import { SIM } from '../config/assets.js';

/**
 * 水电站水力-发电仿真核心（公式推导见 docs/SIMULATION.md）
 *
 * 状态量：
 *  - upLevel / downLevel  上、下游水位 (m)
 *  - gateOpen[5]          5 孔溢流闸门开度 0~1
 *  - guideVane            导叶开度 0~1
 *  - mode                 'generation' | 'flood' | 'maintenance'
 *
 * 输出量：
 *  - head 水头 / qGen 发电流量 / qSpill 泄洪流量 / power 出力 MW / rpm 机组转速
 */
export class Simulation {
  constructor() {
    this.mode = 'generation';
    this.upLevel = 48;
    this.downLevel = 6;
    this.gateOpen = [0, 0, 0, 0, 0];
    this.guideVane = 0.8;

    // 输出（平滑后）
    this.head = 0; this.qGen = 0; this.qSpill = 0;
    this.power = 0; this.rpm = 0; this.efficiency = SIM.ETA;

    this._listeners = [];
  }

  onChange(fn) { this._listeners.push(fn); }
  _emit() { for (const fn of this._listeners) fn(this); }

  /** 工况切换：联动闸门/导叶到典型开度 */
  setMode(mode) {
    this.mode = mode;
    switch (mode) {
      case 'generation':   // 发电工况：机组带负荷，表孔关闭
        this.guideVane = 0.8;
        this.gateOpen.fill(0);
        break;
      case 'flood':        // 泄洪工况：表孔全开 70%，机组减负荷
        this.guideVane = 0.35;
        this.gateOpen.fill(0.7);
        break;
      case 'maintenance':  // 检修工况：停机、落门、断流
        this.guideVane = 0;
        this.gateOpen.fill(0);
        break;
    }
    this._emit();
  }

  setUpLevel(v) { this.upLevel = v; this._emit(); }
  setDownLevel(v) { this.downLevel = v; this._emit(); }
  setGuideVane(v) { this.guideVane = v; this._emit(); }
  setAllGates(v) { this.gateOpen.fill(v); this._emit(); }
  setGate(i, v) { this.gateOpen[i] = v; this._emit(); }

  /** 每帧推进：水力计算 + 水位动态积分 + 机械量平滑 */
  update(dt) {
    const S = SIM;
    const head = Math.max(this.upLevel - this.downLevel, 0);

    // ---- 发电流量：Q = Σ q_unit，单机 q = 导叶开度 × Qmax × √(H/Hr) ----
    const headRatio = Math.sqrt(Math.min(head / S.RATED_HEAD, 1.3));
    const qUnit = this.mode === 'maintenance' ? 0
      : this.guideVane * S.Q_MAX_UNIT * headRatio;
    const qGen = qUnit * S.UNITS;

    // ---- 机组出力：P = ρgQHη / 1e6 (MW) ----
    const power = S.RHO * S.G * qGen * head * S.ETA / 1e6;

    // ---- 泄洪流量（宽顶堰自由出流近似）：Q = C·B·e·√(2gH)，e=开度×孔高 ----
    let qSpill = 0;
    const hAboveSill = Math.max(this.upLevel - 47, 0);   // 堰上水头（堰顶 47m）
    for (const open of this.gateOpen) {
      const e = open * S.SPILL_HOLE_H;
      qSpill += S.SPILL_C * S.SPILL_B * e * Math.sqrt(2 * S.G * Math.max(hAboveSill - e / 2, 0));
    }

    // ---- 水库水位动态：dV/dt = Qin − Qout，V = A·H ----
    const qOut = qGen + qSpill;
    const dH = (S.INFLOW - qOut) * dt / S.RESERVOIR_AREA;
    this.upLevel = clamp(this.upLevel + dH, S.UP_LEVEL_MIN, S.UP_LEVEL_MAX);

    // ---- 机组转速：发电时随负荷微调，检修时惰走到 0（一阶惯性）----
    const loadRatio = power / S.RATED_POWER;
    const rpmTarget = this.mode === 'maintenance' ? 0
      : S.RATED_RPM * (0.55 + 0.45 * Math.min(loadRatio * 1.4, 1));
    this.rpm += (rpmTarget - this.rpm) * Math.min(dt * 0.8, 1);

    // ---- 输出平滑（避免面板数字跳动）----
    const k = Math.min(dt * 5, 1);
    this.head += (head - this.head) * k;
    this.qGen += (qGen - this.qGen) * k;
    this.qSpill += (qSpill - this.qSpill) * k;
    this.power += (power - this.power) * k;

    this._emit();
  }
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

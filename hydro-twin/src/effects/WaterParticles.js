import * as THREE from 'three';

/**
 * 水流粒子系统（CPU 对象池 + 单 Points 绘制调用）
 * 性能：固定容量 4000 粒子，一次 draw call；死亡粒子复用，无 GC 压力。
 *
 * 发射器类型：
 *  - spill   溢流孔挑流（重力抛物线，落入下游）
 *  - outlet  泄洪深孔射流
 *  - tailrace 尾水出流（水平缓流）
 */
const MAX = 4000;

export class WaterParticles {
  constructor(scene) {
    this._pos = new Float32Array(MAX * 3);
    this._vel = new Float32Array(MAX * 3);
    this._life = new Float32Array(MAX);      // 剩余寿命，<=0 为空闲
    this._cursor = 0;
    this._emitters = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this._pos, 3));
    // 初始全部隐藏到地下
    for (let i = 0; i < MAX; i++) this._pos[i * 3 + 1] = -999;

    const mat = new THREE.PointsMaterial({
      color: 0xbfe8ff, size: 0.9, sizeAttenuation: true,
      transparent: true, opacity: 0.75, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;   // 粒子散布范围大，跳过包围球剔除
    scene.add(this.points);
  }

  /**
   * 注册发射器
   * @returns 发射器对象，运行时修改其 intensity (0~1) 控制流量
   */
  addEmitter({ pos, dir, speed, spread = 0.15, rate = 300, life = 2.2, gravity = -9.8 }) {
    const e = {
      pos: new THREE.Vector3(...pos),
      dir: new THREE.Vector3(...dir).normalize(),
      speed, spread, rate, life, gravity,
      intensity: 0, _acc: 0,
    };
    this._emitters.push(e);
    return e;
  }

  update(dt) {
    // ---- 发射 ----
    for (const e of this._emitters) {
      if (e.intensity <= 0.01) continue;
      e._acc += e.rate * e.intensity * dt;
      while (e._acc >= 1) {
        e._acc -= 1;
        this._spawn(e);
      }
    }
    // ---- 积分 & 回收 ----
    for (let i = 0; i < MAX; i++) {
      if (this._life[i] <= 0) continue;
      this._life[i] -= dt;
      const i3 = i * 3;
      if (this._life[i] <= 0 || this._pos[i3 + 1] < -2) {
        this._pos[i3 + 1] = -999;   // 隐藏
        this._life[i] = 0;
        continue;
      }
      // 简单重力积分（按粒子所属发射器重力近似统一 -9.8）
      this._vel[i3 + 1] -= 9.8 * dt;
      this._pos[i3] += this._vel[i3] * dt;
      this._pos[i3 + 1] += this._vel[i3 + 1] * dt;
      this._pos[i3 + 2] += this._vel[i3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  _spawn(e) {
    // 环形缓冲找空位
    let i = this._cursor;
    this._cursor = (this._cursor + 1) % MAX;
    const i3 = i * 3;
    const r = () => (Math.random() - 0.5) * 2;
    this._pos[i3] = e.pos.x + r() * 2;
    this._pos[i3 + 1] = e.pos.y + r() * 1;
    this._pos[i3 + 2] = e.pos.z + r() * 2;
    const s = e.speed * (0.85 + Math.random() * 0.3);
    this._vel[i3] = (e.dir.x + r() * e.spread) * s;
    this._vel[i3 + 1] = (e.dir.y + r() * e.spread) * s;
    this._vel[i3 + 2] = (e.dir.z + r() * e.spread) * s;
    this._life[i] = e.life * (0.7 + Math.random() * 0.6);
  }
}

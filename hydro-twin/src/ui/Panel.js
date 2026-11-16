/**
 * 右侧控制面板：视图控制 / 工况切换 / 水位与闸门调节 / 发电数据监视
 * 纯 DOM 实现，通过回调与 3D 场景解耦。
 */
export class Panel {
  /**
   * @param {Object} actions 由 main.js 注入的动作集合
   */
  constructor(actions) {
    this.a = actions;
    this.el = document.getElementById('panel');
    this._build();
  }

  _build() {
    this.el.innerHTML = `
      <h3>视 图 控 制</h3>
      <div class="ctl-row"><label>剖切透视</label>
        <span class="switch"><input type="checkbox" id="sw-clip"><span class="track"></span></span></div>
      <div class="ctl-row"><label>剖面位置</label>
        <input type="range" id="rg-clip" min="-80" max="120" value="0"><output id="out-clip">0</output></div>
      <div class="ctl-row"><label>线框模式</label>
        <span class="switch"><input type="checkbox" id="sw-wire"><span class="track"></span></span></div>
      <div class="ctl-row"><label>透明模式</label>
        <span class="switch"><input type="checkbox" id="sw-trans"><span class="track"></span></span></div>
      <div class="ctl-row"><label>爆炸拆解</label>
        <input type="range" id="rg-explode" min="0" max="100" value="0"><output id="out-explode">0%</output></div>
      <div class="btn-group">
        <button id="btn-orbit" class="active">轨道相机</button>
        <button id="btn-fly">自由漫游</button>
      </div>
      <button class="ctl-btn" id="btn-reset">视角复位</button>

      <h3>运 行 工 况</h3>
      <div id="mode-badge">发 电</div>
      <div class="btn-group">
        <button data-mode="generation" class="active">发电</button>
        <button data-mode="flood">泄洪</button>
        <button data-mode="maintenance">检修</button>
      </div>

      <h3>水 位 调 节</h3>
      <div class="ctl-row"><label>上游水位</label>
        <input type="range" id="rg-up" min="30" max="55" step="0.1" value="48"><output id="out-up">48.0m</output></div>
      <div class="ctl-row"><label>下游水位</label>
        <input type="range" id="rg-down" min="2" max="12" step="0.1" value="6"><output id="out-down">6.0m</output></div>

      <h3>闸 门 / 机 组</h3>
      <div class="ctl-row"><label>闸门总开度</label>
        <input type="range" id="rg-gates" min="0" max="100" value="0"><output id="out-gates">0%</output></div>
      <div class="ctl-row"><label>导叶开度</label>
        <input type="range" id="rg-vane" min="0" max="100" value="80"><output id="out-vane">80%</output></div>

      <h3>发 电 监 视</h3>
      <div class="gauge-grid">
        <div class="gauge"><div class="g-label">净水头</div><div class="g-value" id="g-head">0<span class="g-unit">m</span></div></div>
        <div class="gauge"><div class="g-label">发电流量</div><div class="g-value" id="g-qgen">0<span class="g-unit">m³/s</span></div></div>
        <div class="gauge"><div class="g-label">泄洪流量</div><div class="g-value" id="g-qspill">0<span class="g-unit">m³/s</span></div></div>
        <div class="gauge"><div class="g-label">机组转速</div><div class="g-value" id="g-rpm">0<span class="g-unit">r/min</span></div></div>
        <div class="gauge"><div class="g-label">全厂出力</div><div class="g-value" id="g-power">0<span class="g-unit">MW</span></div></div>
        <div class="gauge"><div class="g-label">综合效率</div><div class="g-value" id="g-eta">92<span class="g-unit">%</span></div></div>
      </div>
    `;
    this._bind();
  }

  _bind() {
    const $ = id => this.el.querySelector('#' + id);
    const a = this.a;

    // ---- 视图 ----
    $('sw-clip').addEventListener('change', e => a.setClip(e.target.checked));
    $('rg-clip').addEventListener('input', e => {
      $('out-clip').textContent = e.target.value;
      a.setClipPosition(+e.target.value);
    });
    $('sw-wire').addEventListener('change', e => a.setWireframe(e.target.checked));
    $('sw-trans').addEventListener('change', e => a.setTransparent(e.target.checked));
    $('rg-explode').addEventListener('input', e => {
      $('out-explode').textContent = e.target.value + '%';
      a.setExplode(e.target.value / 100);
    });
    $('btn-orbit').addEventListener('click', () => this._cameraMode('orbit'));
    $('btn-fly').addEventListener('click', () => this._cameraMode('fly'));
    $('btn-reset').addEventListener('click', () => a.resetCamera());

    // ---- 工况 ----
    this.el.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.el.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        const badge = $('mode-badge');
        badge.className = mode === 'flood' ? 'flood' : mode === 'maintenance' ? 'maint' : '';
        badge.textContent = { generation: '发 电', flood: '泄 洪', maintenance: '检 修' }[mode];
        a.setMode(mode);
      });
    });

    // ---- 水位 / 闸门 / 导叶 ----
    $('rg-up').addEventListener('input', e => {
      $('out-up').textContent = (+e.target.value).toFixed(1) + 'm';
      a.setUpLevel(+e.target.value);
    });
    $('rg-down').addEventListener('input', e => {
      $('out-down').textContent = (+e.target.value).toFixed(1) + 'm';
      a.setDownLevel(+e.target.value);
    });
    $('rg-gates').addEventListener('input', e => {
      $('out-gates').textContent = e.target.value + '%';
      a.setAllGates(e.target.value / 100);
    });
    $('rg-vane').addEventListener('input', e => {
      $('out-vane').textContent = e.target.value + '%';
      a.setGuideVane(e.target.value / 100);
    });
  }

  _cameraMode(mode) {
    this.el.querySelector('#btn-orbit').classList.toggle('active', mode === 'orbit');
    this.el.querySelector('#btn-fly').classList.toggle('active', mode === 'fly');
    this.a.setCameraMode(mode);
  }

  /** 由仿真循环每帧调用，刷新监视数据 */
  updateGauges(sim) {
    const $ = id => this.el.querySelector('#' + id);
    $('g-head').innerHTML = `${sim.head.toFixed(1)}<span class="g-unit">m</span>`;
    $('g-qgen').innerHTML = `${sim.qGen.toFixed(0)}<span class="g-unit">m³/s</span>`;
    $('g-qspill').innerHTML = `${sim.qSpill.toFixed(0)}<span class="g-unit">m³/s</span>`;
    $('g-rpm').innerHTML = `${sim.rpm.toFixed(1)}<span class="g-unit">r/min</span>`;
    const p = $('g-power');
    p.innerHTML = `${sim.power.toFixed(1)}<span class="g-unit">MW</span>`;
    p.classList.toggle('warn', sim.power > 300);
    // 水位滑块跟随水库动态（泄洪时水位自动变化）
    const up = this.el.querySelector('#rg-up');
    if (document.activeElement !== up) {
      up.value = sim.upLevel;
      this.el.querySelector('#out-up').textContent = sim.upLevel.toFixed(1) + 'm';
    }
  }
}

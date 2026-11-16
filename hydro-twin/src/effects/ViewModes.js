import * as THREE from 'three';

/**
 * 视图模式管理：剖切透视 / 线框 / 透明 / 爆炸拆解
 * 所有模式可叠加组合。
 */
export class ViewModes {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {Map<string, THREE.Group>} components 构件分组表
   */
  constructor(renderer, components) {
    this.renderer = renderer;
    this.components = components;

    // ---- 剖切平面（沿水流方向 Z 剖切，法线朝 -Z，constant 控制剖面位置）----
    this.clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    this.clipEnabled = false;

    // ---- 爆炸拆解 ----
    this.explodeTarget = 0;   // 目标系数 0~1
    this.explodeValue = 0;    // 当前系数（平滑过渡）

    // ---- 材质模式：缓存原始状态以便恢复 ----
    this._matCache = new Map();  // material → {opacity, transparent, wireframe}
    this._wireframe = false;
    this._transparent = false;
  }

  // ==================== 剖切 ====================
  setClip(enabled) {
    this.clipEnabled = enabled;
    this._applyClip();
  }
  /** pos: 剖面 Z 坐标（-80 ~ 120） */
  setClipPosition(pos) {
    this.clipPlane.constant = pos;
    this._applyClip();
  }
  _applyClip() {
    this.renderer.clippingPlanes = this.clipEnabled ? [this.clipPlane] : [];
  }

  // ==================== 线框 ====================
  setWireframe(on) {
    this._wireframe = on;
    this._traverseMaterials(m => { m.wireframe = on; });
  }

  // ==================== 透明 ====================
  setTransparent(on) {
    this._transparent = on;
    this._traverseMaterials(m => {
      const c = this._cache(m);
      if (on) {
        m.transparent = true;
        m.opacity = Math.min(c.opacity, 0.32);
        m.depthWrite = false;
      } else {
        m.opacity = c.opacity;
        m.transparent = c.transparent;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    });
  }

  // ==================== 爆炸拆解 ====================
  /** t: 0（装配）~ 1（完全拆解），每帧平滑逼近 */
  setExplode(t) { this.explodeTarget = t; }

  /** 每帧调用：爆炸位移平滑插值 */
  update(dt) {
    const diff = this.explodeTarget - this.explodeValue;
    if (Math.abs(diff) < 1e-4) return;
    this.explodeValue += diff * Math.min(dt * 4, 1);   // 指数趋近
    for (const group of this.components.values()) {
      const { basePos, explodeDir } = group.userData;
      if (!explodeDir) continue;
      group.position.copy(basePos).addScaledVector(explodeDir, this.explodeValue);
    }
  }

  // ==================== 内部工具 ====================
  _traverseMaterials(fn) {
    const seen = new Set();
    for (const group of this.components.values()) {
      group.traverse(o => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (seen.has(m)) continue;
          seen.add(m);
          fn(m);
        }
      });
    }
  }

  _cache(m) {
    if (!this._matCache.has(m)) {
      this._matCache.set(m, { opacity: m.opacity, transparent: m.transparent });
    }
    return this._matCache.get(m);
  }
}

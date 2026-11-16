import * as THREE from 'three';

/**
 * 构件拾取器：点击构件高亮并弹出参数卡片
 */
export class Inspector {
  /**
   * @param {THREE.Camera} camera
   * @param {Map<string, THREE.Group>} components
   * @param {HTMLElement} domElement 渲染画布
   */
  constructor(camera, components, domElement) {
    this.camera = camera;
    this.components = components;
    this.el = document.getElementById('inspector');
    this._ray = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._selected = null;
    this._highlighted = [];   // 被修改过 emissive 的材质，用于恢复

    domElement.addEventListener('pointerdown', e => {
      // 拖拽旋转视角时不触发拾取（位移小于阈值才算点击）
      this._downX = e.clientX; this._downY = e.clientY;
    });
    domElement.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - this._downX, e.clientY - this._downY) > 5) return;
      this._pick(e);
    });

    this.el.querySelector?.('.close')?.addEventListener('click', () => this.clear());
  }

  _pick(e) {
    this._pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    this._ray.setFromCamera(this._pointer, this.camera);
    const hits = this._ray.intersectObjects([...this.components.values()], true);
    if (!hits.length) { this.clear(); return; }

    // 向上查找所属构件分组
    let node = hits[0].object;
    while (node && !node.userData?.id) node = node.parent;
    if (!node) { this.clear(); return; }
    this._select(node);
  }

  _select(group) {
    this.clear();
    this._selected = group;
    // 高亮：给所有材质加自发光
    group.traverse(o => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!('emissive' in m)) continue;
        this._highlighted.push([m, m.emissive.getHex()]);
        m.emissive.setHex(0x1a4a66);
      }
    });
    // 填充参数卡片
    const { title, info } = group.userData;
    const rows = Object.entries(info)
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    this.el.innerHTML = `<h4>${title}<span class="close" id="insp-close">✕</span></h4><table>${rows}</table>`;
    this.el.classList.remove('hidden');
    this.el.querySelector('#insp-close').addEventListener('click', () => this.clear());
  }

  clear() {
    for (const [m, hex] of this._highlighted) m.emissive.setHex(hex);
    this._highlighted = [];
    this._selected = null;
    this.el.classList.add('hidden');
  }
}

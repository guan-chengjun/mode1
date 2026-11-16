import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * 渲染引擎核心：渲染器 / 场景 / 相机 / 灯光 / 主循环
 * 性能策略：
 *  - 像素比上限 2，避免高分屏过度绘制
 *  - PCFSoft 阴影 + 单方向光，控制阴影开销
 *  - RoomEnvironment 生成 PMREM 环境贴图，一次烘焙全局复用（PBR 反射）
 */
export class Engine {
  constructor(container) {
    // ---------- 渲染器 ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;   // 电影级色调映射
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;               // 开启局部剖切支持
    container.appendChild(this.renderer.domElement);

    // ---------- 场景 ----------
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1622);
    this.scene.fog = new THREE.Fog(0x0d1622, 350, 1400);

    // PBR 环境反射（一次性生成，所有 MeshStandardMaterial 共享）
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // ---------- 相机 ----------
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 3000);
    this.camera.position.set(170, 130, 240);

    // ---------- 灯光 ----------
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x2a2620, 0.55);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2e0, 2.2);
    sun.position.set(220, 320, 160);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // 阴影相机范围覆盖整个枢纽区
    Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 50, far: 900 });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    // 补光（冷色，模拟天光反射）
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
    fill.position.set(-180, 120, -220);
    this.scene.add(fill);

    // ---------- 主循环 ----------
    this._updaters = [];
    this._clock = new THREE.Clock();
    this._fpsEl = document.getElementById('fps');
    this._frames = 0; this._fpsTime = 0;

    window.addEventListener('resize', () => this._onResize());
  }

  /** 注册每帧更新回调 fn(dt, elapsed) */
  onUpdate(fn) { this._updaters.push(fn); }

  start() {
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this._clock.getDelta(), 0.05); // 钳制 dt，防止切后台后跳变
      const t = this._clock.elapsedTime;
      for (const fn of this._updaters) fn(dt, t);
      this.renderer.render(this.scene, this.camera);
      // FPS 统计（每 0.5s 刷新一次）
      this._frames++; this._fpsTime += dt;
      if (this._fpsTime >= 0.5 && this._fpsEl) {
        this._fpsEl.textContent = `${Math.round(this._frames / this._fpsTime)} FPS`;
        this._frames = 0; this._fpsTime = 0;
      }
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

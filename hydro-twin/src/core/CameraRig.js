import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

/**
 * 相机装置：轨道相机(Orbit) 与 自由漫游(Fly) 双模式切换
 *  - Orbit：围绕枢纽旋转/缩放/平移（默认）
 *  - Fly  ：指针锁定第一人称漫游，WASD 移动，QE 升降，Shift 加速
 */
export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.mode = 'orbit';

    // ---- 轨道模式 ----
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.target.set(0, 30, 20);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.maxPolarAngle = Math.PI * 0.495;  // 不允许钻到地面以下
    this.orbit.minDistance = 20;
    this.orbit.maxDistance = 900;

    // ---- 漫游模式 ----
    this.fly = new PointerLockControls(camera, domElement);
    this._keys = new Set();
    this._speed = 40; // m/s

    document.addEventListener('keydown', e => this._keys.add(e.code));
    document.addEventListener('keyup', e => this._keys.delete(e.code));
    this.fly.addEventListener('unlock', () => { if (this.mode === 'fly') this.setMode('orbit'); });

    this._tip = document.getElementById('fly-tip');
  }

  /** 切换相机模式 'orbit' | 'fly' */
  setMode(mode) {
    this.mode = mode;
    const flying = mode === 'fly';
    this.orbit.enabled = !flying;
    this._tip?.classList.toggle('hidden', !flying);
    if (flying) {
      // 从当前视角进入漫游
      this.fly.lock();
    } else if (this.fly.isLocked) {
      this.fly.unlock();
    }
  }

  update(dt) {
    if (this.mode === 'orbit') {
      this.orbit.update();
      return;
    }
    if (!this.fly.isLocked) return;
    // 第一人称移动（相机局部坐标系）
    const v = new THREE.Vector3();
    const k = this._keys;
    const boost = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 3 : 1;
    if (k.has('KeyW')) v.z -= 1;
    if (k.has('KeyS')) v.z += 1;
    if (k.has('KeyA')) v.x -= 1;
    if (k.has('KeyD')) v.x += 1;
    if (v.lengthSq() > 0) {
      v.normalize().multiplyScalar(this._speed * boost * dt);
      this.fly.moveRight(v.x);
      this.fly.moveForward(-v.z);
    }
    if (k.has('KeyQ')) this.camera.position.y -= this._speed * boost * dt;
    if (k.has('KeyE')) this.camera.position.y += this._speed * boost * dt;
    // 防止穿出地面
    if (this.camera.position.y < 2) this.camera.position.y = 2;
  }
}

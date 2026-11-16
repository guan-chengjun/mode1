import { Engine } from './core/Engine.js';
import { CameraRig } from './core/CameraRig.js';
import { SceneBuilder } from './world/SceneBuilder.js';
import { ViewModes } from './effects/ViewModes.js';
import { WaterParticles } from './effects/WaterParticles.js';
import { Simulation } from './sim/Simulation.js';
import { Panel } from './ui/Panel.js';
import { Inspector } from './ui/Inspector.js';

/**
 * 应用装配入口：引擎 → 场景 → 特效 → 仿真 → UI
 */
async function main() {
  // ---------- 引擎与相机 ----------
  const engine = new Engine(document.getElementById('viewport'));
  const rig = new CameraRig(engine.camera, engine.renderer.domElement);

  // ---------- 场景装配（远程 GLB / 程序化回退） ----------
  const builder = new SceneBuilder(engine.scene);
  await builder.build();
  const { components, dynamic } = builder;

  // ---------- 视图特效 ----------
  const viewModes = new ViewModes(engine.renderer, components);

  // ---------- 水流粒子 ----------
  const particles = new WaterParticles(engine.scene);
  // 溢流孔：5 孔挑流发射器（与闸门位置对应）
  const spillEmitters = [-34.4, -17.2, 0, 17.2, 34.4].map(x =>
    particles.addEmitter({ pos: [x, 50, -8], dir: [0, -0.25, 1], speed: 16, rate: 260, life: 2.6 }));
  // 泄洪深孔：2 孔
  const outletEmitters = [-30, 30].map(x =>
    particles.addEmitter({ pos: [x, 24, 24], dir: [0, -0.1, 1], speed: 22, rate: 200, life: 2.2 }));
  // 尾水出流
  const tailEmitter = particles.addEmitter({ pos: [0, 4, 54], dir: [0, 0.05, 1], speed: 7, spread: 0.3, rate: 240, life: 3.5 });

  // ---------- 仿真核心 ----------
  const sim = new Simulation();

  // ---------- UI ----------
  const panel = new Panel({
    setClip:        v => viewModes.setClip(v),
    setClipPosition: v => viewModes.setClipPosition(v),
    setWireframe:   v => viewModes.setWireframe(v),
    setTransparent: v => viewModes.setTransparent(v),
    setExplode:     v => viewModes.setExplode(v),
    setCameraMode:  m => rig.setMode(m),
    resetCamera:    () => { rig.setMode('orbit'); engine.camera.position.set(170, 130, 240); rig.orbit.target.set(0, 30, 20); },
    setMode:        m => sim.setMode(m),
    setUpLevel:     v => sim.setUpLevel(v),
    setDownLevel:   v => sim.setDownLevel(v),
    setAllGates:    v => sim.setAllGates(v),
    setGuideVane:   v => sim.setGuideVane(v),
  });
  const inspector = new Inspector(engine.camera, components, engine.renderer.domElement);

  // ---------- 主循环：仿真 → 场景联动 → 渲染 ----------
  engine.onUpdate((dt, t) => {
    sim.update(dt);

    // 闸门升降（开度 → 提升高度，最大 8m）
    dynamic.gates.forEach((gate, i) => {
      const targetY = gate.userData.baseY + sim.gateOpen[i] * 8;
      gate.position.y += (targetY - gate.position.y) * Math.min(dt * 3, 1);
    });

    // 水轮机转子旋转（rpm → rad/s）
    if (dynamic.rotor) dynamic.rotor.rotation.y += sim.rpm * Math.PI / 30 * dt;

    // 水位联动水面高度
    if (dynamic.waterUp) dynamic.waterUp.position.y = sim.upLevel;
    if (dynamic.waterDown) dynamic.waterDown.position.y = sim.downLevel;
    // 水面微波动
    if (dynamic.waterUp) dynamic.waterUp.position.y += Math.sin(t * 0.8) * 0.06;

    // 粒子发射强度联动
    spillEmitters.forEach((e, i) => { e.intensity = sim.gateOpen[i] * (sim.upLevel > 47 ? 1 : 0.15); });
    outletEmitters.forEach(e => { e.intensity = sim.mode === 'flood' ? 0.8 : 0; });
    tailEmitter.intensity = sim.qGen / 900;

    particles.update(dt);
    viewModes.update(dt);
    rig.update(dt);
    panel.updateGauges(sim);
  });

  engine.start();

  // 隐藏加载遮罩
  const loading = document.getElementById('loading');
  loading.classList.add('fade');
  setTimeout(() => loading.remove(), 600);
}

main().catch(err => {
  console.error('应用初始化失败:', err);
  const el = document.getElementById('loading');
  if (el) el.innerHTML = `<p style="color:#f87171">初始化失败：${err.message}</p>`;
});

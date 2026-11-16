import * as THREE from 'three';

// ============================================================================
//  程序化构件模型库
//  坐标约定：坝轴沿 X 方向，水流沿 +Z（上游 -Z → 下游 +Z），Y 为高程。
//  每个 builder 返回一个 THREE.Group，供 ModelLoader 在无远程模型时回退使用。
//  材质全部为 MeshStandardMaterial（PBR），共享 Engine 提供的环境贴图。
// ============================================================================

// ---------- 共享材质（模块级缓存，避免重复创建） ----------
export const MAT = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.92, metalness: 0.02 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x7c848c, roughness: 0.95, metalness: 0.02 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8f9aa6, roughness: 0.32, metalness: 0.9 }),
  steelPaint: new THREE.MeshStandardMaterial({ color: 0x2e6f9e, roughness: 0.45, metalness: 0.6 }),
  gateRed: new THREE.MeshStandardMaterial({ color: 0xa03a2e, roughness: 0.5, metalness: 0.55 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.95 }),
  rotor: new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.3, metalness: 0.85 }),
  building: new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.8, metalness: 0.05 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x3d5a73, roughness: 0.6, metalness: 0.3 }),
  water: new THREE.MeshPhysicalMaterial({
    color: 0x1b6a96, roughness: 0.08, metalness: 0.0,
    transparent: true, opacity: 0.82, envMapIntensity: 1.2,
  }),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}

// ============================================================================
// 山体地形：平面网格 + 河谷地形函数 + 顶点色
// ============================================================================
export function buildTerrain() {
  const g = new THREE.Group();
  const size = 800, seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cRock = new THREE.Color(0x6b6257), cGrass = new THREE.Color(0x4a6b3a), cBed = new THREE.Color(0x5a5348);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    // 河谷：沿 Z 轴为河道，|x| 越大山体越高；叠加分形起伏
    const valley = Math.pow(Math.min(Math.abs(x) / 260, 1), 1.8) * 110;
    const noise = Math.sin(x * 0.045) * Math.cos(z * 0.05) * 6
                + Math.sin(x * 0.013 + z * 0.017) * 10;
    let h = valley + noise * Math.min(Math.abs(x) / 120, 1);
    // 河道底部压平
    if (Math.abs(x) < 45) h = Math.max(h, 0) * 0.05;
    pos.setY(i, h);

    // 顶点色：河床→岩石→植被
    const t = THREE.MathUtils.clamp(h / 90, 0, 1);
    tmp.copy(cBed).lerp(cRock, Math.min(t * 2.5, 1)).lerp(cGrass, Math.max(0, t - 0.25) * 1.2);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0, metalness: 0 });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  g.add(m);
  return g;
}

// ============================================================================
// 混凝土重力坝：梯形断面沿坝轴拉伸
// ============================================================================
export function buildDam() {
  const g = new THREE.Group();
  // 断面（z-y 平面）：上游面垂直，下游面 1:0.75 斜坡
  const shape = new THREE.Shape();
  shape.moveTo(-22, 0);    // 上游坝踵
  shape.lineTo(-22, 55);   // 上游坝面
  shape.lineTo(-12, 55);   // 坝顶
  shape.lineTo(28, 0);     // 下游坝坡
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 130, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);   // 挤出方向 Z → X（坝轴）
  geo.translate(65, 0, 0);
  g.add(mesh(geo, MAT.concrete));

  // 坝顶防浪墙 + 公路
  g.add(mesh(new THREE.BoxGeometry(130, 2.5, 1), MAT.concreteDark, 0, 56.2, -21.5));
  g.add(mesh(new THREE.BoxGeometry(130, 0.3, 9), MAT.concreteDark, 0, 55.15, -17));
  return g;
}

// ============================================================================
// 溢流孔（表孔）：5 孔溢流堰面 + 闸墩 + 挑流鼻坎
// ============================================================================
export function buildSpillway() {
  const g = new THREE.Group();
  // 溢流面（斜坡滑道，贴合坝下游面）
  const chute = mesh(new THREE.BoxGeometry(86, 2, 46), MAT.concreteDark, 0, 26, 12);
  chute.rotation.x = -Math.atan2(55, 40) * 0.82;
  g.add(chute);
  // 挑流鼻坎
  const lip = mesh(new THREE.BoxGeometry(86, 3, 6), MAT.concrete, 0, 3.5, 34);
  lip.rotation.x = 0.35;
  g.add(lip);
  // 闸墩（6 个，分隔 5 孔）
  for (let i = 0; i < 6; i++) {
    g.add(mesh(new THREE.BoxGeometry(2.4, 10, 12), MAT.concrete, -43 + i * 17.2, 60, -14));
  }
  return g;
}

// ============================================================================
// 泄洪孔（深孔）：坝身中部 2 个矩形孔口 + 出口挑坎
// ============================================================================
export function buildOutlet() {
  const g = new THREE.Group();
  for (const x of [-30, 30]) {
    // 孔口边框（示意深孔进口）
    g.add(mesh(new THREE.BoxGeometry(8, 8.5, 2), MAT.concreteDark, x, 25, -21.5));
    g.add(mesh(new THREE.BoxGeometry(6, 7, 2.4), new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 1 }), x, 25, -21.6));
    // 出口挑坎
    const lip = mesh(new THREE.BoxGeometry(7, 2, 8), MAT.concrete, x, 22, 27);
    lip.rotation.x = 0.3;
    g.add(lip);
  }
  return g;
}

// ============================================================================
// 闸门组：5 扇弧形工作门（可独立升降，userData.gateIndex 标记）
// ============================================================================
export function buildGates() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const gate = mesh(new THREE.BoxGeometry(14.5, 9, 1.2), MAT.gateRed, -34.4 + i * 17.2, 51.5, -14);
    gate.userData.gateIndex = i;          // 供仿真联动升降
    gate.userData.baseY = 51.5;
    // 门顶启闭机排架
    const hoist = mesh(new THREE.BoxGeometry(4, 3, 3), MAT.steelPaint, -34.4 + i * 17.2, 66.5, -14);
    g.add(gate, hoist);
  }
  return g;
}

// ============================================================================
// 上游库区 / 下游河道 水面（平面，水位由仿真驱动 y 坐标）
// ============================================================================
export function buildReservoirUp() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(560, 320, 48, 32);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, MAT.water.clone());
  m.position.set(0, 48, -180);
  m.receiveShadow = true;
  m.userData.isWaterSurface = true;
  g.add(m);
  return g;
}

export function buildReservoirDown() {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(88, 340, 16, 48);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, MAT.water.clone());
  m.position.set(0, 6, 210);
  m.receiveShadow = true;
  m.userData.isWaterSurface = true;
  g.add(m);
  return g;
}

// ============================================================================
// 引水隧洞：左岸山体内圆形有压洞（洞口 + 洞身示意）
// ============================================================================
export function buildTunnel() {
  const g = new THREE.Group();
  // 洞身（斜穿左岸山体，连接库区与压力钢管）
  const body = mesh(new THREE.CylinderGeometry(4.5, 4.5, 150, 24, 1, true), MAT.concreteDark, -105, 28, -60);
  body.rotation.z = Math.PI / 2.15;
  body.rotation.y = 0.5;
  g.add(body);
  // 进口塔
  g.add(mesh(new THREE.BoxGeometry(12, 30, 12), MAT.concrete, -160, 30, -85));
  g.add(mesh(new THREE.CylinderGeometry(5, 5, 3, 24), new THREE.MeshStandardMaterial({ color: 0x0c141c, roughness: 1 }), -160, 18, -79));
  return g;
}

// ============================================================================
// 压力钢管：3 条明管，从坝上游面斜铺至厂房
// ============================================================================
export function buildPenstock() {
  const g = new THREE.Group();
  for (const x of [-20, 0, 20]) {
    // 倾斜段
    const len = Math.hypot(42, 26);
    const pipe = mesh(new THREE.CylinderGeometry(3.5, 3.5, len, 20), MAT.steelPaint, x, 20, 0);
    pipe.rotation.x = Math.atan2(26, 42) + Math.PI / 2;
    pipe.position.set(x, 20, 4);
    g.add(pipe);
    // 镇墩
    g.add(mesh(new THREE.BoxGeometry(10, 6, 8), MAT.concrete, x, 3, 16));
  }
  return g;
}

// ============================================================================
// 水轮发电机组：蜗壳 + 转轮(旋转部件) + 主轴 + 发电机
// 转子部分放入 userData.rotor，仿真驱动其旋转
// ============================================================================
export function buildTurbine() {
  const g = new THREE.Group();
  const rotor = new THREE.Group();

  for (const x of [-20, 0, 20]) {
    // 蜗壳（圆环近似）
    const volute = mesh(new THREE.TorusGeometry(4.2, 1.8, 12, 28), MAT.steel, x, 8, 36);
    volute.rotation.x = Math.PI / 2;
    g.add(volute);
    // 转轮（旋转部件）
    const runner = new THREE.Group();
    const hub = mesh(new THREE.CylinderGeometry(1.2, 2.2, 2.4, 16), MAT.rotor, 0, 0, 0);
    runner.add(hub);
    for (let b = 0; b < 6; b++) {  // 6 叶片示意
      const blade = mesh(new THREE.BoxGeometry(0.3, 1.6, 2.6), MAT.rotor, 0, 0, 0);
      blade.position.set(Math.cos(b / 6 * Math.PI * 2) * 1.6, 0, Math.sin(b / 6 * Math.PI * 2) * 1.6);
      blade.rotation.y = -b / 6 * Math.PI * 2 + 0.5;
      runner.add(blade);
    }
    runner.position.set(x, 8, 36);
    rotor.add(runner);
    // 主轴 + 发电机转子
    const shaft = mesh(new THREE.CylinderGeometry(0.7, 0.7, 10, 12), MAT.rotor, x, 14, 36);
    const genRotor = mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 20), MAT.copper, x, 18, 36);
    rotor.add(shaft, genRotor);
    // 发电机定子外壳（不转）
    g.add(mesh(new THREE.CylinderGeometry(3.4, 3.4, 4.5, 20, 1, true), MAT.steelPaint, x, 18, 36));
  }
  g.userData.rotor = rotor;   // ← 仿真旋转此组
  g.add(rotor);
  return g;
}

// ============================================================================
// 厂房：河床式主厂房 + 装配场 + 屋顶
// ============================================================================
export function buildPowerhouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(64, 22, 24), MAT.building, 0, 11, 40));
  g.add(mesh(new THREE.BoxGeometry(66, 1.5, 26), MAT.roof, 0, 22.7, 40));
  // 装配场段
  g.add(mesh(new THREE.BoxGeometry(18, 16, 24), MAT.building, 41, 8, 40));
  // 大门、通风窗示意
  g.add(mesh(new THREE.BoxGeometry(10, 9, 0.5), MAT.steelPaint, 41, 4.5, 52.2));
  for (let i = 0; i < 5; i++) {
    g.add(mesh(new THREE.BoxGeometry(6, 3, 0.4), new THREE.MeshStandardMaterial({ color: 0x274b63, roughness: 0.2, metalness: 0.4 }), -24 + i * 12, 15, 52.2));
  }
  return g;
}

// ============================================================================
// 升压站：平台 + 主变 + 门型构架 + 避雷针
// ============================================================================
export function buildSwitchyard() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(56, 2, 40), MAT.concreteDark, 95, 1, 45));
  for (let i = 0; i < 3; i++) {
    // 主变压器
    g.add(mesh(new THREE.BoxGeometry(7, 6, 5), MAT.steelPaint, 80 + i * 15, 5, 38));
    g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 8), MAT.copper, 80 + i * 15, 10.5, 38));
  }
  // 门型构架
  for (const x of [76, 96, 116]) {
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 8), MAT.steel, x, 9, 58));
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 14, 8), MAT.steel, x + 8, 9, 58));
    const beam = mesh(new THREE.CylinderGeometry(0.25, 0.25, 8.6, 8), MAT.steel, x + 4, 16, 58);
    beam.rotation.z = Math.PI / 2;
    g.add(beam);
  }
  // 避雷针
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.4, 22, 6), MAT.steel, 70, 13, 30));
  return g;
}

// ============================================================================
// 尾水渠：梯形渠道（下游河道衔接段）
// ============================================================================
export function buildTailrace() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-30, 0); shape.lineTo(-24, 4); shape.lineTo(24, 4); shape.lineTo(30, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 110, bevelEnabled: false });
  // 断面已在 X-Y 平面立起，挤出方向即 +Z（水流方向），直接平移到厂房下游
  geo.translate(0, 0, 55);
  const m = new THREE.Mesh(geo, MAT.concreteDark);
  m.receiveShadow = true;
  g.add(m);
  return g;
}

// ============================================================================
// 构件注册表：id → { builder, explodeDir, 说明 }
// explodeDir 为爆炸拆解视图中该组的位移方向（已含距离系数）
// ============================================================================
export const COMPONENT_DEFS = [
  { id: 'terrain',       builder: buildTerrain,       explodeDir: [0, 0, 0] },
  { id: 'gravityDam',    builder: buildDam,           explodeDir: [0, 0, 0] },
  { id: 'spillway',      builder: buildSpillway,      explodeDir: [0, 14, 30] },
  { id: 'outlet',        builder: buildOutlet,        explodeDir: [0, -6, 22] },
  { id: 'gates',         builder: buildGates,         explodeDir: [0, 34, 0] },
  { id: 'reservoirUp',   builder: buildReservoirUp,   explodeDir: [0, 0, 0] },
  { id: 'reservoirDown', builder: buildReservoirDown, explodeDir: [0, 0, 0] },
  { id: 'tunnel',        builder: buildTunnel,        explodeDir: [-40, 10, 0] },
  { id: 'penstock',      builder: buildPenstock,      explodeDir: [0, 22, -14] },
  { id: 'turbine',       builder: buildTurbine,       explodeDir: [0, -18, 26] },
  { id: 'powerhouse',    builder: buildPowerhouse,    explodeDir: [0, 30, 20] },
  { id: 'switchyard',    builder: buildSwitchyard,    explodeDir: [46, 16, 0] },
  { id: 'tailrace',      builder: buildTailrace,      explodeDir: [0, 0, 40] },
];

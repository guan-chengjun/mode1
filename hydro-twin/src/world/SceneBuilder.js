import * as THREE from 'three';
import { MODEL_URLS, COMPONENT_META } from '../config/assets.js';
import { COMPONENT_DEFS } from './components.js';
import { ModelLoader } from '../core/ModelLoader.js';

/**
 * 场景装配器：
 *  - 按 COMPONENT_DEFS 逐个加载（远程 GLB 或程序化回退）
 *  - 每个构件独立分组，写入 userData（id / 参数 / 爆炸方向 / 原始位置）
 *  - 收集仿真需要操作的动态对象（闸门、转子、水面）
 */
export class SceneBuilder {
  constructor(scene) {
    this.scene = scene;
    this.loader = new ModelLoader();
    /** @type {Map<string, THREE.Group>} 构件 id → 分组 */
    this.components = new Map();
    /** 动态对象引用，供 Simulation / ViewModes 使用 */
    this.dynamic = { gates: [], rotor: null, waterUp: null, waterDown: null };
  }

  async build() {
    const root = new THREE.Group();
    root.name = 'HydropowerPlant';

    // 并发加载全部构件
    await Promise.all(COMPONENT_DEFS.map(async def => {
      const model = await this.loader.load(MODEL_URLS[def.id], def.builder);
      const group = new THREE.Group();
      group.name = def.id;
      group.add(model);
      group.userData = {
        id: def.id,
        title: COMPONENT_META[def.id]?.title ?? def.id,
        info: COMPONENT_META[def.id]?.info ?? {},
        explodeDir: new THREE.Vector3(...def.explodeDir),
        basePos: new THREE.Vector3(),   // 爆炸视图基准位置
      };
      this.components.set(def.id, group);
      root.add(group);
      this._collectDynamic(def.id, group);
    }));

    this.scene.add(root);
    return root;
  }

  /** 从构件组中提取仿真需要驱动的对象 */
  _collectDynamic(id, group) {
    switch (id) {
      case 'gates':
        group.traverse(o => { if (o.userData.gateIndex !== undefined) this.dynamic.gates.push(o); });
        this.dynamic.gates.sort((a, b) => a.userData.gateIndex - b.userData.gateIndex);
        break;
      case 'turbine': {
        // 程序化模型在 userData.rotor；GLB 模型按命名约定查找 "Rotor"
        let rotor = null;
        group.traverse(o => { if (o.userData.rotor) rotor = o.userData.rotor; });
        if (!rotor) rotor = group.getObjectByName('Rotor') ?? null;
        this.dynamic.rotor = rotor;
        break;
      }
      case 'reservoirUp':
        group.traverse(o => { if (o.userData.isWaterSurface) this.dynamic.waterUp = o; });
        break;
      case 'reservoirDown':
        group.traverse(o => { if (o.userData.isWaterSurface) this.dynamic.waterDown = o; });
        break;
    }
  }
}

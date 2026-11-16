import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * 模型加载器：
 *  - 优先加载 config 中配置的远程 GLB；
 *  - 加载失败 / 未配置时回退到内置程序化几何（保证场景永远完整可用）。
 */
export class ModelLoader {
  constructor() {
    this._loader = new GLTFLoader();
    // 如需 Draco 压缩模型，取消下面注释并安装 three/examples 自带解码器路径：
    // import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
    // const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    // this._loader.setDRACOLoader(draco);
  }

  /**
   * @param {string} url        远程/本地 GLB 地址（空串则直接用回退）
   * @param {() => THREE.Group} fallback 程序化几何构建函数
   * @returns {Promise<THREE.Group>}
   */
  async load(url, fallback) {
    if (url) {
      try {
        const gltf = await this._loader.loadAsync(url);
        const model = gltf.scene;
        // 统一开启阴影并确保 PBR 材质环境反射生效
        model.traverse(o => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        return model;
      } catch (err) {
        console.warn(`[ModelLoader] 远程模型加载失败，使用程序化回退模型: ${url}`, err);
      }
    }
    return fallback();
  }
}

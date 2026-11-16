# 水电站数字孪生三维仿真平台

基于 **Vite + Three.js** 的模块化水电站数字孪生项目，包含重力坝枢纽全要素三维场景、水力-发电实时仿真、多视图分析模式与交互式控制面板。

## 功能总览

| 模块 | 功能 |
|------|------|
| 三维场景 | 重力坝、溢流孔、泄洪孔、闸门、上下游库区、引水隧洞、压力钢管、水轮发电机组、厂房、升压站、尾水、山体地形，共 13 个独立构件分组 |
| 视图模式 | 剖切透视（剖面位置可调）、线框模式、透明模式、爆炸拆解视图（可叠加） |
| 相机 | 轨道相机（旋转/缩放/平移）+ 第一人称自由漫游（WASD/QE，Shift 加速） |
| 运转仿真 | 水位调节、闸门开度、水流粒子、水轮机转速联动、发电数据面板 |
| 工况 | 发电 / 泄洪 / 检修 三工况一键切换，联动闸门与机组状态 |
| 交互 | 点击构件高亮并弹出工程参数卡片，右侧集成控制面板 |

## 快速开始

```bash
# 安装依赖（需要 Node.js ≥ 18）
npm install

# 开发模式（默认 http://localhost:5173）
npm run dev

# 生产构建（输出到 dist/）
npm run build

# 本地预览构建产物
npm run preview
```

## 替换远程 GLB 模型

所有模型地址集中在 **`src/config/assets.js`** 顶部的 `MODEL_URLS`：

```js
export const MODEL_URLS = {
  terrain:      '',   // ← 替换为 'https://your-cdn.com/models/terrain.glb'
  gravityDam:   '',
  // ...
};
```

- `url` 留空时使用内置程序化几何模型，**离线即可完整运行**；
- 远程模型需允许跨域访问（CORS），否则可在 `vite.config.js` 中配置代理；
- 本地模型放入 `public/models/`，路径写 `./models/xxx.glb`；
- 替换 GLB 后，水轮机旋转部件请命名为 `Rotor`（或在 `SceneBuilder._collectDynamic` 中调整查找逻辑），水面网格需标记 `userData.isWaterSurface` 的替代约定；
- Draco 压缩模型：在 `src/core/ModelLoader.js` 中取消 DRACOLoader 注释即可。

构件参数卡片数据在同文件 `COMPONENT_META` 中修改。

## 目录结构

```
hydro-twin/
├── index.html                  # 页面骨架与 UI 容器
├── src/
│   ├── main.js                 # 应用装配入口（主循环联动逻辑）
│   ├── style.css               # 工程深色主题样式
│   ├── config/assets.js        # ★ 模型链接 / 构件参数 / 仿真常量
│   ├── core/
│   │   ├── Engine.js           # 渲染器、场景、灯光、主循环
│   │   ├── CameraRig.js        # 轨道相机 + 自由漫游
│   │   └── ModelLoader.js      # GLB 加载（失败回退程序化模型）
│   ├── world/
│   │   ├── components.js       # 13 类构件程序化几何（PBR 材质）
│   │   └── SceneBuilder.js     # 场景装配、动态对象收集
│   ├── effects/
│   │   ├── ViewModes.js        # 剖切 / 线框 / 透明 / 爆炸
│   │   └── WaterParticles.js   # 水流粒子（对象池，单 draw call）
│   ├── sim/Simulation.js       # 水力-发电仿真核心
│   └── ui/
│       ├── Panel.js            # 右侧控制面板
│       └── Inspector.js        # 构件点击拾取与参数卡片
└── docs/SIMULATION.md          # 仿真逻辑说明
```

## 部署

`npm run build` 后将 `dist/` 目录整体上传至任意静态服务器（Nginx / OSS / GitHub Pages 均可）。构建使用相对路径（`base: './'`），可直接部署到子目录。

```nginx
# Nginx 示例
location /hydro/ {
    alias /var/www/hydro-twin/dist/;
    try_files $uri $uri/ /hydro/index.html;
}
```

## 性能优化说明

- 像素比上限 2，避免高分屏过度绘制；
- 粒子系统固定容量对象池 + 单 `Points` 绘制调用，零运行时 GC；
- 材质模块级共享，PMREM 环境贴图一次烘焙全局复用；
- 爆炸/闸门/转速等动画均为一阶平滑插值，无瞬跳；
- `three` 单独分包（manualChunks），利用浏览器长缓存；
- dt 钳制（≤50ms），防止页面切后台后仿真跳变。

# 狐嗦粤语 — 技术架构文档 (TECH_ARCH)

> 本文档定义 Vue 3 + Phaser 的技术架构。
> 设计理念见 [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md),
> 数据结构见 [DATA_MODEL.md](./DATA_MODEL.md)。

---

## 一、技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| UI 外壳层 | Vue 3 + Vite + TypeScript | Vue 3.4+ | 菜单/地图/图鉴/设置 |
| 状态管理 | Pinia | 2.x | 跨层共享进度状态 |
| 游戏引擎 | Phaser 3 | 3.70+ | 平台跳跃,内置 Arcade 物理 |
| 发音引擎 | Web Audio API | 原生 | Jyutping 粤拼合成 |
| 构建工具 | Vite | 5.x | HMR + 打包 |

---

## 二、分层架构

```
┌─────────────────────────────────────────────────┐
│  UI 外壳层 (Vue 3 + Pinia)                       │
│  ├─ 开始菜单 / 地图选择 / 图鉴 / 设置            │
│  ├─ 全局弹窗(结算/设置)                         │
│  └─ 通过 Pinia store + 事件总线与游戏层通信      │
├─────────────────────────────────────────────────┤
│  游戏渲染层 (Phaser 3)                           │
│  ├─ BootScene → PreloadScene → LevelScene        │
│  ├─ UIScene(叠加层,游戏内 HUD/对话卡片)        │
│  └─ 自包含,场景内部自治                         │
├─────────────────────────────────────────────────┤
│  发音引擎层 (speakers/)                          │
│  ├─ BaseSpeaker 接口                             │
│  ├─ JyutpingSpeaker(当前)                      │
│  └─ SpeakerManager 策略切换                      │
├─────────────────────────────────────────────────┤
│  数据层                                          │
│  ├─ data/levels/*.json (关卡数据,能用JSON就用)  │
│  └─ game/scripts/LevelScript_*.ts (关卡定制脚本)│
└─────────────────────────────────────────────────┘
```

### 2.1 分层原则

- `ui/` 层**不碰游戏逻辑**,只管菜单/图鉴/全局弹窗
- `game/` 层**自包含**,Phaser 场景内部自治
- 两层通过 **Pinia store** 共享进度状态,通过**事件总线**通信
- 可扩展性遵循**务实扩展**原则(详见 [DESIGN_PHILOSOPHY.md 第四节](./DESIGN_PHILOSOPHY.md)):
  - 核心组件(TextSprite/Speaker/Player 等)预留扩展点,不过度抽象
  - 每关可自由定制文件/脚本,不强求统一数据模型
  - 关卡数据能用 JSON 描述就用 JSON(`data/levels/*.json`),不能就用代码(`game/scripts/LevelScript_*.ts`),不强求

---

## 三、目录结构

```
hu-so-yue-yu/
├── docs/                       # 所有文档
├── public/                     # 静态资源(音频/字体)
├── src/
│   ├── main.ts                 # Vue 入口
│   ├── App.vue                 # Vue 根组件(挂载UI和游戏)
│   ├── ui/                     # 【Vue UI 外壳层】
│   │   ├── views/              # 页面:开始菜单/地图/图鉴/设置
│   │   ├── components/         # 通用UI组件(对话框/结算/提示)
│   │   └── stores/             # Pinia 状态(进度/收集/设置)
│   ├── game/                   # 【Phaser 游戏层】
│   │   ├── scenes/             # 场景
│   │   │   ├── BootScene.ts        # 启动
│   │   │   ├── PreloadScene.ts     # 资源预加载
│   │   │   ├── LevelScene.ts       # 关卡主场景
│   │   │   └── UIScene.ts          # 游戏内 HUD/对话卡片叠加层
│   │   ├── objects/            # 游戏对象
│   │   │   ├── Player.ts           # 主角阿粤
│   │   │   ├── TextSprite.ts       # ★伪图卡片系统(核心)
│   │   │   ├── SurpriseTrigger.ts  # 惊喜触发器
│   │   │   ├── Coin.ts             # 粤语金币
│   │   │   └── Npc.ts              # NPC
│   │   ├── systems/            # 游戏系统
│   │   │   ├── BuffSystem.ts       # Buff 管理
│   │   │   ├── HintSystem.ts       # 探索指引4层
│   │   │   └── ProgressSystem.ts   # 关卡进度
│   │   ├── scripts/            # ★关卡定制脚本(定制层)
│   │   │   ├── BaseLevelScript.ts  # 关卡脚本基类(钩子)
│   │   │   └── LevelScript_01_fish.ts # 第一关定制逻辑
│   │   └── data/levels/        # ★关卡数据(通用层,JSON驱动)
│   │       └── level_01_fish.json
│   ├── speakers/               # 【发音引擎层】
│   │   ├── BaseSpeaker.ts      # 统一接口
│   │   ├── JyutpingSpeaker.ts  # 当前方案
│   │   └── SpeakerManager.ts   # 策略切换
│   └── shared/                 # 共享:类型/常量/工具
│       ├── types.ts            # TypeScript 类型定义
│       ├── constants.ts        # 常量(按键/颜色/尺寸)
│       └── eventBus.ts         # 事件总线
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 四、Vue UI 与 Phaser 的集成

### 4.1 挂载方式

Vue 根组件 `App.vue` 中:
- 一个 `<div id="game-container">` 用于 Phaser 挂载
- 一个 `<router-view>` 或条件渲染用于 UI 页面

```vue
<!-- 概念示意,非最终代码 -->
<template>
  <div class="app">
    <div id="game-container" v-show="inGame"></div>
    <StartMenu v-if="view === 'menu'" />
    <Map v-else-if="view === 'map'" />
    <Result v-else-if="view === 'result'" />
  </div>
</template>
```

### 4.2 通信机制

**UI → Game**(如点击"开始游戏"):
- 通过 Pinia store 改变状态
- Phaser 场景在 `update()` 中监听 store 变化,或通过事件总线接收

**Game → UI**(如通关结算):
- Phaser 场景调用 `eventBus.emit('level-complete', result)`
- Vue 组件监听事件,显示结算页

### 4.3 事件总线

```typescript
// shared/eventBus.ts 概念示意
type GameEvent =
  | { type: 'level-start'; levelId: string }
  | { type: 'level-complete'; result: LevelResult }
  | { type: 'coin-collected'; word: string }
  | { type: 'surprise-triggered'; id: string }
  | { type: 'sentence-revealed'; sentence: Sentence }
  | { type: 'show-dialog'; dialog: Dialog }
```

---

## 五、Phaser 场景设计

### 5.1 场景流程

```
BootScene
  └─ 初始化 Phaser 配置
  └─ → PreloadScene
       └─ 加载关卡 JSON / 音频 / 字体
       └─ → LevelScene + UIScene(并行)
            ├─ LevelScene: 渲染关卡,处理物理与输入
            └─ UIScene: 叠加 HUD / 对话卡片 / 提示
```

### 5.2 LevelScene 职责

- 加载关卡 JSON 数据
- 创建平台/物件/金币/NPC(全部用 TextSprite 伪图卡片)
- 创建 Player,绑定 Arcade 物理
- 绑定键盘输入(A/D/W/S/E)
- 处理碰撞检测(玩家-平台、玩家-物件、玩家-金币)
- 触发惊喜事件 / 句子揭示
- 更新 BuffSystem / HintSystem / ProgressSystem

### 5.3 UIScene 职责

- 渲染游戏内 HUD(金币数/隐藏发现数/进度)
- 显示对话卡片(伪图卡片 dialogue 类型)
- 显示全局提示卡片(伪图卡片 hint 类型)
- 显示句子揭示全屏卡片(伪图卡片 result 类型)
- 不处理游戏逻辑,只响应 LevelScene 的事件

### 5.4 场景间通信

LevelScene 与 UIScene 通过 Phaser 的事件系统通信:
```typescript
// LevelScene 触发
this.events.emit('show-dialog', dialogData);
// UIScene 监听
this.scene.get('LevelScene').events.on('show-dialog', ...);
```

### 5.5 关卡脚本(LevelScript)机制(可选)

每关**可选**地提供一个定制脚本,继承 `BaseLevelScript`,用于该关独特的逻辑。**不强求每关都用,简单关卡可以不用**。

```typescript
// 概念示意
abstract class BaseLevelScript {
  onLevelLoad(scene: LevelScene): void {}           // 关卡加载后
  onAreaEnter(scene: LevelScene, areaId: string): void {}  // 进入区域
  onPlayerMove(scene: LevelScene, player: Player): void {} // 玩家移动(用于水流/风力等)
  onSurpriseReveal(scene: LevelScene, id: string): void {} // 惊喜揭示
  onSentenceReveal(scene: LevelScene): void {}      // 句子揭示
  update(scene: LevelScene, time: number, delta: number): void {} // 每帧
}
```

**原则**:能用 JSON 描述的关卡数据走 JSON,独特逻辑直接写在关卡脚本里。初赛 Demo 第一关预计无需独特机制,可暂不实现脚本系统。详见 [DESIGN_PHILOSOPHY.md 第四节](./DESIGN_PHILOSOPHY.md)。

---

## 六、伪图卡片系统(TextSprite)实现要点

### 6.1 核心类

`TextSprite` 继承 Phaser.GameObjects.Container,包含:
- `background`:背景矩形(支持高亮)
- `border`:边框矩形
- `mainText`:主文字
- `subtitleText`:副文字
- 滚动逻辑:`.gif` 后缀时,文字在卡片内循环滚动

### 6.2 关键特性

- **输入即时**:所有交互响应 <16ms,严禁同步阻塞
- **`.gif` 滚动**:用 Phaser 的 `update()` 循环更新文字位置,文字超出边界时回到起点
- **高亮支持**:`highlight` 属性变化时,背景色立即变化
- **全局可调用**:作为 `game/objects/TextSprite.ts` 导出,任何场景都能 `new TextSprite(...)`

### 6.3 扩展接口

预留:
- `setAnimation(type)`:淡入/弹出/抖动/呼吸
- `setEffect(type)`:粒子/光晕/拖尾
- `loadTexture(src)`:后期替换真图

---

## 七、渲染循环与性能

### 7.1 帧率目标

- 60 FPS(16.67ms/帧)
- 输入响应 <16ms
- 动效反馈 100~300ms

### 7.2 性能原则

- **避免同步阻塞**:发音合成、关卡加载等异步操作用 Promise/async
- **对象池**:金币/伪图卡片等频繁创建销毁的对象用对象池
- **离屏剔除**:Phaser 自动剔除摄像机外的对象
- **事件解绑**:场景销毁时及时解绑事件监听

---

## 八、发音引擎集成

### 8.1 调用方式

```typescript
// 任意场景
import { speakerManager } from '@/speakers/SpeakerManager';
await speakerManager.speak('做人如果冇梦想,跟咸鱼有咩分别?');
// 或直接读粤拼
await speakerManager.speakJyutping('zou6 jan4 jyu4 gwo2 mou5 mung6 soeng2...');
```

### 8.2 JyutpingSpeaker 实现要点

- 预置粤拼→音素映射表
- 用 Web Audio API 合成音素
- 异步播放,不阻塞游戏循环
- 失败时降级(静音 + 控制台警告)

---

## 九、开发命令(预期)

```bash
npm install         # 安装依赖
npm run dev         # 启动开发服务器(HMR)
npm run build       # 生产构建
npm run preview     # 预览生产构建
npm run typecheck   # TypeScript 类型检查
```

---

## 十、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-06 | 初版:Vue3+Phaser 分层架构、目录结构、场景设计、TextSprite 要点 |

# 狐嗦学园 — 技术架构文档 (TECH_ARCH)

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
│   │   │   ├── LevelScene.ts       # 关卡主场景（含子场景管理）
│   │   │   ├── UIScene.ts          # 游戏内 HUD/对话卡片叠加层
│   │   │   ├── BaseSubScene.ts     # 子场景基类（v0.2）
│   │   │   ├── ChaseScene.ts       # 追捕小游戏子场景（v0.2）
│   │   │   └── DialogueScene.ts    # 剧情对话子场景（v0.2）
│   │   ├── objects/            # 游戏对象
│   │   │   ├── Player.ts           # 主角某人（实现 StateTextSource）
│   │   │   ├── TextSprite.ts       # ★伪图卡片系统（核心，含状态驱动）
│   │   │   ├── MovableNpc.ts       # 可移动 NPC + AI 状态机（v0.2）
│   │   │   ├── SurpriseTrigger.ts  # 惊喜触发器
│   │   │   ├── Coin.ts             # 金币
│   │   │   └── Npc.ts              # NPC（静态）
│   │   ├── systems/            # 游戏系统
│   │   │   ├── BuffSystem.ts       # Buff 管理
│   │   │   ├── HintSystem.ts       # 探索指引4层
│   │   │   ├── ProgressSystem.ts   # 关卡进度
│   │   │   ├── SfxManager.ts       # 音效管理器（v0.2）
│   │   │   ├── CheckpointSystem.ts # 检查点系统（v0.2）
│   │   │   ├── SlowMoManager.ts    # 慢动作管理器（v0.4 新增）单例
│   │   │   └── RainManager.ts      # 雨天效果管理器（v0.4 新增）非单例
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

### 5.6 子场景系统（v0.2 新增）

借鉴马里奥管道式设计，主世界暂停时切入独立子场景展开剧情/小游戏。

**场景流程（含子场景）**：
```
BootScene → PreloadScene → LevelScene + UIScene(并行)
                              │
                ┌─ 触发子场景 ─┤
                ▼              │
           BaseSubScene        │
           ├─ ChaseScene       │ 子场景结束
           └─ DialogueScene    │ eventBus 回传结果
                │              │
                └── scene.stop() + scene.resume() → LevelScene 继续
```

**BaseSubScene 基类**：
```typescript
abstract class BaseSubScene extends Phaser.Scene {
  protected result: SubSceneResult | null = null

  create(data: SubSceneConfig): void {
    // 自动暂停主场景
    this.scene.pause(SCENE.LEVEL)
    this.scene.pause(SCENE.UI)
    this.onSubSceneCreate(data)
  }

  // 子类实现
  abstract onSubSceneCreate(data: SubSceneConfig): void

  // 结束子场景，回传结果
  protected complete(result: SubSceneResult): void {
    this.result = result
    eventBus.emit({ type: 'subscene-complete', result })
    this.scene.stop()
    this.scene.resume(SCENE.LEVEL)
    this.scene.resume(SCENE.UI)
  }
}
```

**场景间结果协议**：
```typescript
interface SubSceneResult {
  subSceneId: string
  outcome: 'success' | 'failure' | 'cancelled'
  rewards?: {
    giveBuff?: string
    unlockPath?: string
    revealCoins?: string[]
  }
}
```

### 5.7 LevelScene 子场景管理

LevelScene 新增职责：
- 区域触发检测（Zone 进入判定）
- 子场景启动（`scene.launch` + 镜头过渡）
- 结果回传处理（监听 `subscene-complete` 事件）
- 检查点管理（每个 Zone 入口自动保存）
- 登台门槛（revealZone 金币检查）

---

## 六、伪图卡片系统(TextSprite)实现要点

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

### 6.4 状态驱动绑定（v0.2 新增）

**StateTextSource 接口**：
```typescript
// shared/types.ts
export interface StateTextSource {
  getState(): string  // 返回当前状态标识
}
```

**TextSprite 新增方法**：
```typescript
class TextSprite {
  private stateSource: StateTextSource | null = null
  private stateTextMap: Record<string, string> | null = null
  private lastState: string = ''

  /** 绑定状态源（可选，不绑定则维持静态文字） */
  bindState(source: StateTextSource, textMap: Record<string, string>): this {
    this.stateSource = source
    this.stateTextMap = textMap
    this.lastState = source.getState()
    this.applyState(this.lastState)
    return this
  }

  /** 每帧检查状态变化，变化时更新文字 */
  private updateStateBinding(): void {
    if (!this.stateSource || !this.stateTextMap) return
    const state = this.stateSource.getState()
    if (state !== this.lastState) {
      this.lastState = state
      this.applyState(state)
    }
  }

  private applyState(state: string): void {
    const text = this.stateTextMap![state]
    if (text) {
      if (this.suffix === '.gif') {
        this.prepareScrollText(text)  // .gif 模式下重新准备滚动
      } else {
        this.setConfigText(text)      // 静态模式下直接 setText
      }
    }
  }
}
```

**性能设计**：状态变化时才更新文字，避免每帧 `setText` 重绘。状态缓存 `lastState` 与当前比较，无变化则跳过。

**注册机制**：`LevelScene` 维护 `stateSources: Map<string, StateTextSource>` 注册表。TextSprite 创建时若 `config.stateBinding` 存在，从注册表查找源并绑定。

### 6.5 MovableNpc（v0.2 新增）

```typescript
class MovableNpc extends Npc implements StateTextSource {
  private aiState: 'idle' | 'patrol' | 'flee' | 'caught' = 'idle'
  private patrolPoints: { x: number; y: number }[]
  private fleeSpeed: number
  private body2: Phaser.Physics.Arcade.Body  // 动态物理体

  constructor(scene, data: MovableNpcData) {
    super(scene, data)
    // 覆盖为动态物理体（Npc 基类是静态的）
    scene.physics.world.enable(this, Phaser.Physics.Arcade.DYNAMIC_BODY)
    this.body2 = this.body as Phaser.Physics.Arcade.Body
    this.body2.setCollideWorldBounds(true)
    // ... 物理配置
  }

  getState(): string {
    return this.aiState
  }

  updateAI(player: Player): void {
    // AI 状态机：根据玩家距离切换 idle/patrol/flee
    // flee: 计算远离玩家方向的速度向量
    // caught: 判定 overlap 后触发
  }
}
```

### 6.6 SfxManager（v0.2 新增）

```typescript
class SfxManager {
  private static instance: SfxManager
  private ctx: AudioContext

  static getInstance(): SfxManager { ... }

  play(type: SfxType): void {
    // 根据类型合成对应音效
    // 与发音引擎共用 AudioContext
  }

  setMuted(muted: boolean): void { ... }
}
```

单例模式，各场景按需调用 `SfxManager.getInstance().play('jump')`。

### 6.7 SlowMoManager（v0.4 新增）

**设计目标**：控制 `physics.world.timeScale` 实现全局慢放/冻结，使用 `performance.now()` 驱动过渡避免「慢放中的慢放」问题。

```typescript
class SlowMoManager {
  private static instance: SlowMoManager
  private scene: Phaser.Scene | null
  private state: 'idle' | 'frozen' | 'transitioning'
  private currentScale: number

  static getInstance(): SlowMoManager { ... }

  init(scene: Phaser.Scene): void       // 绑定场景
  destroy(): void                        // 恢复全速，清理引用

  setTimeScale(target: number, durationMs: number): void  // 平滑过渡
  freeze(durationMs: number): void                         // 冻结（timeScale → 10000）
  resume(durationMs: number): void                         // 恢复到 1.0

  getCurrentScale(): number
  getState(): string
  isActive(): boolean

  update(): void  // 每帧驱动（必须在场景 update 中调用）
}
```

**核心原理**：
- 全局控制：`scene.physics.world.timeScale` —— 所有物理体（Player/NPC/雨滴/子弹）自动受影响
- 真实时间：`performance.now()` 驱动过渡，`easeInOutQuad` 缓动函数
- 冻结安全值：`timeScale = 10000`（近乎静止，不能为 0，会阻塞主循环）
- 单例模式：全局唯一，多个场景切换时通过 `init()`/`destroy()` 绑定/解绑
- **重要**: Phaser timeScale 语义为 `1.0=正常` / `2.0=半速` / `5.0=1/5速`，即有效速度 = 1/timeScale
- **丝滑优化**: 等比提升 `physics.world.fps`（`newFps = baseFps × timeScale`），保持物理有效更新率 ≈ 60Hz

**与 Phaser 时间系统关系**：
- `scene.time.timeScale`：影响 scene.update 频率 + tweens + delayedCall —— 不用于慢放（会导致 update 变慢，陷入死循环）
- `physics.world.timeScale`：仅影响物理引擎步进 —— **采用此方案**

### 6.7b 子弹时间自动触发（ChaseScene，v0.4 新增）

**设计目标**：在追捕场景中，当玩家跳跃接近逃跑者时自动触发慢动作序列，实现「子弹时间」电影级效果。

**两段式序列**：
```
触发 → 冻结1s(NPC闪现逃逸+0.9→0.1倒计时) → 慢放3s(20%速度) → 恢复全速
```

**多维度距离门控（L1-L8）**：

| 级别 | 条件 | 距离上限 | 说明 |
|------|------|---------|------|
| L1 | `dist < 100` | 100px | 斜线贴近 |
| L2 | `dx < 80 && dy < 100` | ~128px | 横向贴近 |
| L3 | `dy < 80 && dx < 100` | ~128px | 纵向贴近 |
| L4 | `dist < collisionDist+10` | ~55px | 兜底保险 |
| L5 | `minDist < 15 && dist < 180 && ratio > 3` | 180px | 高置信度非对角 |
| L6 | `minDist < 8 && dist < 180` | 180px | 极小预测距离 |
| L7 | `vy > 300 && dist < 150 && dx < 60` | 150px | AI急速下落 |
| L8 | `edgeDist < 25 && minDist < 8 && dist < 200 && ratio > 3` | 200px | 垂直边缘贴近 |

**核心机制**：

1. **抛物线轨迹预测** (`predictiveTrajectoryCheck()`):
   - 60帧@120Hz采样（0.5秒预测窗口）
   - 玩家和AI均按抛物线运动（考虑重力）
   - AI站在平台上时不施加重力（`body.blocked.down` 判断）
   - 返回 `PredictionResult`：minDist、minDistFrame、minDistTime、预测位置、垂直边缘距离

2. **视线检测** (`hasClearLineOfSight()`):
   - 身体中心连线检测障碍物
   - 排除地面平台、NPC脚下平台（25px内）、NPC周围平台

3. **垂直边缘距离** (`verticalEdgeDist`):
   - 公式：`|predPy - predFy| - (playerHalfH + AIHalfH)`
   - 负值表示角色边缘重叠，用于垂直接近场景判断

4. **闪现机制**：
   - NPC 冻结标志（`frozen=true`）：跳过 AI 更新，防止速度/重力积累
   - 重力禁用（`body.setAllowGravity(false)`）：防止悬空
   - 速度清零（`body.setVelocity(0,0)`）：防止残余速度
   - 水平方向闪现：使用 Container tween 避免物理体同步问题

**一次性触发**：`bulletTimeTriggered` 标记，每次追捕只触发一次。

### 6.8 RainManager（v0.4 新增）

**设计目标**：创建 TextSprite 雨滴对象池，物理体驱动下落，配合 SlowMoManager 实现雨天慢放效果。

```typescript
class RainManager {
  private scene: Phaser.Scene
  private drops: TextSprite[]

  constructor(scene: Phaser.Scene, config: RainConfig)

  update(): void   // 每帧回收落出屏幕的雨滴
  destroy(): void  // 清理所有雨滴
}

interface RainConfig {
  count: number        // 雨滴数量（默认 60）
  speed: number        // 下落速度 px/s（默认 400）
  worldW: number       // 世界宽度
  worldH: number       // 世界高度
  color?: string       // 雨滴颜色（默认 #aaccff）
  dropWidth?: number   // 雨滴宽度（默认 3）
  dropHeight?: number  // 雨滴高度（默认 12）
}
```

**实现要点**：
- 雨滴基于 TextSprite（3x12px 浅蓝卡片，无文字无边框，`setDepth(1)`）
- 物理体：`setAllowGravity(false)` + `setVelocityY(400)`
- 回收循环：`y > worldH + 20` → `body.reset()` → 补设 `allowGravity=false` + `setVelocityY(speed)`
- 非单例：每个场景可独立创建各自的雨系统
- 慢放联动：雨滴是物理体，`physics.world.timeScale` 变化时自动慢放/冻结

**已知坑**：`body.reset()` 在 Phaser 3 中会将 `allowGravity` 重置为 `true`，必须手动补设。

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
| v2.2 | 2026-07-11 | v0.4 子弹时间自动触发:新增6.7b章节(多维度距离门控L1-L8/轨迹预测/视线检测/垂直边缘距离/闪现机制) |
| v2.1 | 2026-07-09 | v0.4 起步:新增 SlowMoManager(6.7)/RainManager(6.8)/目录更新 |
| v2.0 | 2026-07-07 | v0.2 内容深化:新增子场景(BaseSubScene/ChaseScene)/状态驱动绑定/MovableNpc/SfxManager/检查点/目录更新 |
| v1.0 | 2026-07-06 | 初版:Vue3+Phaser 分层架构、目录结构、场景设计、TextSprite 要点 |

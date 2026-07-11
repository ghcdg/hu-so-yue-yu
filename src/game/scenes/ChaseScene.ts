/**
 * ChaseScene - 追捕小游戏子场景（v0.2 新增, v0.3 升级）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第十章(NPC AI 与追捕系统)
 * - LEVEL_DESIGN/LEVEL_01_FISH.md 区1(老伯追捕)
 * - TECH_ARCH.md 5.6(子场景系统)
 *
 * v0.3 升级:
 * - 双倍速度:进入追捕场景后 player 和 NPC 速度翻倍
 * - NPC 子弹系统:5 发子弹,玩家靠近时发射,命中推飞玩家
 * - 多阶梯平台 + 墙壁反弹:增加场景复杂度和追捕难度
 * - NPC 主动跳跃:玩家在上方或遇到障碍时主动跳跃
 *
 * 独立小场景,有阶梯平台布局。
 * 玩家控制阿粤追,老伯(MovableNpc)自动逃跑+射击。
 * 碰到老伯即抓住,触发对话后回传结果。
 */
import Phaser from 'phaser'
import { SCENE, COLORS, PHYSICS, SLOWMO } from '@/shared/constants'
import { BaseSubScene } from '@/game/scenes/BaseSubScene'
import type { SubSceneConfig } from '@/game/scenes/BaseSubScene'
import { Player } from '@/game/objects/Player'
import { MovableNpc } from '@/game/objects/MovableNpc'
import type { MovableNpcData } from '@/game/objects/MovableNpc'
import { Bullet } from '@/game/objects/Bullet'
import { TextSprite } from '@/game/objects/TextSprite'
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { PlatformData, DialogueData, ChaseSceneData } from '@/game/data/types'
import { SlowMoManager } from '@/game/systems/SlowMoManager'
import { RainManager } from '@/game/systems/RainManager'

/** 追捕子场景配置(扩展 SubSceneConfig + ChaseSceneData) */
export interface ChaseSceneConfig extends SubSceneConfig, ChaseSceneData {
  type: 'chase'
}

/** 预测结果(含诊断信息) */
interface PredictionResult {
  minDist: number
  /** minDist 出现的帧号(1-based) */
  minDistFrame: number
  /** minDist 出现时的时间(秒) */
  minDistTime: number
  /** minDist 出现时玩家预测位置 */
  predPx: number
  predPy: number
  /** minDist 出现时逃跑者预测位置 */
  predFx: number
  predFy: number
  /** 预测交汇点的垂直边缘距离: |predPy-predFy| - (playerHalfH + AIHalfH)，负值表示重叠 */
  verticalEdgeDist: number
}

export class ChaseScene extends BaseSubScene {
  private player!: Player
  private fugitive!: MovableNpc
  private chaseConfig!: ChaseSceneConfig
  private caught = false
  private dialogueIndex = 0
  private dialogueBox: TextSprite | null = null
  private bulletsGroup!: Phaser.GameObjects.Group

  // ── v0.4 测试:慢动作 + 雨系统 ──
  private rainManager: RainManager | null = null
  private slowMoActive = false
  private slowMoStatusText: Phaser.GameObjects.Text | null = null
  /** 方案 A+D: 子弹时间是否已自动触发（一次性） */
  private bulletTimeTriggered = false
  /** 子弹时间 4s 自动恢复计时器 */
  private bulletTimeTimer: Phaser.Time.TimerEvent | null = null
  /** 冻结阶段计时器(1s 后进入慢动作) */
  private freezeTimer: Phaser.Time.TimerEvent | null = null
  /** 冻结倒计时文字(0.9→0.1) */
  private countdownText: Phaser.GameObjects.Text | null = null
  /** 场景中所有静态障碍物(用于视线检测) */
  private obstacles: Phaser.Physics.Arcade.Sprite[] = []

  // ── 预测轨迹可视化 ──
  /** 最近一次预测结果(用于绘制轨迹) */
  private lastPrediction: PredictionResult | null = null
  /** 预测轨迹 Graphics 对象 */
  private predictionGfx: Phaser.GameObjects.Graphics | null = null

  // ── 方案 C: 预测轨迹常量 ──
  /** 预测帧数(~0.5s, 120Hz 采样) */
  private static readonly PREDICTION_FRAMES = 60
  /** 物理步进时间(120Hz 采样, 提高精度) */
  private static readonly PHYSICS_DT = 1 / 120

  /** 子弹时间门控阈值（以 collisionDist 为基准的比例系数）
   *
   *  collisionDist = playerHalfW + AIHalfW + 5（当前 ~45px）
   *  调整角色大小后，所有像素阈值自动按比例缩放。
   *
   *  不可缩放参数（因依赖物理/几何特性，非碰撞距离）：
   *  - L5_RATIO / L8_RATIO: 长宽比（判断对角接近），与角色大小无关
   *  - L7_VY: AI 下落速度阈值，取决于 PHYSICS.GRAVITY，重力变则需重调
   */
  private static readonly BT = {
    // ── 预测阈值 ──
    PREDICTION_MULT: 1.1,    // 预测最小距离阈值（collisionDist × 1.1 ≈ 50px）

    // ── 距离门控（L1-L4） ──
    L1_DIST: 2.2,            // 斜线贴近（100px）
    L2_DX: 1.8,              // 横向贴近 dx（80px）
    L2_DY: 2.2,              // 横向贴近 dy（100px）
    L3_DY: 1.8,              // 纵向贴近 dy（80px）
    L3_DX: 2.2,              // 纵向贴近 dx（100px）
    L4_MARGIN: 10,           // 兜底保险固定余量（px）

    // ── 预测门控（L5/L6） ──
    L5_MINDIST: 0.33,        // 高置信度 minDist（15px）
    L5_DIST: 4.0,            // 高置信度 dist（180px）
    L5_RATIO: 3,             // 长宽比阈值（非对角接近）
    L6_MINDIST: 0.18,        // 极小 minDist（8px）
    L6_DIST: 4.0,            // 极小 dist（180px）

    // ── AI 下落（L7） ──
    L7_VY: 300,              // AI 下落速度阈值（依赖 PHYSICS.GRAVITY，不可缩放）
    L7_DIST: 3.3,            // 下落距离（150px）
    L7_DX: 1.3,              // 下落水平偏移（60px）

    // ── 边缘贴近（L8） ──
    L8_EDGEDIST: 0.55,       // 边缘距离（25px）
    L8_MINDIST: 0.18,        // 极小 minDist（8px）
    L8_DIST: 4.4,            // 边缘距离（200px）
    L8_RATIO: 3,             // 长宽比阈值（非对角接近）

    // ── 视线检测容差 ──
    LOS_PLATFORM: 0.33,      // 平台顶部对齐容差（15px）
    LOS_PROXIMITY: 0.55,     // NPC 周边安全距离（25px）
  } as const

  constructor() {
    super(SCENE.CHASE)
  }

  protected onSubSceneCreate(data: SubSceneConfig): void {
    this.chaseConfig = data as ChaseSceneConfig
    const cfg = this.chaseConfig
    const { width: worldW, height: worldH } = cfg.worldSize

    // 背景
    this.cameras.main.setBackgroundColor(COLORS.BG)
    this.physics.world.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    // 场景标题
    this.add
      .text(worldW / 2, 20, '追捕老伯!', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ff6b6b'
      })
      .setOrigin(0.5)

    // 地面
    const ground = this.createPlatform(
      { x: worldW / 2, y: worldH - 10 },
      { width: worldW, height: 20 },
      '天台地面'
    )

    // 平台(阶梯块)
    const platforms: TextSprite[] = []
    for (const p of cfg.platforms) {
      const plat = this.createPlatform(p.position, p.size, '平台')
      platforms.push(plat)
    }

    // 收集台阶平台作为障碍物(地面不算, 它是地板不是墙)
    this.obstacles = [...platforms]

    // Player(双倍速度)
    this.player = new Player(this, cfg.playerSpawn.x, cfg.playerSpawn.y)
    this.player.bindCardState(
      cfg.stateTextMaps?.player ?? {
        idle: '阿粤', run: '追!', jump: '跳', fall: '落', crouch: '蹲'
      }
    )
    // 双倍最大速度
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setMaxVelocityX(PHYSICS.PLAYER_SPEED * 2)
    // 平台反弹(水平反弹,垂直无反弹:避免地面弹跳;反弹在动态Body上设置)
    const bounce = cfg.platformBounce ?? 0.6
    playerBody.setBounce(bounce, 0)
    this.physics.add.collider(this.player, [ground, ...platforms])

    // Fugitive(MovableNpc, 双倍速度 + 子弹)
    const fugData: MovableNpcData = {
      id: cfg.fugitive.npcId,
      card: {
        ...cfg.fugitive.card,
        stateBinding: {
          sourceId: cfg.fugitive.npcId,
          textMap: cfg.stateTextMaps?.fugitive ?? {
            idle: '老伯', patrol: '巡', flee: '逃!', caught: '啊!', flee_empty: '弹尽!'
          }
        }
      },
      position: cfg.fugitive.spawn,
      dialogues: cfg.caughtDialogue,
      patrolPoints: cfg.fugitive.patrolPoints,
      fleeSpeed: cfg.fugitive.fleeSpeed * 2, // 双倍逃跑速度
      chaseTriggerRadius: 200,
      initialState: 'patrol',
      bullet: cfg.bullet
        ? {
            count: cfg.bullet.count,
            shootRange: cfg.bullet.shootRange,
            cooldownMs: cfg.bullet.cooldownMs
          }
        : undefined
    }
    this.fugitive = new MovableNpc(this, fugData)
    this.fugitive.bindState(
      this.fugitive,
      (cfg.fugitive.card.stateBinding ?? fugData.card.stateBinding)!.textMap
    )
    this.fugitive.onCaught = () => {
      this.onCatch()
    }
    // NPC 射击回调
    this.fugitive.onShoot = (x, y, targetX, targetY) => {
      this.createBullet(x, y, targetX, targetY)
    }
    // NPC 平台反弹
    const fugBody = this.fugitive.body as Phaser.Physics.Arcade.Body
    fugBody.setBounce(bounce, 0)
    this.physics.add.collider(this.fugitive, [ground, ...platforms])

    // 子弹 Group
    this.bulletsGroup = this.add.group()

    // 子弹 vs 玩家:命中推飞
    this.physics.add.overlap(
      this.bulletsGroup,
      this.player,
      (_obj1, obj2) => {
        const bullet = _obj1 as Bullet
        if (!bullet.active) return
        bullet.pushPlayer(obj2)
        bullet.destroy()
      }
    )

    // 子弹 vs 平台:命中销毁
    this.physics.add.collider(
      this.bulletsGroup,
      [ground, ...platforms],
      (obj1) => {
        const bullet = obj1 as Bullet
        if (bullet.active) bullet.destroy()
      }
    )

    // 碰撞检测:玩家碰到逃跑者
    this.physics.add.overlap(this.player, this.fugitive, () => {
      if (!this.caught && this.fugitive.getAiState() !== 'caught') {
        this.fugitive.catch()
      }
    })

    // ESC 取消
    this.input.keyboard!.on('keydown-ESC', () => {
      this.cancel()
    })

    // ── v0.4 测试:慢动作 + 雨系统 ──
    // 初始化慢动作管理器
    SlowMoManager.getInstance().init(this)
    this.bulletTimeTriggered = false

    // 创建雨系统
    this.rainManager = new RainManager(this, {
      count: 60,
      speed: 400,
      worldW,
      worldH
    })

    // 状态提示文字
    this.slowMoStatusText = this.add
      .text(worldW / 2, worldH - 30, '追近逃跑者并跳跃触发子弹时间 | T键手动切换', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 10, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(100)

    // T 键切换慢放
    this.input.keyboard!.on('keydown-T', () => {
      this.toggleSlowMo()
    })

    // 场景关闭时清理
    this.events.once('shutdown', () => {
      this.bulletTimeTimer?.destroy()
      this.freezeTimer?.destroy()
      this.countdownText?.destroy()
      this.predictionGfx?.destroy()
      this.rainManager?.destroy()
      SlowMoManager.getInstance().destroy()
    })
  }

  update(): void {
    // v0.4: 慢动作管理器更新(驱动 timeScale 过渡)
    SlowMoManager.getInstance().update()

    // v0.4: 雨滴回收
    this.rainManager?.update()

    if (!this.player || !this.fugitive || this.caught) return

    // 方案 A+D: 子弹时间自动触发检测
    this.checkBulletTimeTrigger()

    // 更新 AI
    this.fugitive.updateAI(this.player.x, this.player.y)

    // 清理已销毁的子弹
    this.bulletsGroup.getChildren().forEach((b) => {
      if (!b.active) {
        this.bulletsGroup.remove(b, true, true)
      }
    })

    // 限时检测
    if (this.chaseConfig.timeLimitMs) {
      // 预留:超时则失败重试
    }
  }

  /** 创建子弹:从 NPC 射向玩家 */
  private createBullet(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number
  ): void {
    const bullet = new Bullet(this, fromX, fromY - 15, targetX, targetY)
    this.bulletsGroup.add(bullet)
  }

  /** 抓到老伯 */
  private onCatch(): void {
    this.caught = true
    this.dialogueIndex = 0

    // 子弹时间自动触发过 → 恢复正常速度（取消计时器）
    if (this.bulletTimeTriggered) {
      this.resumeNormalSpeed('抓到!')
    }

    this.showCaughtDialogue()
  }

  /** 显示抓到后的对话 */
  private showCaughtDialogue(): void {
    const dialogues = this.chaseConfig.caughtDialogue
    if (this.dialogueIndex >= dialogues.length) {
      // 对话结束,回传结果
      this.complete({
        subSceneId: this.chaseConfig.id,
        outcome: 'success',
        rewards: this.chaseConfig.onComplete
      })
      return
    }

    const line = dialogues[this.dialogueIndex]
    // 销毁旧对话卡片
    this.dialogueBox?.destroy()

    // 创建对话卡片(底部)
    const { height: worldH } = this.chaseConfig.worldSize
    this.dialogueBox = new TextSprite(this, 400, worldH - 60, {
      type: 'dialogue',
      text: `${line.speaker}: ${line.text}`,
      size: { width: 700, height: 80 },
      borderWidth: 2
    })

    // 按 E 推进
    const advance = () => {
      this.dialogueIndex++
      this.showCaughtDialogue()
    }
    const keyHandler = (_event: KeyboardEvent) => {
      if (_event.code === 'KeyE') {
        this.input.keyboard!.off('keydown-E', keyHandler)
        advance()
      }
    }
    this.input.keyboard!.on('keydown-E', keyHandler)
  }

  // ── v0.4 测试:慢放切换 ──

  /** 多维度距离门控 + 分级触发
   *  所有像素阈值基于 collisionDist 动态计算，角色大小变化后自动缩放。
   *  L1 斜线贴近 / L2 横向贴近 / L3 纵向贴近 — 纯距离门控
   *  L4 兜底保险 — 必定闪现救场
   *  L5/L6/L7/L8 — 基于预测的触发（轨迹不穿过障碍物时可用） */
  private checkBulletTimeTrigger(): void {
    if (this.bulletTimeTriggered) return

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const fugitiveBody = this.fugitive.body as Phaser.Physics.Arcade.Body

    const dx = Math.abs(this.player.x - this.fugitive.x)
    const dy = Math.abs(this.player.y - this.fugitive.y)
    const dist = Math.sqrt(dx * dx + dy * dy)

    const isAirborne = !playerBody.blocked.down && !playerBody.touching.down
    const los = this.hasClearLineOfSight()

    // 碰撞距离(body半宽和 + 5px容差) — 所有像素阈值的基准
    const cd = (playerBody.halfWidth + fugitiveBody.halfWidth) + 5
    const BT = ChaseScene.BT

    // ═══════════════════════════════
    // L4: 兜底保险 — 极限距离必定触发(闪现救场)
    // ═══════════════════════════════
    const l4Dist = cd + BT.L4_MARGIN
    if (dist < l4Dist && los) {
      console.log(`[BT] L4-TRIGGER dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=${isAirborne ? 1 : 0} los=1 cd=${cd.toFixed(0)} l4Dist=${l4Dist.toFixed(0)}`)
      this.triggerBulletTime()
      return
    }

    // 预测轨迹需要玩家在空中
    if (!isAirborne) return
    if (!los) {
      console.log(`[BT] SKIP dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=1 los=0 (blocked)`)
      return
    }

    const pred = this.predictiveTrajectoryCheck()
    const predictionThreshold = cd * BT.PREDICTION_MULT
    if (pred.minDist >= predictionThreshold) {
      console.log(`[BT] SKIP dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=1 los=1 minDist=${pred.minDist.toFixed(1)} (>= ${predictionThreshold.toFixed(1)})`)
      return
    }

    // ═══════════════════════════════
    // 障碍物检测: 检查预测轨迹是否穿过平台
    // 穿过 → 预测不可靠(AI 会被平台截停)，跳过 L5/L6/L7/L8，仅保留 L1-L4 纯距离触发
    // ═══════════════════════════════
    const trajectoryHitsObstacle = this.doesPredictedTrajectoryHitObstacle()
    if (trajectoryHitsObstacle) {
      console.log(`[BT] OBSTACLE-HIT dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=1 los=1 ` +
        `minDist=${pred.minDist.toFixed(1)} — prediction unreliable, fallback to L1-L4 only`)
    }

    // ═══════════════════════════════
    // 多维度距离门控: 预测交汇 + 当前距离贴近
    // L1-L4: 纯距离门控(不依赖预测，始终可用)
    // L5/L6/L7/L8: 基于预测的触发(仅在轨迹不穿过障碍物时可用)
    // ═══════════════════════════════
    let level = 0
    if (dist < cd * BT.L1_DIST) {
      level = 1 // 斜线贴近(综合距离最近)
    } else if (dx < cd * BT.L2_DX && dy < cd * BT.L2_DY) {
      level = 2 // 横向贴近 + 垂直不乱
    } else if (dy < cd * BT.L3_DY && dx < cd * BT.L3_DX) {
      level = 3 // 纵向贴近 + 水平不乱
    }

    // ── 基于预测的触发(仅轨迹不穿过障碍物时) ──
    if (!trajectoryHitsObstacle) {
      if (level === 0 && pred.minDist < cd * BT.L5_MINDIST && dist < cd * BT.L5_DIST) {
        // L5: 高置信度预测 + 非对角接近
        const aspectRatio = Math.max(dx, dy) / Math.max(Math.min(dx, dy), 1)
        if (aspectRatio > BT.L5_RATIO) {
          level = 5
        }
      }
      if (level === 0 && pred.minDist < cd * BT.L6_MINDIST && dist < cd * BT.L6_DIST) {
        // L6: 预测几乎确定交汇
        level = 6
      }
      if (level === 0 && fugitiveBody.velocity.y > BT.L7_VY && dist < cd * BT.L7_DIST && dx < cd * BT.L7_DX) {
        // L7: AI 急速下落 — 预测不可靠时用当前距离判断
        level = 7
      }
      if (level === 0 && pred.verticalEdgeDist < cd * BT.L8_EDGEDIST && pred.minDist < cd * BT.L8_MINDIST && dist < cd * BT.L8_DIST) {
        // L8: 垂直/水平边缘贴近 — 非对角接近场景专用
        const aspectRatio = Math.max(dx, dy) / Math.max(Math.min(dx, dy), 1)
        if (aspectRatio > BT.L8_RATIO) {
          level = 8
        }
      }
    }

    if (level > 0) {
      console.log(`[BT] L${level}-TRIGGER dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=1 los=1 ` +
        `minDist=${pred.minDist.toFixed(1)} edgeDist=${pred.verticalEdgeDist.toFixed(0)} ` +
        `f#${pred.minDistFrame}(${(pred.minDistTime*1000).toFixed(0)}ms) ` +
        `pVel=(${playerBody.velocity.x.toFixed(0)},${playerBody.velocity.y.toFixed(0)}) ` +
        `fVel=(${fugitiveBody.velocity.x.toFixed(0)},${fugitiveBody.velocity.y.toFixed(0)}) ` +
        `predP=(${pred.predPx.toFixed(0)},${pred.predPy.toFixed(0)}) predF=(${pred.predFx.toFixed(0)},${pred.predFy.toFixed(0)})`)
      this.lastPrediction = pred
      this.triggerBulletTime()
    } else {
      console.log(`[BT] SKIP dist=${dist.toFixed(0)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} isAir=1 los=1 ` +
        `minDist=${pred.minDist.toFixed(1)} edgeDist=${pred.verticalEdgeDist.toFixed(0)} ` +
        `f#${pred.minDistFrame}(${(pred.minDistTime*1000).toFixed(0)}ms) ` +
        `pVel=(${playerBody.velocity.x.toFixed(0)},${playerBody.velocity.y.toFixed(0)}) ` +
        `fVel=(${fugitiveBody.velocity.x.toFixed(0)},${fugitiveBody.velocity.y.toFixed(0)}) ` +
        `predP=(${pred.predPx.toFixed(0)},${pred.predPy.toFixed(0)}) predF=(${pred.predFx.toFixed(0)},${pred.predFy.toFixed(0)}) ` +
        `(no level match)`)
    }
  }

  /** 方案 C: 预测玩家跳跃抛物线是否将在 N 帧内接近逃跑者，返回最小距离及诊断信息 */
  private predictiveTrajectoryCheck(): PredictionResult {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const fugitiveBody = this.fugitive.body as Phaser.Physics.Arcade.Body

    const px = this.player.x
    const py = this.player.y
    const pvx = playerBody.velocity.x
    const pvy = playerBody.velocity.y

    const fx = this.fugitive.x
    const fy = this.fugitive.y
    const fvx = fugitiveBody.velocity.x
    const fvy = fugitiveBody.velocity.y

    const dt = ChaseScene.PHYSICS_DT
    const g = PHYSICS.GRAVITY

    let minDist = Infinity
    let minDistFrame = 0
    let predPxAtMin = px
    let predPyAtMin = py
    let predFxAtMin = fx
    let predFyAtMin = fy

    // AI 站在平台上 → 不受重力影响，垂直位置保持不变
    const aiOnGround = fugitiveBody.blocked.down

    for (let i = 1; i <= ChaseScene.PREDICTION_FRAMES; i++) {
      const t = i * dt
      // 玩家抛物线: x(t) = x0 + vx*t, y(t) = y0 + vy*t + 0.5*g*t²
      const predPx = px + pvx * t
      const predPy = py + pvy * t + 0.5 * g * t * t
      // 逃跑者: 站在平台上 → 直线运动；空中 → 抛物线(受重力影响)
      const predFx = fx + fvx * t
      const predFy = aiOnGround ? fy + fvy * t : fy + fvy * t + 0.5 * g * t * t

      const d = Phaser.Math.Distance.Between(predPx, predPy, predFx, predFy)
      if (d < minDist) {
        minDist = d
        minDistFrame = i
        predPxAtMin = predPx
        predPyAtMin = predPy
        predFxAtMin = predFx
        predFyAtMin = predFy
      }
    }
    // 垂直边缘距离: 角色边缘之间的垂直间隙
    // 负值表示边缘重叠(角色已交错)
    const verticalEdgeDist = Math.abs(predPyAtMin - predFyAtMin) -
      (playerBody.halfHeight + fugitiveBody.halfHeight)

    return {
      minDist,
      minDistFrame,
      minDistTime: minDistFrame * dt,
      predPx: predPxAtMin,
      predPy: predPyAtMin,
      predFx: predFxAtMin,
      predFy: predFyAtMin,
      verticalEdgeDist
    }
  }

  /** 检查预测轨迹是否穿过任何障碍物（平台）
   *  在预测的 60 帧中逐段检测 AI 预测位置是否穿过障碍物边界。
   *  如果穿过，说明预测不可靠（AI 会被平台截停），应跳过基于预测的触发（L5/L6/L7/L8）。
   *  跳过 NPC 当前所在平台（与 hasClearLineOfSight 一致）。 */
  private doesPredictedTrajectoryHitObstacle(): boolean {
    const fugitiveBody = this.fugitive.body as Phaser.Physics.Arcade.Body

    const fx = this.fugitive.x
    const fy = this.fugitive.y
    const fvx = fugitiveBody.velocity.x
    const fvy = fugitiveBody.velocity.y

    const dt = ChaseScene.PHYSICS_DT
    const g = PHYSICS.GRAVITY
    const aiOnGround = fugitiveBody.blocked.down

    // 跳过 NPC 当前所在平台（与 hasClearLineOfSight 一致）
    const npcBottom = this.fugitive.y + fugitiveBody.halfHeight
    const skipPlatforms = new Set<Phaser.Physics.Arcade.Sprite>()
    for (const obs of this.obstacles) {
      if (!obs.body) continue
      const bounds = (obs.body as Phaser.Physics.Arcade.Body).getBounds(
        new Phaser.Geom.Rectangle()
      )
      if (
        Math.abs(bounds.top - npcBottom) < 15 &&
        this.fugitive.x >= bounds.x &&
        this.fugitive.x <= bounds.right
      ) {
        skipPlatforms.add(obs)
      }
    }

    let prevX = fx
    let prevY = fy

    for (let i = 1; i <= ChaseScene.PREDICTION_FRAMES; i++) {
      const t = i * dt
      const predFx = fx + fvx * t
      const predFy = aiOnGround ? fy + fvy * t : fy + fvy * t + 0.5 * g * t * t

      const segment = new Phaser.Geom.Line(prevX, prevY, predFx, predFy)

      for (const obs of this.obstacles) {
        if (skipPlatforms.has(obs)) continue
        if (!obs.body) continue
        const bounds = (obs.body as Phaser.Physics.Arcade.Body).getBounds(
          new Phaser.Geom.Rectangle()
        )

        if (Phaser.Geom.Intersects.LineToRectangle(segment, bounds)) {
          return true
        }
      }

      prevX = predFx
      prevY = predFy
    }

    return false
  }

  /** 检查玩家→逃跑者之间是否有障碍物阻挡视线（身体中心连线）
   *  跳过三类障碍物：
   *  1. NPC 脚下平台（障碍物顶部对齐 NPC 底部，且 NPC 在水平范围内）
   *  2. 玩家脚下平台（障碍物顶部对齐玩家底部，且玩家在水平范围内）
   *  3. NPC 周围安全距离内的障碍物（保守兜底）
   *  容差基于 collisionDist 动态缩放，角色大小变化后自动适应。 */
  private hasClearLineOfSight(): boolean {
    const line = new Phaser.Geom.Line(
      this.player.x, this.player.y,
      this.fugitive.x, this.fugitive.y
    )
    const fugitiveBody = this.fugitive.body as Phaser.Physics.Arcade.Body
    const npcBottom = this.fugitive.y + fugitiveBody.halfHeight

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const playerBottom = this.player.y + playerBody.halfHeight

    const cd = (playerBody.halfWidth + fugitiveBody.halfWidth) + 5
    const BT = ChaseScene.BT
    const platformAlign = cd * BT.LOS_PLATFORM   // 平台顶部对齐容差
    const proximity = cd * BT.LOS_PROXIMITY       // NPC 周边安全距离

    for (const obs of this.obstacles) {
      if (!obs.body) continue
      const bounds = (obs.body as Phaser.Physics.Arcade.Body).getBounds(
        new Phaser.Geom.Rectangle()
      )

      // 规则1: 跳过 NPC 脚下平台 — 障碍物顶部对齐 NPC 底部 且 NPC 在水平范围内
      const npcOnThisPlatform =
        Math.abs(bounds.top - npcBottom) < platformAlign &&
        this.fugitive.x >= bounds.x &&
        this.fugitive.x <= bounds.right
      if (npcOnThisPlatform) continue

      // 规则2: 跳过玩家脚下平台 — 障碍物顶部对齐玩家底部 且玩家在水平范围内
      const playerOnThisPlatform =
        Math.abs(bounds.top - playerBottom) < platformAlign &&
        this.player.x >= bounds.x &&
        this.player.x <= bounds.right
      if (playerOnThisPlatform) continue

      // 规则3: 跳过 NPC 周围安全距离内的障碍物(保守兜底)
      if (
        this.fugitive.x >= bounds.x - proximity &&
        this.fugitive.x <= bounds.right + proximity &&
        this.fugitive.y >= bounds.y - proximity &&
        this.fugitive.y <= bounds.bottom + proximity
      ) {
        continue
      }

      if (Phaser.Geom.Intersects.LineToRectangle(line, bounds)) {
        return false
      }
    }
    return true
  }

  /** 触发子弹时间（一次性）
   *  两阶段: 冻结 1s(逃跑者闪现+倒计时) → 慢动作 3s */
  private triggerBulletTime(): void {
    this.bulletTimeTriggered = true
    const slowMo = SlowMoManager.getInstance()
    const { width: worldW } = this.chaseConfig.worldSize

    // 绘制预测轨迹(调试可视化)
    this.drawPredictionTrajectory()

    // ═══════════════════════════════════════
    // Phase 1: 冻结 1s — 逃跑者闪现 + 倒计时
    // ═══════════════════════════════════════
    slowMo.setTimeScale(10000, 0) // 视觉冻结(无过渡)

    // 冻结 AI: 防止 timeScale=10000 时 velocity 补偿爆炸
    this.fugitive.frozen = true

    this.logFugitiveState('[BT-FLASH] before hide')

    // 隐藏逃跑者
    this.fugitive.setVisible(false)

    // 闪现目标: player 对面, 空中高处, 由物理引擎自然落地
    const playerX = this.player.x
    const targetX = playerX < worldW / 2
      ? worldW - 100   // player 在左边 → 闪现到右边
      : 100             // player 在右边 → 闪现到左边
    const targetY = 100

    // 同时更新 Container 和 body 位置(防止冻结期间被捕获)
    this.fugitive.x = targetX
    this.fugitive.y = targetY
    const body = this.fugitive.body as Phaser.Physics.Arcade.Body | null
    if (body) {
      body.position.x = targetX - body.halfWidth
      body.position.y = targetY - body.halfHeight
      body.setVelocity(0, 0)
    }

    this.logFugitiveState('[BT-FLASH] after hide')

    // 倒计时显示
    this.showCountdown()

    // ═══════════════════════════════════════
    // Phase 2: 1s 后闪现出现 + 进入慢动作
    // ═══════════════════════════════════════
    this.freezeTimer = this.time.delayedCall(1000, () => {
      this.freezeTimer = null

      // 清理预测轨迹
      this.predictionGfx?.destroy()
      this.predictionGfx = null

      this.logFugitiveState('[BT-FLASH] before reveal')

      // 闪现出现
      this.fugitive.setVisible(true)
      this.fugitive.frozen = false
      body?.setVelocity(0, 0)

      // 闪现提示
      this.showFlashHint(targetX, targetY)

      // 清理倒计时
      this.countdownText?.destroy()
      this.countdownText = null

      this.logFugitiveState('[BT-SLOWMO] started')

      // 进入慢动作
      const timeScale = 1 / SLOWMO.SPEED
      slowMo.setTimeScale(timeScale, SLOWMO.TRANSITION_IN_MS)

      const pct = Math.round(SLOWMO.SPEED * 100)
      this.slowMoStatusText?.setText(`子弹时间! 慢放中 (${pct}%)`)

      // 慢动作期间诊断日志
      this.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          this.logFugitiveState('[BT-SLOWMO] periodic')
        }
      })

      // 3 秒后自动恢复
      this.bulletTimeTimer = this.time.delayedCall(3000, () => {
        this.logFugitiveState('[BT-SLOWMO] before resume')
        this.resumeNormalSpeed('子弹时间结束')
      })
    })
  }

  /** 绘制预测轨迹(调试可视化)
   *  在子弹时间触发时调用，画出：
   *  - AI 逃跑者: 橙色虚线轨迹 + 箭头 + 起点圆点
   *  - Player: 绿色虚线轨迹 + 箭头 + 起点圆点
   *  帮助玩家理解场景中即将发生的交汇。 */
  private drawPredictionTrajectory(): void {
    const pred = this.lastPrediction
    if (!pred) return

    this.predictionGfx = this.add.graphics()
    this.predictionGfx.setDepth(150)

    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    const fugitiveBody = this.fugitive.body as Phaser.Physics.Arcade.Body

    const px = this.player.x
    const py = this.player.y
    const pvx = playerBody.velocity.x
    const pvy = playerBody.velocity.y

    const fx = this.fugitive.x
    const fy = this.fugitive.y
    const fvx = fugitiveBody.velocity.x
    const fvy = fugitiveBody.velocity.y
    const aiOnGround = fugitiveBody.blocked.down

    const dt = ChaseScene.PHYSICS_DT
    const g = PHYSICS.GRAVITY
    const frames = Math.min(pred.minDistFrame, ChaseScene.PREDICTION_FRAMES)
    const dashLen = 2 // 每 2 帧画一段虚线
    const arrowLen = 12
    const arrowAngle = Math.PI / 6 // 30°

    // ────────────────────────────────────
    // AI 逃跑者轨迹（橙色虚线）
    // ────────────────────────────────────
    this.predictionGfx.lineStyle(2, 0xffaa00, 0.7)

    let prevX = fx
    let prevY = fy

    for (let i = dashLen; i <= frames; i += dashLen) {
      const t = i * dt
      const predFx = fx + fvx * t
      const predFy = aiOnGround ? fy + fvy * t : fy + fvy * t + 0.5 * g * t * t

      this.predictionGfx.beginPath()
      this.predictionGfx.moveTo(prevX, prevY)
      this.predictionGfx.lineTo(predFx, predFy)
      this.predictionGfx.strokePath()

      prevX = predFx
      prevY = predFy
    }

    // AI 箭头
    const fEndX = pred.predFx
    const fEndY = pred.predFy
    const fEndT = frames * dt
    const fEndVy = aiOnGround ? fvy : fvy + g * fEndT
    const fAngle = Math.atan2(fEndVy, fvx)

    this.predictionGfx.lineStyle(2.5, 0xffaa00, 0.9)

    this.predictionGfx.beginPath()
    this.predictionGfx.moveTo(fEndX, fEndY)
    this.predictionGfx.lineTo(
      fEndX - arrowLen * Math.cos(fAngle - arrowAngle),
      fEndY - arrowLen * Math.sin(fAngle - arrowAngle)
    )
    this.predictionGfx.strokePath()

    this.predictionGfx.beginPath()
    this.predictionGfx.moveTo(fEndX, fEndY)
    this.predictionGfx.lineTo(
      fEndX - arrowLen * Math.cos(fAngle + arrowAngle),
      fEndY - arrowLen * Math.sin(fAngle + arrowAngle)
    )
    this.predictionGfx.strokePath()

    // AI 起点圆点
    this.predictionGfx.fillStyle(0xffaa00, 0.8)
    this.predictionGfx.fillCircle(fx, fy, 4)

    // ────────────────────────────────────
    // Player 轨迹（绿色虚线）— 抛物线
    // ────────────────────────────────────
    this.predictionGfx.lineStyle(2, 0x00ff88, 0.7)

    let prevPx = px
    let prevPy = py

    for (let i = dashLen; i <= frames; i += dashLen) {
      const t = i * dt
      const predPx = px + pvx * t
      const predPy = py + pvy * t + 0.5 * g * t * t

      this.predictionGfx.beginPath()
      this.predictionGfx.moveTo(prevPx, prevPy)
      this.predictionGfx.lineTo(predPx, predPy)
      this.predictionGfx.strokePath()

      prevPx = predPx
      prevPy = predPy
    }

    // Player 箭头
    const pEndX = pred.predPx
    const pEndY = pred.predPy
    const pEndT = frames * dt
    const pEndVy = pvy + g * pEndT
    const pAngle = Math.atan2(pEndVy, pvx)

    this.predictionGfx.lineStyle(2.5, 0x00ff88, 0.9)

    this.predictionGfx.beginPath()
    this.predictionGfx.moveTo(pEndX, pEndY)
    this.predictionGfx.lineTo(
      pEndX - arrowLen * Math.cos(pAngle - arrowAngle),
      pEndY - arrowLen * Math.sin(pAngle - arrowAngle)
    )
    this.predictionGfx.strokePath()

    this.predictionGfx.beginPath()
    this.predictionGfx.moveTo(pEndX, pEndY)
    this.predictionGfx.lineTo(
      pEndX - arrowLen * Math.cos(pAngle + arrowAngle),
      pEndY - arrowLen * Math.sin(pAngle + arrowAngle)
    )
    this.predictionGfx.strokePath()

    // Player 起点圆点
    this.predictionGfx.fillStyle(0x00ff88, 0.8)
    this.predictionGfx.fillCircle(px, py, 4)
  }

  /** 显示冻结倒计时(0.9 → 0.1, 每 100ms 更新) */
  private showCountdown(): void {
    const { width: worldW, height: worldH } = this.chaseConfig.worldSize
    this.countdownText = this.add
      .text(worldW / 2, worldH / 2, '0.9', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '56px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(200)

    let count = 0.9
    this.time.addEvent({
      delay: 100,
      repeat: 8, // 0.9, 0.8, ..., 0.1
      callback: () => {
        count -= 0.1
        this.countdownText?.setText(count.toFixed(1))
      }
    })
  }

  /** 诊断日志: 追踪 fugitive 可视状态 */
  private logFugitiveState(tag: string): void {
    const f = this.fugitive
    const body = f.body as Phaser.Physics.Arcade.Body | null
    console.log(
      `[${tag}] ` +
      `pos=(${f.x.toFixed(0)},${f.y.toFixed(0)}) ` +
      `body=(${body?.x?.toFixed(0) ?? '?'},${body?.y?.toFixed(0) ?? '?'}) ` +
      `vel=(${body?.velocity?.x?.toFixed(0) ?? '?'},${body?.velocity?.y?.toFixed(0) ?? '?'}) ` +
      `grav=${body?.allowGravity ?? '?'} ` +
      `vis=${f.visible} alpha=${f.alpha} active=${f.active} ` +
      `depth=${f.depth} scale=(${f.scaleX},${f.scaleY}) ` +
      `frozen=${f.frozen} aiState=${f.getAiState()} ` +
      `destroyed=${!f.scene} ` +
      `parent=${f.parentContainer ? 'hasParent' : 'none'}`
    )
  }

  /** 闪现提示: 在逃跑者出现位置显示 "闪现!" 文字并淡出 */
  private showFlashHint(x: number, y: number): void {
    const hint = this.add
      .text(x, y - 40, '闪现!', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '28px',
        color: '#ffff00',
        stroke: '#000000',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(200)

    this.tweens.add({
      targets: hint,
      alpha: 0,
      y: y - 80,
      duration: 600,
      ease: 'Power2',
      onComplete: () => hint.destroy()
    })
  }

  /** 恢复正常速度（自动恢复 / 抓到触发） */
  private resumeNormalSpeed(msg: string): void {
    if (this.bulletTimeTimer) { this.bulletTimeTimer.destroy(); this.bulletTimeTimer = null }
    if (this.freezeTimer) { this.freezeTimer.destroy(); this.freezeTimer = null }
    this.fugitive.frozen = false
    this.countdownText?.destroy()
    this.countdownText = null
    SlowMoManager.getInstance().resume(SLOWMO.TRANSITION_OUT_MS)
    this.slowMoStatusText?.setText(msg)
    this.logFugitiveState('[BT-RESUME] after restore')
  }

  /** 切换慢放状态(T 键触发,保留用于调试) */
  private toggleSlowMo(): void {
    this.slowMoActive = !this.slowMoActive
    const slowMo = SlowMoManager.getInstance()

    if (this.slowMoActive) {
      const timeScale = 1 / SLOWMO.SPEED
      slowMo.setTimeScale(timeScale, SLOWMO.TRANSITION_IN_MS)
      const pct = Math.round(SLOWMO.SPEED * 100)
      this.slowMoStatusText?.setText(`按 T 切换慢放 | 当前: 慢放中 (${pct}%)`)
    } else {
      slowMo.resume(SLOWMO.TRANSITION_OUT_MS)
      this.slowMoStatusText?.setText('按 T 切换慢放 | 当前: 正常')
    }
  }

  /** 创建平台(带物理碰撞) */
  private createPlatform(
    pos: { x: number; y: number },
    size: { width: number; height: number },
    text: string
  ): TextSprite {
    const platform = new TextSprite(this, pos.x, pos.y, {
      type: 'object',
      text,
      size,
      borderWidth: 1
    })
    this.physics.add.existing(platform, true)
    return platform
  }
}
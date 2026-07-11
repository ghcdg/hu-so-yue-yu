/**
 * MovableNpc - 可移动 NPC + AI 状态机（v0.2 新增）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第十章 10.3(MovableNpc)
 * - TECH_ARCH.md 6.5(MovableNpc 实现要点)
 * - DATA_MODEL.md 第八章(MovableNpcData Schema)
 * - DESIGN_PHILOSOPHY.md 第三节(务实扩展:新增子类不改基类)
 *
 * 继承 Npc(静态物理体),覆盖为动态物理体,增加 AI 状态机。
 * 实现 StateTextSource,卡片可实时显示动作。
 * 用于追捕/打架等子场景。
 *
 * AI 状态机:
 *   idle → patrol → flee → caught → idle
 *             ↑         ↓
 *             └─ 巡逻路径 ──┘
 */
import Phaser from 'phaser'
import { Npc } from '@/game/objects/Npc'
import type { NpcData } from '@/game/data/types'
import type { StateTextSource } from '@/shared/types'
import { SlowMoManager } from '@/game/systems/SlowMoManager'
import { PHYSICS } from '@/shared/constants'

/** MovableNpc 扩展数据 */
export interface MovableNpcData extends NpcData {
  /** 巡逻路径点 */
  patrolPoints: { x: number; y: number }[]
  /** 逃跑速度 */
  fleeSpeed: number
  /** 触发追逐的玩家距离 */
  chaseTriggerRadius: number
  /** AI 初始状态 */
  initialState: 'idle' | 'patrol'
  /** 子弹配置(可选,不配置则不发射子弹) */
  bullet?: {
    /** 子弹数量 */
    count: number
    /** 射击触发距离(玩家进入此范围时发射) */
    shootRange: number
    /** 射击冷却(ms) */
    cooldownMs: number
  }
}

export type MovableNpcState = 'idle' | 'patrol' | 'flee' | 'caught'

export class MovableNpc extends Npc implements StateTextSource {
  private aiState: MovableNpcState = 'idle'
  private patrolPoints: { x: number; y: number }[]
  private patrolIndex = 0
  private fleeSpeed: number
  private chaseTriggerRadius: number
  private body2!: Phaser.Physics.Arcade.Body

  /** 被抓到时触发(场景监听) */
  onCaught: (() => void) | null = null

  /** 冻结标志: 子弹时间冻结期间跳过 AI 速度补偿, 防止 velocity 爆炸 */
  frozen = false

  // ── 子弹系统 ──
  private bulletsRemaining: number
  private shootRange: number
  private shootCooldownMs: number
  private shootTimer = 0
  /** 射击回调:场景创建子弹,参数(shooterX, shooterY, targetX, targetY) */
  onShoot: ((x: number, y: number, targetX: number, targetY: number) => void) | null = null

  constructor(scene: Phaser.Scene, data: MovableNpcData) {
    super(scene, data)

    this.patrolPoints = data.patrolPoints
    this.fleeSpeed = data.fleeSpeed
    this.chaseTriggerRadius = data.chaseTriggerRadius
    this.aiState = data.initialState

    // 子弹配置(可选)
    const bulletCfg = data.bullet
    this.bulletsRemaining = bulletCfg?.count ?? 0
    this.shootRange = bulletCfg?.shootRange ?? 0
    this.shootCooldownMs = bulletCfg?.cooldownMs ?? 500

    // 覆盖为动态物理体(Npc 基类创建的是 StaticBody,需先移除再重建)
    // StaticBody 没有 setImmovable/setVelocity 等方法,无法直接转换
    // world.disable 只是禁用,world.enable 会复用旧 body → 必须清空 body 引用
    scene.physics.world.disable(this)
    ;(this as any).body = undefined
    scene.physics.add.existing(this) // 不带参数 = 动态 Body
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setCollideWorldBounds(true)
    body.setBounce(0, 0)
    body.setDragX(200)
    this.body2 = body

    // 注册到场景 update
    scene.events.on('update', this.onAIUpdate, this)
  }

  // ──────────────────────────────────────────────
  // StateTextSource 接口
  // ──────────────────────────────────────────────

  getStateLabel(): string {
    if (this.aiState === 'flee' && this.bulletsRemaining <= 0) return 'flee_empty'
    return this.aiState
  }

  getAiState(): MovableNpcState {
    return this.aiState
  }

  // ──────────────────────────────────────────────
  // AI 状态机(场景每帧调用 updateAI)
  // ──────────────────────────────────────────────

  /**
   * 更新 AI,由场景 update 调用
   * @param playerX 玩家 X 坐标
   * @param playerY 玩家 Y 坐标
   */
  updateAI(playerX: number, playerY: number): void {
    if (this.aiState === 'caught') return
    // 冻结期间跳过: 防止 AI 以 ×10000 倍速写入 velocity
    if (this.frozen) return

    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)

    // 玩家靠近 → 逃跑
    if (dist < this.chaseTriggerRadius && this.aiState !== 'flee') {
      this.aiState = 'flee'
      return
    }

    // 玩家远离 → 恢复巡逻
    if (dist >= this.chaseTriggerRadius * 1.5 && this.aiState === 'flee') {
      this.aiState = 'patrol'
      this.body2.setVelocityX(0)
      return
    }

    // 巡逻
    if (this.aiState === 'patrol' && this.patrolPoints.length > 0) {
      this.patrolBehavior()
    }

    // 逃跑:每帧执行(含射击决策)
    if (this.aiState === 'flee') {
      // 射击:有子弹 + 冷却完毕 + 玩家在射程内
      if (
        this.bulletsRemaining > 0 &&
        this.shootTimer <= 0 &&
        this.shootRange > 0 &&
        dist < this.shootRange
      ) {
        this.onShoot?.(this.x, this.y, playerX, playerY)
        this.bulletsRemaining--
        this.shootTimer = this.shootCooldownMs
      }
      this.fleeBehavior(playerX, playerY)
    }
  }

  /** 获取慢放速度补偿系数：正常速度返回 1.0，慢放中返回 timeScale（如 10.0） */
  private getSlowMoMultiplier(): number {
    const slowMo = SlowMoManager.getInstance()
    return slowMo.isActive() ? slowMo.getCurrentScale() : 1.0
  }

  /** 巡逻:在 patrolPoints 间移动 */
  private patrolBehavior(): void {
    const scale = this.getSlowMoMultiplier()
    const target = this.patrolPoints[this.patrolIndex]
    const dx = target.x - this.x
    if (Math.abs(dx) < 10) {
      // 到达,切换到下一个巡逻点
      this.body2.setVelocityX(0)
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
    } else {
      this.body2.setVelocityX(Math.sign(dx) * this.fleeSpeed * 0.5 * scale)
    }
  }

  /** 逃跑:远离玩家方向,遇到障碍/玩家在上方时主动跳跃 */
  fleeBehavior(playerX: number, playerY: number): void {
    const scale = this.getSlowMoMultiplier()
    const dx = this.x - playerX
    const dy = this.y - playerY
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    // 水平逃跑(远离玩家)，慢放时速度补偿
    this.body2.setVelocityX(
      (dx / dist) * this.fleeSpeed * scale
    )
    // 主动跳跃:玩家在上方(高于 NPC 50px 以上)且 NPC 着地 → 跳
    const grounded = this.body2.blocked.down || this.body2.touching.down
    if (grounded && dy > 50) {
      this.body2.setVelocityY(-480 * scale)
    }
    // 遇到障碍时尝试跳跃
    if (this.body2.blocked.left || this.body2.blocked.right) {
      this.body2.setVelocityY(-420 * scale)
    }
  }

  /** 被玩家抓到 */
  catch(): void {
    this.aiState = 'caught'
    this.body2.setVelocity(0, 0)
    this.onCaught?.()
  }

  // ──────────────────────────────────────────────
  // 内部:update
  // ──────────────────────────────────────────────

  private onAIUpdate = (_time: number, delta: number): void => {
    // 被抓状态不做任何事
    if (this.aiState === 'caught') return
    // 冻结期间跳过: timeScale=10000 时补偿爆炸, 导致解冻后物体会飞走
    if (this.frozen) return

    // 慢放重力补偿：physics.world.timeScale 同时削减了重力加速度和位移，
    // 需同时补偿速度项和位移项，完整公式: C = GRAVITY × Δt × (scale - 1/scale)
    const slowMo = SlowMoManager.getInstance()
    if (slowMo.isActive()) {
      const scale = slowMo.getCurrentScale()
      const deltaSec = delta / 1000
      // 补偿量 = 速度修正 + 位移修正，经推导得 scale - 1/scale
      const compensation = PHYSICS.GRAVITY * deltaSec * (scale - 1 / scale)
      this.body2.velocity.y += compensation
    }

    // 射击冷却递减
    if (this.shootTimer > 0) {
      this.shootTimer -= delta
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.scene && this.scene.events) {
      this.scene.events.off('update', this.onAIUpdate, this)
    }
    super.destroy(fromScene)
  }
}
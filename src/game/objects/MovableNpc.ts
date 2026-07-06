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

  constructor(scene: Phaser.Scene, data: MovableNpcData) {
    super(scene, data)

    this.patrolPoints = data.patrolPoints
    this.fleeSpeed = data.fleeSpeed
    this.chaseTriggerRadius = data.chaseTriggerRadius
    this.aiState = data.initialState

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

    // 逃跑:每帧执行
    if (this.aiState === 'flee') {
      this.fleeBehavior(playerX, playerY)
    }
  }

  /** 巡逻:在 patrolPoints 间移动 */
  private patrolBehavior(): void {
    const target = this.patrolPoints[this.patrolIndex]
    const dx = target.x - this.x
    if (Math.abs(dx) < 10) {
      // 到达,切换到下一个巡逻点
      this.body2.setVelocityX(0)
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length
    } else {
      this.body2.setVelocityX(Math.sign(dx) * this.fleeSpeed * 0.5)
    }
  }

  /** 逃跑:远离玩家方向 */
  fleeBehavior(playerX: number, playerY: number): void {
    const dx = this.x - playerX
    const dy = this.y - playerY
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    // 水平逃跑(远离玩家)
    this.body2.setVelocityX(
      (dx / dist) * this.fleeSpeed
    )
    // 遇到障碍时尝试跳跃
    if (this.body2.blocked.left || this.body2.blocked.right) {
      this.body2.setVelocityY(-400)
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

  private onAIUpdate = (_time: number, _delta: number): void => {
    // 被抓状态不做任何事
    if (this.aiState === 'caught') return
  }

  destroy(fromScene?: boolean): void {
    if (this.scene && this.scene.events) {
      this.scene.events.off('update', this.onAIUpdate, this)
    }
    super.destroy(fromScene)
  }
}
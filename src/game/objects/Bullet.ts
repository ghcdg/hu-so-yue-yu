/**
 * Bullet - 子弹类（继承基础卡片 TextSprite）
 *
 * 设计依据:
 * - 基础卡片组件的子类示范:纯视觉(TextSprite) + 子类加物理
 * - 用于追捕子场景:NPC 发射子弹将玩家弹开
 *
 * 特性:
 * - 20x20 蓝色"弹"字卡片
 * - 动态物理体,向目标方向飞行
 * - 碰墙/碰世界边界自动销毁
 * - 生命周期超时自动销毁
 */
import Phaser from 'phaser'
import { TextSprite } from '@/game/objects/TextSprite'

/** 子弹默认参数 */
const BULLET_SIZE = 20
const BULLET_SPEED = 400
const BULLET_LIFESPAN = 3000 // ms

/** 子弹推飞玩家的力度参数 */
export const BULLET_PUSH = {
  /** 水平推飞速度（远离子弹方向） */
  horizontal: 600,
  /** 垂直上抛速度（负值=向上） */
  vertical: -400
} as const

export class Bullet extends TextSprite {
  private body2!: Phaser.Physics.Arcade.Body
  private lifeTimer: Phaser.Time.TimerEvent

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    targetX: number,
    targetY: number
  ) {
    super(scene, x, y, {
      type: 'object',
      text: '弹',
      size: { width: BULLET_SIZE, height: BULLET_SIZE },
      borderWidth: 2,
      textColor: '#00ffff',
      borderColor: '#00bfff'
    })

    // 添加动态物理体
    scene.physics.add.existing(this)
    this.body2 = this.body as Phaser.Physics.Arcade.Body
    this.body2.setCollideWorldBounds(true)
    this.body2.setBounce(0, 0)

    // 世界边界碰撞时销毁
    this.body2.onWorldBounds = true
    scene.physics.world.on('worldbounds', (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject === this) {
        this.destroy()
      }
    })

    // 飞向目标
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY)
    this.body2.setVelocity(
      Math.cos(angle) * BULLET_SPEED,
      Math.sin(angle) * BULLET_SPEED
    )

    // 生命周期超时自动销毁
    this.lifeTimer = scene.time.delayedCall(BULLET_LIFESPAN, () => {
      this.destroy()
    })
  }

  /**
   * 子弹命中玩家时调用:将玩家朝子弹来源方向推飞
   * 由 ChaseScene 的 overlap 回调调用
   */
  pushPlayer(player: Phaser.GameObjects.GameObject): void {
    const playerBody = (player as any).body as Phaser.Physics.Arcade.Body
    if (!playerBody) return

    // 方向:从子弹指向玩家(推飞方向=远离子弹)
    const dx = playerBody.x - this.x
    const dy = playerBody.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    playerBody.setVelocity(
      (dx / dist) * BULLET_PUSH.horizontal,
      BULLET_PUSH.vertical
    )
  }

  destroy(fromScene?: boolean): void {
    this.lifeTimer?.remove()
    super.destroy(fromScene)
  }
}
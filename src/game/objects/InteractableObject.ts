/**
 * InteractableObject - 可互动物件
 *
 * 设计依据:DATA_MODEL.md InteractableData + GAME_DESIGN.md 第四章铺垫链
 *
 * 视觉:TextSprite(object 类型)
 * 物理:静态(不移动,不重力)
 * 互动:玩家靠近 + 按 E → LevelScene 检测到附近可互动物件 → 触发对应 action
 *
 * 动作类型(InteractAction):
 * - kick_fish:踢咸鱼 → 弹开动效 + 揭示隐藏金币(反向引导机制)
 * - find_difference:进入找区别于场景
 *
 * 互动后状态:consumed=true,防止重复触发
 */
import Phaser from 'phaser'
import { TextSprite } from '@/game/objects/TextSprite'
import type { InteractableData } from '@/game/data/types'

export class InteractableObject extends TextSprite {
  readonly intId: string
  readonly action: string
  readonly revealCoinId?: string

  /** 是否已互动过(防重复) */
  private consumed = false

  constructor(scene: Phaser.Scene, data: InteractableData) {
    super(scene, data.position.x, data.position.y, data.card)
    this.intId = data.id
    this.action = data.action
    this.revealCoinId = data.revealCoinId

    // 静态物理体(可碰撞但不移动)
    scene.physics.add.existing(this, true)
  }

  /** 是否已互动过 */
  isConsumed(): boolean {
    return this.consumed
  }

  /**
   * 触发互动(返回是否成功,已 consumed 返回 false)
   * 实际动作逻辑由 LevelScene 根据 action 类型 switch 处理
   */
  interact(): boolean {
    if (this.consumed) return false
    this.consumed = true
    return true
  }

  /** 弹开动效(踢咸鱼/踢足球用) */
  playKickEffect(): void {
    this.scene.tweens.add({
      targets: this,
      x: this.x + 160,
      y: this.y - 80,
      alpha: 0,
      scale: 0.6,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroy()
    })
  }

  /** 闪现提示动效(踢球后闪现文字) */
  playFlashHint(text: string): void {
    const hint = this.scene.add
      .text(this.x, this.y - 120, text, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '32px',
        color: '#ffd166',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 20, y: 12 }
      })
      .setOrigin(0.5)
    this.scene.tweens.add({
      targets: hint,
      y: hint.y - 80,
      alpha: 0,
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => hint.destroy()
    })
  }
}

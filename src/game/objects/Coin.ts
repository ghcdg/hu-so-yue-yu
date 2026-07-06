/**
 * Coin - 粤语金币
 *
 * 设计依据:DATA_MODEL.md CoinData + GAME_DESIGN.md 第七章收集系统
 * 视觉:TextSprite(object 类型),印粤语字
 * 物理:无重力悬浮,bounce 动效
 * 拾取:overlap 检测 → collect() → 拾取动效 → 销毁 → emit 事件
 */
import Phaser from 'phaser'
import { TextSprite } from '@/game/objects/TextSprite'

export class Coin extends TextSprite {
  readonly word: string
  readonly jyutping: string
  private collected = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    word: string,
    jyutping: string
  ) {
    super(scene, x, y, {
      type: 'object',
      text: word,
      subtitle: '粤语金币',
      suffix: '.jpg',
      size: { width: 40, height: 40 },
      borderWidth: 2,
      animation: 'bounce'
    })
    this.word = word
    this.jyutping = jyutping

    // 物理体:无重力悬浮
    scene.physics.add.existing(this)
    const body = this.body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setImmovable(true)
  }

  /** 拾取(返回是否成功,已拾取返回 false) */
  collect(): boolean {
    if (this.collected) return false
    this.collected = true

    // 拾取动效:放大 + 淡出
    this.scene.tweens.add({
      targets: this,
      scaleX: this.scaleX * 1.6,
      scaleY: this.scaleY * 1.6,
      alpha: 0,
      duration: 220,
      ease: 'Cubic.easeOut',
      onComplete: () => this.destroy()
    })
    return true
  }

  isCollected(): boolean {
    return this.collected
  }
}

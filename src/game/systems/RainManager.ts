/**
 * RainManager - 雨天效果管理器（v0.4 独立模块）
 *
 * 核心能力:
 * - 创建 N 个 TextSprite 雨滴，物理体驱动下落
 * - 雨滴落出屏幕底部自动回收到顶部循环利用
 * - 雨滴受 physics.world.timeScale 自动控制（配合 SlowMoManager）
 * - 非单例，每个场景可独立创建
 *
 * 使用方式:
 *   const rain = new RainManager(scene, { count: 60, speed: 400, worldW: 800, worldH: 600 })
 *   rain.update()   // 在场景 update() 中每帧调用
 *   rain.destroy()  // 场景关闭时清理
 */
import Phaser from 'phaser'
import { TextSprite } from '@/game/objects/TextSprite'

export interface RainConfig {
  /** 雨滴数量 */
  count: number
  /** 下落速度(px/s) */
  speed: number
  /** 世界宽度 */
  worldW: number
  /** 世界高度 */
  worldH: number
  /** 雨滴颜色 */
  color?: string
  /** 雨滴宽度 */
  dropWidth?: number
  /** 雨滴高度 */
  dropHeight?: number
}

export class RainManager {
  private scene: Phaser.Scene
  private config: RainConfig
  private drops: TextSprite[] = []

  constructor(scene: Phaser.Scene, config: RainConfig) {
    this.scene = scene
    this.config = {
      color: '#aaccff',
      dropWidth: 6,
      dropHeight: 24,
      ...config
    }
    this.createDrops()
  }

  /** 创建雨滴对象池 */
  private createDrops(): void {
    const { count, worldW, worldH, speed, color, dropWidth, dropHeight } = this.config

    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, worldW)
      const y = Phaser.Math.Between(0, worldH) // 初始随机高度，看起来自然

      const drop = new TextSprite(this.scene, x, y, {
        type: 'object',
        text: '',
        size: { width: dropWidth!, height: dropHeight! },
        bgColor: color,
        borderWidth: 0
      })
      drop.setDepth(1) // 在平台之上，不遮挡 NPC

      this.scene.physics.add.existing(drop)
      const body = drop.body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)  // 用手动速度，不用重力
      body.setVelocityY(speed)

      this.drops.push(drop)
    }
  }

  /** 每帧更新：回收落出屏幕的雨滴 */
  update(): void {
    const { worldW, worldH, speed } = this.config

    for (const drop of this.drops) {
      if (!drop.active) continue
      if (drop.y > worldH + 40) {
        const body = drop.body as Phaser.Physics.Arcade.Body
        const newX = Phaser.Math.Between(0, worldW)
        const newY = Phaser.Math.Between(-40, 0)
        // reset() 会重置 allowGravity 为 true,需手动关掉
        body.reset(newX, newY)
        body.setAllowGravity(false)
        body.setVelocityY(speed)
      }
    }
  }

  /** 清理所有雨滴 */
  destroy(): void {
    for (const drop of this.drops) {
      if (drop.active) {
        drop.destroy()
      }
    }
    this.drops = []
  }
}
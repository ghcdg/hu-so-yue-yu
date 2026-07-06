/**
 * Phaser 游戏实例工厂
 *
 * 职责:接收 Vue 提供的 DOM 容器,创建 Phaser.Game 实例
 * 设计:Vue 负责容器生命周期,Phaser 负责游戏内容
 * 详见 TECH_ARCH.md 第四章
 */
import Phaser from 'phaser'
import { GAME_SIZE } from '@/shared/constants'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_SIZE.WIDTH,
    height: GAME_SIZE.HEIGHT,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 1200 },
        debug: false
      }
    },
    scene: [BootScene, PreloadScene, LevelScene, UIScene]
  })
}

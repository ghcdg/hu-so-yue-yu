/**
 * Phaser 游戏实例工厂
 *
 * 职责:接收 Vue 提供的 DOM 容器,创建 Phaser.Game 实例
 * 设计:Vue 负责容器生命周期,Phaser 负责游戏内容
 * 详见 TECH_ARCH.md 第四章
 */
import Phaser from 'phaser'
import { GAME_SIZE, PHYSICS } from '@/shared/constants'
import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { LevelScene } from './scenes/LevelScene'
import { UIScene } from './scenes/UIScene'
import { ChaseScene } from './scenes/ChaseScene'
import { FindDifferenceScene } from './scenes/FindDifferenceScene'
import { speakerManager } from '@/speakers/SpeakerManager'
import { JyutpingSpeaker } from '@/speakers/JyutpingSpeaker'
import { WebSpeechSpeaker } from '@/speakers/WebSpeechSpeaker'

export function createPhaserGame(parent: HTMLElement): Phaser.Game {
  // 注册发音引擎(第一个注册的设为 current)
  // Demo 阶段:WebSpeech 普通话优先(发音完整),Jyutping 备选
  speakerManager.register(new WebSpeechSpeaker())
  speakerManager.register(new JyutpingSpeaker())

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_SIZE.WIDTH,
    height: GAME_SIZE.HEIGHT,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.NONE
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: PHYSICS.GRAVITY },
        debug: false
      }
    },
    scene: [BootScene, PreloadScene, LevelScene, UIScene, ChaseScene, FindDifferenceScene]
  })

  // 响应式 zoom: 一次缩放到位，避免 FIT 模式二次缩放导致文字模糊
  // 窗口 >= 1280×720 时 cap 在 0.5（2x 像素密度），窗口更小时自适应填满
  const updateZoom = () => {
    const pw = game.scale.parent.clientWidth
    const ph = game.scale.parent.clientHeight
    const zoom = Math.min(pw / GAME_SIZE.WIDTH, ph / GAME_SIZE.HEIGHT, 0.5)
    game.scale.setZoom(zoom)
  }
  updateZoom()
  window.addEventListener('resize', updateZoom)
  // 场景 shutdown 时移除监听
  game.events.once('destroy', () => {
    window.removeEventListener('resize', updateZoom)
  })

  return game
}

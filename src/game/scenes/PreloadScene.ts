/**
 * PreloadScene - 资源预加载
 * 职责:加载关卡 JSON / 音频 / 字体(阶段2为空),完成后启动 LevelScene
 *
 * 时序:PreloadScene.create → start LevelScene → LevelScene.create 末尾 launch UIScene
 * 这样 UIScene.create 时 LevelScene 已存在,可安全监听其 events
 */
import Phaser from 'phaser'
import { SCENE } from '@/shared/constants'

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE.PRELOAD)
  }

  preload(): void {
    // 阶段2:无资源加载
    // 阶段3:加载关卡 JSON / 音频 / 字体
  }

  create(): void {
    console.log('[PreloadScene] 资源就绪, 跳转 LevelScene')
    try {
      this.scene.start(SCENE.LEVEL)
    } catch (err) {
      console.error('[PreloadScene] 出错:', err)
    }
  }
}

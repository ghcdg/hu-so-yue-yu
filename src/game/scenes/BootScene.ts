/**
 * BootScene - Phaser 启动场景
 * 职责:初始化引擎配置,跳转 PreloadScene
 * 详见 TECH_ARCH.md 5.1 节
 */
import Phaser from 'phaser'
import { SCENE } from '@/shared/constants'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.BOOT)
  }

  create(): void {
    this.scene.start(SCENE.PRELOAD)
  }
}

/**
 * UIScene - 游戏内 HUD / 对话卡片叠加层
 * 职责:显示 HUD / 对话卡片 / 全局提示 / 句子揭示
 * 详见 TECH_ARCH.md 5.3 节
 *
 * 原则:不处理游戏逻辑,只响应 LevelScene 的事件
 * 阶段2:仅显示金币数 / 隐藏数占位 HUD
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'

export class UIScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text
  private hiddenText!: Phaser.GameObjects.Text

  constructor() {
    super(SCENE.UI)
  }

  create(): void {
    const { WIDTH } = GAME_SIZE

    // 顶部 HUD 半透明背景
    this.add.rectangle(0, 0, WIDTH, 48, COLORS.BG_LIGHT, 0.85).setOrigin(0, 0)

    this.coinText = this.add.text(20, 14, '粤语金币: 0', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
      color: '#ffd166'
    })

    this.hiddenText = this.add.text(220, 14, '隐藏发现: 0', {
      fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
      fontSize: '18px',
      color: '#ef476f'
    })

    this.add
      .text(WIDTH - 20, 14, 'ESC = 模拟通关返回', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#a0a0c0'
      })
      .setOrigin(1, 0)

    // 监听 LevelScene 的 HUD 更新事件
    const levelScene = this.scene.get(SCENE.LEVEL)
    levelScene.events.on(
      'hud-update',
      (data: { coins: number; hidden: number }) => {
        this.coinText.setText(`粤语金币: ${data.coins}`)
        this.hiddenText.setText(`隐藏发现: ${data.hidden}`)
      }
    )
  }
}

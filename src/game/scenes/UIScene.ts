/**
 * UIScene - 游戏内 HUD / 对话卡片 / 句子揭示叠加层
 * 职责:显示 HUD / 对话卡片 / 全局提示 / 句子揭示
 * 详见 TECH_ARCH.md 5.3 节
 *
 * 原则:不处理游戏逻辑,只响应 LevelScene 的事件
 *
 * 监听事件(来自 LevelScene.events):
 * - 'hud-update':更新金币/隐藏数
 * - 'show-dialog':显示对话卡片
 * - 'close-dialog':隐藏对话卡片
 * - 'reveal-sentence':显示句子揭示全屏卡片
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { TextSprite } from '@/game/objects/TextSprite'
import type { DialogueData } from '@/game/data/types'
import type { Sentence } from '@/shared/types'

export class UIScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text
  private hiddenText!: Phaser.GameObjects.Text

  // 对话卡片
  private dialogCard: TextSprite | null = null
  private dialogHint!: Phaser.GameObjects.Text

  // 揭示卡片
  private revealOverlay: Phaser.GameObjects.Rectangle | null = null
  private revealCard: TextSprite | null = null
  private revealSource!: Phaser.GameObjects.Text
  private revealHint!: Phaser.GameObjects.Text

  constructor() {
    super(SCENE.UI)
  }

  create(): void {
    const { WIDTH } = GAME_SIZE

    // ── 顶部 HUD ──
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
      .text(WIDTH - 20, 14, 'ESC = 通关结算', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#a0a0c0'
      })
      .setOrigin(1, 0)

    // 对话提示(初始隐藏)
    this.dialogHint = this.add
      .text(WIDTH / 2, GAME_SIZE.HEIGHT - 50, '按 E 继续 / 走开关闭', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)
      .setVisible(false)

    // ── 监听 LevelScene 事件 ──
    const levelScene = this.scene.get(SCENE.LEVEL)

    levelScene.events.on('hud-update', (data: { coins: number; hidden: number }) => {
      this.coinText.setText(`粤语金币: ${data.coins}`)
      this.hiddenText.setText(`隐藏发现: ${data.hidden}`)
    })

    levelScene.events.on('show-dialog', (line: DialogueData) => {
      this.showDialog(line)
    })

    levelScene.events.on('close-dialog', () => {
      this.hideDialog()
    })

    levelScene.events.on('reveal-sentence', (sentence: Sentence) => {
      this.showReveal(sentence)
    })
  }

  // ──────────────────────────────────────────────
  // 对话卡片
  // ──────────────────────────────────────────────

  private showDialog(line: DialogueData): void {
    this.hideDialog()

    const { WIDTH, HEIGHT } = GAME_SIZE
    const cardW = 760
    const cardH = 120

    this.dialogCard = new TextSprite(this, WIDTH / 2, HEIGHT - 110, {
      type: 'dialogue',
      text: line.text,
      subtitle: line.speaker,
      suffix: '.jpg',
      size: { width: cardW, height: cardH }
    })
    this.children.bringToTop(this.dialogHint)
    this.dialogHint.setVisible(true)
  }

  private hideDialog(): void {
    this.dialogCard?.destroy()
    this.dialogCard = null
    this.dialogHint.setVisible(false)
  }

  // ──────────────────────────────────────────────
  // 句子揭示全屏卡片
  // ──────────────────────────────────────────────

  private showReveal(sentence: Sentence): void {
    const { WIDTH, HEIGHT } = GAME_SIZE

    // 半透明遮罩
    this.revealOverlay = this.add
      .rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.75)
      .setOrigin(0.5)

    // 揭示卡片(result 类型)
    const cardW = 720
    const cardH = 280
    this.revealCard = new TextSprite(this, WIDTH / 2, HEIGHT / 2 - 20, {
      type: 'result',
      text: sentence.cantonese,
      subtitle: sentence.jyutping,
      suffix: '.jpg',
      size: { width: cardW, height: cardH }
    })

    // 普通话释义
    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, sentence.mandarin, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#a0a0c0',
        align: 'center',
        wordWrap: { width: cardW - 40 }
      })
      .setOrigin(0.5)

    // 来源
    if (sentence.source) {
      this.revealSource = this.add
        .text(WIDTH / 2, HEIGHT / 2 + 120, `—— ${sentence.source}`, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '14px',
          color: '#6a6a8a'
        })
        .setOrigin(0.5)
    }

    // 提示
    this.revealHint = this.add
      .text(WIDTH / 2, HEIGHT - 60, '按任意键继续(ESC 通关结算)', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    // 任意键关闭
    this.input.keyboard?.once('keydown', () => this.hideReveal())
  }

  private hideReveal(): void {
    this.revealOverlay?.destroy()
    this.revealCard?.destroy()
    this.revealSource?.destroy()
    this.revealHint?.destroy()
    this.revealOverlay = null
    this.revealCard = null
  }
}

/**
 * UIScene - 游戏内 HUD / 对话 / 揭示叠加层
 * 职责:显示 HUD / 对话卡片 / 互动提示 / Toast / 句子揭示
 * 详见 TECH_ARCH.md 5.3 节
 *
 * 原则:不处理游戏逻辑,只响应 LevelScene 的事件
 *
 * 监听事件(来自 LevelScene.events):
 * - 'hud-update':更新金币数
 * - 'show-dialog' / 'close-dialog':对话卡片
 * - 'show-interact-hint' / 'hide-interact-hint':互动提示
 * - 'show-toast':Toast 提示(捡金币/触发机关等)
 * - 'reveal-sentence':句子揭示全屏卡片
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { TextSprite } from '@/game/objects/TextSprite'
import type { DialogueData } from '@/game/data/types'
import type { Sentence } from '@/shared/types'

export class UIScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text

  // 对话卡片
  private dialogCard: TextSprite | null = null
  private dialogSpeaker!: Phaser.GameObjects.Text
  private dialogHint!: Phaser.GameObjects.Text

  // 互动提示(靠近可互动物件时显示)
  private interactHint!: Phaser.GameObjects.Text

  // Toast 提示
  private toastText: Phaser.GameObjects.Text | null = null

  // 揭示卡片
  private revealOverlay: Phaser.GameObjects.Rectangle | null = null
  private revealCard: TextSprite | null = null
  private revealSource!: Phaser.GameObjects.Text
  private revealHint!: Phaser.GameObjects.Text
  /** reveal 模式下键盘监听器引用(用于 shutdown 清理) */
  private revealKeyHandler: (() => void) | null = null

  constructor() {
    super(SCENE.UI)
  }

  create(): void {
    const { WIDTH } = GAME_SIZE

    // ── 顶部 HUD ──
    this.add.rectangle(0, 0, WIDTH, 96, COLORS.BG_LIGHT, 0.85).setOrigin(0, 0).setScrollFactor(0)
    this.coinText = this.add
      .text(40, 28, '金币: 0', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '36px',
        color: '#ffd166'
      })
      .setScrollFactor(0)
    this.add
      .text(WIDTH - 40, 28, 'ESC = 通关结算', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '28px',
        color: '#a0a0c0'
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)

    // 对话说话人标签(初始隐藏,位于气泡上方)
    this.dialogSpeaker = this.add
      .text(WIDTH / 2, 0, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '24px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false)

    // 对话提示(初始隐藏,位于气泡下方)
    this.dialogHint = this.add
      .text(WIDTH / 2, 0, '按 E 继续 / 走开关闭', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '24px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false)

    // 互动提示(初始隐藏,靠近可互动物件时显示)
    this.interactHint = this.add
      .text(WIDTH / 2, GAME_SIZE.HEIGHT - 160, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '30px',
        color: '#ffd166',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 20, y: 12 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false)

    // ── 监听 LevelScene 事件 ──
    const levelScene = this.scene.get(SCENE.LEVEL)

    levelScene.events.on('hud-update', (data: { coins: number }) => {
      this.coinText.setText(`金币: ${data.coins}`)
    })

    levelScene.events.on('show-dialog', (line: DialogueData) => {
      this.showDialog(line)
    })

    levelScene.events.on('close-dialog', () => {
      this.hideDialog()
    })

    levelScene.events.on('show-interact-hint', (hint: string) => {
      this.interactHint.setText(hint).setVisible(true)
    })

    levelScene.events.on('hide-interact-hint', () => {
      this.interactHint.setVisible(false)
    })

    levelScene.events.on('show-toast', (text: string) => {
      this.showToast(text)
    })

    levelScene.events.on('reveal-sentence', (sentence: Sentence) => {
      this.showReveal(sentence)
    })
  }

  // ──────────────────────────────────────────────
  // 对话卡片(底部聊天气泡)
  // ──────────────────────────────────────────────

  private showDialog(line: DialogueData): void {
    this.hideDialog()

    const { WIDTH, HEIGHT } = GAME_SIZE
    const cardW = 760
    const cardH = 110

    // 说话人标签(气泡上方)
    this.dialogSpeaker
      .setPosition(WIDTH / 2, HEIGHT - 350)
      .setText(line.speaker)
      .setVisible(true)

    // 气泡卡片
    this.dialogCard = new TextSprite(this, WIDTH / 2, HEIGHT - 260, {
      type: 'dialogue',
      text: line.text,
      size: { width: cardW, height: cardH }
    })
    this.dialogCard.setScrollFactor(0)

    // 操作提示(气泡下方)
    this.dialogHint
      .setPosition(WIDTH / 2, HEIGHT - 160)
      .setVisible(true)
  }

  private hideDialog(): void {
    this.dialogCard?.destroy()
    this.dialogCard = null
    this.dialogSpeaker.setVisible(false)
    this.dialogHint.setVisible(false)
  }

  // ──────────────────────────────────────────────
  // Toast 提示(短暂显示)
  // ──────────────────────────────────────────────

  private showToast(text: string): void {
    this.toastText?.destroy()
    const { WIDTH, HEIGHT } = GAME_SIZE
    this.toastText = this.add
      .text(WIDTH / 2, HEIGHT - 320, text, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '30px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 28, y: 16 },
        align: 'center',
        wordWrap: { width: 1200 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
    this.children.bringToTop(this.toastText)
    this.tweens.add({
      targets: this.toastText,
      alpha: 0,
      duration: 2500,
      delay: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.toastText?.destroy()
        this.toastText = null
      }
    })
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
      .setScrollFactor(0)

    // 揭示卡片(result 类型)
    const cardW = 1440
    const cardH = 560
    this.revealCard = new TextSprite(this, WIDTH / 2, HEIGHT / 2 - 40, {
      type: 'result',
      text: sentence.cantonese,
      subtitle: sentence.jyutping,
      suffix: '.jpg',
      size: { width: cardW, height: cardH }
    })
    this.revealCard.setScrollFactor(0)

    // 普通话释义
    const mandarinText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 160, sentence.mandarin, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '36px',
        color: '#a0a0c0',
        align: 'center',
        wordWrap: { width: cardW - 80 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 来源
    if (sentence.source) {
      this.revealSource = this.add
        .text(WIDTH / 2, HEIGHT / 2 + 240, `—— ${sentence.source}`, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '28px',
        color: '#6a6a8a'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
    }

    // 提示
    this.revealHint = this.add
      .text(WIDTH / 2, HEIGHT - 120, '按任意键继续(ESC 通关结算)', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '28px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 任意键关闭(用 once 避免重复)
    const handler = () => {
      this.revealCard?.destroy()
      this.revealOverlay?.destroy()
      this.revealSource?.destroy()
      this.revealHint?.destroy()
      mandarinText.destroy()
      this.revealCard = null
      this.revealOverlay = null
      this.revealKeyHandler = null
      // 移除监听器
      this.input.keyboard?.off('keydown', handler)
    }
    this.revealKeyHandler = handler
    this.input.keyboard?.once('keydown', handler)

    // 场景关闭时清理
    this.events.on('shutdown', this.onShutdown, this)
  }

  /** 场景关闭时清理(防止内存泄漏) */
  private onShutdown(): void {
    this.events.off('shutdown', this.onShutdown, this)
    // 清理 reveal 键盘监听器
    if (this.revealKeyHandler) {
      this.input.keyboard?.off('keydown', this.revealKeyHandler)
      this.revealKeyHandler = null
    }
  }
}

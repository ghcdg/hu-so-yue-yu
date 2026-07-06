/**
 * UIScene - 游戏内 HUD / 对话 / 惊喜 / 揭示叠加层
 * 职责:显示 HUD / 对话卡片 / 互动提示 / Toast / 惊喜三段式 / 句子揭示
 * 详见 TECH_ARCH.md 5.3 节
 *
 * 原则:不处理游戏逻辑,只响应 LevelScene 的事件
 *
 * 监听事件(来自 LevelScene.events):
 * - 'hud-update':更新金币/隐藏数
 * - 'show-dialog' / 'close-dialog':对话卡片
 * - 'show-interact-hint' / 'hide-interact-hint':互动提示
 * - 'show-toast':Toast 提示(捡金币/触发机关等)
 * - 'surprise-setup':惊喜阶段1 铺垫提示卡片
 * - 'surprise-reveal':惊喜阶段2 角色揭示
 * - 'hide-surprise-reveal':销毁惊喜揭示卡片(对话关闭时)
 * - 'reveal-sentence':句子揭示全屏卡片
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { TextSprite } from '@/game/objects/TextSprite'
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { DialogueData } from '@/game/data/types'
import type { Sentence } from '@/shared/types'

export class UIScene extends Phaser.Scene {
  private coinText!: Phaser.GameObjects.Text
  private hiddenText!: Phaser.GameObjects.Text

  // 对话卡片
  private dialogCard: TextSprite | null = null
  private dialogHint!: Phaser.GameObjects.Text

  // 互动提示(靠近可互动物件时显示)
  private interactHint!: Phaser.GameObjects.Text

  // Toast 提示
  private toastText: Phaser.GameObjects.Text | null = null

  // 惊喜卡片(阶段1/2)
  private surpriseSetupCard: TextSprite | null = null
  private surpriseRevealCard: TextSprite | null = null

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
    this.add.rectangle(0, 0, WIDTH, 48, COLORS.BG_LIGHT, 0.85).setOrigin(0, 0).setScrollFactor(0)
    this.coinText = this.add
      .text(20, 14, '粤语金币: 0', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ffd166'
      })
      .setScrollFactor(0)
    this.hiddenText = this.add
      .text(220, 14, '隐藏发现: 0', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ef476f'
      })
      .setScrollFactor(0)
    this.add
      .text(WIDTH - 20, 14, 'ESC = 通关结算', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#a0a0c0'
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)

    // 对话提示(初始隐藏)
    this.dialogHint = this.add
      .text(WIDTH / 2, GAME_SIZE.HEIGHT - 50, '按 E 继续 / 走开关闭', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '13px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false)

    // 互动提示(初始隐藏,靠近可互动物件时显示)
    this.interactHint = this.add
      .text(WIDTH / 2, GAME_SIZE.HEIGHT - 80, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: '#ffd166',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: { x: 10, y: 6 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
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

    levelScene.events.on('show-interact-hint', (hint: string) => {
      this.interactHint.setText(hint).setVisible(true)
    })

    levelScene.events.on('hide-interact-hint', () => {
      this.interactHint.setVisible(false)
    })

    levelScene.events.on('show-toast', (text: string) => {
      this.showToast(text)
    })

    // 惊喜阶段1:铺垫提示卡片
    levelScene.events.on('surprise-setup', (cardConfig: TextSpriteConfig) => {
      this.showSurpriseSetup(cardConfig)
    })

    // 惊喜阶段2:角色揭示
    levelScene.events.on(
      'surprise-reveal',
      (data: { characterCard: TextSpriteConfig; scrollText: string }) => {
        this.showSurpriseReveal(data.characterCard, data.scrollText)
      }
    )

    levelScene.events.on('reveal-sentence', (sentence: Sentence) => {
      this.showReveal(sentence)
    })

    // 惊喜揭示卡片销毁(对话关闭时触发)
    levelScene.events.on('hide-surprise-reveal', () => {
      this.hideSurpriseReveal()
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
    this.dialogCard.setScrollFactor(0)
    this.children.bringToTop(this.dialogHint)
    this.dialogHint.setVisible(true)
  }

  private hideDialog(): void {
    this.dialogCard?.destroy()
    this.dialogCard = null
    this.dialogHint.setVisible(false)
  }

  // ──────────────────────────────────────────────
  // Toast 提示(短暂显示)
  // ──────────────────────────────────────────────

  private showToast(text: string): void {
    this.toastText?.destroy()
    const { WIDTH, HEIGHT } = GAME_SIZE
    this.toastText = this.add
      .text(WIDTH / 2, HEIGHT - 160, text, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 14, y: 8 },
        align: 'center',
        wordWrap: { width: 600 }
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
  // 惊喜三段式
  // ──────────────────────────────────────────────

  /** 阶段1:铺垫提示卡片(屏幕中上方,显示 delayMs 后自动消失) */
  private showSurpriseSetup(cardConfig: TextSpriteConfig): void {
    this.surpriseSetupCard?.destroy()
    const { WIDTH } = GAME_SIZE
    this.surpriseSetupCard = new TextSprite(this, WIDTH / 2, 120, {
      ...cardConfig,
      animation: 'glow'
    })
    this.surpriseSetupCard.setScrollFactor(0)
    this.children.bringToTop(this.surpriseSetupCard)
  }

  /** 阶段2:角色揭示(中央偏上卡片 + 滚动文字,由对话关闭时销毁) */
  private showSurpriseReveal(cardConfig: TextSpriteConfig, scrollText: string): void {
    // 销毁阶段1卡片
    this.surpriseSetupCard?.destroy()
    this.surpriseSetupCard = null

    const { WIDTH, HEIGHT } = GAME_SIZE
    // 位置上移到 HEIGHT/2-140,让玩家(屏幕中央)不被卡片遮挡
    this.surpriseRevealCard = new TextSprite(this, WIDTH / 2, HEIGHT / 2 - 140, {
      ...cardConfig,
      suffix: '.gif',
      text: scrollText
    })
    this.surpriseRevealCard.setScrollFactor(0)
    this.children.bringToTop(this.surpriseRevealCard)
  }

  /** 销毁惊喜揭示卡片(由 LevelScene 对话关闭时触发) */
  private hideSurpriseReveal(): void {
    this.surpriseRevealCard?.destroy()
    this.surpriseRevealCard = null
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
    const cardW = 720
    const cardH = 280
    this.revealCard = new TextSprite(this, WIDTH / 2, HEIGHT / 2 - 20, {
      type: 'result',
      text: sentence.cantonese,
      subtitle: sentence.jyutping,
      suffix: '.jpg',
      size: { width: cardW, height: cardH }
    })
    this.revealCard.setScrollFactor(0)

    // 普通话释义
    const mandarinText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 80, sentence.mandarin, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#a0a0c0',
        align: 'center',
        wordWrap: { width: cardW - 40 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 来源
    if (sentence.source) {
      this.revealSource = this.add
        .text(WIDTH / 2, HEIGHT / 2 + 120, `—— ${sentence.source}`, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '14px',
          color: '#6a6a8a'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
    }

    // 提示
    this.revealHint = this.add
      .text(WIDTH / 2, HEIGHT - 60, '按任意键继续(ESC 通关结算)', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 任意键关闭(用 once 避免重复)
    this.input.keyboard?.once('keydown', () => {
      this.revealCard?.destroy()
      this.revealOverlay?.destroy()
      this.revealSource?.destroy()
      this.revealHint?.destroy()
      mandarinText.destroy()
      this.revealCard = null
      this.revealOverlay = null
    })
  }
}

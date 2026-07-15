/**
 * UIScene - 游戏内 HUD / 对话 / 揭示叠加层
 * 职责:显示 HUD / 对话卡片 / 互动提示 / Toast / 句子揭示
 * 详见 TECH_ARCH.md 5.3 节
 *
 * 原则:不处理游戏逻辑,只响应 LevelScene 的事件
 *
 * 监听事件(来自 LevelScene.events):
 * - 'show-dialog' / 'close-dialog':对话卡片
 * - 'show-interact-hint' / 'hide-interact-hint':互动提示
 * - 'show-toast':Toast 提示(捡金币/触发机关等)
 * - 'reveal-sentence':句子揭示全屏卡片
 * - 'task-update':任务状态更新
 * - 'collection-update':收集文字更新
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { TextSprite } from '@/game/objects/TextSprite'
import type { DialogueData } from '@/game/data/types'
import type { Sentence } from '@/shared/types'
import { CantoneseSpeaker } from '@/speakers/CantoneseSpeaker'

export class UIScene extends Phaser.Scene {

  // ── 顶部 HUD ──
  private taskText!: Phaser.GameObjects.Text
  private collectionText!: Phaser.GameObjects.Text

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

  // ── 任务/收集状态 ──
  private chaseCompleted = false
  private findDiffCompleted = false
  private collectedWords: string[] = []

  // ── ESC 退出确认 ──
  private confirmingExit = false
  private exitConfirmBg: Phaser.GameObjects.Graphics | null = null
  private exitConfirmText: Phaser.GameObjects.Text | null = null

  // ── 粤语 TTS ──
  private cantoneseSpeaker = new CantoneseSpeaker()

  constructor() {
    super(SCENE.UI)
  }

  create(): void {
    const { WIDTH } = GAME_SIZE
    const HUD_HEIGHT = 80

    // ── 顶部 HUD 背景 ──
    this.add
      .rectangle(0, 0, WIDTH, HUD_HEIGHT, COLORS.BG_LIGHT, 0.9)
      .setOrigin(0, 0)
      .setScrollFactor(0)

    // 操作提示(左侧)
    this.add
      .text(24, HUD_HEIGHT / 2, '方向键: ←左/右→ 移动 · 空格/上↑ 跳跃 · E 互动 · ESC 退出', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        color: '#a0a0c0'
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)

    // 任务状态(居中偏右)
    this.taskText = this.add
      .text(WIDTH / 2 + 160, HUD_HEIGHT / 2, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 收集文字(右侧)
    this.collectionText = this.add
      .text(WIDTH - 24, HUD_HEIGHT / 2, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '26px',
        color: '#a0a0c0'
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)

    // 初始化任务显示
    this.updateTaskDisplay()
    this.updateCollectionDisplay()

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

    // 任务状态更新
    levelScene.events.on('task-update', (data: { chase: boolean; findDifference: boolean }) => {
      this.chaseCompleted = data.chase
      this.findDiffCompleted = data.findDifference
      this.updateTaskDisplay()
    })

    // 收集文字更新
    levelScene.events.on('collection-update', (data: { words: string[] }) => {
      this.collectedWords = data.words
      this.updateCollectionDisplay()
    })

    // ── ESC 退出确认 ──
    levelScene.events.on('show-exit-confirm', () => {
      this.showExitConfirm()
    })

    // Y 确认退出 / N 取消
    this.input.keyboard?.on('keydown-Y', () => {
      if (this.confirmingExit) {
        this.hideExitConfirm()
        levelScene.events.emit('confirm-exit')
      }
    })
    this.input.keyboard?.on('keydown-N', () => {
      if (this.confirmingExit) {
        this.hideExitConfirm()
      }
    })
  }

  /** 更新任务状态显示 */
  private updateTaskDisplay(): void {
    const chase = this.chaseCompleted ? '✓' : '待完成'
    const diff = this.findDiffCompleted ? '✓' : '待完成'
    this.taskText.setText(`任务1: 和老伯聊天 [${chase}]    任务2:找咸鱼 [${diff}]`)
  }

  /** 更新收集文字显示 */
  private updateCollectionDisplay(): void {
    if (this.collectedWords.length === 0) {
      this.collectionText.setText('')
      return
    }
    // 文字拼音映射
    const pinyinMap: Record<string, string> = {
      '梦想': 'mung6 soeng2',
      '咸鱼': 'haam4 jyu4'
    }
    // 按顺序分组显示（梦+想 → 梦想，咸+鱼 → 咸鱼）
    const joined = this.collectedWords.join('')
    const items: string[] = []
    for (const [word, pinyin] of Object.entries(pinyinMap)) {
      if (joined.includes(word)) {
        items.push(`${word}(${pinyin})`)
      }
    }
    this.collectionText.setText(`背包: ${items.join(' ')}`)
  }

  // ──────────────────────────────────────────────
  // 对话卡片(底部聊天气泡)
  // ──────────────────────────────────────────────

  /** 显示退出确认弹窗 */
  private showExitConfirm(): void {
    if (this.confirmingExit) return
    this.confirmingExit = true
    const { WIDTH, HEIGHT } = GAME_SIZE

    this.exitConfirmBg = this.add.graphics()
    this.exitConfirmBg.fillStyle(0x000000, 0.7)
    this.exitConfirmBg.fillRect(0, 0, WIDTH, HEIGHT)
    this.exitConfirmBg.setScrollFactor(0)
    this.exitConfirmBg.setDepth(500)

    this.exitConfirmText = this.add
      .text(WIDTH / 2, HEIGHT / 2, '确定要退出关卡吗？\n按 Y 确认 / 按 N 取消', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: { x: 40, y: 30 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(501)
  }

  /** 隐藏退出确认弹窗 */
  private hideExitConfirm(): void {
    this.confirmingExit = false
    this.exitConfirmBg?.destroy()
    this.exitConfirmBg = null
    this.exitConfirmText?.destroy()
    this.exitConfirmText = null
  }

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
    const { WIDTH } = GAME_SIZE

    // 获取 player 的屏幕坐标，将 toast 放在 player 头部上方 20px
    let toastX = WIDTH / 2
    let toastY = 200
    const levelScene = this.scene.get(SCENE.LEVEL)
    if (levelScene) {
      const player = (levelScene as any).player
      if (player) {
        const cam = levelScene.cameras.main
        toastX = player.x - cam.scrollX
        // player 卡片高度约 60px，头部在 y - 30 处，再往上 50px
        toastY = player.y - 30 - 80 - cam.scrollY
      }
    }

    this.toastText = this.add
      .text(toastX, toastY, text, {
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
      duration: 4000,
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

    // 揭示卡片(result 类型, 3400×1500)
    // 显示 cantonese_show(含粤拼标注), 文字统一 80px
    const cardW = 3400
    const cardH = 1500
    this.revealCard = new TextSprite(this, WIDTH / 2, HEIGHT / 2, {
      type: 'result',
      text: sentence.cantonese_show,
      size: { width: cardW, height: cardH }
    })
    this.revealCard.setScrollFactor(0)
    this.revealCard.setFontSize(80)

    // 普通话释义(与粤语上下对齐, 80px)
    const mandarinText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 160, sentence.mandarin_show, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '80px',
        color: '#a0a0c0',
        align: 'center',
        wordWrap: { width: cardW - 80 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 来源(80px)
    if (sentence.source) {
      this.revealSource = this.add
        .text(WIDTH / 2, HEIGHT / 2 + 260, `—— ${sentence.source}`, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '80px',
        color: '#6a6a8a'
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
    }

    // 提示
    this.revealHint = this.add
      .text(WIDTH / 2, HEIGHT - 100, '按任意键继续(ESC 通关结算)', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '28px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    // 粤语 TTS 朗读 cantonese_read(fire-and-forget)
    void this.cantoneseSpeaker.speak(sentence.cantonese_read)

    // 任意键关闭(用 once 避免重复)
    const handler = () => {
      this.cantoneseSpeaker.stop()
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
    this.cantoneseSpeaker.stop()
    // 清理 reveal 键盘监听器
    if (this.revealKeyHandler) {
      this.input.keyboard?.off('keydown', this.revealKeyHandler)
      this.revealKeyHandler = null
    }
  }
}

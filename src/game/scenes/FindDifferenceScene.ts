/**
 * FindDifferenceScene - 找区别于场景（v0.5 新增）
 *
 * 设计依据:
 * - GAME_DESIGN.md 9.6 节(FindDifference 子场景:「找区别」)
 * - 方案1: 眼力找茬 — 在一堆咸鱼中找出梦想鱼
 *
 * 核心玩法:
 * - 单轮: 45 条鱼, 难度4(发光+颜色区分)
 * - 所有鱼全画面随机移动, 随机速度, 咸鱼额外旋转干扰
 * - 27 种颜文字+emoji 混合使用, 梦想鱼和咸鱼仅靠发光+颜色区分
 * - 键盘导航: 方向键就近选中(角度判断), 绿色高亮实时跟随, E 键确认
 * - 找到梦想鱼即通关, 获得奖励文字
 */
import Phaser from 'phaser'
import { SCENE, COLORS, BORDER_RADIUS } from '@/shared/constants'
import { BaseSubScene } from '@/game/scenes/BaseSubScene'
import type { SubSceneConfig } from '@/game/scenes/BaseSubScene'
import type { FindDifferenceSceneConfig } from '@/game/data/types'
import { TextSprite } from '@/game/objects/TextSprite'
import { SfxManager } from '@/game/systems/SfxManager'

// ── 鱼卡片数据 ──

interface FishCard {
  sprite: TextSprite
  isDream: boolean
}

// ── 颜文字池（27 种，每项以"咸鱼"开头，\n 换行显示颜文字） ──

const ALL_KAOMOJI = [
  '咸鱼\n(◕‿◕)', '咸鱼\n(★ω★)', '咸鱼\n(✧∇✧)', '咸鱼\n(◠‿◠)', '咸鱼\n(≧◡≦)',     // 快乐
  '咸鱼\n(´；ω；`)', '咸鱼\n(´・ω・`)', '咸鱼\n(；一_一)', '咸鱼\n(´-ω-`)', '咸鱼\n(´△｀)',  // 悲伤
  '咸鱼\n<º)))-<',                                                                  // 鱼
  '咸鱼\n(`・ω・´)', '咸鱼\n(つд⊂)', '咸鱼\n(́◉◞౪◟◉‵)', '咸鱼\n(ง๑ •̀_•́)ง', '咸鱼\n(　˙灬˙　)', '咸鱼\n(✪ω✪)',
  '咸鱼\n(๑´ڡ`๑)', '咸鱼\n(•‾⌣‾•)', '咸鱼\n(#`皿´)', '咸鱼\nヽ(`Д´)ノ', '咸鱼\n(ノ▼Д▼)ノ',  // 其他
  '咸鱼\n><(((‘>', '咸鱼\n<*)))-<', '咸鱼\n><(((*>', '咸鱼\n<º)))-<', '咸鱼\n><((((°>',  // 鱼颜文字
]

// ── 梦想鱼 / 咸鱼 颜色映射（按区别度） ──

const DREAM_COLORS: Record<number, { border: number; text: string }> = {
  1: { border: 0xff8c00, text: '#ff8c00' },
  2: { border: 0xdd9944, text: '#dd9944' },
  3: { border: 0xbb9966, text: '#bb9966' },
  4: { border: 0xaa9977, text: '#aa9977' },
}

const SALTED_COLORS: Record<number, { border: number; text: string }> = {
  1: { border: 0x666666, text: '#666666' },
  2: { border: 0x777766, text: '#777766' },
  3: { border: 0x888877, text: '#888877' },
  4: { border: 0x999988, text: '#999988' },
}

// ── 常量 ──

const FISH_SIZE = { width: 160, height: 160 }
const PLAY_MARGIN = 120       // 移动区域边距
const MOVE_DURATION_BASE = 1200 // 移动基准时长(ms)，实际在 ±30% 范围内浮动
const MOVE_DURATION_FLOAT = 0.3 // 浮动比例
const MOVE_DELAY_MIN = 100    // 到达后最小延迟(ms)
const MOVE_DELAY_MAX = 500    // 到达后最大延迟(ms)
const ROTATE_AMP = 15          // 咸鱼旋转幅度(度)

export class FindDifferenceScene extends BaseSubScene {
  private config!: FindDifferenceSceneConfig
  private fishCount = 45
  private difficulty = 4

  // ── 状态 ──
  private fishCards: FishCard[] = []
  private dreamFishIndex = -1
  private selectedIndex = 0
  private active = false
  private movementTweens: Phaser.Tweens.Tween[] = []
  private rotationTweens: Phaser.Tweens.Tween[] = []

  // ── 梦想鱼智能 AI（前 30 秒） ──
  private smartAI = true
  private readonly disturbRadius = 250
  private readonly smartAIDuration = 30000

  // ── 高亮干扰状态 ──
  private highlightDisturbed = false
  private highlightFlickerVisible = true
  private lastFlickerTime = 0

  // ── UI 元素 ──
  private titleText!: Phaser.GameObjects.Text
  private statusText!: Phaser.GameObjects.Text
  private selectionHighlight!: Phaser.GameObjects.Graphics
  private resultContainer!: Phaser.GameObjects.Container

  constructor() {
    super(SCENE.FIND_DIFFERENCE)
  }

  // ═══════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════

  protected onSubSceneCreate(data: SubSceneConfig): void {
    this.config = data as FindDifferenceSceneConfig
    this.fishCount = this.config.fishCount || 20
    this.difficulty = this.config.difficulty || 4
    const { width: worldW, height: worldH } = this.config.worldSize

    this.cameras.main.setBackgroundColor(COLORS.BG)

    // ── 标题 ──
    this.titleText = this.add
      .text(worldW / 2, 60, '找区别', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '48px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    // ── 状态提示 ──
    this.statusText = this.add
      .text(worldW / 2, 130, '用方向键移动，按 E 选中梦想鱼', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '32px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    // ── 选中高亮（深度最高，每帧更新） ──
    this.selectionHighlight = this.add.graphics()
    this.selectionHighlight.setDepth(50)

    // ── 结果容器（初始隐藏） ──
    this.resultContainer = this.add.container(worldW / 2, worldH / 2)
    this.resultContainer.setVisible(false)
    this.resultContainer.setDepth(100)

    // ── ESC 取消 ──
    this.input.keyboard!.on('keydown-ESC', () => {
      this.cancel()
    })

    // ── 键盘导航（就近选中） ──
    this.input.keyboard!.on('keydown-LEFT', () => this.moveSelection(-1, 0))
    this.input.keyboard!.on('keydown-RIGHT', () => this.moveSelection(1, 0))
    this.input.keyboard!.on('keydown-UP', () => this.moveSelection(0, -1))
    this.input.keyboard!.on('keydown-DOWN', () => this.moveSelection(0, 1))
    this.input.keyboard!.on('keydown-E', () => this.confirmSelection())
    this.input.keyboard!.on('keydown-ENTER', () => this.confirmSelection())

    // ── 场景关闭清理 ──
    this.events.once('shutdown', () => {
      this.cleanup()
    })

    // ── 生成鱼（随机散落）、启动移动、选中初始鱼 ──
    this.generateFishGrid()

    // 初始光标放在离梦想鱼最远的鱼上，确保开局有追捕时间
    let maxDist = -1
    let farthestIndex = 0
    const dreamFish = this.fishCards[this.dreamFishIndex]
    for (let i = 0; i < this.fishCards.length; i++) {
      if (i === this.dreamFishIndex) continue
      const dist = Phaser.Math.Distance.Between(
        dreamFish.sprite.x, dreamFish.sprite.y,
        this.fishCards[i].sprite.x, this.fishCards[i].sprite.y
      )
      if (dist > maxDist) {
        maxDist = dist
        farthestIndex = i
      }
    }
    this.selectedIndex = farthestIndex

    this.startAllMovement()

    // 30 秒后取消智能 AI
    this.time.delayedCall(this.smartAIDuration, () => {
      this.smartAI = false
    })

    this.active = true
  }

  // ═══════════════════════════════════════
  // 每帧更新：高亮实时跟随
  // ═══════════════════════════════════════

  update(): void {
    if (this.active) {
      this.updateSelectionHighlight()
      this.updateDreamFishAI()
    }
  }

  // ═══════════════════════════════════════
  // 鱼网格生成
  // ═══════════════════════════════════════

  private generateFishGrid(): void {
    const { width: worldW, height: worldH } = this.config.worldSize
    const minX = PLAY_MARGIN + FISH_SIZE.width / 2
    const maxX = worldW - PLAY_MARGIN - FISH_SIZE.width / 2
    const minY = 200 + FISH_SIZE.height / 2
    const maxY = worldH - PLAY_MARGIN - FISH_SIZE.height / 2

    // 随机选择梦想鱼位置
    this.dreamFishIndex = Phaser.Math.Between(0, this.fishCount - 1)

    const diff = this.difficulty
    const dreamColor = DREAM_COLORS[diff]
    const saltedColor = SALTED_COLORS[diff]

    // 打乱颜文字池
    const shuffledKao = Phaser.Utils.Array.Shuffle([...ALL_KAOMOJI])

    for (let i = 0; i < this.fishCount; i++) {
      // 随机初始位置：全画面散落
      const x = Phaser.Math.Between(minX, maxX)
      const y = Phaser.Math.Between(minY, maxY)

      const isDream = i === this.dreamFishIndex
      const kao = shuffledKao[i % shuffledKao.length]

      const sprite = new TextSprite(this, x, y, {
        type: 'character',
        text: kao,
        size: FISH_SIZE,
        borderWidth: 4,
        borderColor: isDream ? dreamColor.border : saltedColor.border,
        textColor: isDream ? dreamColor.text : saltedColor.text,
        animation: isDream ? 'glow' : 'none',
        borderRadius: BORDER_RADIUS.MD,
      })

      // 点击选中（移动高亮到该位置）
      sprite.setInteractive(
        new Phaser.Geom.Rectangle(
          -FISH_SIZE.width / 2,
          -FISH_SIZE.height / 2,
          FISH_SIZE.width,
          FISH_SIZE.height
        ),
        Phaser.Geom.Rectangle.Contains
      )

      sprite.on('pointerdown', () => {
        if (!this.active) return
        this.selectedIndex = i
      })

      sprite.on('pointerover', () => {
        if (!this.active) return
        this.input.setDefaultCursor('pointer')
      })
      sprite.on('pointerout', () => {
        this.input.setDefaultCursor('default')
      })

      this.fishCards.push({ sprite, isDream })
    }
  }

  // ═══════════════════════════════════════
  // 移动系统：所有鱼全画面随机游走
  // ═══════════════════════════════════════

  private startAllMovement(): void {
    const { width: worldW, height: worldH } = this.config.worldSize
    const minX = PLAY_MARGIN + FISH_SIZE.width / 2
    const maxX = worldW - PLAY_MARGIN - FISH_SIZE.width / 2
    const minY = 200 + FISH_SIZE.height / 2
    const maxY = worldH - PLAY_MARGIN - FISH_SIZE.height / 2

    for (const fish of this.fishCards) {
      this.startFishMovement(fish, minX, maxX, minY, maxY)
      if (!fish.isDream) {
        this.startFishRotation(fish)
      }
    }
  }

  /** 单条鱼的随机移动循环 */
  private startFishMovement(
    fish: FishCard,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    const moveToNext = () => {
      if (!this.active || !fish.sprite.active) return

      const targetX = Phaser.Math.Between(minX, maxX)
      const targetY = Phaser.Math.Between(minY, maxY)
      const duration = Phaser.Math.Between(
        MOVE_DURATION_BASE * (1 - MOVE_DURATION_FLOAT),
        MOVE_DURATION_BASE * (1 + MOVE_DURATION_FLOAT)
      )

      const t = this.tweens.add({
        targets: fish.sprite,
        x: targetX,
        y: targetY,
        duration,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const delay = Phaser.Math.Between(MOVE_DELAY_MIN, MOVE_DELAY_MAX)
          this.time.delayedCall(delay, moveToNext)
        }
      })
      this.movementTweens.push(t)
    }

    // 初始延迟错开，避免所有鱼同时移动
    this.time.delayedCall(Phaser.Math.Between(0, 500), moveToNext)
  }

  /** 咸鱼旋转干扰循环 */
  private startFishRotation(fish: FishCard): void {
    const rotateNext = () => {
      if (!this.active || !fish.sprite.active) return

      const t = this.tweens.add({
        targets: fish.sprite,
        angle: Phaser.Math.Between(-ROTATE_AMP, ROTATE_AMP),
        duration: Phaser.Math.Between(400, 800),
        yoyo: true,
        repeat: 0,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const delay = Phaser.Math.Between(0, 300)
          this.time.delayedCall(delay, rotateNext)
        }
      })
      this.rotationTweens.push(t)
    }

    this.time.delayedCall(Phaser.Math.Between(0, 300), rotateNext)
  }

  // ═══════════════════════════════════════
  // 键盘导航：就近选中（角度判断）
  // ═══════════════════════════════════════

  /** 方向键移动选中：在当前选中鱼的方向上找最近的鱼 */
  private moveSelection(dx: number, dy: number): void {
    if (!this.active) return

    const currentFish = this.fishCards[this.selectedIndex]
    if (!currentFish) return

    const cx = currentFish.sprite.x
    const cy = currentFish.sprite.y
    const targetAngle = Math.atan2(dy, dx) // 操作方向的角度

    let bestIndex = -1
    let bestDist = Infinity
    let secondIndex = -1
    let secondDist = Infinity

    for (let i = 0; i < this.fishCards.length; i++) {
      if (i === this.selectedIndex) continue

      const fish = this.fishCards[i]
      const fx = fish.sprite.x
      const fy = fish.sprite.y

      const angle = Math.atan2(fy - cy, fx - cx)
      let angleDiff = angle - targetAngle

      // 标准化到 [-PI, PI]
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      // 在 ±25° 范围内
      if (Math.abs(angleDiff) <= Math.PI * 25 / 180) {
        const dist = Math.hypot(fx - cx, fy - cy)
        if (dist < bestDist) {
          // 当前最佳降为第二
          secondDist = bestDist
          secondIndex = bestIndex
          bestDist = dist
          bestIndex = i
        } else if (dist < secondDist) {
          secondDist = dist
          secondIndex = i
        }
      }
    }

    if (bestIndex >= 0) {
      // 滑脱：选中梦想鱼时，智能 AI 期间 90% 概率滑到旁边的非梦想鱼
      const slipChance = this.smartAI ? 0.90 : 0.15
      if (bestIndex === this.dreamFishIndex && secondIndex >= 0 && Math.random() < slipChance) {
        this.selectedIndex = secondIndex
      } else {
        this.selectedIndex = bestIndex
      }
    }
  }

  /** 更新选中高亮：每帧调用，跟随鱼实时位置 */
  private updateSelectionHighlight(): void {
    this.selectionHighlight.clear()

    if (this.selectedIndex < 0 || this.selectedIndex >= this.fishCards.length) return

    // 高亮干扰：每 500ms 闪烁，弱化透明度
    if (this.highlightDisturbed) {
      const now = this.time.now
      if (now - this.lastFlickerTime >= 500) {
        this.highlightFlickerVisible = !this.highlightFlickerVisible
        this.lastFlickerTime = now
      }
      if (!this.highlightFlickerVisible) return
    }

    const fish = this.fishCards[this.selectedIndex]
    const { width, height } = FISH_SIZE
    const x = fish.sprite.x - width / 2 - 6
    const y = fish.sprite.y - height / 2 - 6
    const w = width + 12
    const h = height + 12

    const alpha = this.highlightDisturbed ? 0.05 : 0.15
    const borderAlpha = this.highlightDisturbed ? 0.3 : 1

    // 绿色半透明填充 + 绿色边框
    this.selectionHighlight.fillStyle(0x44ff44, alpha)
    this.selectionHighlight.fillRoundedRect(x, y, w, h, BORDER_RADIUS.MD + 4)
    this.selectionHighlight.lineStyle(4, 0x44ff44, borderAlpha)
    this.selectionHighlight.strokeRoundedRect(x, y, w, h, BORDER_RADIUS.MD + 4)
  }

  // ═══════════════════════════════════════
  // 梦想鱼智能 AI：光标靠近时干扰高亮显示
  // ═══════════════════════════════════════

  /** 每帧检测：光标靠近梦想鱼时触发高亮干扰 */
  private updateDreamFishAI(): void {
    if (!this.smartAI) return

    const dreamFish = this.fishCards[this.dreamFishIndex]
    const selectedFish = this.fishCards[this.selectedIndex]
    if (!dreamFish || !selectedFish) return

    const dist = Phaser.Math.Distance.Between(
      dreamFish.sprite.x, dreamFish.sprite.y,
      selectedFish.sprite.x, selectedFish.sprite.y
    )

    this.highlightDisturbed = dist < this.disturbRadius
  }

  /** 按 E/Enter 确认选中 */
  private confirmSelection(): void {
    if (!this.active) return

    const fish = this.fishCards[this.selectedIndex]
    if (!fish) return

    if (fish.isDream) {
      // 正确！
      this.active = false
      SfxManager.getInstance().play('correct')

      // 隐藏选中高亮
      this.selectionHighlight.clear()

      // 梦想鱼反馈: 放大后缩小
      this.tweens.add({
        targets: fish.sprite,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 200,
        yoyo: true,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.time.delayedCall(300, () => this.finish())
        }
      })
    } else {
      // 错误！
      SfxManager.getInstance().play('wrong')

      // 屏幕震动
      this.cameras.main.shake(150, 0.005)

      // 错误鱼闪烁红色
      const wrongFish = this.fishCards[this.selectedIndex].sprite
      wrongFish.setAlpha(0.4)
      this.time.delayedCall(200, () => {
        wrongFish.setAlpha(1)
      })

      // 状态提示
      this.statusText.setText('不是这条！再找找～')
      this.statusText.setColor('#ff6b6b')
      this.time.delayedCall(800, () => {
        this.statusText.setText('用方向键移动，按 E 选中梦想鱼')
        this.statusText.setColor('#ffd166')
      })
    }
  }

  // ═══════════════════════════════════════
  // 清理
  // ═══════════════════════════════════════

  private cleanup(): void {
    this.active = false

    // 停止所有移动 tween
    for (const t of this.movementTweens) {
      t.destroy()
    }
    this.movementTweens = []

    // 停止所有旋转 tween
    for (const t of this.rotationTweens) {
      t.destroy()
    }
    this.rotationTweens = []

    // 销毁鱼卡片
    for (const fish of this.fishCards) {
      fish.sprite.destroy()
    }
    this.fishCards = []
  }

  // ═══════════════════════════════════════
  // 结算
  // ═══════════════════════════════════════

  private finish(): void {
    // 隐藏游戏 UI
    this.titleText.setVisible(false)
    this.statusText.setVisible(false)

    // 隐藏鱼卡片
    for (const fish of this.fishCards) {
      fish.sprite.setVisible(false)
    }

    // 结果面板
    const resultBg = this.add.graphics()
    resultBg.fillStyle(0x000000, 0.85)
    resultBg.fillRoundedRect(-400, -220, 800, 440, BORDER_RADIUS.LG)
    resultBg.lineStyle(3, 0xffd166, 1)
    resultBg.strokeRoundedRect(-400, -220, 800, 440, BORDER_RADIUS.LG)
    this.resultContainer.add(resultBg)

    // 评价
    const gradeText = this.add
      .text(0, -160, '找到了！', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '56px',
        color: '#ffd166',
      })
      .setOrigin(0.5)
    this.resultContainer.add(gradeText)

    // 副标题
    const subText = this.add
      .text(0, -80, '在一堆咸鱼中找到了梦想鱼', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '28px',
        color: '#a0a0c0',
      })
      .setOrigin(0.5)
    this.resultContainer.add(subText)

    // 奖励
    const rewardText = this.add
      .text(0, 0, `获得文字: 「${this.config.reward.word}」`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '40px',
        color: '#ffd166',
      })
      .setOrigin(0.5)
    this.resultContainer.add(rewardText)

    // 提示
    const hintText = this.add
      .text(0, 100, '按 E 继续', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '32px',
        color: '#888888',
      })
      .setOrigin(0.5)
    this.resultContainer.add(hintText)

    this.resultContainer.setVisible(true)

    SfxManager.getInstance().play('levelComplete')

    // 按 E 回传结果
    this.input.keyboard!.once('keydown-E', () => {
      this.complete({
        subSceneId: this.config.id,
        outcome: 'success',
        rewards: {
          word: this.config.reward.word,
          jyutping: this.config.reward.jyutping,
        }
      })
    })
  }
}
/**
 * TextSprite - 伪图卡片系统(全局视觉组件)
 *
 * 设计依据:
 * - DESIGN_PHILOSOPHY.md 原则5(伪图卡片系统)
 * - TECH_ARCH.md 第六章(实现要点)
 * - DATA_MODEL.md 第三章(TextSpriteConfig Schema)
 * - GAME_DESIGN.md 第三章(伪图卡片系统)
 *
 * 核心理念:用"框 + 文字"代替图片,后期可无缝替换真图。
 * 全局复用:场景物件 / 角色立绘 / 对话卡片 / 提示卡片 / 结算卡片 / 平台 / 金币。
 *
 * 后缀语义:
 * - .jpg:静态展示,文字居中
 * - .gif:文字在卡片内循环滚动(会心一笑的梗)
 * - 无:同 .jpg
 *
 * 性能原则(TECH_ARCH 7.2):
 * - 输入响应 <16ms,严禁同步阻塞
 * - 频繁创建销毁的对象建议用对象池(本类预留,初赛 Demo 物件数有限,暂不实现)
 */
import Phaser from 'phaser'
import { TEXT_SPRITE_STYLES, COLORS } from '@/shared/constants'

export type TextSpriteType =
  | 'character'
  | 'object'
  | 'scenery'
  | 'dialogue'
  | 'hint'
  | 'result'

export type TextSpriteSuffix = '.jpg' | '.gif' | null

export type TextSpriteAnimation = 'none' | 'shake' | 'glow' | 'bounce'

/**
 * 伪图卡片配置 - 对应 DATA_MODEL.md TextSpriteConfig
 * 关卡 JSON 中可直接使用此结构
 */
export interface TextSpriteConfig {
  id?: string
  type: TextSpriteType
  text: string
  subtitle?: string
  /** 后缀:.jpg 静态 / .gif 滚动 / 无(同 .jpg) */
  suffix?: TextSpriteSuffix
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  scale?: number
  /** 文字颜色,缺省按 type 取默认 */
  textColor?: string | number
  /** 边框颜色,缺省按 type 取默认 */
  borderColor?: string | number
  /** 背景颜色,缺省按 type 取默认 */
  bgColor?: string | number
  /** 边框粗细,默认 3 */
  borderWidth?: number
  /** 是否高亮(背景立即变色) */
  highlight?: boolean
  /** .gif 滚动速度(字符/秒),默认 5 */
  scrollSpeed?: number
  /** 是否可互动 */
  interactable?: boolean
  /** 靠近时显示的互动提示(如"按 E 踢一脚") */
  interactHint?: string
  /** 默认动效:none / shake / glow / bounce */
  animation?: TextSpriteAnimation
}

// 默认值
const DEFAULT_WIDTH = 120
const DEFAULT_HEIGHT = 80
const DEFAULT_BORDER_WIDTH = 3
const DEFAULT_SCROLL_SPEED = 5 // 字符/秒
const SCROLL_SEPARATOR = '  ·  '
const FONT_FAMILY = 'Arial, "Microsoft YaHei", "PingFang SC", sans-serif'

/** 颜色转换:string(#RRGGBB 或 RRGGBB) | number → number */
function toColor(c?: string | number): number | null {
  if (c === undefined || c === null) return null
  if (typeof c === 'number') return c
  const hex = c.replace('#', '')
  const n = parseInt(hex, 16)
  return Number.isNaN(n) ? null : n
}

/** number → #RRGGBB 字符串(供 Phaser Text color 用) */
function colorToHex(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`
}

export class TextSprite extends Phaser.GameObjects.Container {
  /** 卡片配置(可读写,setText 等会同步更新) */
  config: TextSpriteConfig
  readonly textSpriteType: TextSpriteType
  readonly suffix: TextSpriteSuffix
  readonly interactable: boolean
  readonly interactHint: string | null

  // 子对象
  private background: Phaser.GameObjects.Rectangle
  private borderRect: Phaser.GameObjects.Rectangle
  private mainText: Phaser.GameObjects.Text
  private subtitleText: Phaser.GameObjects.Text | null = null

  // 尺寸
  private cardWidth: number
  private cardHeight: number
  private borderWidth: number

  // 状态
  private highlighted = false

  // .gif 滚动状态
  private scrollCharOffset = 0
  private scrollDisplayLength = 0
  private scrollLongText = ''
  private scrollFontSize = 16

  // 动效状态
  private animationType: TextSpriteAnimation = 'none'
  private animTime = 0
  private baseX = 0
  private baseY = 0
  private baseScale = 1

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: TextSpriteConfig
  ) {
    super(scene, x, y)

    this.config = { ...config }
    this.textSpriteType = config.type
    this.suffix = config.suffix ?? null
    this.interactable = config.interactable ?? false
    this.interactHint = config.interactHint ?? null
    this.baseX = x
    this.baseY = y

    const style = TEXT_SPRITE_STYLES[config.type]
    this.cardWidth = config.size?.width ?? DEFAULT_WIDTH
    this.cardHeight = config.size?.height ?? DEFAULT_HEIGHT
    this.borderWidth = config.borderWidth ?? DEFAULT_BORDER_WIDTH
    this.baseScale = config.scale ?? 1

    // ── 背景 ──
    const bgColor = toColor(config.bgColor) ?? style.bg
    const bgAlpha = config.bgColor !== undefined ? 1 : style.bgAlpha
    this.background = scene.add
      .rectangle(0, 0, this.cardWidth, this.cardHeight, bgColor, bgAlpha)
      .setOrigin(0.5)

    // ── 边框(透明填充 + stroke) ──
    const borderColor = toColor(config.borderColor) ?? style.border
    this.borderRect = scene.add
      .rectangle(0, 0, this.cardWidth, this.cardHeight, borderColor, 0)
      .setOrigin(0.5)
      .setStrokeStyle(this.borderWidth, borderColor, 1)

    // ── 主文字 ──
    const textColor = toColor(config.textColor) ?? style.text
    const fontSize = Math.max(10, Math.min(this.cardWidth, this.cardHeight) * 0.22)
    this.scrollFontSize = fontSize
    const isGif = this.suffix === '.gif'
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSize}px`,
      color: colorToHex(textColor),
      align: 'center'
    }
    // .gif 单行滚动,不用 wordWrap;其他类型启用 wordWrap 自动换行
    if (!isGif) {
      textStyle.wordWrap = { width: this.cardWidth - this.borderWidth * 2 - 8 }
    }
    this.mainText = scene.add
      .text(0, config.subtitle ? -this.cardHeight * 0.15 : 0, config.text, textStyle)
      .setOrigin(0.5)

    // ── 副文字 ──
    if (config.subtitle) {
      this.subtitleText = scene.add
        .text(0, this.cardHeight * 0.25, config.subtitle, {
          fontFamily: FONT_FAMILY,
          fontSize: `${fontSize * 0.6}px`,
          color: colorToHex(textColor),
          align: 'center',
          wordWrap: { width: this.cardWidth - this.borderWidth * 2 - 8 }
        })
        .setOrigin(0.5)
    }

    this.add([this.background, this.borderRect, this.mainText])
    if (this.subtitleText) this.add(this.subtitleText)

    // 滚动准备
    if (isGif) {
      this.prepareScrollText()
    }

    // 高亮
    if (config.highlight) {
      this.setHighlight(true)
    }

    // 动效
    this.animationType = config.animation ?? 'none'

    // 缩放 & 物理尺寸(供 enable body 用)
    this.setScale(this.baseScale)
    this.setSize(this.cardWidth, this.cardHeight)

    scene.add.existing(this)

    // 自动注册到场景 update 循环(destroy 时解绑)
    this.scene.events.on('update', this.onSceneUpdate, this)
  }

  // ──────────────────────────────────────────────
  // 公开 API
  // ──────────────────────────────────────────────

  /** 切换高亮(背景色立即变化) */
  setHighlight(on: boolean): this {
    this.highlighted = on
    if (on) {
      this.background.setFillStyle(COLORS.HIGHLIGHT_BG, COLORS.HIGHLIGHT_BG_ALPHA)
    } else {
      const style = TEXT_SPRITE_STYLES[this.textSpriteType]
      const bgColor = toColor(this.config.bgColor) ?? style.bg
      const bgAlpha = this.config.bgColor !== undefined ? 1 : style.bgAlpha
      this.background.setFillStyle(bgColor, bgAlpha)
    }
    return this
  }

  isHighlighted(): boolean {
    return this.highlighted
  }

  /** 修改主文字(.gif 模式会重新准备滚动) */
  setText(text: string): this {
    this.config.text = text
    if (this.suffix === '.gif') {
      this.prepareScrollText()
    } else {
      this.mainText.setText(text)
    }
    return this
  }

  /** 切换动效 */
  setAnimation(type: TextSpriteAnimation): this {
    this.animationType = type
    this.animTime = 0
    if (type === 'none') {
      // 恢复基准位置与缩放
      this.setPosition(this.baseX, this.baseY)
      this.setScale(this.baseScale)
      // 恢复边框 alpha
      const style = TEXT_SPRITE_STYLES[this.textSpriteType]
      const borderColor = toColor(this.config.borderColor) ?? style.border
      this.borderRect.setStrokeStyle(this.borderWidth, borderColor, 1)
    }
    return this
  }

  /** 设置基准位置(shake 动效基于此偏移) */
  setBasePosition(x: number, y: number): this {
    this.baseX = x
    this.baseY = y
    this.setPosition(x, y)
    return this
  }

  /** 设置基准缩放(bounce 动效基于此缩放) */
  setBaseScale(scale: number): this {
    this.baseScale = scale
    this.setScale(scale)
    return this
  }

  // ──────────────────────────────────────────────
  // P2 扩展接口(预留签名,初赛 Demo 不实现)
  // ──────────────────────────────────────────────

  /** P2:粒子/光晕/拖尾等特效 */
  setEffect(_type: string): this {
    console.warn('[TextSprite] setEffect 是 P2 扩展接口,暂未实现')
    return this
  }

  /** P2:后期替换真图 */
  loadTexture(_src: string): this {
    console.warn('[TextSprite] loadTexture 是 P2 扩展接口,暂未实现')
    return this
  }

  // ──────────────────────────────────────────────
  // 内部:滚动逻辑
  // ──────────────────────────────────────────────

  private prepareScrollText(): void {
    const base = this.config.text
    if (!base) {
      this.scrollLongText = ''
      return
    }
    // 中文约等宽,字符宽度 ≈ fontSize
    const charWidth = this.scrollFontSize
    const innerWidth = this.cardWidth - this.borderWidth * 2 - 8
    this.scrollDisplayLength = Math.max(4, Math.floor(innerWidth / charWidth))
    // 重复 base 多次,确保滚动有足够内容
    const unitLen = base.length + SCROLL_SEPARATOR.length
    const repeatCount = Math.max(
      3,
      Math.ceil((this.scrollDisplayLength + unitLen) / unitLen) + 2
    )
    this.scrollLongText = Array(repeatCount).fill(base).join(SCROLL_SEPARATOR)
    this.scrollCharOffset = 0
    this.updateScrollDisplay()
  }

  private updateScrollDisplay(): void {
    if (!this.scrollLongText) return
    const totalLen = this.scrollLongText.length
    const intOffset = Math.floor(this.scrollCharOffset) % totalLen
    let display = this.scrollLongText.substring(
      intOffset,
      intOffset + this.scrollDisplayLength
    )
    // 循环补齐(防止末尾不足)
    if (display.length < this.scrollDisplayLength) {
      display += this.scrollLongText.substring(
        0,
        this.scrollDisplayLength - display.length
      )
    }
    this.mainText.setText(display)
  }

  // ──────────────────────────────────────────────
  // 内部:update 循环(由场景 update 事件驱动)
  // ──────────────────────────────────────────────

  private onSceneUpdate(_time: number, delta: number): void {
    this.animTime += delta

    // .gif 滚动
    if (this.suffix === '.gif' && this.scrollLongText) {
      const speed = this.config.scrollSpeed ?? DEFAULT_SCROLL_SPEED
      this.scrollCharOffset += (speed * delta) / 1000
      // 取模防止累积过大(浮点精度)
      const totalLen = this.scrollLongText.length
      if (this.scrollCharOffset > totalLen) {
        this.scrollCharOffset -= totalLen
      }
      this.updateScrollDisplay()
    }

    // 动效
    switch (this.animationType) {
      case 'shake': {
        const amount = 1.5
        this.setPosition(
          this.baseX + (Math.random() - 0.5) * amount * 2,
          this.baseY + (Math.random() - 0.5) * amount * 2
        )
        break
      }
      case 'bounce': {
        const t = this.animTime / 300
        this.setScale(this.baseScale * (1 + Math.sin(t) * 0.05))
        break
      }
      case 'glow': {
        const t = this.animTime / 500
        const alpha = 0.5 + Math.sin(t) * 0.4
        const style = TEXT_SPRITE_STYLES[this.textSpriteType]
        const borderColor = toColor(this.config.borderColor) ?? style.border
        this.borderRect.setStrokeStyle(this.borderWidth, borderColor, alpha)
        break
      }
      case 'none':
      default:
        break
    }
  }

  destroy(fromScene?: boolean): void {
    // 解绑 update 监听(防止内存泄漏)
    if (this.scene && this.scene.events) {
      this.scene.events.off('update', this.onSceneUpdate, this)
    }
    super.destroy(fromScene)
  }
}

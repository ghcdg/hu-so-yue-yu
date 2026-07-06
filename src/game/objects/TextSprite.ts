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
import type { StateTextSource } from '@/shared/types'

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
  /** 圆角半径,缺省按 type 取默认 */
  borderRadius?: number
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
  /** 状态绑定(v0.2 新增,可选):绑定后卡片文字随状态源变化 */
  stateBinding?: {
    sourceId: string       // 状态源ID(如 'player' / 'npc_oldMan')
    textMap: Record<string, string>  // 状态→文字映射
    subtitleMap?: Record<string, string> // 状态→副文字映射(可选)
  }
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
  private background: Phaser.GameObjects.Graphics
  private borderGfx: Phaser.GameObjects.Graphics
  private mainText: Phaser.GameObjects.Text
  private subtitleText: Phaser.GameObjects.Text | null = null

  // 尺寸
  private cardWidth: number
  private cardHeight: number
  private borderWidth: number
  private borderRadius: number

  // 状态
  private highlighted = false
  private currentBgColor: number
  private currentBgAlpha: number
  private currentBorderColor: number

  // .gif 滚动状态
  private scrollCharOffset = 0
  private scrollDisplayLength = 0
  private scrollLongText = ''
  private scrollFontSize = 16

  // 文字裁剪 mask(仅 .gif 模式,放在 scene 层级避免遮文字)
  private clipMask: Phaser.Display.Masks.GeometryMask | null = null
  private maskGraphics: Phaser.GameObjects.Graphics | null = null

  // 状态驱动(v0.2 新增)
  private stateSource: StateTextSource | null = null
  private stateTextMap: Record<string, string> | null = null
  private stateSubtitleMap: Record<string, string> | null = null
  private lastStateLabel = ''

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
    this.borderRadius = config.borderRadius ?? style.borderRadius
    this.baseScale = config.scale ?? 1

    // 颜色
    this.currentBgColor = toColor(config.bgColor) ?? style.bg
    this.currentBgAlpha = config.bgColor !== undefined ? 1 : style.bgAlpha
    const textColor = toColor(config.textColor) ?? style.text
    this.currentBorderColor = toColor(config.borderColor) ?? style.border

    const halfW = this.cardWidth / 2
    const halfH = this.cardHeight / 2
    const r = this.borderRadius

    // ── 背景(圆角矩形 Graphics) ──
    this.background = scene.add.graphics()
    this.drawBackground()

    // ── 边框(圆角矩形 Graphics) ──
    this.borderGfx = scene.add.graphics()
    this.drawBorder()

    // ── 主文字 ──
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

    this.add([this.background, this.borderGfx, this.mainText])
    if (this.subtitleText) this.add(this.subtitleText)

    // ── 文字裁剪 mask(仅 .gif 模式,Graphics 放在 scene 层级避免遮文字) ──
    if (isGif) {
      const innerPadding = this.borderWidth + 4
      this.maskGraphics = scene.add.graphics()
      this.maskGraphics.setPosition(x, y)
      this.maskGraphics.fillStyle(0xffffff, 1)
      this.maskGraphics.fillRoundedRect(
        -halfW + innerPadding,
        -halfH + innerPadding,
        this.cardWidth - innerPadding * 2,
        this.cardHeight - innerPadding * 2,
        Math.max(0, r - innerPadding)
      )
      this.clipMask = this.maskGraphics.createGeometryMask()
      // GeometryMask.preRenderWebGL 直接调用 renderWebGL,不走 visible 检查
      // 设为不可见后:颜色缓冲区不渲染(不遮文字),stencil 缓冲区仍生效(正常裁剪)
      this.maskGraphics.setVisible(false)
      this.mainText.setMask(this.clipMask)
      if (this.subtitleText) this.subtitleText.setMask(this.clipMask)
    }

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
  // 内部:绘制方法
  // ──────────────────────────────────────────────

  /** 绘制/重绘背景圆角矩形(alpha=0 时跳过填充,避免 Phaser 默认白色) */
  private drawBackground(): void {
    this.background.clear()
    if (this.currentBgAlpha > 0) {
      this.background.fillStyle(this.currentBgColor, this.currentBgAlpha)
      this.background.fillRoundedRect(
        -this.cardWidth / 2,
        -this.cardHeight / 2,
        this.cardWidth,
        this.cardHeight,
        this.borderRadius
      )
    }
  }

  /** 绘制/重绘边框圆角矩形 */
  private drawBorder(alpha = 1): void {
    this.borderGfx.clear()
    this.borderGfx.lineStyle(this.borderWidth, this.currentBorderColor, alpha)
    this.borderGfx.strokeRoundedRect(
      -this.cardWidth / 2,
      -this.cardHeight / 2,
      this.cardWidth,
      this.cardHeight,
      this.borderRadius
    )
  }

  // ──────────────────────────────────────────────
  // 公开 API
  // ──────────────────────────────────────────────

  /** 切换高亮(背景色立即变化) */
  setHighlight(on: boolean): this {
    this.highlighted = on
    if (on) {
      this.currentBgColor = COLORS.HIGHLIGHT_BG
      this.currentBgAlpha = COLORS.HIGHLIGHT_BG_ALPHA
    } else {
      const style = TEXT_SPRITE_STYLES[this.textSpriteType]
      this.currentBgColor = toColor(this.config.bgColor) ?? style.bg
      this.currentBgAlpha = this.config.bgColor !== undefined ? 1 : style.bgAlpha
    }
    this.drawBackground()
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
      this.drawBorder(1)
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

  /** 绑定状态源(v0.2 新增):卡片文字随状态源实时变化 */
  bindState(source: StateTextSource, textMap: Record<string, string>, subtitleMap?: Record<string, string>): this {
    this.stateSource = source
    this.stateTextMap = textMap
    this.stateSubtitleMap = subtitleMap ?? null
    this.lastStateLabel = source.getStateLabel()
    this.applyStateLabel(this.lastStateLabel)
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
    // .gif 滚动文字:左对齐到卡片内边界,便于像素级 x 偏移实现丝滑滚动
    this.mainText.setOrigin(0, 0.5)
    this.mainText.x = -innerWidth / 2
    this.updateScrollDisplay()
  }

  private updateScrollDisplay(): void {
    if (!this.scrollLongText) return
    const totalLen = this.scrollLongText.length
    // 保留小数部分,实现像素级平滑滚动(而非字符跳动)
    const offset = ((this.scrollCharOffset % totalLen) + totalLen) % totalLen
    const intOffset = Math.floor(offset)
    const frac = offset - intOffset
    // 多取 1 字符,用 mainText.x 偏移 frac 个字符宽度
    let display = this.scrollLongText.substring(
      intOffset,
      intOffset + this.scrollDisplayLength + 1
    )
    // 循环补齐(防止末尾不足)
    if (display.length < this.scrollDisplayLength + 1) {
      display += this.scrollLongText.substring(
        0,
        this.scrollDisplayLength + 1 - display.length
      )
    }
    this.mainText.setText(display)
    // 像素级偏移:向左移动 frac 个字符宽度,视觉上文字连续滚动
    const innerWidth = this.cardWidth - this.borderWidth * 2 - 8
    this.mainText.x = -innerWidth / 2 - frac * this.scrollFontSize
  }

  // ──────────────────────────────────────────────
  // 内部:状态驱动(v0.2)
  // ──────────────────────────────────────────────

  /** 每帧检查状态变化,变化时更新文字 */
  private updateStateBinding(): void {
    if (!this.stateSource || !this.stateTextMap) return
    const stateLabel = this.stateSource.getStateLabel()
    if (stateLabel !== this.lastStateLabel) {
      this.lastStateLabel = stateLabel
      this.applyStateLabel(stateLabel)
    }
  }

  /** 根据状态标识更新卡片文字 */
  private applyStateLabel(label: string): void {
    const text = this.stateTextMap![label]
    if (!text) return
    this.config.text = text
    if (this.suffix === '.gif') {
      this.prepareScrollText()
    } else {
      this.mainText.setText(text)
    }
    // 副文字同步更新
    if (this.subtitleText && this.stateSubtitleMap) {
      const sub = this.stateSubtitleMap[label]
      if (sub) {
        this.config.subtitle = sub
        this.subtitleText.setText(sub)
      }
    }
  }

  // ──────────────────────────────────────────────
  // 内部:update 循环(由场景 update 事件驱动)
  // ──────────────────────────────────────────────

  private onSceneUpdate(_time: number, delta: number): void {
    this.animTime += delta

    // 状态驱动:每帧检查状态变化
    this.updateStateBinding()

    // 同步 mask 位置(遮罩在 scene 层级,需跟随容器移动)
    if (this.maskGraphics) {
      this.maskGraphics.setPosition(this.x, this.y)
    }

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
        this.drawBorder(alpha)
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
    // 清理 scene 层级的 mask Graphics
    this.maskGraphics?.destroy()
    this.maskGraphics = null
    this.clipMask = null
    super.destroy(fromScene)
  }
}

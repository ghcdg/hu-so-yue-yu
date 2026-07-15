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
  /** 头部文字（split 布局专用） */
  headerText?: string
  /** 布局模式：single 居中 / split 上下分区（header 20% + body 80%） */
  layout?: 'single' | 'split'
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
    textMap: Record<string, string>  // 状态→文字映射（single=主文字, split=主体文字）
    subtitleMap?: Record<string, string> // 状态→副文字映射（可选）
    headerTextMap?: Record<string, string>  // split 布局：状态→头部文字
    bodyTextMap?: Record<string, string>    // split 布局：状态→主体文字（优先于 textMap）
    kaomojiMap?: Record<string, string>     // split 布局：状态→颜文字（独立元素，自动缩放）
  }
}

// 默认值 — 2x 缩放
const DEFAULT_WIDTH = 240
const DEFAULT_HEIGHT = 160
const DEFAULT_BORDER_WIDTH = 6
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
  private mainText!: Phaser.GameObjects.Text
  private subtitleText: Phaser.GameObjects.Text | null = null

  // split 布局
  private layoutMode: 'single' | 'split' = 'single'
  private headerTextObj: Phaser.GameObjects.Text | null = null
  private kaomojiObj: Phaser.GameObjects.Text | null = null
  private dividerGfx: Phaser.GameObjects.Graphics | null = null
  private headerStateTextMap: Record<string, string> | null = null
  private bodyStateTextMap: Record<string, string> | null = null
  private kaomojiStateTextMap: Record<string, string> | null = null
  private lastHeaderStateLabel = ''
  private lastBodyStateLabel = ''
  private lastKaomojiStateLabel = ''
  /** 暂停状态绑定（子弹时间等场景下临时覆盖文字） */
  private stateBindingPaused = false

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

  // .gif 滚动状态（预渲染纹理方案）
  private scrollFontSize = 16
  private scrollImage: Phaser.GameObjects.Image | null = null
  private scrollCanvasTexture: Phaser.Textures.CanvasTexture | null = null
  private scrollPixelOffset = 0
  private scrollTextPixelWidth = 0 // 单份完整文本的像素宽度（用于无缝循环）

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

    // ── 布局模式 ──
    this.layoutMode = config.layout ?? 'single'

    // ── 主文字 ──
    const fontSize = Math.max(28, Math.min(this.cardWidth, this.cardHeight) * 0.22)
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
      textStyle.wordWrap = { width: this.cardWidth - this.borderWidth * 2 - 16 }
    }

    if (this.layoutMode === 'split') {
      // split 布局：header(20%) + 分隔线 + body(80%)
      this.initSplitLayout(scene, config, textColor, textStyle, fontSize)
      if (isGif) {
        console.warn('[TextSprite] .gif 滚动模式不支持 split 布局，将使用静态显示')
      }
    } else {
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
            wordWrap: { width: this.cardWidth - this.borderWidth * 2 - 16 }
          })
          .setOrigin(0.5)
      }
    }

    if (this.layoutMode === 'split') {
      const children: Phaser.GameObjects.GameObject[] = [
        this.background, this.borderGfx, this.dividerGfx!,
        this.headerTextObj!, this.mainText
      ]
      if (this.kaomojiObj) children.push(this.kaomojiObj)
      this.add(children)
    } else {
      this.add([this.background, this.borderGfx, this.mainText])
      if (this.subtitleText) this.add(this.subtitleText)
    }

    // ── 文字裁剪 mask(仅 .gif 模式,Graphics 放在 scene 层级避免遮文字) ──
    if (isGif) {
      const innerPadding = this.borderWidth + 8
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
  // Protected:供子类扩展的辅助方法
  // ──────────────────────────────────────────────

  /** 获取卡片内部可用区域(扣除边框后),供子类在卡片内定位内容 */
  protected getCardInnerBounds(): { x: number; y: number; width: number; height: number } {
    const pad = this.borderWidth + 8
    return {
      x: -this.cardWidth / 2 + pad,
      y: -this.cardHeight / 2 + pad,
      width: this.cardWidth - pad * 2,
      height: this.cardHeight - pad * 2
    }
  }

  /** 获取卡片尺寸(供子类读取) */
  protected getCardSize(): { width: number; height: number } {
    return { width: this.cardWidth, height: this.cardHeight }
  }

  /** 获取当前背景色(供子类读取) */
  protected getCurrentBgColor(): number {
    return this.currentBgColor
  }

  /** 获取当前边框色(供子类读取) */
  protected getCurrentBorderColor(): number {
    return this.currentBorderColor
  }

  /** 获取主文字对象(供子类直接操作,如追加符号) */
  protected getMainText(): Phaser.GameObjects.Text {
    return this.mainText
  }

  // ──────────────────────────────────────────────
  // 内部:split 布局初始化
  // ──────────────────────────────────────────────

  /** 初始化 split 布局：header(20%) + 分隔线 + body(80%)
   *  body 内部分为：kaomoji(45%) + bodyText(55%)，各为独立 Text 元素 */
  private initSplitLayout(
    scene: Phaser.Scene,
    config: TextSpriteConfig,
    textColor: number,
    _bodyTextStyle: Phaser.Types.GameObjects.Text.TextStyle,
    baseFontSize: number
  ): void {
    const headerHeight = this.cardHeight * 0.2
    const bodyHeight = this.cardHeight * 0.8
    const kaomojiHeight = bodyHeight * 0.45
    const bodyTextHeight = bodyHeight * 0.55

    const headerY = -this.cardHeight / 2 + headerHeight / 2
    const dividerY = -this.cardHeight / 2 + headerHeight
    const kaomojiY = dividerY + kaomojiHeight / 2
    const bodyTextY = dividerY + kaomojiHeight + bodyTextHeight / 2

    const innerWidth = this.cardWidth - this.borderWidth * 2 - 16

    // 字体自适应
    const headerFontSize = Math.max(12, Math.min(headerHeight * 0.7, baseFontSize * 0.6))
    const bodyFontSize = Math.max(16, Math.min(bodyTextHeight * 0.45, baseFontSize))

    // ── Header 文字 ──
    this.headerTextObj = scene.add.text(0, headerY, config.headerText ?? '', {
      fontFamily: FONT_FAMILY,
      fontSize: `${headerFontSize}px`,
      color: colorToHex(textColor),
      align: 'center',
      wordWrap: { width: innerWidth }
    }).setOrigin(0.5)

    // ── 解析初始文字：第一行为 kaomoji，其余为 bodyText ──
    const { kaomoji, bodyText } = this.splitKaomojiAndText(config.text)

    // ── Kaomoji（独立元素，自动缩放） ──
    const kaoFontSize = this.calcKaomojiFontSize(kaomoji, innerWidth, kaomojiHeight)
    this.kaomojiObj = scene.add.text(0, kaomojiY, kaomoji, {
      fontFamily: FONT_FAMILY,
      fontSize: `${kaoFontSize}px`,
      color: colorToHex(textColor),
      align: 'center'
    }).setOrigin(0.5)

    // ── Body 文字 ──
    this.mainText = scene.add.text(0, bodyTextY, bodyText, {
      fontFamily: FONT_FAMILY,
      fontSize: `${bodyFontSize}px`,
      color: colorToHex(textColor),
      align: 'center',
      wordWrap: { width: innerWidth }
    }).setOrigin(0.5)

    // ── 分隔线（细线，低透明度） ──
    this.dividerGfx = scene.add.graphics()
    this.dividerGfx.lineStyle(1, this.currentBorderColor, 0.2)
    const dividerLeft = -this.cardWidth / 2 + this.borderWidth + 8
    const dividerRight = this.cardWidth / 2 - this.borderWidth - 8
    this.dividerGfx.lineBetween(dividerLeft, dividerY, dividerRight, dividerY)
  }

  /** 从文字中拆分 kaomoji 和 bodyText（第一行为 kaomoji，其余为 bodyText） */
  private splitKaomojiAndText(text: string): { kaomoji: string; bodyText: string } {
    const newlineIdx = text.indexOf('\n')
    if (newlineIdx >= 0) {
      return {
        kaomoji: text.substring(0, newlineIdx),
        bodyText: text.substring(newlineIdx + 1)
      }
    }
    return { kaomoji: '', bodyText: text }
  }

  /** 计算 kaomoji 自适应字体大小（不超过卡片宽度和 kaomoji 区域高度） */
  private calcKaomojiFontSize(kaomoji: string, maxWidth: number, maxHeight: number): number {
    if (!kaomoji) return 12
    const len = Math.max(kaomoji.length, 1)
    const widthBased = maxWidth / len
    const heightBased = maxHeight * 0.75
    return Math.max(8, Math.floor(Math.min(widthBased, heightBased)))
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
    if (this.suffix === '.gif' && this.layoutMode !== 'split') {
      this.prepareScrollText()
    } else {
      this.mainText.setText(text)
    }
    return this
  }

  /** 修改主文字字体大小 */
  setFontSize(size: number): this {
    this.mainText.setFontSize(size)
    return this
  }

  /** 修改副文字字体大小 */
  setSubtitleFontSize(size: number): this {
    if (this.subtitleText) {
      this.subtitleText.setFontSize(size)
    }
    return this
  }

  /** 修改头部文字（split 布局专用） */
  setHeaderText(text: string): this {
    this.config.headerText = text
    if (this.headerTextObj) {
      this.headerTextObj.setText(text)
    }
    return this
  }

  /** 修改 kaomoji 文字（split 布局专用，自动缩放字体以适配卡片） */
  setKaomoji(text: string): this {
    if (!this.kaomojiObj) return this
    const innerWidth = this.cardWidth - this.borderWidth * 2 - 16
    const kaomojiHeight = this.cardHeight * 0.8 * 0.45
    const fontSize = this.calcKaomojiFontSize(text, innerWidth, kaomojiHeight)
    this.kaomojiObj.setFontSize(fontSize)
    this.kaomojiObj.setText(text)
    return this
  }

  /** 暂停状态绑定（子弹时间等场景下临时手动控制文字） */
  pauseStateBinding(): this {
    this.stateBindingPaused = true
    return this
  }

  /** 恢复状态绑定 */
  resumeStateBinding(): this {
    this.stateBindingPaused = false
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
  bindState(source: StateTextSource, textMap: Record<string, string>, subtitleMap?: Record<string, string>, headerTextMap?: Record<string, string>, bodyTextMap?: Record<string, string>, kaomojiMap?: Record<string, string>): this {
    this.stateSource = source
    this.stateTextMap = textMap
    this.stateSubtitleMap = subtitleMap ?? null
    this.headerStateTextMap = headerTextMap ?? null
    this.bodyStateTextMap = bodyTextMap ?? null
    this.kaomojiStateTextMap = kaomojiMap ?? null
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

  /**
   * 预渲染滚动文字到 Canvas 纹理，用 Image 移动代替 Text 重绘
   * 核心思路：将滚动文字一次性绘制到离屏 Canvas → 创建静态纹理 → Image 位移
   * 彻底消除每帧 setText() 触发的 Canvas 重绘，实现 GPU 级丝滑滚动
   */
  private prepareScrollText(): void {
    const base = this.config.text
    if (!base) return

    // 清理旧资源
    this.cleanupScrollResources()

    const fontSize = this.scrollFontSize
    const textColor = this.config.textColor
      ? colorToHex(toColor(this.config.textColor) ?? 0xffffff)
      : '#f5f5f5'

    // 重复文本确保足够填充可视区域 + 一份用于无缝循环
    const repeatCount = 4
    const fullText = Array(repeatCount).fill(base).join(SCROLL_SEPARATOR)

    // 测量文本像素宽度
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')!
    measureCtx.font = `${fontSize}px ${FONT_FAMILY}`
    const metrics = measureCtx.measureText(fullText)
    const textWidth = Math.ceil(metrics.width)
    const textHeight = Math.ceil(fontSize * 1.4)

    this.scrollTextPixelWidth = textWidth

    // 创建纹理：两份文本并排，实现无缝循环
    const canvasWidth = textWidth * 2
    const canvasHeight = textHeight

    const textureKey = `scroll_${this.config.id || 'unnamed'}_${Date.now()}`
    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey)
    }

    this.scrollCanvasTexture = this.scene.textures.createCanvas(textureKey, canvasWidth, canvasHeight)
    const ctx = this.scrollCanvasTexture!.getContext()
    ctx.font = `${fontSize}px ${FONT_FAMILY}`
    ctx.fillStyle = textColor
    ctx.textBaseline = 'middle'
    // 绘制两份文本
    ctx.fillText(fullText, 0, canvasHeight / 2)
    ctx.fillText(fullText, textWidth, canvasHeight / 2)
    this.scrollCanvasTexture!.refresh()

    // 创建 Image 显示纹理
    this.scrollImage = this.scene.add.image(0, 0, textureKey)
    this.scrollImage.setOrigin(0, 0.5)

    // 定位到卡片内部左边界
    const innerPadding = this.borderWidth + 8
    this.scrollImage.setPosition(
      -this.cardWidth / 2 + innerPadding,
      0
    )

    // 应用裁剪 mask（与原来 mainText 的 mask 一致）
    if (this.clipMask) {
      this.scrollImage.setMask(this.clipMask)
    }

    // 隐藏原始 Text，加入 Image 到容器
    this.mainText.setVisible(false)
    this.add(this.scrollImage)

    this.scrollPixelOffset = 0
  }

  /** 清理滚动相关资源（纹理 + Image） */
  private cleanupScrollResources(): void {
    if (this.scrollImage) {
      this.scrollImage.destroy()
      this.scrollImage = null
    }
    if (this.scrollCanvasTexture) {
      const key = this.scrollCanvasTexture.key
      this.scrollCanvasTexture.destroy()
      this.scrollCanvasTexture = null
      if (this.scene.textures.exists(key)) {
        this.scene.textures.remove(key)
      }
    }
  }

  /** 像素级滚动更新：直接移动 Image 位置，无任何文字重绘 */
  private updateScrollDisplay(): void {
    if (!this.scrollImage || this.scrollTextPixelWidth <= 0) return

    const innerPadding = this.borderWidth + 8
    const startX = -this.cardWidth / 2 + innerPadding

    // 无缝循环：当偏移超过一份文本宽度时回卷
    if (this.scrollPixelOffset >= this.scrollTextPixelWidth) {
      this.scrollPixelOffset -= this.scrollTextPixelWidth
    }

    this.scrollImage.x = startX - this.scrollPixelOffset
  }

  // ──────────────────────────────────────────────
  // 内部:状态驱动(v0.2)
  // ──────────────────────────────────────────────

  /** 每帧检查状态变化,变化时更新文字 */
  private updateStateBinding(): void {
    if (!this.stateSource || this.stateBindingPaused) return

    const stateLabel = this.stateSource.getStateLabel()

    if (this.layoutMode === 'split') {
      // split 模式：header、kaomoji、body 独立状态映射
      if (this.headerStateTextMap && stateLabel !== this.lastHeaderStateLabel) {
        this.lastHeaderStateLabel = stateLabel
        const headerText = this.headerStateTextMap[stateLabel]
        if (headerText !== undefined && this.headerTextObj) {
          this.headerTextObj.setText(headerText)
        }
      }
      if (this.kaomojiStateTextMap && stateLabel !== this.lastKaomojiStateLabel) {
        this.lastKaomojiStateLabel = stateLabel
        const kaomoji = this.kaomojiStateTextMap[stateLabel]
        if (kaomoji !== undefined) {
          this.setKaomoji(kaomoji)
        }
      }
      const bodyMap = this.bodyStateTextMap ?? this.stateTextMap
      if (bodyMap && stateLabel !== this.lastBodyStateLabel) {
        this.lastBodyStateLabel = stateLabel
        const bodyText = bodyMap[stateLabel]
        if (bodyText !== undefined && this.mainText) {
          this.mainText.setText(bodyText)
        }
      }
    } else {
      // single 模式：原有逻辑
      if (stateLabel !== this.lastStateLabel) {
        this.lastStateLabel = stateLabel
        this.applyStateLabel(stateLabel)
      }
    }
  }

  /** 根据状态标识更新卡片文字（single 模式） */
  private applyStateLabel(label: string): void {
    const text = this.stateTextMap![label]
    if (text === undefined) return
    this.config.text = text
    if (this.suffix === '.gif') {
      this.prepareScrollText()
    } else {
      this.mainText.setText(text)
    }
    // 副文字同步更新
    if (this.subtitleText && this.stateSubtitleMap) {
      const sub = this.stateSubtitleMap[label]
      if (sub !== undefined) {
        this.config.subtitle = sub
        this.subtitleText.setText(sub)
      }
    }
  }

  // ──────────────────────────────────────────────
  // 内部:update 循环(由场景 update 事件驱动)
  // ──────────────────────────────────────────────

  private onSceneUpdate(_time: number, delta: number): void {
    // 防御:对象已销毁或场景已停止时跳过
    if (!this.active || !this.mainText?.active) return

    this.animTime += delta

    // 状态驱动:每帧检查状态变化
    this.updateStateBinding()

    // 同步 mask 位置(遮罩在 scene 层级,需跟随容器移动)
    if (this.maskGraphics) {
      this.maskGraphics.setPosition(this.x, this.y)
    }

    // .gif 滚动：像素级位移，纯 GPU 纹理移动，无 Canvas 重绘
    if (this.suffix === '.gif' && this.scrollImage && this.scrollTextPixelWidth > 0) {
      const speed = this.config.scrollSpeed ?? DEFAULT_SCROLL_SPEED
      // 像素/秒 = 字符速度 × 字号（与旧逻辑兼容）
      this.scrollPixelOffset += (speed * this.scrollFontSize * delta) / 1000
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
    // 清理滚动资源（纹理 + Image）
    this.cleanupScrollResources()
    // 清理 scene 层级的 mask Graphics
    this.maskGraphics?.destroy()
    this.maskGraphics = null
    this.clipMask = null
    // 清理 split 布局的分隔线
    this.dividerGfx?.destroy()
    this.dividerGfx = null
    // 清理 kaomoji（独立元素，不在 Container children 中自动管理）
    this.kaomojiObj?.destroy()
    this.kaomojiObj = null
    super.destroy(fromScene)
  }
}

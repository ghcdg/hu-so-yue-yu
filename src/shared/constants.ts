/**
 * 全局常量 - 按键 / 颜色 / 尺寸 / 场景 key
 */

/** Phaser 场景 key */
export const SCENE = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  LEVEL: 'LevelScene',
  UI: 'UIScene',
  /** 追捕子场景(v0.2) */
  CHASE: 'ChaseScene',
  /** 剧情对话子场景(v0.2) */
  DIALOGUE: 'DialogueScene',
  /** 踢足球子场景(v0.2) */
  FOOTBALL: 'FootballScene'
} as const

/** 游戏画布尺寸(16:9) — 2x 内部渲染分辨率 */
export const GAME_SIZE = {
  WIDTH: 2560,
  HEIGHT: 1440
} as const

/** 物理常量(Arcade Physics) — 2x 缩放 */
export const PHYSICS = {
  GRAVITY: 2400,
  PLAYER_SPEED: 520,
  /** 跳跃速度 — 2x 缩放 + 5% 余量确保平台可达 */
  JUMP_VELOCITY: -1160,
  DOUBLE_JUMP_VELOCITY: -1000
} as const

/** 慢动作系统配置（v0.4）
 *
 *  只需改 SPEED 即可测试不同慢放程度：
 *    0.2 = 20% 速度（timeScale = 1/0.2 = 5.0）
 *    0.1 = 10% 速度（timeScale = 1/0.1 = 10.0）
 *    0.5 = 50% 速度（timeScale = 1/0.5 = 2.0）
 *
 *  fps 自适应由 SlowMoManager 内部自动处理（newFps = baseFps × timeScale），无需手动调整。
 */
export const SLOWMO = {
  /** 慢放速度比例（0~1）：0.2 = 20% 速度 */
  SPEED: 0.1,
  /** 进入慢放的过渡时间(ms) */
  TRANSITION_IN_MS: 500,
  /** 恢复全速的过渡时间(ms) */
  TRANSITION_OUT_MS: 300,
} as const

/** 键盘映射 */
export const KEYS = {
  LEFT: 'A',
  RIGHT: 'D',
  UP: 'W',
  DOWN: 'S',
  JUMP: 'SPACE',
  INTERACT: 'E'
} as const

/** 伪图卡片配色 - 对应 DESIGN_PHILOSOPHY 原则5 */
export const COLORS = {
  // 主题色
  BG: 0x1a1a2e, // 深蓝黑背景
  BG_LIGHT: 0x16213e,
  // 文字
  TEXT_PRIMARY: 0xf5f5f5,
  TEXT_SECONDARY: 0xa0a0c0,
  // 边框
  BORDER_DEFAULT: 0x4a4a6a,
  BORDER_HIGHLIGHT: 0xffd166, // 高亮黄
  // 高亮背景(伪图卡片 highlight=true 时)
  HIGHLIGHT_BG: 0xffd166,
  HIGHLIGHT_BG_ALPHA: 0.35
} as const

/** 统一圆角半径(px) — 2x 缩放 */
export const BORDER_RADIUS = {
  /** 小型卡片(金币/平台标签) */
  SM: 8,
  /** 中型卡片(对话/提示/NPC) */
  MD: 12,
  /** 大型卡片(揭示/结算) */
  LG: 20
} as const

/**
 * 伪图卡片类型默认样式表 - 单一来源,TextSprite 导入使用
 * 颜色以 DATA_MODEL.md 第三章为准
 * | type | borderColor | textColor | bgColor |
 * | character | #FF8C00(橙) | #FFF | transparent |
 * | object | #1E90FF(蓝) | #FFF | transparent |
 * | scenery | #888(灰) | #DDD | transparent |
 * | dialogue | #8B4513(棕) | #FFF | rgba(0,0,0,0.7) |
 * | hint | #FFD700(金) | #000 | rgba(255,255,255,0.9) |
 * | result | #FFD700(金) | #FFF | rgba(0,0,0,0.85) |
 */
export interface TextSpriteTypeStyle {
  border: number
  text: number
  bg: number
  bgAlpha: number // 0 = 透明
  borderRadius: number // 圆角半径(px)
}

export const TEXT_SPRITE_STYLES: Record<
  'character' | 'object' | 'scenery' | 'dialogue' | 'hint' | 'result',
  TextSpriteTypeStyle
> = {
  character: { border: 0xff8c00, text: 0xffffff, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.MD },
  object: { border: 0x1e90ff, text: 0xffffff, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.SM },
  scenery: { border: 0x888888, text: 0xdddddd, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.SM },
  dialogue: { border: 0x8b4513, text: 0xffffff, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.MD },
  hint: { border: 0xffd700, text: 0x000000, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.MD },
  result: { border: 0xffd700, text: 0xffffff, bg: 0x000000, bgAlpha: 0.5, borderRadius: BORDER_RADIUS.LG }
}

/** UI 视图名称(中文,用于显示) */
export const VIEW_LABELS = {
  menu: '开始菜单',
  game: '游戏中',
  result: '结算页'
} as const

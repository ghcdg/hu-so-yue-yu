/**
 * 全局常量 - 按键 / 颜色 / 尺寸 / 场景 key
 */

/** Phaser 场景 key */
export const SCENE = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  LEVEL: 'LevelScene',
  UI: 'UIScene'
} as const

/** 游戏画布尺寸(16:9) */
export const GAME_SIZE = {
  WIDTH: 1280,
  HEIGHT: 720
} as const

/** 物理常量(Arcade Physics) */
export const PHYSICS = {
  GRAVITY: 1200,
  PLAYER_SPEED: 260,
  JUMP_VELOCITY: -560,
  DOUBLE_JUMP_VELOCITY: -480
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
  // 类型色
  TYPE_CHARACTER: 0xef476f, // 角色-红
  TYPE_OBJECT: 0x06d6a0, // 物件-绿
  TYPE_SCENERY: 0x118ab2, // 路标-蓝
  TYPE_DIALOGUE: 0xffd166, // 对话-黄
  TYPE_HINT: 0xff6b6b, // 提示-橙红
  TYPE_RESULT: 0xffd166 // 结算-金
} as const

/** UI 视图名称(中文,用于显示) */
export const VIEW_LABELS = {
  menu: '开始菜单',
  game: '游戏中',
  result: '结算页'
} as const

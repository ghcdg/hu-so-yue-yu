/**
 * 共享类型定义 - 跨层通用
 * 详见 DATA_MODEL.md(参考结构,不强求全部实现)
 */

/** 关卡结算结果 */
export interface LevelResult {
  levelId: string
  levelName: string
  coins: number
  totalCoins: number
  timeMs: number
  /** 评价等级:咸鱼翻身 / 咸鱼之王 / 梦想家 */
  rank: string
  /** 伏笔台词(关卡结束后显示,埋下一关悬念) */
  epilogue?: { speaker: string; lines: string[] }
}

/** 最终揭示的句子(粤语朗读 + 粤语展示 + 普通话展示) */
export interface Sentence {
  /** 粤语朗读版(纯粤语文字, 用于 TTS 朗读) */
  cantonese_read: string
  /** 粤语展示版(含粤拼标注, 用于画面显示) */
  cantonese_show: string
  /** 普通话展示版(用于画面显示) */
  mandarin_show: string
  /** 来源(如:周星驰《少林足球》) */
  source?: string
}

/** 对话片段 */
export interface DialogLine {
  speaker: string
  text: string
  /** 可选:伪图卡片类型 */
  avatarType?: 'character' | 'npc'
}

/** 对话卡片数据 */
export interface Dialog {
  id: string
  lines: DialogLine[]
}

/** 游戏事件联合类型 - 事件总线通信契约 */
export type GameEvent =
  | { type: 'level-start'; levelId: string }
  | { type: 'level-complete'; result: LevelResult }
  | { type: 'coin-collected'; word: string; count: number }
  | { type: 'surprise-triggered'; id: string; name: string }
  | { type: 'sentence-revealed'; sentence: Sentence }
  | { type: 'show-dialog'; dialog: Dialog }
  | { type: 'show-hint'; text: string; durationMs?: number }

/** 事件处理器类型 */
export type GameEventHandler = (payload: GameEvent) => void

/** 伪图卡片类型 - 对应 DESIGN_PHILOSOPHY 原则5 */
export type TextSpriteType =
  | 'character' // 角色立绘
  | 'object' // 场景物件
  | 'scenery' // 背景路标
  | 'dialogue' // 对话卡片
  | 'hint' // 全局提示卡片
  | 'result' // 结算卡片

/** 游戏视图状态(Vue UI 层路由) */
export type UIView = 'menu' | 'game' | 'result'

/**
 * 状态文字源接口（v0.2 新增）
 * 任何对象实现此接口即可驱动 TextSprite 卡片实时显示对应文字。
 * 例如: Player 返回 'run'/'jump'/..., MovableNpc 返回 'flee'/'caught'...
 */
export interface StateTextSource {
  /** 返回当前状态标识（由状态映射表映射为卡片文字） */
  getStateLabel(): string
}

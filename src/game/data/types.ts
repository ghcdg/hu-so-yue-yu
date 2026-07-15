/**
 * 关卡数据类型定义 - 对应 DATA_MODEL.md 的 JSON Schema
 * 关卡数据用 JSON 描述,独特玩法逻辑写代码(务实扩展原则)
 */
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { Sentence } from '@/shared/types'

/** 目标句子(粤语朗读 + 粤语展示 + 普通话展示) */
export interface SentenceData {
  cantonese_read: string
  cantonese_show: string
  mandarin_show: string
  source?: string
}

/** 对话片段 */
export interface DialogueData {
  speaker: string
  text: string
  card?: TextSpriteConfig
  emotion?: 'normal' | 'happy' | 'sad' | 'surprised' | 'thinking'
  pauseMs?: number
}

/** 平台数据 */
export interface PlatformData {
  id: string
  type: 'static' | 'moving' | 'breakable'
  position: { x: number; y: number }
  size: { width: number; height: number }
  card?: TextSpriteConfig
  moving?: { axis: 'x' | 'y'; range: number; speed: number }
  breakable?: { hitsToBreak: number }
}

/** 金币数据 */
export interface CoinData {
  id: string
  position: { x: number; y: number }
  word: string
  jyutping: string
}

/** NPC 数据 */
export interface NpcData {
  id: string
  card: TextSpriteConfig
  position: { x: number; y: number }
  dialogues: DialogueData[]
}

/**
 * 可互动物件动作类型
 * 代码里 switch 处理(务实扩展:复杂逻辑写代码,不硬塞 JSON)
 */
export type InteractAction =
  | 'kick_fish' // 区2:踢咸鱼 → 弹开 + 揭示隐藏金币
  | 'find_difference' // 找区别于场景: 在一堆咸鱼中找出梦想鱼

/** 可互动物件数据 */
export interface InteractableData {
  id: string
  card: TextSpriteConfig
  position: { x: number; y: number }
  /** E 键互动时的动作类型(代码 switch 处理) */
  action: InteractAction
  /** 关联的隐藏金币ID(action=kick_fish 等揭示后给) */
  revealCoinId?: string
}

/** Buff 数据 */
export interface BuffData {
  id: string
  name: string
  description: string
  effect: {
    type: 'jumpEnhance'
    value: number // 0.3 = +30%
  }
}

/** 惊喜事件三段式数据 */
export interface SurpriseData {
  id: string
  type: 'required' | 'hidden'
  /** 阶段1:铺垫(全局提示卡片) */
  setup: {
    hintCard: TextSpriteConfig
    delayMs: number
  }
  /** 阶段2:揭示(角色伪图卡片 + 滚动文字) */
  reveal: {
    characterCard: TextSpriteConfig
    scrollText: string
  }
  /** 阶段3:互动(对话 + 给 buff) */
  interact: {
    dialogue: DialogueData[]
    buff?: BuffData
  }
}

/** 关卡数据(简化版,初赛 Demo 用) */
export interface LevelData {
  id: string
  name: string
  themeTag: string
  targetSentence: SentenceData
  /** 世界尺寸(大于画面时相机跟随) */
  worldSize: { width: number; height: number }
  spawn: { x: number; y: number }
  ground: {
    position: { x: number; y: number }
    size: { width: number; height: number }
    card: TextSpriteConfig
  }
  platforms: PlatformData[]
  coins: CoinData[]
  npcs: NpcData[]
  interactables: InteractableData[]
  surprises: SurpriseData[]
  /** 区域分组(v0.2):每个区域定义入口和检查点 */
  zones?: ZoneData[]
  revealPosition: { x: number; y: number }
  /** 登台门槛(v0.2):需要集齐的金币数,0 或未设置则无门槛 */
  requireCoins?: number
  /** 金币不足时的提示(v0.2) */
  lockedHint?: string
  totalCoins: number
  /** 伏笔台词(结算页显示,老伯再次出现埋第二关悬念) */
  epilogue?: { speaker: string; lines: string[] }
  /** 追捕子场景配置(v0.3,数据驱动) */
  chaseScene?: ChaseSceneData
}

/** 追捕子场景数据(v0.3,定义在 types.ts 避免循环依赖) */
export interface ChaseSceneData {
  id: string
  worldSize: { width: number; height: number }
  platforms: PlatformData[]
  playerSpawn: { x: number; y: number }
  fugitive: {
    npcId: string
    card: TextSpriteConfig
    spawn: { x: number; y: number }
    fleeSpeed: number
    patrolPoints: { x: number; y: number }[]
  }
  caughtDialogue: DialogueData[]
  timeLimitMs?: number
  stateTextMaps?: {
    player: Record<string, string>
    fugitive: Record<string, string>
  }
  bullet?: {
    count: number
    shootRange: number
    cooldownMs: number
  }
  platformBounce?: number
}

/** 区域数据(v0.2 新增,关卡可选分区域组织) */
export interface ZoneData {
  id: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  /** 进入区域时触发的子场景ID */
  cutsceneId?: string
  /** 进入时显示的引导文字 */
  enterHint?: string
  /** 检查点位置(掉落复活点) */
  checkpoint?: { x: number; y: number }
}

/** 找区别于场景配置(v0.5) */
export interface FindDifferenceSceneConfig {
  id: string
  type: 'findDifference'
  worldSize: { width: number; height: number }
  fishCount: number
  difficulty: number
  gridCols: number
  reward: {
    word: string
    jyutping: string
  }
}

/** 将 SentenceData 转为 Sentence(shared 类型) */
export function toSentence(s: SentenceData): Sentence {
  return {
    cantonese_read: s.cantonese_read,
    cantonese_show: s.cantonese_show,
    mandarin_show: s.mandarin_show,
    source: s.source
  }
}

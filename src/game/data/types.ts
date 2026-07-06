/**
 * 关卡数据类型定义 - 对应 DATA_MODEL.md 的 JSON Schema
 * 关卡数据用 JSON 描述,独特玩法逻辑写代码(务实扩展原则)
 */
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { Sentence } from '@/shared/types'

/** 目标句子(粤语 + 粤拼 + 普通话释义) */
export interface SentenceData {
  cantonese: string
  jyutping: string
  mandarin: string
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

/** 关卡数据(简化版,初赛 Demo 用) */
export interface LevelData {
  id: string
  name: string
  themeTag: string
  targetSentence: SentenceData
  spawn: { x: number; y: number }
  ground: {
    position: { x: number; y: number }
    size: { width: number; height: number }
    card: TextSpriteConfig
  }
  platforms: PlatformData[]
  coins: CoinData[]
  npcs: NpcData[]
  revealPosition: { x: number; y: number }
  totalCoins: number
  totalHidden: number
}

/** 将 SentenceData 转为 Sentence(shared 类型) */
export function toSentence(s: SentenceData): Sentence {
  return {
    cantonese: s.cantonese,
    jyutping: s.jyutping,
    mandarin: s.mandarin,
    source: s.source
  }
}

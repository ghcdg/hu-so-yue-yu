/**
 * Npc - 非玩家角色
 *
 * 设计依据:DATA_MODEL.md NpcData + GAME_DESIGN.md 第十章 NPC 类型
 * 视觉:TextSprite(character 类型)立绘
 * 物理:静态(不移动)
 * 对话:talk() 推进对话,循环回到开头
 *
 * 互动流程:
 * 1. 玩家靠近 + 按 E → LevelScene 检测到附近 NPC
 * 2. 调用 npc.talk() 获取当前对话行
 * 3. LevelScene emit 'show-dialog' 事件 → UIScene 显示对话卡片
 */
import Phaser from 'phaser'
import { TextSprite } from '@/game/objects/TextSprite'
import type { DialogueData, NpcData } from '@/game/data/types'

export class Npc extends TextSprite {
  readonly npcId: string
  readonly dialogues: DialogueData[]
  private currentIndex = 0

  constructor(scene: Phaser.Scene, data: NpcData) {
    super(scene, data.position.x, data.position.y, {
      ...data.card,
      type: 'character'
    })
    this.npcId = data.id
    this.dialogues = data.dialogues

    // 静态物理体
    scene.physics.add.existing(this, true)
  }

  /**
   * 推进对话,返回当前行
   * 对话结束后回到开头(循环)
   */
  talk(): DialogueData {
    const line = this.dialogues[this.currentIndex]
    this.currentIndex = (this.currentIndex + 1) % this.dialogues.length
    return line
  }

  /** 获取当前对话索引(用于外部判断对话进度) */
  getCurrentIndex(): number {
    return this.currentIndex
  }

  /** 是否还有未读完的对话(用于"按 E 继续"提示) */
  hasMore(): boolean {
    return this.currentIndex !== 0
  }

  /** 重置对话进度 */
  resetDialogue(): void {
    this.currentIndex = 0
  }
}

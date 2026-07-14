/**
 * 游戏状态 Store - Vue UI 层与 Phaser 游戏层共享的进度状态
 *
 * 职责:
 * - 管理 UI 视图切换(menu/game/result)
 * - 持有当前关卡 ID 与最近一次结算结果
 * - 提供 startGame / finishLevel / backToMenu 动作
 *
 * 通信:
 * - UI → Game:startGame 设置 levelId,GameContainer 监听后创建 Phaser 实例
 * - Game → UI:Phaser 通过 eventBus emit level-complete,App.vue 监听后调用 finishLevel
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LevelResult, UIView } from '@/shared/types'

/** 任务ID */
export type TaskId = 'chase' | 'findDifference'

/** 任务状态 */
export interface TaskState {
  chase: boolean      // 追捕梦想是否完成
  findDifference: boolean  // 找咸鱼是否完成
}

export const useGameStore = defineStore('game', () => {
  const view = ref<UIView>('menu')
  const currentLevelId = ref<string | null>(null)
  const lastResult = ref<LevelResult | null>(null)

  // ── 任务系统 ──
  const tasks = ref<TaskState>({ chase: false, findDifference: false })

  // ── 背包/收集文字 ──
  const collectedWords = ref<string[]>([])

  function startGame(levelId: string): void {
    currentLevelId.value = levelId
    lastResult.value = null
    // 重置任务和收集
    tasks.value = { chase: false, findDifference: false }
    collectedWords.value = []
    view.value = 'game'
  }

  function finishLevel(result: LevelResult): void {
    lastResult.value = result
    view.value = 'result'
  }

  function backToMenu(): void {
    view.value = 'menu'
    currentLevelId.value = null
  }

  /** 完成任务 */
  function completeTask(taskId: TaskId): void {
    tasks.value[taskId] = true
  }

  /** 是否已完成某任务 */
  function isTaskCompleted(taskId: TaskId): boolean {
    return tasks.value[taskId]
  }

  /** 收集文字 */
  function collectWords(words: string[]): void {
    for (const w of words) {
      if (!collectedWords.value.includes(w)) {
        collectedWords.value.push(w)
      }
    }
  }

  return {
    view,
    currentLevelId,
    lastResult,
    tasks,
    collectedWords,
    startGame,
    finishLevel,
    backToMenu,
    completeTask,
    isTaskCompleted,
    collectWords
  }
})

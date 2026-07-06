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

export const useGameStore = defineStore('game', () => {
  const view = ref<UIView>('menu')
  const currentLevelId = ref<string | null>(null)
  const lastResult = ref<LevelResult | null>(null)

  function startGame(levelId: string): void {
    currentLevelId.value = levelId
    lastResult.value = null
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

  return {
    view,
    currentLevelId,
    lastResult,
    startGame,
    finishLevel,
    backToMenu
  }
})

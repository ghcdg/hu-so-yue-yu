<!--
  App.vue - Vue 根组件
  职责:
  - 根据 store.view 切换 UI 视图(menu/game/result)
  - view='game' 时挂载 GameContainer
  - 监听 eventBus 的 level-complete → 调用 store.finishLevel
  原则:UI 外壳不碰游戏逻辑,只管视图路由与跨层事件桥接
-->
<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useGameStore } from '@/ui/stores/gameStore'
import { eventBus } from '@/shared/eventBus'
import StartMenu from '@/ui/views/StartMenu.vue'
import ResultView from '@/ui/views/ResultView.vue'
import GameContainer from '@/ui/components/GameContainer.vue'

const store = useGameStore()

// Game → UI 桥接:监听通关事件,切换到结算页
const offLevelComplete = eventBus.on('level-complete', (e) => {
  store.finishLevel(e.result)
})

onBeforeUnmount(() => {
  offLevelComplete()
})
</script>

<template>
  <div class="app-root">
    <StartMenu v-if="store.view === 'menu'" />
    <GameContainer
      v-else-if="store.view === 'game' && store.currentLevelId"
      :key="store.currentLevelId"
      :level-id="store.currentLevelId"
    />
    <ResultView v-else-if="store.view === 'result'" />
  </div>
</template>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg-dark);
}
</style>

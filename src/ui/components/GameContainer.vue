<!--
  GameContainer.vue - Phaser 游戏挂载点
  职责:接收 levelId,创建/销毁 Phaser.Game 实例
  原则:UI 组件不碰游戏内部逻辑,只管生命周期
-->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import Phaser from 'phaser'
import { createPhaserGame } from '@/game/PhaserGame'

const props = defineProps<{ levelId: string }>()

let game: Phaser.Game | null = null
const containerRef = ref<HTMLDivElement | null>(null)

function mountGame() {
  if (!containerRef.value) {
    console.error('[GameContainer] containerRef 为空, 无法挂载游戏')
    return
  }
  console.log('[GameContainer] 挂载 Phaser 游戏到容器:', containerRef.value)
  // 销毁旧实例(切关时)
  destroyGame()
  game = createPhaserGame(containerRef.value)
  console.log('[GameContainer] Phaser 游戏创建完成')
}

function destroyGame() {
  if (game) {
    game.destroy(true)
    game = null
  }
}

onMounted(mountGame)
onBeforeUnmount(destroyGame)

// 切换关卡时重新挂载
watch(
  () => props.levelId,
  () => mountGame()
)
</script>

<template>
  <div class="game-container">
    <div ref="containerRef" class="phaser-root"></div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
}
.phaser-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.phaser-root :deep(canvas) {
  display: block;
  max-width: 100%;
  max-height: 100%;
}
</style>

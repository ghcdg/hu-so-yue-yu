<!--
  ResultView.vue - 通关结算页
  阶段2:显示 lastResult,验证 Game → UI 通信
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/ui/stores/gameStore'

const store = useGameStore()

const result = computed(() => store.lastResult)

function backToMenu() {
  store.backToMenu()
}
</script>

<template>
  <div class="result-view">
    <div class="result-card" v-if="result">
      <h2 class="rank">「{{ result.rank }}」</h2>
      <div class="level-id">{{ result.levelId }} 通关</div>

      <div class="stats">
        <div class="stat-row">
          <span class="label">粤语金币</span>
          <span class="value">{{ result.coins }} / {{ result.totalCoins }}</span>
        </div>
        <div class="stat-row">
          <span class="label">隐藏发现</span>
          <span class="value">{{ result.hiddenFound }} / {{ result.totalHidden }}</span>
        </div>
        <div class="stat-row">
          <span class="label">用时</span>
          <span class="value">{{ (result.timeMs / 1000).toFixed(1) }} 秒</span>
        </div>
      </div>

      <button class="back-btn" @click="backToMenu">返回菜单</button>
    </div>

    <div v-else class="empty">暂无结算数据</div>
  </div>
</template>

<style scoped>
.result-view {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f5f5f5;
}
.result-card {
  width: min(480px, 90%);
  padding: 40px 32px;
  background: #16213e;
  border: 2px solid #ffd166;
  border-radius: 8px;
  text-align: center;
}
.rank {
  font-size: 40px;
  color: #ffd166;
  margin: 0 0 8px;
}
.level-id {
  font-size: 14px;
  color: #a0a0c0;
  margin-bottom: 28px;
}
.stats {
  text-align: left;
  margin: 0 auto 28px;
  width: fit-content;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  font-size: 16px;
  padding: 8px 0;
  border-bottom: 1px dashed #2a2a4a;
}
.label {
  color: #a0a0c0;
}
.value {
  color: #f5f5f5;
  font-weight: bold;
}
.back-btn {
  font-size: 16px;
  padding: 10px 36px;
  background: #4a4a6a;
  color: #f5f5f5;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.back-btn:hover {
  background: #5a5a7a;
}
.empty {
  color: #6a6a8a;
}
</style>

<!--
  ResultView.vue - 通关结算页
  显示:评价等级 / 收集统计 / 伏笔台词 / 再来一次
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/ui/stores/gameStore'

const store = useGameStore()

const result = computed(() => store.lastResult)

const rankColor = computed(() => {
  if (!result.value) return '#ffd166'
  switch (result.value.rank) {
    case '梦想家': return '#ffd166'
    case '咸鱼之王': return '#a0c0ff'
    default: return '#c0c0c0'
  }
})

function backToMenu() {
  store.backToMenu()
}

function playAgain() {
  // 重新开始当前关卡:回到菜单再进入
  store.backToMenu()
  if (result.value) {
    // 下一帧开始游戏,确保 view 切换完成
    requestAnimationFrame(() => {
      store.startGame(result.value!.levelId)
    })
  }
}
</script>

<template>
  <div class="result-view">
    <div class="result-card" v-if="result">
      <div class="level-name">{{ result.levelName || result.levelId }}</div>
      <h2 class="rank" :style="{ color: rankColor }">「{{ result.rank }}」</h2>

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

      <!-- 伏笔台词 -->
      <div class="epilogue" v-if="result.epilogue">
        <div class="epilogue-speaker">{{ result.epilogue.speaker }} 再次出现:</div>
        <div class="epilogue-line" v-for="(line, i) in result.epilogue.lines" :key="i">
          "{{ line }}"
        </div>
      </div>

      <div class="buttons">
        <button class="btn btn-primary" @click="playAgain">再来一次</button>
        <button class="btn btn-secondary" @click="backToMenu">返回菜单</button>
      </div>
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
  color: var(--color-text-primary);
}
.result-card {
  width: min(480px, 90%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 36px 32px;
  background: var(--color-bg-light);
  border: 2px solid var(--color-accent);
  border-radius: var(--radius-md);
  text-align: center;
}
.level-name {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.rank {
  font-size: 40px;
  margin: 0 0 20px;
}
.stats {
  text-align: left;
  margin: 0 auto 20px;
  width: fit-content;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  font-size: 16px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--color-border);
}
.label {
  color: var(--color-text-secondary);
}
.value {
  color: var(--color-text-primary);
  font-weight: bold;
}

/* 伏笔台词 */
.epilogue {
  margin: 20px 0;
  padding: 16px 20px;
  background: var(--color-accent-dim);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  text-align: left;
}
.epilogue-speaker {
  font-size: 13px;
  color: var(--color-accent);
  margin-bottom: 8px;
}
.epilogue-line {
  font-size: 14px;
  color: #c0c0c0;
  line-height: 1.8;
  font-style: italic;
}

.buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}
.btn {
  font-size: 15px;
  padding: 10px 28px;
  border: none;
  border-radius: var(--btn-radius);
  cursor: pointer;
  transition: var(--btn-transition);
}
.btn-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-color);
}
.btn-primary:hover {
  background: var(--color-accent-light);
}
.btn-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-color);
}
.btn-secondary:hover {
  background: var(--color-border-light);
}
.empty {
  color: var(--color-text-muted);
}
</style>
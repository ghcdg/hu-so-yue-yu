<!--
  ResultView.vue - 通关结算页
  风格:与游戏主体统一,暗色背景 + 文字卡片
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
    default: return '#a0a0c0'
  }
})

function backToMenu() {
  store.backToMenu()
}

function playAgain() {
  store.backToMenu()
  if (result.value) {
    requestAnimationFrame(() => {
      store.startGame(result.value!.levelId)
    })
  }
}
</script>

<template>
  <div class="result-view">
    <div class="result-card" v-if="result">
      <div class="level-tag">{{ result.levelName || result.levelId }}</div>
      <div class="rank" :style="{ color: rankColor }">{{ result.rank }}</div>

      <div class="stats">
        <div class="stat-row">
          <span class="label">金币</span>
          <span class="value">{{ result.coins }} / {{ result.totalCoins }}</span>
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
        <div class="btn btn-primary" @click="playAgain" role="button" tabindex="0">再来一次</div>
        <div class="btn btn-secondary" @click="backToMenu" role="button" tabindex="0">返回菜单</div>
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
  background: #1a1a2e;
}

.result-card {
  width: min(420px, 90%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 32px 32px;
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
  text-align: center;
}

.level-tag {
  font-size: 13px;
  color: #6a6a8a;
  letter-spacing: 2px;
  margin-bottom: 4px;
}

.rank {
  font-size: 36px;
  margin: 0 0 20px;
  letter-spacing: 4px;
}

/* ── 统计 ── */
.stats {
  text-align: left;
  margin: 0 auto 20px;
  width: fit-content;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  font-size: 15px;
  padding: 8px 0;
  border-bottom: 1px dashed #3a3a5a;
}
.label {
  color: #a0a0c0;
}
.value {
  color: #f5f5f5;
  font-weight: bold;
}

/* ── 伏笔台词 ── */
.epilogue {
  margin: 20px 0;
  padding: 14px 18px;
  border: 1px dashed #4a4a6a;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  text-align: left;
}
.epilogue-speaker {
  font-size: 13px;
  color: #ffd166;
  margin-bottom: 8px;
}
.epilogue-line {
  font-size: 13px;
  color: #a0a0c0;
  line-height: 1.8;
  font-style: italic;
}

/* ── 按钮(卡片风格) ── */
.buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}
.btn {
  font-size: 15px;
  padding: 10px 28px;
  border-radius: 6px;
  cursor: pointer;
  letter-spacing: 2px;
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}
.btn-primary {
  border: 2px solid #ffd166;
  background: rgba(255, 209, 102, 0.08);
  color: #ffd166;
}
.btn-primary:hover {
  background: rgba(255, 209, 102, 0.18);
  transform: scale(1.03);
}
.btn-secondary {
  border: 2px solid #4a4a6a;
  background: rgba(0, 0, 0, 0.2);
  color: #a0a0c0;
}
.btn-secondary:hover {
  background: rgba(74, 74, 106, 0.3);
  transform: scale(1.03);
}

.empty {
  color: #6a6a8a;
}
</style>
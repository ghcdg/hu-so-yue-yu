<!--
  StartMenu.vue - 开始菜单
  风格:与游戏主体统一,暗色背景 + 文字卡片
-->
<script setup lang="ts">
import { useGameStore } from '@/ui/stores/gameStore'

const store = useGameStore()

function startGame() {
  store.startGame('level_01_fish')
}
</script>

<template>
  <div class="start-menu">
    <!-- 标题卡片 -->
    <div class="title-card">
      <span class="title-text">胡嗦粤语</span>
      <span class="title-sub">游戏第一,学习第二</span>
      <div class="level-desc">Demo: 梦想与咸鱼</div>
    </div>

    <!-- 关卡卡片 -->
    <!-- <div class="level-card">
      <div class="level-header"></div>
      <div class="level-name"></div>
      <div class="level-desc"></div>
    </div> -->

    <!-- 开始按钮(卡片风格) -->
    <div class="start-card" @click="startGame" role="button" tabindex="0">
      开始游戏
    </div>

    <!-- 提示 -->
    <div class="hint">
      这是一个没有用的提示<br />(◕‿◕)
    </div>
  </div>
</template>

<style scoped>
.start-menu {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 20px;
  box-sizing: border-box;
  background: #1a1a2e;
}

/* ── 标题卡片 ── */
.title-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 48px;
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.3);
}
.title-text {
  font-size: 40px;
  color: #f5f5f5;
  letter-spacing: 6px;
}
.title-sub {
  font-size: 14px;
  color: #6a6a8a;
  letter-spacing: 2px;
}

/* ── 关卡卡片 ── */
.level-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 40px;
  border: 1px solid #4a4a6a;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  min-width: 280px;
}
.level-header {
  font-size: 13px;
  color: #6a6a8a;
  letter-spacing: 2px;
  text-transform: uppercase;
}
.level-name {
  font-size: 22px;
  color: #f5f5f5;
}
.level-desc {
  font-size: 13px;
  color: #a0a0c0;
  margin-top: 2px;
}

/* ── 开始按钮(卡片风格) ── */
.start-card {
  padding: 14px 56px;
  border: 2px solid #ffd166;
  border-radius: 8px;
  background: rgba(255, 209, 102, 0.08);
  color: #ffd166;
  font-size: 18px;
  cursor: pointer;
  letter-spacing: 4px;
  transition: background 0.15s ease, transform 0.1s ease;
  user-select: none;
}
.start-card:hover {
  background: rgba(255, 209, 102, 0.18);
  transform: scale(1.03);
}
.start-card:active {
  transform: scale(0.98);
}

/* ── 提示 ── */
.hint {
  margin-top: 16px;
  font-size: 12px;
  color: #4a4a6a;
  text-align: center;
  line-height: 1.6;
}
</style>
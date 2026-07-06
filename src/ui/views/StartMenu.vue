<!--
  StartMenu.vue - 开始菜单
  阶段2:简化为标题 + 单关入口 + 说明
-->
<script setup lang="ts">
import { useGameStore } from '@/ui/stores/gameStore'

const store = useGameStore()

function startGame() {
  // 第一关:咸鱼梦想(周星驰《少林足球》)
  store.startGame('level_01_fish')
}
</script>

<template>
  <div class="start-menu">
    <h1 class="title">狐嗦粤语</h1>
    <p class="subtitle">游戏第一,学习第二</p>

    <div class="card">
      <div class="card-title">第一关 · 咸鱼梦想</div>
      <div class="card-desc">周星驰《少林足球》经典梗 · 7 区铺垫链</div>
      <button class="start-btn" @click="startGame">开始游戏</button>
    </div>

    <div class="hint">
      阶段2 骨架验证版:可点击游戏内按钮模拟收集 / 通关,<br />
      验证 Vue UI ↔ Phaser 通信链路。
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
  gap: 20px;
  padding: 40px 20px;
  box-sizing: border-box;
  color: #f5f5f5;
}
.title {
  font-size: 56px;
  margin: 0;
  color: #ffd166;
  letter-spacing: 8px;
}
.subtitle {
  font-size: 18px;
  color: #a0a0c0;
  margin: 0 0 20px;
}
.card {
  width: min(520px, 90%);
  padding: 28px 32px;
  background: #16213e;
  border: 2px solid #4a4a6a;
  border-radius: 8px;
  text-align: center;
}
.card-title {
  font-size: 24px;
  color: #ffd166;
  margin-bottom: 8px;
}
.card-desc {
  font-size: 14px;
  color: #a0a0c0;
  margin-bottom: 24px;
}
.start-btn {
  font-size: 18px;
  padding: 12px 48px;
  background: #ffd166;
  color: #1a1a2e;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.1s ease;
}
.start-btn:hover {
  transform: scale(1.04);
}
.start-btn:active {
  transform: scale(0.98);
}
.hint {
  margin-top: 24px;
  font-size: 13px;
  color: #6a6a8a;
  text-align: center;
  line-height: 1.6;
}
</style>

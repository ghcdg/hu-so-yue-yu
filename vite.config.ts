import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vue 3 + Vite + TypeScript + Phaser 配置
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // @ 指向 src,方便 ui/game/speakers/shared 互相导入
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false
  },
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500 // Phaser 体积较大,放宽警告阈值
  }
})

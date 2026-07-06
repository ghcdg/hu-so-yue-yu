/**
 * Vue 入口
 * 职责:创建 app 实例,挂载 Pinia,挂载到 #app
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')

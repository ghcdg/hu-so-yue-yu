/**
 * 事件总线 - Vue UI 层与 Phaser 游戏层之间的通信桥梁
 *
 * 设计原则:
 * - UI → Game:通过 Pinia store 改变状态(Phaser 场景在 update 中轮询)
 * - Game → UI:通过 eventBus 触发事件(Vue 组件监听)
 * - 跨层通信走事件总线,场景内部通信走 Phaser 的 events
 *
 * 详见 TECH_ARCH.md 4.2 节
 */
import type { GameEvent, GameEventHandler } from './types'

class EventBus {
  private listeners = new Map<string, Set<GameEventHandler>>()

  /** 订阅事件,返回取消订阅函数 */
  on<T extends GameEvent['type']>(
    type: T,
    handler: (payload: Extract<GameEvent, { type: T }>) => void
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(handler as GameEventHandler)
    return () => this.off(type, handler)
  }

  /** 一次性订阅 */
  once<T extends GameEvent['type']>(
    type: T,
    handler: (payload: Extract<GameEvent, { type: T }>) => void
  ): () => void {
    const off = this.on(type, (payload) => {
      off()
      handler(payload)
    })
    return off
  }

  /** 取消订阅 */
  off<T extends GameEvent['type']>(
    type: T,
    handler: (payload: Extract<GameEvent, { type: T }>) => void
  ): void {
    this.listeners.get(type)?.delete(handler as GameEventHandler)
  }

  /** 触发事件 */
  emit<T extends GameEvent['type']>(event: Extract<GameEvent, { type: T }>): void {
    const set = this.listeners.get(event.type)
    if (!set) return
    // 复制一份,防止回调中增删导致迭代异常
    for (const handler of [...set]) {
      try {
        handler(event)
      } catch (err) {
        console.error('[eventBus] handler error:', err)
      }
    }
  }

  /** 清空所有监听(场景切换/销毁时调用) */
  clear(): void {
    this.listeners.clear()
  }
}

export const eventBus = new EventBus()

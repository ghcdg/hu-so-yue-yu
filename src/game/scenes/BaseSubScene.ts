/**
 * BaseSubScene - 子场景基类（v0.2 新增）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第九章(子场景系统)
 * - TECH_ARCH.md 5.6(子场景系统)
 * - DESIGN_PHILOSOPHY.md 原则2(流畅性优先)
 *
 * 借鉴马里奥管道式设计:主世界暂停时切入独立子场景展开剧情/小游戏。
 * 子场景结束时回传结果,主世界恢复并应用结果。
 *
 * 生命周期:
 *   LevelScene → scene.pause(LEVEL) + scene.launch('SubScene', config)
 *   → 子场景运行 → complete(result) → scene.stop() + scene.resume(LEVEL)
 *   → LevelScene 监听 'subscene-complete' 事件,应用结果
 */
import Phaser from 'phaser'
import { SCENE } from '@/shared/constants'
import { eventBus } from '@/shared/eventBus'

/** 子场景结果 */
export interface SubSceneResult {
  subSceneId: string
  outcome: 'success' | 'failure' | 'cancelled'
  rewards?: {
    giveBuff?: string
    unlockPath?: string
    revealCoins?: string[]
    advanceStory?: boolean
    /** 足球子场景:收集的文字 */
    word?: string
    /** 足球子场景:文字粤拼 */
    jyutping?: string
    /** 足球子场景:命中区域 */
    zone?: string
  }
}

/** 子场景配置(基类,各子类型扩展) */
export interface SubSceneConfig {
  id: string
  type: 'chase' | 'dialogue' | 'fight' | 'football'
  /** 子场景结束后的回调 */
  onComplete?: SubSceneResult['rewards']
}

export abstract class BaseSubScene extends Phaser.Scene {
  protected subSceneId = ''
  protected subSceneType = ''

  constructor(key: string) {
    super(key)
  }

  create(data: SubSceneConfig): void {
    this.subSceneId = data.id
    this.subSceneType = data.type

    // 暂停主场景
    this.scene.pause(SCENE.LEVEL)
    this.scene.pause(SCENE.UI)

    // 子类实现具体内容
    this.onSubSceneCreate(data)
  }

  /** 子类实现:创建子场景内容 */
  protected abstract onSubSceneCreate(data: SubSceneConfig): void

  /** 结束子场景,回传结果 */
  protected complete(result: SubSceneResult): void {
    // 过渡效果:淡出
    this.cameras.main.fadeOut(300, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      // 回传结果
      eventBus.emit({ type: 'subscene-complete' } as any)
      // 通过 Phaser events 传递结果(LevelScene 可监听)
      const levelScene = this.scene.get(SCENE.LEVEL)
      if (levelScene) {
        levelScene.events.emit('subscene-result', result)
      }

      // 恢复主场景
      this.scene.resume(SCENE.LEVEL)
      this.scene.resume(SCENE.UI)
      this.scene.stop()
    })
  }

  /** 取消子场景(无结果) */
  protected cancel(): void {
    this.complete({
      subSceneId: this.subSceneId,
      outcome: 'cancelled'
    })
  }
}
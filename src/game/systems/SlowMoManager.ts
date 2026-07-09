/**
 * SlowMoManager - 慢动作管理器（v0.4 独立模块）
 *
 * 核心能力:
 * - 控制 physics.world.timeScale 实现全局慢放/冻结
 * - 使用 performance.now() 驱动过渡，避免 timeScale 变慢后过渡也变慢
 * - 单例模式，全局唯一
 *
 * 【重要】Phaser physics.world.timeScale 语义:
 *   1.0 = 正常速度
 *   2.0 = 半速（慢放）
 *   5.0 = 1/5 速（20%）
 *   0.5 = 双倍速
 *   即: 有效速度 = 1 / timeScale
 *
 * 使用方式:
 *   const slowMo = SlowMoManager.getInstance()
 *   slowMo.init(scene)                          // 在场景 create() 中初始化
 *   slowMo.setTimeScale(5.0, 500)               // 0.5秒过渡到 20% 速度
 *   slowMo.freeze(3000)                          // 冻结 3 秒
 *   slowMo.resume(300)                           // 0.3秒恢复到全速
 *   slowMo.update()                              // 在场景 update() 中每帧调用
 *   slowMo.destroy()                             // 场景关闭时清理
 */
import Phaser from 'phaser'

type SlowMoState = 'idle' | 'frozen' | 'transitioning'

export class SlowMoManager {
  private static instance: SlowMoManager

  private scene: Phaser.Scene | null = null
  private state: SlowMoState = 'idle'
  private currentScale = 1.0

  // 过渡参数
  private transitionFrom = 1.0
  private transitionTo = 1.0
  private transitionStart = 0
  private transitionDuration = 0

  // 冻结参数
  private freezeEnd = 0

  // fps 自适应：timeScale 越高，物理步进越稀疏，需等比提升 fps 保持丝滑
  private baseFps = 60

  static getInstance(): SlowMoManager {
    if (!SlowMoManager.instance) {
      SlowMoManager.instance = new SlowMoManager()
    }
    return SlowMoManager.instance
  }

  /** 初始化，绑定场景 */
  init(scene: Phaser.Scene): void {
    this.scene = scene
    this.state = 'idle'
    this.currentScale = 1.0
    this.baseFps = scene.physics.world.fps
    this.scene.physics.world.timeScale = 1.0
  }

  /** 销毁，恢复全速 */
  destroy(): void {
    if (this.scene) {
      // 防御：场景 shutdown 时 physics world 可能已被清理
      if (this.scene.physics?.world) {
        this.scene.physics.world.timeScale = 1.0
        this.scene.physics.world.setFPS(this.baseFps)
      }
      this.scene = null
    }
    this.state = 'idle'
    this.currentScale = 1.0
  }

  // ── 全局控制 ──

  /** 平滑过渡到目标 timeScale，fps 在 update() 中跟随平滑变化 */
  setTimeScale(target: number, durationMs: number): void {
    if (!this.scene) return
    this.transitionFrom = this.currentScale
    this.transitionTo = Math.max(target, 0.0001) // 不能为 0，会阻塞主循环
    this.transitionStart = performance.now()
    this.transitionDuration = durationMs
    this.state = 'transitioning'
  }

  /** 冻结画面（timeScale → 10000，近乎静止） */
  freeze(durationMs: number): void {
    if (!this.scene) return
    this.state = 'frozen'
    this.currentScale = 10000
    this.scene.physics.world.timeScale = 10000
    this.freezeEnd = performance.now() + durationMs
  }

  /** 恢复到全速 */
  resume(durationMs: number = 0): void {
    this.setTimeScale(1.0, durationMs)
  }

  // ── 状态查询 ──

  getCurrentScale(): number {
    return this.currentScale
  }

  getState(): SlowMoState {
    return this.state
  }

  isActive(): boolean {
    return this.state !== 'idle' || this.currentScale > 1.0
  }

  // ── 每帧更新（必须在场景 update 中调用） ──

  update(): void {
    if (!this.scene) return
    const now = performance.now()

    if (this.state === 'frozen') {
      if (now >= this.freezeEnd) {
        this.state = 'idle'
        // 冻结结束，保持当前 scale（由调用方决定下一步）
      }
      return
    }

    if (this.state === 'transitioning') {
      const elapsed = now - this.transitionStart
      const t = Math.min(elapsed / this.transitionDuration, 1.0)
      // easeInOutQuad
      const eased = t < 0.5
        ? 2 * t * t
        : -1 + (4 - 2 * t) * t
      this.currentScale = this.transitionFrom + (this.transitionTo - this.transitionFrom) * eased
      this.scene.physics.world.timeScale = this.currentScale
      // fps 跟随 timeScale 平滑变化，避免切换瞬间的顿挫感
      this.scene.physics.world.setFPS(Math.round(this.baseFps * this.currentScale))

      if (t >= 1.0) {
        this.state = 'idle'
        this.currentScale = this.transitionTo
        this.scene.physics.world.timeScale = this.transitionTo
        this.scene.physics.world.setFPS(Math.round(this.baseFps * this.transitionTo))
      }
    }
  }
}
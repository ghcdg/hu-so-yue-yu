/**
 * SfxManager - 音效管理器（v0.2 新增）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第十二章(音效系统)
 * - TECH_ARCH.md 6.6(SfxManager 实现要点)
 *
 * Web Audio API 合成,零外部依赖。
 * 关键时机必有反馈,但不喧宾夺主。
 * 单例模式,各场景按需调用 SfxManager.getInstance().play('jump')。
 */
export type SfxType =
  | 'jump'
  | 'doubleJump'
  | 'coin'
  | 'interact'
  | 'surprise'
  | 'brickBreak'
  | 'levelComplete'
  | 'hit'
  | 'chaseStart'
  | 'correct'
  | 'wrong'
  | 'combo'
  | 'tick'

export class SfxManager {
  private static instance: SfxManager | null = null
  private ctx: AudioContext | null = null
  private muted = false

  static getInstance(): SfxManager {
    if (!SfxManager.instance) {
      SfxManager.instance = new SfxManager()
    }
    return SfxManager.instance
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext()
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  play(type: SfxType): void {
    if (this.muted) return
    try {
      const ctx = this.getCtx()
      switch (type) {
        case 'jump': this.playTone(ctx, 600, 0.08, 'square', 0.3); break
        case 'doubleJump': this.playTone(ctx, 800, 0.12, 'square', 0.3); break
        case 'coin': this.playCoin(ctx); break
        case 'interact': this.playTone(ctx, 440, 0.06, 'sine', 0.25); break
        case 'surprise': this.playSurprise(ctx); break
        case 'brickBreak': this.playNoise(ctx, 0.15, 0.2); break
        case 'levelComplete': this.playChord(ctx); break
        case 'hit': this.playTone(ctx, 200, 0.1, 'sawtooth', 0.2); break
        case 'chaseStart': this.playTone(ctx, 500, 0.15, 'sawtooth', 0.25); break
        case 'correct': this.playTone(ctx, 880, 0.12, 'sine', 0.25); break
        case 'wrong': this.playTone(ctx, 150, 0.15, 'sawtooth', 0.2); break
        case 'combo': this.playCombo(ctx); break
        case 'tick': this.playTone(ctx, 1000, 0.04, 'sine', 0.15); break
      }
    } catch {
      // 静默失败,音效不影响游戏运行
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  getMuted(): boolean {
    return this.muted
  }

  destroy(): void {
    this.ctx?.close()
    this.ctx = null
    SfxManager.instance = null
  }

  // ── 合成方法 ──

  private playTone(
    ctx: AudioContext,
    freq: number,
    duration: number,
    waveType: OscillatorType,
    volume: number
  ): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = waveType
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  private playCoin(ctx: AudioContext): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(800, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.08)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.12)
  }

  private playSurprise(ctx: AudioContext): void {
    // 爆开音效:短促噪音 + 低频
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
    noise.connect(gain)
    gain.connect(ctx.destination)
    noise.start(ctx.currentTime)
  }

  private playNoise(ctx: AudioContext, duration: number, volume: number): void {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    noise.connect(gain)
    gain.connect(ctx.destination)
    noise.start(ctx.currentTime)
  }

  private playChord(ctx: AudioContext): void {
    // 上扬和弦:三个音叠加
    const freqs = [523, 659, 784] // C5, E5, G5
    const oscs = freqs.map(freq => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      return osc
    })
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    oscs.forEach(osc => osc.connect(gain))
    gain.connect(ctx.destination)
    oscs.forEach(osc => {
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.6)
    })
  }

  /** combo 音效: 快速上升音阶 */
  private playCombo(ctx: AudioContext): void {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  }
}
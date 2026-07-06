/**
 * JyutpingSpeaker - 粤拼合成发音引擎(当前启用方案)
 *
 * 设计依据:TECH_ARCH.md 第八章、GAME_DESIGN.md 第九章
 *
 * 务实简化说明(初赛 Demo):
 * - 真语音合成需音素库/神经网络,Web Audio API 无法直接合成真人发音
 * - Demo 目标:让玩家听到"有6声调起伏的电子音",感知粤语声调特征即可
 * - 每个音节 = 1个 OscillatorNode(正弦波)+ ADSR 包络,声调决定基频走向
 * - 不追求语音学准确,追求"能听出声调起伏 + 无外部资源依赖"
 *
 * 粤拼6声调(语言学近似)→ 频率走向:
 *   调1 高平 55 → 440Hz 平
 *   调2 高升 35 → 330→440Hz 升
 *   调3 中平 33 → 330Hz 平
 *   调4 低降 21 → 220→165Hz 降
 *   调5 低升 23 → 220→277Hz 升
 *   调6 低平 22 → 220Hz 平
 *
 * 失败降级:不可用/播放异常 → 静音 + console.warn,不阻塞游戏
 */
import type { BaseSpeaker } from './BaseSpeaker'

/** 声调频率轮廓(起止频率,相同=平调,不同=升降调) */
interface ToneProfile {
  startFreq: number
  endFreq: number
}

/** 粤拼6声调 → 频率参数(Hz) */
const TONE_FREQ: Record<number, ToneProfile> = {
  1: { startFreq: 440, endFreq: 440 }, // 高平 55
  2: { startFreq: 330, endFreq: 440 }, // 高升 35
  3: { startFreq: 330, endFreq: 330 }, // 中平 33
  4: { startFreq: 220, endFreq: 165 }, // 低降 21
  5: { startFreq: 220, endFreq: 277 }, // 低升 23
  6: { startFreq: 220, endFreq: 220 } // 低平 22
}

/** 单音节时长(ms) */
const SYLLABLE_MS = 220
/** 音节间隔(ms) */
const GAP_MS = 40
/** 音量(0~1,正弦波柔和音色,避免过大) */
const PEAK_GAIN = 0.15

/** 解析后的音节 */
interface Syllable {
  letters: string
  tone: number
}

export class JyutpingSpeaker implements BaseSpeaker {
  readonly name = 'jyutping'

  /** AudioContext 懒加载(浏览器策略:需用户交互后创建) */
  private ctx: AudioContext | null = null
  /** 播放中标志(stop() 用) */
  private playing = false

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('AudioContext' in window || 'webkitAudioContext' in window)
    )
  }

  /** 懒加载获取 AudioContext */
  private getCtx(): AudioContext | null {
    if (!this.isAvailable()) return null
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      this.ctx = new AC()
    }
    // 浏览器策略:交互后 resume
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  /**
   * 朗读中文文本
   * 初赛 Demo 未实现中文→粤拼词典,降级为静音 + 警告
   * 调用方应优先使用 speakJyutping(jp)
   */
  async speak(_text: string): Promise<void> {
    console.warn(
      '[JyutpingSpeaker] speak(text) 未实现中文→粤拼映射,请使用 speakJyutping(jyutping)'
    )
  }

  /** 朗读粤拼串(如 "zou6 jan4 jyu4 gwo2") */
  async speakJyutping(jyutping: string): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('[JyutpingSpeaker] Web Audio API 不可用,跳过发音')
      return
    }
    const ctx = this.getCtx()
    if (!ctx) return

    const syllables = this.parseJyutping(jyutping)
    if (syllables.length === 0) return

    this.playing = true
    try {
      for (const syl of syllables) {
        if (!this.playing) break
        await this.playTone(ctx, syl)
      }
    } catch (e) {
      console.warn('[JyutpingSpeaker] 播放失败,降级静音:', e)
    } finally {
      this.playing = false
    }
  }

  /** 解析粤拼串 → 音节数组(匹配 [a-z]+[1-6],忽略标点空格) */
  private parseJyutping(text: string): Syllable[] {
    const result: Syllable[] = []
    const re = /([a-z]+)([1-6])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      result.push({ letters: m[1], tone: parseInt(m[2], 10) })
    }
    return result
  }

  /** 播放单音节(正弦波 + 频率走向 + ADSR 包络) */
  private playTone(ctx: AudioContext, syl: Syllable): Promise<void> {
    return new Promise<void>((resolve) => {
      const profile = TONE_FREQ[syl.tone] ?? TONE_FREQ[6]
      const now = ctx.currentTime
      const duration = SYLLABLE_MS / 1000

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(profile.startFreq, now)
      if (profile.startFreq !== profile.endFreq) {
        osc.frequency.linearRampToValueAtTime(profile.endFreq, now + duration)
      }

      // ADSR 简化包络(避免爆音)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + 0.02) // attack 20ms
      gain.gain.setValueAtTime(PEAK_GAIN, now + duration - 0.04) // sustain
      gain.gain.linearRampToValueAtTime(0, now + duration) // release 40ms

      osc.connect(gain).connect(ctx.destination)
      osc.start(now)
      osc.stop(now + duration)

      // 等待当前音节播完(含间隔)
      window.setTimeout(resolve, SYLLABLE_MS + GAP_MS)
    })
  }

  stop(): void {
    this.playing = false
    if (this.ctx) {
      this.ctx.close().catch(() => {
        /* 忽略关闭错误 */
      })
      this.ctx = null
    }
  }
}

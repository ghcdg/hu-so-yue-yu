/**
 * CantoneseSpeaker - 浏览器原生 SpeechSynthesis 粤语发音引擎
 *
 * 核心逻辑提取自 deepseek_html_20260715_ef3355.html:
 * - SpeechSynthesisUtterance + lang='zh-HK'
 * - 优先选择 zh-HK / yue 语音包
 * - 降级方案: zh-* 语音包
 *
 * 用途: 揭示平台朗读粤语原句(cantonese_read)
 */
import type { BaseSpeaker } from './BaseSpeaker'

export class CantoneseSpeaker implements BaseSpeaker {
  readonly name = 'cantonese'

  private selectedVoice: SpeechSynthesisVoice | null = null
  private initialized = false

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    )
  }

  /** 选择粤语语音(优先 zh-HK / yue, 降级 zh-*) */
  private getCantoneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) return null
    for (const v of voices) {
      if (v.lang.toLowerCase() === 'zh-hk' || v.lang.toLowerCase() === 'yue') return v
    }
    for (const v of voices) {
      if (v.lang.toLowerCase().includes('hk') || v.lang.toLowerCase().includes('yue')) return v
    }
    for (const v of voices) {
      if (v.lang.toLowerCase().startsWith('zh')) return v
    }
    return voices[0]
  }

  /** 初始化语音选择(浏览器异步加载语音列表) */
  private initVoice(): void {
    if (this.initialized) return
    this.initialized = true

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      this.selectedVoice = this.getCantoneseVoice(voices)
    }
    // 监听语音列表动态加载
    window.speechSynthesis.onvoiceschanged = () => {
      const v = window.speechSynthesis.getVoices()
      const best = this.getCantoneseVoice(v)
      if (best) this.selectedVoice = best
    }
  }

  /** 朗读粤语文本 */
  async speak(text: string): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('[CantoneseSpeaker] SpeechSynthesis 不可用,跳过发音')
      return
    }
    if (!text.trim()) return

    this.initVoice()

    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-HK'
      u.rate = 0.9
      u.pitch = 1.0
      u.volume = 1.0

      if (this.selectedVoice) {
        u.voice = this.selectedVoice
      } else {
        // 再次尝试获取语音
        const voices = window.speechSynthesis.getVoices()
        const best = this.getCantoneseVoice(voices)
        if (best) {
          u.voice = best
          this.selectedVoice = best
        }
      }

      u.onend = () => resolve()
      u.onerror = (e) => {
        console.warn('[CantoneseSpeaker] 朗读失败:', e.error)
        resolve()
      }

      try {
        window.speechSynthesis.speak(u)
      } catch (e) {
        console.warn('[CantoneseSpeaker] 启动朗读失败:', e)
        resolve()
      }
    })
  }

  /** 朗读粤拼(Web Speech 不支持, 降级静音) */
  async speakJyutping(_jyutping: string): Promise<void> {
    console.warn('[CantoneseSpeaker] speakJyutping 不支持, 请改用 speak(粤语文本)')
  }

  stop(): void {
    if (this.isAvailable()) {
      window.speechSynthesis.cancel()
    }
  }
}
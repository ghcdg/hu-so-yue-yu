/**
 * WebSpeechSpeaker - 浏览器原生 SpeechSynthesis 发音引擎(普通话)
 *
 * 用途:Demo 阶段用浏览器内置 TTS 朗读普通话,确保玩家能听到完整发音
 * 后期:由 SpeakerManager 切换为 JyutpingSpeaker(粤语)/DoubaoTTS(豆包)
 *
 * 设计依据:GAME_DESIGN.md 第九章(预留方案之一)
 * 优点:零依赖、支持中文、发音完整(对比 JyutpingSpeaker 的电子音)
 * 缺点:浏览器/系统语音包差异,音色不统一
 *
 * 失败降级:SpeechSynthesis 不可用或无中文语音 → 静音 + console.warn
 */
import type { BaseSpeaker } from './BaseSpeaker'

export class WebSpeechSpeaker implements BaseSpeaker {
  readonly name = 'webspeech'

  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window
    )
  }

  /** 朗读中文文本(默认普通话 zh-CN) */
  async speak(text: string): Promise<void> {
    if (!this.isAvailable()) {
      console.warn('[WebSpeechSpeaker] SpeechSynthesis 不可用,跳过发音')
      return
    }
    if (!text.trim()) return

    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = 1
      u.pitch = 1
      u.volume = 1

      // 尝试选择中文语音(若系统已加载)
      const voices = window.speechSynthesis.getVoices()
      const zh = voices.find((v) => v.lang.startsWith('zh'))
      if (zh) u.voice = zh

      u.onend = () => resolve()
      u.onerror = (e) => {
        console.warn('[WebSpeechSpeaker] 朗读失败:', e)
        resolve()
      }
      window.speechSynthesis.speak(u)
    })
  }

  /**
   * 朗读粤拼
   * Web Speech 不识别粤拼符号,降级为静音(调用方应改用 speak(中文))
   */
  async speakJyutping(_jyutping: string): Promise<void> {
    console.warn(
      '[WebSpeechSpeaker] speakJyutping 不支持,请改用 speak(中文文本)'
    )
  }

  stop(): void {
    if (this.isAvailable()) {
      window.speechSynthesis.cancel()
    }
  }
}

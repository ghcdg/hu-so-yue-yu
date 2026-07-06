/**
 * 发音引擎管理器 - 策略模式
 *
 * 当前阶段2只提供空壳,阶段3 P1 接入 JyutpingSpeaker。
 * 设计原则:核心组件预留扩展点(DESIGN_PHILOSOPHY 第四节原则1)。
 */
import type { BaseSpeaker } from './BaseSpeaker'

class SpeakerManager {
  private current: BaseSpeaker | null = null
  private speakers = new Map<string, BaseSpeaker>()

  /** 注册引擎 */
  register(speaker: BaseSpeaker): void {
    this.speakers.set(speaker.name, speaker)
    // 第一个注册的设为当前
    if (!this.current) {
      this.current = speaker
    }
  }

  /** 切换引擎 */
  use(name: string): boolean {
    const s = this.speakers.get(name)
    if (s) {
      this.current = s
      return true
    }
    return false
  }

  /** 朗读粤语 */
  async speak(text: string): Promise<void> {
    if (this.current?.isAvailable()) {
      await this.current.speak(text)
    }
  }

  /** 朗读粤拼 */
  async speakJyutping(jyutping: string): Promise<void> {
    if (this.current?.isAvailable()) {
      await this.current.speakJyutping(jyutping)
    }
  }

  /** 停止 */
  stop(): void {
    this.current?.stop()
  }
}

export const speakerManager = new SpeakerManager()

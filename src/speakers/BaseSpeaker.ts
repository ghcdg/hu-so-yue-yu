/**
 * 发音引擎统一接口
 * 详见 TECH_ARCH.md 第八章 - 当前为阶段2空壳,阶段3 P1 实现
 */
export interface BaseSpeaker {
  /** 引擎名称 */
  readonly name: string
  /** 是否可用 */
  isAvailable(): boolean
  /** 朗读粤语句子(中文) */
  speak(text: string): Promise<void>
  /** 朗读粤拼 */
  speakJyutping(jyutping: string): Promise<void>
  /** 停止当前播放 */
  stop(): void
}

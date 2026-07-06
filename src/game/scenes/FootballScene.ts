/**
 * FootballScene - 踢足球子场景（v0.2 新增）
 *
 * 设计依据:街角破旧足球互动 → 力量条定格 → 抛物线踢球 → 收集汉字奖励
 *
 * 玩法:
 * - 力量条在 0-100% 之间来回摆动
 * - 按 E 定格力量,球沿抛物线飞出
 * - 共 3 次机会,取最佳成绩
 * - 落点奖励:垃圾桶(鱼) / 招牌(跟) / 窗户(冇)
 * - 奖励文字来自目标句子「做人如果冇梦想,跟咸鱼有咩分别?」
 */
import Phaser from 'phaser'
import { SCENE, COLORS } from '@/shared/constants'
import { BaseSubScene } from '@/game/scenes/BaseSubScene'
import type { SubSceneConfig } from '@/game/scenes/BaseSubScene'
import { Player } from '@/game/objects/Player'

/** 足球子场景配置 */
export interface FootballSceneConfig extends SubSceneConfig {
  type: 'football'
  /** 场景尺寸 */
  worldSize: { width: number; height: number }
  /** 玩家起始位置 */
  playerSpawn: { x: number; y: number }
  /** 总踢球次数 */
  totalAttempts: number
}

/** 奖励区域定义 */
interface RewardZone {
  word: string
  jyutping: string
  label: string
  powerMin: number
  powerMax: number
  targetX: number
}

/** 三个奖励区域(来自目标句子关键字符) */
const REWARD_ZONES: RewardZone[] = [
  { word: '鱼', jyutping: 'jyu4', label: '垃圾桶', powerMin: 0, powerMax: 35, targetX: 230 },
  { word: '跟', jyutping: 'gan1', label: '招牌', powerMin: 35, powerMax: 70, targetX: 400 },
  { word: '冇', jyutping: 'mou5', label: '窗户', powerMin: 70, powerMax: 100, targetX: 570 }
]

/** 力量条摆动速度(%/秒) */
const POWER_SPEED = 120

export class FootballScene extends BaseSubScene {
  private player!: Player
  private ball!: Phaser.GameObjects.Arc
  private powerBar!: Phaser.GameObjects.Graphics
  private powerBg!: Phaser.GameObjects.Graphics
  private powerValue = 0
  private powerDirection = 1
  private powerActive = false
  private kicking = false
  private attempts = 0
  private maxAttempts = 3
  private bestResult: RewardZone | null = null
  private footballConfig!: FootballSceneConfig
  private stateText!: Phaser.GameObjects.Text
  private hudText!: Phaser.GameObjects.Text

  constructor() {
    super(SCENE.FOOTBALL)
  }

  protected onSubSceneCreate(data: SubSceneConfig): void {
    this.footballConfig = data as FootballSceneConfig
    const cfg = this.footballConfig
    const { width: worldW, height: worldH } = cfg.worldSize
    this.maxAttempts = cfg.totalAttempts

    this.cameras.main.setBackgroundColor(COLORS.BG)
    this.physics.world.setBounds(0, 0, worldW, worldH)

    // ── 地面 ──
    const groundY = worldH - 30
    this.add.rectangle(worldW / 2, groundY, worldW, 60, 0x2a2a3e)
    const ground = this.add.zone(worldW / 2, groundY, worldW, 60)
    this.physics.add.existing(ground, true)

    // ── 场景标题 ──
    this.add
      .text(worldW / 2, 20, '街角 · 踢足球', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    // ── 落点标记(垃圾桶/招牌/窗户) ──
    for (const zone of REWARD_ZONES) {
      const markerY = groundY - 25
      this.add.rectangle(zone.targetX, markerY, 90, 30, 0x2a2a4e).setStrokeStyle(1, 0x555577)
      this.add
        .text(zone.targetX, markerY, zone.label, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '12px',
          color: '#8888aa'
        })
        .setOrigin(0.5)
      // 奖励文字标签
      this.add
        .text(zone.targetX, markerY - 22, zone.word, {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '16px',
          color: '#ffd166'
        })
        .setOrigin(0.5)
    }

    // ── Player ──
    this.player = new Player(this, cfg.playerSpawn.x, cfg.playerSpawn.y)
    this.player.bindCardState({ idle: '阿粤', run: '跑', jump: '跳', fall: '落', crouch: '蹲' })
    this.physics.add.collider(this.player, ground)
    // 子场景中禁止玩家移动(body 是物理体,setVelocityX 在 Body 上)
    ;(this.player.body as Phaser.Physics.Arcade.Body).setVelocityX(0)

    // ── 足球 ──
    this.ball = this.add.circle(400, 530, 14, 0xffd166)
    this.ball.setStrokeStyle(2, 0xffffff)

    // ── 力量条背景 ──
    const barX = 440
    const barY = 70
    const barW = 400
    const barH = 28
    this.powerBg = this.add.graphics()
    this.powerBg.fillStyle(0x333355, 1)
    this.powerBg.fillRoundedRect(barX, barY, barW, barH, 4)
    this.powerBg.lineStyle(2, 0x666688, 1)
    this.powerBg.strokeRoundedRect(barX, barY, barW, barH, 4)

    this.powerBar = this.add.graphics()

    // ── 提示文字 ──
    this.stateText = this.add
      .text(worldW / 2, 115, '按 E 开始踢球!', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    // ── HUD(剩余次数 + 最佳成绩) ──
    this.hudText = this.add
      .text(worldW / 2, 145, '', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)
    this.updateHud()

    // ── 开始力量摆动 ──
    this.startPowerCharge()

    // ── E 键:定格力量 ──
    this.input.keyboard!.on('keydown-E', () => {
      if (this.powerActive && !this.kicking) {
        this.stopAndKick()
      }
    })

    // ── ESC 取消 ──
    this.input.keyboard!.on('keydown-ESC', () => {
      this.cancel()
    })
  }

  /** 开始力量条摆动 */
  private startPowerCharge(): void {
    this.powerValue = 0
    this.powerDirection = 1
    this.powerActive = true
    this.kicking = false
    this.stateText.setText('按 E 定格力量!')
  }

  update(_time: number, delta: number): void {
    if (!this.powerActive || this.kicking) return

    // 力量条摆动(frame-rate independent)
    this.powerValue += this.powerDirection * POWER_SPEED * (delta / 1000)
    if (this.powerValue >= 100) {
      this.powerValue = 100
      this.powerDirection = -1
    } else if (this.powerValue <= 0) {
      this.powerValue = 0
      this.powerDirection = 1
    }

    this.drawPowerBar()
  }

  /** 绘制力量条(颜色渐变:绿→黄→红) */
  private drawPowerBar(): void {
    this.powerBar.clear()
    const pct = this.powerValue / 100
    const color = pct > 0.7 ? 0xff4444 : pct > 0.35 ? 0xffd166 : 0x44ff44
    const barW = 392 * pct
    this.powerBar.fillStyle(color, 1)
    this.powerBar.fillRoundedRect(444, 72, barW, 22, 3)
  }

  /** 定格力量并踢球 */
  private stopAndKick(): void {
    this.powerActive = false
    this.kicking = true
    this.attempts++
    const power = Math.round(this.powerValue)
    this.stateText.setText(`力量: ${power}%`)

    const zone = this.getRewardZone(this.powerValue)
    const targetX = zone ? zone.targetX : 700 // 出界

    // 球抛物线飞行
    const startX = this.ball.x
    const startY = this.ball.y
    const groundY = this.footballConfig.worldSize.height - 44

    this.tweens.add({
      targets: this.ball,
      x: targetX,
      duration: 700,
      ease: 'Linear',
      onUpdate: (_tween: Phaser.Tweens.Tween) => {
        const progress = _tween.progress
        // 线性插值 X 和 Y
        this.ball.x = startX + (targetX - startX) * progress
        // 抛物线弧(Y 轴)
        const linearY = startY + (groundY - startY) * progress
        const arcHeight = -180 * Math.sin(progress * Math.PI)
        this.ball.y = linearY + arcHeight
      },
      onComplete: () => {
        this.showResult(zone)
      }
    })
  }

  /** 根据力量值获取奖励区域 */
  private getRewardZone(power: number): RewardZone | null {
    for (const zone of REWARD_ZONES) {
      if (power >= zone.powerMin && power <= zone.powerMax) {
        return zone
      }
    }
    return null
  }

  /** 显示踢球结果 */
  private showResult(zone: RewardZone | null): void {
    if (zone) {
      if (!this.bestResult || zone.powerMax > this.bestResult.powerMax) {
        this.bestResult = zone
      }
      this.stateText.setText(`击中 ${zone.label}! 获得文字: 「${zone.word}」`)
    } else {
      this.stateText.setText('出界了! 没有奖励')
    }

    this.updateHud()

    if (this.attempts < this.maxAttempts) {
      // 重置足球,开始下一轮
      this.time.delayedCall(1200, () => {
        this.ball.setPosition(400, 530)
        this.startPowerCharge()
      })
    } else {
      // 全部踢完,结束
      this.time.delayedCall(1500, () => {
        this.finish()
      })
    }
  }

  /** 更新 HUD 信息 */
  private updateHud(): void {
    const remaining = this.maxAttempts - this.attempts
    const best = this.bestResult ? `最佳: ${this.bestResult.word}(${this.bestResult.label})` : '暂无'
    this.hudText.setText(`剩余: ${remaining}/${this.maxAttempts} | ${best}`)
  }

  /** 结束子场景,回传结果 */
  private finish(): void {
    if (this.bestResult) {
      this.complete({
        subSceneId: this.footballConfig.id,
        outcome: 'success',
        rewards: {
          word: this.bestResult.word,
          jyutping: this.bestResult.jyutping,
          zone: this.bestResult.label
        }
      })
    } else {
      this.complete({
        subSceneId: this.footballConfig.id,
        outcome: 'failure'
      })
    }
  }
}
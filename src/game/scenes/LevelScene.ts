/**
 * LevelScene - 关卡主场景
 * 职责:渲染关卡 / 处理物理与输入 / 触发惊喜与揭示
 * 详见 TECH_ARCH.md 5.2 节
 *
 * 阶段2:仅占位验证 Vue ↔ Phaser 通信链路
 * - 模拟收集金币 / 隐藏发现(通知 UIScene 更新 HUD)
 * - 模拟通关(eventBus 通知 Vue 弹结算)
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { eventBus } from '@/shared/eventBus'

interface HudUpdatePayload {
  coins: number
  hidden: number
}

export class LevelScene extends Phaser.Scene {
  private coins = 0
  private hidden = 0
  private startTime = 0
  private readonly levelId = 'level_01_fish'

  constructor() {
    super(SCENE.LEVEL)
  }

  create(): void {
    const { WIDTH, HEIGHT } = GAME_SIZE
    this.coins = 0
    this.hidden = 0
    this.startTime = this.time.now

    this.cameras.main.setBackgroundColor(COLORS.BG)

    // 标题
    this.add
      .text(WIDTH / 2, 80, '狐嗦粤语 — 阶段2 骨架验证', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '32px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    this.add
      .text(WIDTH / 2, 130, `关卡: ${this.levelId}`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)

    this.add
      .text(
        WIDTH / 2,
        HEIGHT / 2 - 130,
        '此处为 LevelScene 占位\n阶段3 将填入第一关 7 区铺垫链',
        {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '16px',
          color: '#a0a0c0',
          align: 'center',
          lineSpacing: 6
        }
      )
      .setOrigin(0.5)

    // 模拟:收集粤语金币
    const coinBtn = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 40, '[ 点击收集粤语金币 ]', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#06d6a0',
        backgroundColor: '#16213e',
        padding: { x: 20, y: 10 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    coinBtn.on('pointerdown', () => {
      this.coins++
      this.emitHudUpdate()
      eventBus.emit({
        type: 'coin-collected',
        word: '占位词',
        count: this.coins
      })
    })

    // 模拟:触发隐藏发现
    const hiddenBtn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 30, '[ 触发隐藏发现 ]', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#ef476f',
        backgroundColor: '#16213e',
        padding: { x: 20, y: 10 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    hiddenBtn.on('pointerdown', () => {
      this.hidden++
      this.emitHudUpdate()
      eventBus.emit({
        type: 'hidden-found',
        id: `hidden_${this.hidden}`,
        count: this.hidden
      })
    })

    // 模拟:通关结算
    const finishBtn = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 110, '[ 模拟通关 → 结算 ]', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '22px',
        color: '#1a1a2e',
        backgroundColor: '#ffd166',
        padding: { x: 24, y: 12 }
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    finishBtn.on('pointerdown', () => this.finishLevel())

    // ESC 键也触发结算(模拟返回)
    this.input.keyboard?.on('keydown-ESC', () => this.finishLevel())

    // 启动 UIScene(此时 LevelScene 已存在,UIScene 可安全监听)
    this.scene.launch(SCENE.UI)

    // 通知 Vue UI 层:关卡已启动
    eventBus.emit({ type: 'level-start', levelId: this.levelId })
  }

  private emitHudUpdate(): void {
    const payload: HudUpdatePayload = { coins: this.coins, hidden: this.hidden }
    // 场景内部事件 - UIScene 监听
    this.events.emit('hud-update', payload)
  }

  private finishLevel(): void {
    eventBus.emit({
      type: 'level-complete',
      result: {
        levelId: this.levelId,
        coins: this.coins,
        totalCoins: 5,
        hiddenFound: this.hidden,
        totalHidden: 2,
        timeMs: this.time.now - this.startTime,
        rank: '咸鱼翻身'
      }
    })
  }
}

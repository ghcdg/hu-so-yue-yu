/**
 * LevelScene - 关卡主场景
 * 职责:从 JSON 加载关卡 / 创建对象 / 配置碰撞 / 处理互动 / 触发揭示
 * 详见 TECH_ARCH.md 5.2 节
 *
 * 阶段3 P3:关卡数据驱动
 * - 平台 / 金币 / NPC 从 JSON 加载
 * - 金币拾取(overlap)
 * - NPC 对话(E 键 + 靠近)
 * - 句子揭示(到达揭示点)
 */
import Phaser from 'phaser'
import { SCENE, COLORS, GAME_SIZE } from '@/shared/constants'
import { eventBus } from '@/shared/eventBus'
import { TextSprite } from '@/game/objects/TextSprite'
import { Player } from '@/game/objects/Player'
import { Coin } from '@/game/objects/Coin'
import { Npc } from '@/game/objects/Npc'
import levelData from '@/game/data/levels/level_01_fish.json'
import type { LevelData } from '@/game/data/types'
import { toSentence } from '@/game/data/types'
import { speakerManager } from '@/speakers/SpeakerManager'

const LEVEL = levelData as LevelData

/** NPC 互动检测半径 */
const NPC_INTERACT_RADIUS = 80
/** 对话中玩家走远自动关闭的距离阈值 */
const DIALOG_CLOSE_DISTANCE = 120

export class LevelScene extends Phaser.Scene {
  private coins = 0
  private hidden = 0
  private startTime = 0

  private player!: Player
  private coinsGroup!: Phaser.GameObjects.Group
  private npcs: Npc[] = []
  private platforms: TextSprite[] = []
  private revealZone!: Phaser.GameObjects.Zone
  private revealed = false

  /** 当前正在对话的 NPC(null=无对话) */
  private talkingNpc: Npc | null = null

  constructor() {
    super(SCENE.LEVEL)
  }

  create(): void {
    const { WIDTH } = GAME_SIZE
    this.coins = 0
    this.hidden = 0
    this.startTime = this.time.now
    this.revealed = false
    this.cameras.main.setBackgroundColor(COLORS.BG)
    this.physics.world.setBoundsCollision(true, true, true, true)

    // ── 关卡标题 ──
    this.add
      .text(WIDTH / 2, 28, `${LEVEL.name} · ${LEVEL.themeTag}`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#ffd166'
      })
      .setOrigin(0.5)

    this.add
      .text(WIDTH / 2, 54, 'A/D 移动 · W/Space 跳跃 · S 蹲下 · E 互动/推进对话 · ESC 通关', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '12px',
        color: '#a0a0c0'
      })
      .setOrigin(0.5)

    // ── 地面 ──
    const ground = this.createPlatform(LEVEL.ground.position, LEVEL.ground.size, LEVEL.ground.card.text)

    // ── 平台 ──
    for (const p of LEVEL.platforms) {
      this.createPlatform(p.position, p.size, p.card?.text ?? '平台')
    }

    // ── 金币 ──
    this.coinsGroup = this.add.group()
    for (const c of LEVEL.coins) {
      const coin = new Coin(this, c.position.x, c.position.y, c.word, c.jyutping)
      this.coinsGroup.add(coin)
    }

    // ── NPC ──
    for (const n of LEVEL.npcs) {
      const npc = new Npc(this, n)
      this.npcs.push(npc)
    }

    // ── Player ──
    this.player = new Player(this, LEVEL.spawn.x, LEVEL.spawn.y)

    // ── 揭示点(隐形 zone) ──
    this.revealZone = this.add.zone(
      LEVEL.revealPosition.x,
      LEVEL.revealPosition.y,
      60,
      60
    )
    this.physics.add.existing(this.revealZone, true)

    // ── 碰撞配置 ──
    this.physics.add.collider(this.player, [ground, ...this.platforms])

    // 金币拾取(overlap)
    this.physics.add.overlap(
      this.player,
      this.coinsGroup.getChildren(),
      (_obj1, obj2) => {
        const coin = obj2 as Coin
        if (coin.collect()) {
          this.coins++
          this.emitHudUpdate()
          eventBus.emit({ type: 'coin-collected', word: coin.word, count: this.coins })
          // 铺垫链过程不发音:让玩家潜意识拼凑碎片,不打扰(DESIGN_PHILOSOPHY 原则3)
        }
      }
    )

    // 揭示点检测
    this.physics.add.overlap(this.player, this.revealZone, () => {
      if (!this.revealed) {
        this.revealed = true
        const sentence = toSentence(LEVEL.targetSentence)
        // 通知 UIScene 显示揭示卡片
        this.events.emit('reveal-sentence', sentence)
        // 通知 Vue UI 层
        eventBus.emit({ type: 'sentence-revealed', sentence })
        // 朗读普通话释义(fire-and-forget,不阻塞游戏循环)
        void speakerManager.speak(sentence.mandarin)
      }
    })

    // ── E 互动:推进对话 / 触发 NPC 对话 ──
    this.events.on('player-interact', (data: { x: number; y: number }) => {
      if (this.talkingNpc) {
        // 正在对话中:推进
        const line = this.talkingNpc.talk()
        this.events.emit('show-dialog', line)
        return
      }
      // 寻找附近 NPC
      const npc = this.findNearbyNpc(data.x, data.y)
      if (npc) {
        this.talkingNpc = npc
        const line = npc.talk()
        this.events.emit('show-dialog', line)
      }
    })

    // ── ESC 通关 ──
    this.input.keyboard?.on('keydown-ESC', () => this.finishLevel())

    // 启动 UIScene
    this.scene.launch(SCENE.UI)
    eventBus.emit({ type: 'level-start', levelId: LEVEL.id })
  }

  /** 创建平台(TextSprite + 静态物理体) */
  private createPlatform(
    position: { x: number; y: number },
    size: { width: number; height: number },
    label: string
  ): TextSprite {
    const p = new TextSprite(this, position.x, position.y, {
      type: 'object',
      text: label,
      suffix: '.jpg',
      size: { width: size.width, height: size.height },
      borderWidth: 2
    })
    this.physics.add.existing(p, true)
    this.platforms.push(p)
    return p
  }

  /** 寻找半径内的 NPC */
  private findNearbyNpc(x: number, y: number): Npc | null {
    let nearest: Npc | null = null
    let minDist = NPC_INTERACT_RADIUS
    for (const npc of this.npcs) {
      const dx = npc.x - x
      const dy = npc.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        nearest = npc
      }
    }
    return nearest
  }

  /** 关闭对话(UIScene 调用,玩家走远或对话结束) */
  closeDialog(): void {
    this.talkingNpc?.resetDialogue()
    this.talkingNpc = null
  }

  /** 每帧:对话中检测玩家是否走远,走远则自动关闭对话 */
  update(): void {
    if (!this.talkingNpc || !this.player) return
    const dx = this.talkingNpc.x - this.player.x
    const dy = this.talkingNpc.y - this.player.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > DIALOG_CLOSE_DISTANCE) {
      this.closeDialog()
      this.events.emit('close-dialog')
    }
  }

  private emitHudUpdate(): void {
    this.events.emit('hud-update', { coins: this.coins, hidden: this.hidden })
  }

  private finishLevel(): void {
    eventBus.emit({
      type: 'level-complete',
      result: {
        levelId: LEVEL.id,
        coins: this.coins,
        totalCoins: LEVEL.totalCoins,
        hiddenFound: this.hidden,
        totalHidden: LEVEL.totalHidden,
        timeMs: this.time.now - this.startTime,
        rank: this.coins >= LEVEL.totalCoins ? '梦想家' : '咸鱼翻身'
      }
    })
  }
}

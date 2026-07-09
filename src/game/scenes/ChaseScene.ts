/**
 * ChaseScene - 追捕小游戏子场景（v0.2 新增, v0.3 升级）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第十章(NPC AI 与追捕系统)
 * - LEVEL_DESIGN/LEVEL_01_FISH.md 区1(老伯追捕)
 * - TECH_ARCH.md 5.6(子场景系统)
 *
 * v0.3 升级:
 * - 双倍速度:进入追捕场景后 player 和 NPC 速度翻倍
 * - NPC 子弹系统:5 发子弹,玩家靠近时发射,命中推飞玩家
 * - 多阶梯平台 + 墙壁反弹:增加场景复杂度和追捕难度
 * - NPC 主动跳跃:玩家在上方或遇到障碍时主动跳跃
 *
 * 独立小场景,有阶梯平台布局。
 * 玩家控制阿粤追,老伯(MovableNpc)自动逃跑+射击。
 * 碰到老伯即抓住,触发对话后回传结果。
 */
import Phaser from 'phaser'
import { SCENE, COLORS, PHYSICS, SLOWMO } from '@/shared/constants'
import { BaseSubScene } from '@/game/scenes/BaseSubScene'
import type { SubSceneConfig } from '@/game/scenes/BaseSubScene'
import { Player } from '@/game/objects/Player'
import { MovableNpc } from '@/game/objects/MovableNpc'
import type { MovableNpcData } from '@/game/objects/MovableNpc'
import { Bullet } from '@/game/objects/Bullet'
import { TextSprite } from '@/game/objects/TextSprite'
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { PlatformData, DialogueData, ChaseSceneData } from '@/game/data/types'
import { SlowMoManager } from '@/game/systems/SlowMoManager'
import { RainManager } from '@/game/systems/RainManager'

/** 追捕子场景配置(扩展 SubSceneConfig + ChaseSceneData) */
export interface ChaseSceneConfig extends SubSceneConfig, ChaseSceneData {
  type: 'chase'
}

export class ChaseScene extends BaseSubScene {
  private player!: Player
  private fugitive!: MovableNpc
  private chaseConfig!: ChaseSceneConfig
  private caught = false
  private dialogueIndex = 0
  private dialogueBox: TextSprite | null = null
  private bulletsGroup!: Phaser.GameObjects.Group

  // ── v0.4 测试:慢动作 + 雨系统 ──
  private rainManager: RainManager | null = null
  private slowMoActive = false
  private slowMoStatusText: Phaser.GameObjects.Text | null = null

  constructor() {
    super(SCENE.CHASE)
  }

  protected onSubSceneCreate(data: SubSceneConfig): void {
    this.chaseConfig = data as ChaseSceneConfig
    const cfg = this.chaseConfig
    const { width: worldW, height: worldH } = cfg.worldSize

    // 背景
    this.cameras.main.setBackgroundColor(COLORS.BG)
    this.physics.world.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    // 场景标题
    this.add
      .text(worldW / 2, 20, '追捕老伯!', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '18px',
        color: '#ff6b6b'
      })
      .setOrigin(0.5)

    // 地面
    const ground = this.createPlatform(
      { x: worldW / 2, y: worldH - 10 },
      { width: worldW, height: 20 },
      '天台地面'
    )

    // 平台(阶梯块)
    const platforms: TextSprite[] = []
    for (const p of cfg.platforms) {
      const plat = this.createPlatform(p.position, p.size, '平台')
      platforms.push(plat)
    }

    // Player(双倍速度)
    this.player = new Player(this, cfg.playerSpawn.x, cfg.playerSpawn.y)
    this.player.bindCardState(
      cfg.stateTextMaps?.player ?? {
        idle: '阿粤', run: '追!', jump: '跳', fall: '落', crouch: '蹲'
      }
    )
    // 双倍最大速度
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setMaxVelocityX(PHYSICS.PLAYER_SPEED * 2)
    // 平台反弹(水平反弹,垂直无反弹:避免地面弹跳;反弹在动态Body上设置)
    const bounce = cfg.platformBounce ?? 0.6
    playerBody.setBounce(bounce, 0)
    this.physics.add.collider(this.player, [ground, ...platforms])

    // Fugitive(MovableNpc, 双倍速度 + 子弹)
    const fugData: MovableNpcData = {
      id: cfg.fugitive.npcId,
      card: {
        ...cfg.fugitive.card,
        stateBinding: {
          sourceId: cfg.fugitive.npcId,
          textMap: cfg.stateTextMaps?.fugitive ?? {
            idle: '老伯', patrol: '巡', flee: '逃!', caught: '啊!', flee_empty: '弹尽!'
          }
        }
      },
      position: cfg.fugitive.spawn,
      dialogues: cfg.caughtDialogue,
      patrolPoints: cfg.fugitive.patrolPoints,
      fleeSpeed: cfg.fugitive.fleeSpeed * 2, // 双倍逃跑速度
      chaseTriggerRadius: 200,
      initialState: 'patrol',
      bullet: cfg.bullet
        ? {
            count: cfg.bullet.count,
            shootRange: cfg.bullet.shootRange,
            cooldownMs: cfg.bullet.cooldownMs
          }
        : undefined
    }
    this.fugitive = new MovableNpc(this, fugData)
    this.fugitive.bindState(
      this.fugitive,
      (cfg.fugitive.card.stateBinding ?? fugData.card.stateBinding)!.textMap
    )
    this.fugitive.onCaught = () => {
      this.onCatch()
    }
    // NPC 射击回调
    this.fugitive.onShoot = (x, y, targetX, targetY) => {
      this.createBullet(x, y, targetX, targetY)
    }
    // NPC 平台反弹
    const fugBody = this.fugitive.body as Phaser.Physics.Arcade.Body
    fugBody.setBounce(bounce, 0)
    this.physics.add.collider(this.fugitive, [ground, ...platforms])

    // 子弹 Group
    this.bulletsGroup = this.add.group()

    // 子弹 vs 玩家:命中推飞
    this.physics.add.overlap(
      this.bulletsGroup,
      this.player,
      (_obj1, obj2) => {
        const bullet = _obj1 as Bullet
        if (!bullet.active) return
        bullet.pushPlayer(obj2)
        bullet.destroy()
      }
    )

    // 子弹 vs 平台:命中销毁
    this.physics.add.collider(
      this.bulletsGroup,
      [ground, ...platforms],
      (obj1) => {
        const bullet = obj1 as Bullet
        if (bullet.active) bullet.destroy()
      }
    )

    // 碰撞检测:玩家碰到逃跑者
    this.physics.add.overlap(this.player, this.fugitive, () => {
      if (!this.caught && this.fugitive.getAiState() !== 'caught') {
        this.fugitive.catch()
      }
    })

    // ESC 取消
    this.input.keyboard!.on('keydown-ESC', () => {
      this.cancel()
    })

    // ── v0.4 测试:慢动作 + 雨系统 ──
    // 初始化慢动作管理器
    SlowMoManager.getInstance().init(this)

    // 创建雨系统
    this.rainManager = new RainManager(this, {
      count: 60,
      speed: 400,
      worldW,
      worldH
    })

    // 状态提示文字
    this.slowMoStatusText = this.add
      .text(worldW / 2, worldH - 30, '按 T 切换慢放 | 当前: 正常', {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: { x: 10, y: 4 }
      })
      .setOrigin(0.5)
      .setDepth(100)

    // T 键切换慢放
    this.input.keyboard!.on('keydown-T', () => {
      this.toggleSlowMo()
    })

    // 场景关闭时清理
    this.events.once('shutdown', () => {
      this.rainManager?.destroy()
      SlowMoManager.getInstance().destroy()
    })
  }

  update(): void {
    // v0.4: 慢动作管理器更新(驱动 timeScale 过渡)
    SlowMoManager.getInstance().update()

    // v0.4: 雨滴回收
    this.rainManager?.update()

    if (!this.player || !this.fugitive || this.caught) return

    // 更新 AI
    this.fugitive.updateAI(this.player.x, this.player.y)

    // 清理已销毁的子弹
    this.bulletsGroup.getChildren().forEach((b) => {
      if (!b.active) {
        this.bulletsGroup.remove(b, true, true)
      }
    })

    // 限时检测
    if (this.chaseConfig.timeLimitMs) {
      // 预留:超时则失败重试
    }
  }

  /** 创建子弹:从 NPC 射向玩家 */
  private createBullet(
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number
  ): void {
    const bullet = new Bullet(this, fromX, fromY - 15, targetX, targetY)
    this.bulletsGroup.add(bullet)
  }

  /** 抓到老伯 */
  private onCatch(): void {
    this.caught = true
    this.dialogueIndex = 0
    this.showCaughtDialogue()
  }

  /** 显示抓到后的对话 */
  private showCaughtDialogue(): void {
    const dialogues = this.chaseConfig.caughtDialogue
    if (this.dialogueIndex >= dialogues.length) {
      // 对话结束,回传结果
      this.complete({
        subSceneId: this.chaseConfig.id,
        outcome: 'success',
        rewards: this.chaseConfig.onComplete
      })
      return
    }

    const line = dialogues[this.dialogueIndex]
    // 销毁旧对话卡片
    this.dialogueBox?.destroy()

    // 创建对话卡片(底部)
    const { height: worldH } = this.chaseConfig.worldSize
    this.dialogueBox = new TextSprite(this, 400, worldH - 60, {
      type: 'dialogue',
      text: `${line.speaker}: ${line.text}`,
      size: { width: 700, height: 80 },
      borderWidth: 2
    })

    // 按 E 推进
    const advance = () => {
      this.dialogueIndex++
      this.showCaughtDialogue()
    }
    const keyHandler = (_event: KeyboardEvent) => {
      if (_event.code === 'KeyE') {
        this.input.keyboard!.off('keydown-E', keyHandler)
        advance()
      }
    }
    this.input.keyboard!.on('keydown-E', keyHandler)
  }

  // ── v0.4 测试:慢放切换 ──

  /** 切换慢放状态(T 键触发) */
  private toggleSlowMo(): void {
    this.slowMoActive = !this.slowMoActive
    const slowMo = SlowMoManager.getInstance()

    if (this.slowMoActive) {
      const timeScale = 1 / SLOWMO.SPEED
      slowMo.setTimeScale(timeScale, SLOWMO.TRANSITION_IN_MS)
      const pct = Math.round(SLOWMO.SPEED * 100)
      this.slowMoStatusText?.setText(`按 T 切换慢放 | 当前: 慢放中 (${pct}%)`)
    } else {
      slowMo.resume(SLOWMO.TRANSITION_OUT_MS)
      this.slowMoStatusText?.setText('按 T 切换慢放 | 当前: 正常')
    }
  }

  /** 创建平台(带物理碰撞) */
  private createPlatform(
    pos: { x: number; y: number },
    size: { width: number; height: number },
    text: string
  ): TextSprite {
    const platform = new TextSprite(this, pos.x, pos.y, {
      type: 'object',
      text,
      size,
      borderWidth: 1
    })
    this.physics.add.existing(platform, true)
    return platform
  }
}
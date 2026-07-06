/**
 * ChaseScene - 追捕小游戏子场景（v0.2 新增）
 *
 * 设计依据:
 * - GAME_DESIGN.md 第十章(NPC AI 与追捕系统)
 * - LEVEL_DESIGN/LEVEL_01_FISH.md 区1(老伯追捕)
 * - TECH_ARCH.md 5.6(子场景系统)
 *
 * 独立小场景,有阶梯平台布局。
 * 玩家控制阿粤追,老伯(MovableNpc)自动逃跑。
 * 碰到老伯即抓住,触发对话后回传结果。
 *
 * 配置数据:ChaseSceneConfig(由关卡 JSON 或代码提供)
 */
import { SCENE, COLORS } from '@/shared/constants'
import { BaseSubScene } from '@/game/scenes/BaseSubScene'
import type { SubSceneConfig } from '@/game/scenes/BaseSubScene'
import { Player } from '@/game/objects/Player'
import { MovableNpc } from '@/game/objects/MovableNpc'
import type { MovableNpcData } from '@/game/objects/MovableNpc'
import { TextSprite } from '@/game/objects/TextSprite'
import type { TextSpriteConfig } from '@/game/objects/TextSprite'
import type { PlatformData, DialogueData } from '@/game/data/types'

/** 追捕子场景配置 */
export interface ChaseSceneConfig extends SubSceneConfig {
  type: 'chase'
  /** 小场景世界尺寸 */
  worldSize: { width: number; height: number }
  /** 平台布局 */
  platforms: PlatformData[]
  /** 玩家起始位置 */
  playerSpawn: { x: number; y: number }
  /** 逃跑 NPC 配置 */
  fugitive: {
    npcId: string
    card: TextSpriteConfig
    spawn: { x: number; y: number }
    fleeSpeed: number
    patrolPoints: { x: number; y: number }[]
  }
  /** 抓到后的对话 */
  caughtDialogue: DialogueData[]
  /** 限时(可选,超时失败重试) */
  timeLimitMs?: number
  /** 状态文字映射(可选) */
  stateTextMaps?: {
    player: Record<string, string>
    fugitive: Record<string, string>
  }
}

export class ChaseScene extends BaseSubScene {
  private player!: Player
  private fugitive!: MovableNpc
  private chaseConfig!: ChaseSceneConfig
  private caught = false
  private dialogueIndex = 0
  private dialogueBox: TextSprite | null = null

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
      platforms.push(this.createPlatform(p.position, p.size, '平台'))
    }

    // Player
    this.player = new Player(this, cfg.playerSpawn.x, cfg.playerSpawn.y)
    this.player.bindCardState(
      cfg.stateTextMaps?.player ?? {
        idle: '阿粤', run: '追', jump: '跳', fall: '落', crouch: '蹲'
      }
    )
    this.physics.add.collider(this.player, [ground, ...platforms])

    // Fugitive(MovableNpc)
    const fugData: MovableNpcData = {
      id: cfg.fugitive.npcId,
      card: {
        ...cfg.fugitive.card,
        stateBinding: {
          sourceId: cfg.fugitive.npcId,
          textMap: cfg.stateTextMaps?.fugitive ?? {
            idle: '老伯', patrol: '巡', flee: '逃!', caught: '啊!'
          }
        }
      },
      position: cfg.fugitive.spawn,
      dialogues: cfg.caughtDialogue,
      patrolPoints: cfg.fugitive.patrolPoints,
      fleeSpeed: cfg.fugitive.fleeSpeed,
      chaseTriggerRadius: 200,
      initialState: 'patrol'
    }
    this.fugitive = new MovableNpc(this, fugData)
    this.fugitive.bindState(
      this.fugitive,
      (cfg.fugitive.card.stateBinding ?? fugData.card.stateBinding)!.textMap
    )
    this.fugitive.onCaught = () => {
      this.onCatch()
    }
    this.physics.add.collider(this.fugitive, [ground, ...platforms])

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
  }

  update(): void {
    if (!this.player || !this.fugitive || this.caught) return

    // 更新 AI
    this.fugitive.updateAI(this.player.x, this.player.y)

    // 限时检测
    if (this.chaseConfig.timeLimitMs) {
      // 预留:超时则失败重试
    }
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
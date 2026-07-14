/**
 * LevelScene - 关卡主场景
 * 职责:从 JSON 加载关卡 / 创建对象 / 配置碰撞 / 处理互动 / 触发揭示
 * 详见 TECH_ARCH.md 5.2 节、LEVEL_DESIGN/LEVEL_01_FISH.md
 *
 * - 可互动物件:E 键触发(踢咸鱼/找区别)
 * - 子场景:追捕老伯 / 找区别于场景
 */
import Phaser from 'phaser'
import { SCENE, COLORS } from '@/shared/constants'
import { eventBus } from '@/shared/eventBus'
import { TextSprite } from '@/game/objects/TextSprite'
import { Player } from '@/game/objects/Player'
import { Coin } from '@/game/objects/Coin'
import { Npc } from '@/game/objects/Npc'
import { InteractableObject } from '@/game/objects/InteractableObject'
import type { ChaseSceneConfig } from '@/game/scenes/ChaseScene'
import type { FindDifferenceSceneConfig } from '@/game/data/types'
import { SfxManager } from '@/game/systems/SfxManager'
import levelData from '@/game/data/levels/level_01_fish.json'
import type { LevelData, InteractAction, DialogueData } from '@/game/data/types'
import { toSentence } from '@/game/data/types'
import { speakerManager } from '@/speakers/SpeakerManager'

const LEVEL = levelData as LevelData

/** NPC 互动检测半径 */
const NPC_INTERACT_RADIUS = 160
/** 可互动物件检测半径 */
const OBJECT_INTERACT_RADIUS = 140
/** 对话中玩家走远自动关闭的距离阈值 */
const DIALOG_CLOSE_DISTANCE = 240

export class LevelScene extends Phaser.Scene {
  private coins = 0
  private startTime = 0

  private player!: Player
  private coinsGroup!: Phaser.GameObjects.Group
  private npcs: Npc[] = []
  private interactables: InteractableObject[] = []
  private platforms: TextSprite[] = []
  private revealZone!: Phaser.GameObjects.Zone
  private revealed = false

  /** 当前正在对话的 NPC(null=无 NPC 对话) */
  private talkingNpc: Npc | null = null
  /** 惊喜对话队列(三段式阶段3,逐条按 E 推进) */
  private surpriseDialogueQueue: DialogueData[] = []
  /** 对话锚点位置(NPC 或惊喜触发点,用于走远自动关闭检测) */
  private dialogAnchor: { x: number; y: number } | null = null
  /** 对话是否进行中(防止 E 键同时触发互动) */
  private dialogActive = false
  /** 检查点:从 zones 数据提取,按 x 坐标升序排列 */
  private checkpoints: { x: number; y: number }[] = []
  /** 当前到达的检查点下标(0=起点) */
  private currentCheckpointIndex = 0
  /** 当前互动提示文字(避免重复 emit) */
  private currentHint = ''

  /** 追捕任务是否已完成 */
  private chaseCompleted = false
  /** 找区别任务是否已完成 */
  private findDiffCompleted = false
  /** 已收集的文字列表 */
  private collectedWords: string[] = []

  constructor() {
    super(SCENE.LEVEL)
  }

  create(): void {
    this.coins = 0
    this.startTime = this.time.now
    this.revealed = false
    this.cameras.main.setBackgroundColor(COLORS.BG)

    // ── 世界边界 + 相机跟随 ──
    const { width: worldW, height: worldH } = LEVEL.worldSize
    this.physics.world.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

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

    // ── 可互动物件 ──
    for (const i of LEVEL.interactables) {
      const obj = new InteractableObject(this, i)
      this.interactables.push(obj)
    }

    // ── Player ──
    this.player = new Player(this, LEVEL.spawn.x, LEVEL.spawn.y)
    // 验证:状态驱动卡片(v0.2 demo) - 玩家卡片实时显示动作
    this.player.bindCardState({
      idle: '某人', run: '跑', jump: '跳', fall: '落', crouch: '蹲'
    })
    // 音效回调
    this.player.onSfx = (type) => {
      SfxManager.getInstance().play(type)
    }
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // ── 揭示点(隐形 zone) ──
    this.revealZone = this.add.zone(LEVEL.revealPosition.x, LEVEL.revealPosition.y, 120, 120)
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
          SfxManager.getInstance().play('coin')
          this.emitHudUpdate()
          eventBus.emit({ type: 'coin-collected', word: coin.word, count: this.coins })
          // 铺垫链过程不发音:让玩家潜意识拼凑碎片,不打扰(DESIGN_PHILOSOPHY 原则3)
        }
      }
    )

    // 揭示点检测(含登台门槛 v0.2 + 任务完成检查)
    this.physics.add.overlap(this.player, this.revealZone, () => {
      if (this.revealed) return
      const reqCoins = LEVEL.requireCoins ?? 0
      if (this.coins < reqCoins) {
        this.events.emit('show-toast', LEVEL.lockedHint ?? `还需收集 ${reqCoins - this.coins} 个汉字才能登台!`)
        return
      }
      // 任务完成检查：必须完成追捕+找区别两个子场景
      if (!this.chaseCompleted || !this.findDiffCompleted) {
        const missing: string[] = []
        if (!this.chaseCompleted) missing.push('和老伯聊天')
        if (!this.findDiffCompleted) missing.push('找咸鱼')
        this.events.emit('show-toast', `还未完成任务！请参考画面上方的任务去完成：${missing.join('、')}`)
        return
      }
      this.revealed = true
      const sentence = toSentence(LEVEL.targetSentence)
      this.events.emit('reveal-sentence', sentence)
      eventBus.emit({ type: 'sentence-revealed', sentence })
      // 朗读普通话释义(fire-and-forget,不阻塞游戏循环)
      void speakerManager.speak(sentence.mandarin)
    })

    // ── E 互动:推进对话 / 触发可互动物件 / 触发 NPC 对话 ──
    this.events.on('player-interact', (data: { x: number; y: number }) => {
      // 优先级1:对话进行中 → 推进或关闭
      if (this.dialogActive) {
        if (this.talkingNpc) {
          // NPC 对话:循环推进(talk() 内部循环)
          const line = this.talkingNpc.talk()
          this.events.emit('show-dialog', line)
          // 老伯第3句对话后触发追捕子场景(任务未完成时可重入)
          if (this.talkingNpc.npcId === 'npc_oldMan' && this.talkingNpc.getCurrentIndex() === 0 && !this.chaseCompleted) {
            this.closeDialog()
            this.events.emit('close-dialog')
            this.time.delayedCall(500, () => this.startChaseScene())
          }
        } else if (this.surpriseDialogueQueue.length > 0) {
          // 惊喜对话:emit 下一条
          this.events.emit('show-dialog', this.surpriseDialogueQueue.shift()!)
        } else {
          // 惊喜对话已到最后一条,按 E 关闭
          this.closeDialog()
          this.events.emit('close-dialog')
        }
        return
      }
      // 优先级2:附近可互动物件
      const intObj = this.findNearbyInteractable(data.x, data.y)
      if (intObj) {
        this.handleInteractableAction(intObj)
        return
      }
      // 优先级3:附近 NPC
      const npc = this.findNearbyNpc(data.x, data.y)
      if (npc) {
        this.talkingNpc = npc
        this.dialogAnchor = { x: npc.x, y: npc.y }
        this.dialogActive = true
        const line = npc.talk()
        this.events.emit('show-dialog', line)
      }
    })

    // ── ESC 退出（带确认弹窗，由 UIScene 处理） ──
    this.input.keyboard?.on('keydown-ESC', () => {
      this.events.emit('show-exit-confirm')
    })

    // 确认退出回调
    this.events.on('confirm-exit', () => {
      this.finishLevel()
    })

    // ── F 键测试找区别于场景 ──
    this.input.keyboard?.on('keydown-F', () => this.startFindDifferenceScene())

    // 子场景结果监听
    this.events.on('subscene-result', (result: any) => {
      if (result.outcome === 'success') {
        // 追捕子场景:收集「梦想」
        if (result.subSceneId === 'chase_oldman') {
          this.chaseCompleted = true
          const words = ['梦', '想']
          this.addCollectedWords(words)
          this.emitTaskUpdate()
          this.events.emit('show-toast', '追捕成功! 收集到「梦想」')
          // 引导玩家去「找区别」子场景
          this.time.delayedCall(2500, () => {
            this.events.emit('show-toast', '前面有个「找区别」的地方，去看看吧！')
          })
        }
        // 找区别于场景:收集「咸鱼」
        else if (result.subSceneId === 'find_difference') {
          this.findDiffCompleted = true
          const words = ['咸', '鱼']
          this.addCollectedWords(words)
          this.emitTaskUpdate()
          this.events.emit('show-toast', '找到了！收集到「咸鱼」')
        }
        // 其他子场景:收集文字奖励
        else if (result.rewards?.word && result.rewards?.jyutping) {
          this.coins++
          this.emitHudUpdate()
          eventBus.emit({
            type: 'coin-collected',
            word: result.rewards.word,
            count: this.coins
          })
          this.events.emit('show-toast', `获得文字「${result.rewards.word}」! 已收集 ${this.coins}/${LEVEL.totalCoins} 字`)
        }
      } else {
        // 取消/失败:如果任务未完成,重置可互动物件
        if (result.subSceneId === 'find_difference' && !this.findDiffCompleted) {
          const intObj = this.interactables.find(o => o.action === 'find_difference')
          intObj?.reset()
        }
        this.events.emit('show-toast', result.subSceneId === 'chase_oldman' ? '追捕取消,可重新找老伯' : '找区别取消,可重新尝试')
      }
    })

    // 场景关闭时清理
    this.events.on('shutdown', this.onShutdown, this)

    // 启动 UIScene
    this.scene.launch(SCENE.UI)
    eventBus.emit({ type: 'level-start', levelId: LEVEL.id })

    // 检查点:从 zones 数据提取,按 x 升序排列;无 zones 则仅用起点
    this.checkpoints = [{ x: LEVEL.spawn.x, y: LEVEL.spawn.y }]
    if (LEVEL.zones && LEVEL.zones.length > 0) {
      const zonePoints = LEVEL.zones
        .filter(z => z.checkpoint)
        .map(z => z.checkpoint!)
        .sort((a, b) => a.x - b.x)
      this.checkpoints = [
        { x: LEVEL.spawn.x, y: LEVEL.spawn.y },
        ...zonePoints
      ]
    }
    this.currentCheckpointIndex = 0

    // 初始引导:提示玩家去找老伯
    this.time.delayedCall(800, () => {
      this.events.emit('show-toast', '去找老伯聊聊吧！按 E 互动')
    })
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

  /** 寻找半径内的可互动物件(未 consumed) */
  private findNearbyInteractable(x: number, y: number): InteractableObject | null {
    let nearest: InteractableObject | null = null
    let minDist = OBJECT_INTERACT_RADIUS
    for (const obj of this.interactables) {
      if (obj.isConsumed()) continue
      const dx = obj.x - x
      const dy = obj.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) {
        minDist = dist
        nearest = obj
      }
    }
    return nearest
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

  /** 处理可互动物件动作(switch 分发) */
  private handleInteractableAction(obj: InteractableObject): void {
    if (!obj.interact()) return
    const action = obj.action as InteractAction
    switch (action) {
      case 'kick_fish':
        this.kickFish(obj)
        break
      case 'find_difference':
        this.startFindDifferenceScene()
        break
    }
  }

  /** 区2:踢咸鱼 → 弹开 + 揭示隐藏金币(反向引导) */
  private kickFish(obj: InteractableObject): void {
    obj.playKickEffect()
    // 揭示隐藏金币(把金币从初始隐藏位置创建/或激活)
    if (obj.revealCoinId) {
      const coinData = LEVEL.coins.find((c) => c.id === obj.revealCoinId)
      if (coinData) {
        // 金币已在场景中,但可能位置隐蔽;这里直接让其可见可拾取
        // 简化:金币本就在该位置,踢咸鱼后给提示
        this.events.emit('show-toast', `发现隐藏金币: ${coinData.word}`)
      }
    }
    this.events.emit('show-toast', '触发隐藏剧情(但还没开始做)继续走吧...')
  }

  /** 关闭对话(玩家走远或按 E 结束时调用) */
  closeDialog(): void {
    this.talkingNpc?.resetDialogue()
    this.talkingNpc = null
    this.surpriseDialogueQueue = []
    this.dialogAnchor = null
    this.dialogActive = false
  }

  /** 每帧:掉落检测 + 对话走远关闭 + 互动提示更新 */
  update(): void {
    if (!this.player) return

    // 检查点:玩家跨过下一个检查点 x 坐标时自动保存
    const nextIdx = this.currentCheckpointIndex + 1
    if (nextIdx < this.checkpoints.length && this.player.x > this.checkpoints[nextIdx].x) {
      this.currentCheckpointIndex = nextIdx
    }

    // 掉落检测(超出世界底部 → 复活到最近检查点)
    const worldH = LEVEL.worldSize.height
    if (this.player.y > worldH + 160) {
      // 关闭对话(如果有)
      if (this.dialogActive) {
        this.closeDialog()
        this.events.emit('close-dialog')
      }
      const cp = this.checkpoints[this.currentCheckpointIndex]
      this.player.respawn(cp.x, cp.y)
      this.cameras.main.flash(300, 40, 40, 60)
      this.events.emit('show-toast', '掉下去了!回到最近检查点')
      return
    }

    // 对话走远自动关闭(统一用 dialogAnchor 检测 NPC/惊喜对话)
    if (this.dialogAnchor) {
      const dx = this.dialogAnchor.x - this.player.x
      const dy = this.dialogAnchor.y - this.player.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > DIALOG_CLOSE_DISTANCE) {
        this.closeDialog()
        this.events.emit('close-dialog')
      }
    }

    // 互动提示(靠近可互动物件或 NPC 时显示;对话中不显示避免误导)
    if (this.dialogActive) {
      if (this.currentHint !== '') {
        this.currentHint = ''
        this.events.emit('hide-interact-hint')
      }
    } else {
      // 优先显示可互动物件提示
      const nearbyInt = this.findNearbyInteractable(this.player.x, this.player.y)
      let hint = nearbyInt?.interactHint ?? ''
      // 无互动物件时，检查附近 NPC
      if (!hint) {
        const nearbyNpc = this.findNearbyNpc(this.player.x, this.player.y)
        if (nearbyNpc) {
          hint = '按 E 聊天'
        }
      }
      if (hint !== this.currentHint) {
        this.currentHint = hint
        if (hint) {
          this.events.emit('show-interact-hint', hint)
        } else {
          this.events.emit('hide-interact-hint')
        }
      }
    }
  }

  private emitHudUpdate(): void {
    this.events.emit('hud-update', { coins: this.coins })
  }

  /** 添加收集文字并通知 UIScene */
  private addCollectedWords(words: string[]): void {
    for (const w of words) {
      if (!this.collectedWords.includes(w)) {
        this.collectedWords.push(w)
      }
    }
    this.events.emit('collection-update', { words: [...this.collectedWords] })
  }

  /** 发送任务状态更新到 UIScene */
  private emitTaskUpdate(): void {
    this.events.emit('task-update', {
      chase: this.chaseCompleted,
      findDifference: this.findDiffCompleted
    })
  }

  private finishLevel(): void {
    // 通关镜头缩放 + 淡出过渡
    this.cameras.main.zoomTo(0.6, 600)
    this.cameras.main.fadeOut(600, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      eventBus.emit({
        type: 'level-complete',
        result: {
          levelId: LEVEL.id,
          levelName: LEVEL.name,
          coins: this.coins,
          totalCoins: LEVEL.totalCoins,
          timeMs: this.time.now - this.startTime,
          rank: this.coins >= LEVEL.totalCoins ? '梦想家' : this.coins >= 3 ? '咸鱼之王' : '咸鱼翻身',
          epilogue: LEVEL.epilogue
        }
      })
    })
  }

  /** 场景关闭时清理(防止内存泄漏) */
  private onShutdown(): void {
    this.events.off('shutdown', this.onShutdown, this)
    this.events.off('player-interact')
    this.input.keyboard?.off('keydown-ESC')
    this.scene.stop(SCENE.UI)
  }

  /** 启动追捕老伯子场景(老伯对话第3句话触发) */
  private startChaseScene(): void {
    const chaseCfg = LEVEL.chaseScene
    if (!chaseCfg) {
      // fallback:无 JSON 配置时使用硬编码默认值
      this.scene.launch(SCENE.CHASE, {
        id: 'chase_oldman',
        type: 'chase',
        worldSize: { width: 1600, height: 1200 },
        platforms: [
          { id: 'p1', type: 'static', position: { x: 400, y: 960 }, size: { width: 240, height: 40 } },
          { id: 'p2', type: 'static', position: { x: 800, y: 800 }, size: { width: 240, height: 40 } },
          { id: 'p3', type: 'static', position: { x: 1200, y: 640 }, size: { width: 240, height: 40 } },
          { id: 'p4', type: 'static', position: { x: 800, y: 480 }, size: { width: 240, height: 40 } },
          { id: 'p5', type: 'static', position: { x: 400, y: 320 }, size: { width: 240, height: 40 } }
        ],
        playerSpawn: { x: 200, y: 1000 },
        fugitive: {
          npcId: 'oldman',
          card: { type: 'character', text: '老伯', suffix: '.jpg', size: { width: 100, height: 120 }, borderWidth: 4 },
          spawn: { x: 1200, y: 400 },
          fleeSpeed: 360,
          patrolPoints: [{ x: 1200, y: 400 }, { x: 800, y: 400 }]
        },
        caughtDialogue: [
          { speaker: '老伯', text: '好啦好啦,年轻人腿脚真快!' },
          { speaker: '老伯', text: '咸鱼就在前面,去看看吧!' }
        ]
      } as ChaseSceneConfig)
      return
    }
    this.scene.launch(SCENE.CHASE, chaseCfg)
  }

  /** 启动找区别于场景（v0.5） */
  private startFindDifferenceScene(): void {
    this.scene.launch(SCENE.FIND_DIFFERENCE, {
      id: 'find_difference',
      type: 'findDifference',
      worldSize: { width: 2560, height: 1440 },
      fishCount: 20,
      difficulty: 4,
      gridCols: 4,
      reward: { word: '梦', jyutping: 'mung6' }
    } as FindDifferenceSceneConfig)
  }
}

/**
 * LevelScene - 关卡主场景
 * 职责:从 JSON 加载关卡 / 创建对象 / 配置碰撞 / 处理互动 / 触发揭示 / 惊喜事件
 * 详见 TECH_ARCH.md 5.2 节、LEVEL_DESIGN/LEVEL_01_FISH.md
 *
 * 阶段3:7 区铺垫链 + 惊喜事件 + Buff 系统
 * - 7 区:打工→咸鱼→疑问→足球→寺庙→星爷→挑战→揭示
 * - 可互动物件:E 键触发(踢咸鱼/踢足球/触发惊喜/隐藏惊喜)
 * - 惊喜三段式:铺垫提示→角色揭示→互动给 buff
 * - Buff:咸鱼翻身 = setDoubleJump(true, 1.3)
 */
import Phaser from 'phaser'
import { SCENE, COLORS } from '@/shared/constants'
import { eventBus } from '@/shared/eventBus'
import { TextSprite } from '@/game/objects/TextSprite'
import { Player } from '@/game/objects/Player'
import { Coin } from '@/game/objects/Coin'
import { Npc } from '@/game/objects/Npc'
import { InteractableObject } from '@/game/objects/InteractableObject'
import levelData from '@/game/data/levels/level_01_fish.json'
import type { LevelData, SurpriseData, BuffData, InteractAction, DialogueData } from '@/game/data/types'
import { toSentence } from '@/game/data/types'
import { speakerManager } from '@/speakers/SpeakerManager'

const LEVEL = levelData as LevelData

/** NPC 互动检测半径 */
const NPC_INTERACT_RADIUS = 80
/** 可互动物件检测半径 */
const OBJECT_INTERACT_RADIUS = 70
/** 对话中玩家走远自动关闭的距离阈值 */
const DIALOG_CLOSE_DISTANCE = 120

export class LevelScene extends Phaser.Scene {
  private coins = 0
  private hidden = 0
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
  /** 已触发的惊喜ID集合(防重复) */
  private triggeredSurprises = new Set<string>()
  /** 当前互动提示文字(避免重复 emit) */
  private currentHint = ''

  constructor() {
    super(SCENE.LEVEL)
  }

  create(): void {
    this.coins = 0
    this.hidden = 0
    this.startTime = this.time.now
    this.revealed = false
    this.cameras.main.setBackgroundColor(COLORS.BG)

    // ── 世界边界 + 相机跟随 ──
    const { width: worldW, height: worldH } = LEVEL.worldSize
    this.physics.world.setBounds(0, 0, worldW, worldH)
    this.cameras.main.setBounds(0, 0, worldW, worldH)

    // ── 关卡标题 ──
    this.add
      .text(this.cameras.main.width / 2, 28, `${LEVEL.name} · ${LEVEL.themeTag}`, {
        fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
        fontSize: '20px',
        color: '#ffd166'
      })
      .setOrigin(0.5)
      .setScrollFactor(0)

    this.add
      .text(
        this.cameras.main.width / 2,
        54,
        'A/D 移动 · W/Space 跳跃 · S 蹲下 · E 互动 · ESC 通关',
        {
          fontFamily: 'Arial, "Microsoft YaHei", sans-serif',
          fontSize: '12px',
          color: '#a0a0c0'
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)

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
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // ── 揭示点(隐形 zone) ──
    this.revealZone = this.add.zone(LEVEL.revealPosition.x, LEVEL.revealPosition.y, 60, 60)
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
        this.events.emit('reveal-sentence', sentence)
        eventBus.emit({ type: 'sentence-revealed', sentence })
        // 朗读普通话释义(fire-and-forget,不阻塞游戏循环)
        void speakerManager.speak(sentence.mandarin)
      }
    })

    // ── E 互动:推进对话 / 触发可互动物件 / 触发 NPC 对话 ──
    this.events.on('player-interact', (data: { x: number; y: number }) => {
      // 优先级1:对话进行中 → 推进或关闭
      if (this.dialogActive) {
        if (this.talkingNpc) {
          // NPC 对话:循环推进(talk() 内部循环)
          const line = this.talkingNpc.talk()
          this.events.emit('show-dialog', line)
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

    // ── ESC 通关 ──
    this.input.keyboard?.on('keydown-ESC', () => this.finishLevel())

    // 场景关闭时清理
    this.events.on('shutdown', this.onShutdown, this)

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
      case 'kick_ball':
        this.kickBall(obj)
        break
      case 'trigger_surprise':
        this.triggerSurprise(obj)
        break
      case 'hidden_shoe':
        this.hiddenShoe(obj)
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
        this.events.emit('show-toast', `发现隐藏粤语金币: ${coinData.word}`)
      }
    }
    this.events.emit('show-toast', '咸鱼弹开了!隐藏路径(待实现)...')
  }

  /** 区4:踢足球 → 弹飞 + 闪现"黄金右脚"提示 */
  private kickBall(obj: InteractableObject): void {
    obj.playKickEffect()
    obj.playFlashHint('少林功夫+足球=?')
    this.events.emit('show-toast', '足球弹飞了!滚向远方...')
  }

  /** 区6隐藏:踢破旧足球鞋 → 钢铁腿隐藏惊喜 */
  private hiddenShoe(obj: InteractableObject): void {
    obj.playKickEffect()
    this.hidden++
    this.emitHudUpdate()
    eventBus.emit({ type: 'hidden-found', id: 'hidden_steel_leg', count: this.hidden })
    this.events.emit('show-toast', '钢铁腿:我踢球的时候,你们还穿开裆裤!隐藏发现+1')
  }

  /** 区4:触发必触发惊喜(三段式叙事,玩家踢足球触发) */
  private triggerSurprise(obj: InteractableObject): void {
    const surpriseId = obj.surpriseId
    if (!surpriseId || this.triggeredSurprises.has(surpriseId)) return
    this.triggeredSurprises.add(surpriseId)

    const surprise = LEVEL.surprises.find((s) => s.id === surpriseId)
    if (!surprise) return

    // 记录触发点位置(阶段3 对话锚点用,obj 会被 playKickEffect 销毁)
    const anchorX = obj.x
    const anchorY = obj.y

    // 物件先弹开
    obj.playKickEffect()

    // 三段式:阶段1 铺垫提示 → 阶段2 揭示 → 阶段3 互动给 buff
    this.executeSurprise(surprise, anchorX, anchorY)
  }

  /** 执行惊喜三段式(扁平时序:setup 立即 + reveal/dialog 同时;buff 立即生效) */
  private executeSurprise(surprise: SurpriseData, anchorX: number, anchorY: number): void {
    // 阶段1:立即显示铺垫卡片(屏幕上方)+ 立即应用 buff(手感优先,不等对话)
    this.events.emit('surprise-setup', surprise.setup.hintCard)
    eventBus.emit({
      type: 'surprise-triggered',
      id: surprise.id,
      name: surprise.reveal.characterCard.text
    })
    if (surprise.interact.buff) {
      this.applyBuff(surprise.interact.buff)
    }

    // 阶段2+3:delayMs 后同时显示 reveal 卡片(中央偏上)+ 对话(底部)
    // 位置分离,互不干扰;玩家可自由操作
    this.time.delayedCall(surprise.setup.delayMs, () => {
      this.events.emit('surprise-reveal', {
        characterCard: surprise.reveal.characterCard,
        scrollText: surprise.reveal.scrollText
      })
      this.surpriseDialogueQueue = [...surprise.interact.dialogue]
      this.dialogAnchor = { x: anchorX, y: anchorY }
      this.dialogActive = true
      if (this.surpriseDialogueQueue.length > 0) {
        this.events.emit('show-dialog', this.surpriseDialogueQueue.shift()!)
      }
    })
  }

  /** 应用 Buff(咸鱼翻身 = 二段跳 +30%) */
  private applyBuff(buff: BuffData): void {
    if (buff.effect.type === 'jumpEnhance') {
      // value=0.3 → multiplier=1+0.3=1.3
      this.player.setDoubleJump(true, 1 + buff.effect.value)
      this.events.emit('show-toast', `获得 Buff: ${buff.name}!${buff.description}`)
    }
  }

  /** 关闭对话(玩家走远或惊喜对话按 E 结束时调用) */
  closeDialog(): void {
    this.talkingNpc?.resetDialogue()
    this.talkingNpc = null
    this.surpriseDialogueQueue = []
    this.dialogAnchor = null
    this.dialogActive = false
    // 同步销毁惊喜揭示卡片(UIScene 中)
    this.events.emit('hide-surprise-reveal')
  }

  /** 每帧:掉落检测 + 对话走远关闭 + 互动提示更新 */
  update(): void {
    if (!this.player) return

    // 掉落检测(超出世界底部 → 复活)
    const worldH = LEVEL.worldSize.height
    if (this.player.y > worldH + 80) {
      // 关闭对话(如果有)
      if (this.dialogActive) {
        this.closeDialog()
        this.events.emit('close-dialog')
      }
      this.player.respawn(LEVEL.spawn.x, LEVEL.spawn.y)
      this.events.emit('show-toast', '掉下去了!回到起点')
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

    // 互动提示(靠近可互动物件时显示;对话中不显示避免误导)
    if (this.dialogActive) {
      if (this.currentHint !== '') {
        this.currentHint = ''
        this.events.emit('hide-interact-hint')
      }
    } else {
      const nearbyInt = this.findNearbyInteractable(this.player.x, this.player.y)
      const hint = nearbyInt?.interactHint ?? ''
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
    this.events.emit('hud-update', { coins: this.coins, hidden: this.hidden })
  }

  private finishLevel(): void {
    eventBus.emit({
      type: 'level-complete',
      result: {
        levelId: LEVEL.id,
        levelName: LEVEL.name,
        coins: this.coins,
        totalCoins: LEVEL.totalCoins,
        hiddenFound: this.hidden,
        totalHidden: LEVEL.totalHidden,
        timeMs: this.time.now - this.startTime,
        rank: this.coins >= LEVEL.totalCoins ? '梦想家' : this.coins >= 3 ? '咸鱼之王' : '咸鱼翻身',
        epilogue: LEVEL.epilogue
      }
    })
  }

  /** 场景关闭时清理(防止内存泄漏) */
  private onShutdown(): void {
    this.events.off('shutdown', this.onShutdown, this)
    this.events.off('player-interact')
    this.input.keyboard?.off('keydown-ESC')
    this.scene.stop(SCENE.UI)
  }
}

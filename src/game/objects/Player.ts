/**
 * Player - 主角某人
 *
 * 设计依据:
 * - GAME_DESIGN.md 第二章(平台跳跃系统)+ 第十章 10.1(主角某人)
 * - TECH_ARCH.md 物理常量
 * - DESIGN_PHILOSOPHY.md 原则2(流畅性优先)
 *
 * 视觉:用 TextSprite(character 类型)"某人.jpg" 代替立绘
 * 物理:Arcade Physics,重力 1200,二段跳 buff 可启用
 *
 * 操作(对应 GAME_DESIGN 2.1):
 * - A/← 左移  D/→ 右移(松手滑行,水平惯性)
 * - W/↑/Space 跳跃(支持二段跳,需 buff 启用)
 * - S/↓ 蹲下(移动锁定 + 视觉变矮)
 * - E 互动(emit 'player-interact' 事件,场景判断附近可互动物件)
 *
 * 性能(原则2):输入即时 <16ms,用 Phaser keyboard 系统
 */
import Phaser from 'phaser'
import { PHYSICS } from '@/shared/constants'
import { TextSprite } from '@/game/objects/TextSprite'
import type { StateTextSource } from '@/shared/types'

/** 玩家状态快照(供场景/UI 读取) */
export interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  isGrounded: boolean
  isCrouching: boolean
  facing: 'left' | 'right'
  jumpsRemaining: number
}

/** 默认玩家尺寸 — 2x 缩放 */
const PLAYER_W = 80
const PLAYER_H = 120
const CROUCH_SCALE_Y = 0.6
/** 水平阻力(松手滑行衰减,值越小滑行越远) */
const DRAG_X = 1200

export class Player extends Phaser.GameObjects.Container implements StateTextSource {
  private sprite: TextSprite
  private body2!: Phaser.Physics.Arcade.Body

  // 输入键
  private keyA!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyE!: Phaser.Input.Keyboard.Key
  private keySpace!: Phaser.Input.Keyboard.Key
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  // 跳跃状态
  private jumpsRemaining = 1 // 默认一段跳
  private maxJumps = 1 // buff 启用后变 2
  private doubleJumpMultiplier = 1 // buff 可设 1.3

  // 状态
  private isCrouching = false
  private isGrounded = false
  private facing: 'left' | 'right' = 'right'

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y)

    // 视觉:伪图卡片 "某人.jpg"
    this.sprite = new TextSprite(scene, 0, 0, {
      type: 'character',
      text: '某人',
      suffix: '.jpg',
      size: { width: PLAYER_W, height: PLAYER_H },
      borderWidth: 4
    })
    this.add(this.sprite)

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body2 = this.body as Phaser.Physics.Arcade.Body
    this.body2.setSize(PLAYER_W, PLAYER_H)
    this.body2.setOffset(-PLAYER_W / 2, -PLAYER_H / 2) // Container 中心对齐
    this.body2.setCollideWorldBounds(true)
    this.body2.setDragX(DRAG_X)
    this.body2.setMaxVelocityX(PHYSICS.PLAYER_SPEED)

    // 输入
    const kb = scene.input.keyboard!
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.keyE = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.cursors = kb.createCursorKeys()

    // 注册到场景 update
    scene.events.on('update', this.onSceneUpdate, this)
  }

  // ──────────────────────────────────────────────
  // 公开 API
  // ──────────────────────────────────────────────

  /** 启用/禁用二段跳(buff 系统调用) */
  setDoubleJump(enabled: boolean, multiplier = 1): this {
    this.maxJumps = enabled ? 2 : 1
    this.doubleJumpMultiplier = enabled ? multiplier : 1
    // 如果当前在空中且 jumpsRemaining 已经因 maxJumps 变化而不合法,夹一下
    if (this.jumpsRemaining > this.maxJumps) {
      this.jumpsRemaining = this.maxJumps
    }
    return this
  }

  /** 重置到指定位置(掉落复活用) */
  respawn(x: number, y: number): this {
    this.body2.reset(x, y)
    this.body2.setVelocity(0, 0)
    this.jumpsRemaining = this.maxJumps
    return this
  }

  /** 获取状态快照 */
  getSnapshot(): PlayerState {
    return {
      x: this.x,
      y: this.y,
      vx: this.body2.velocity.x,
      vy: this.body2.velocity.y,
      isGrounded: this.isGrounded,
      isCrouching: this.isCrouching,
      facing: this.facing,
      jumpsRemaining: this.jumpsRemaining
    }
  }

  /** StateTextSource 接口:返回当前状态标识 */
  getStateLabel(): string {
    if (this.isCrouching) return 'crouch'
    if (!this.isGrounded) {
      return this.body2.velocity.y < 0 ? 'jump' : 'fall'
    }
    if (Math.abs(this.body2.velocity.x) > 10) return 'run'
    return 'idle'
  }

  /** 朝向(用于互动检测方向) */
  getFacing(): 'left' | 'right' {
    return this.facing
  }

  /** 音效回调(可选,由场景注入) */
  onSfx: ((type: 'jump' | 'doubleJump') => void) | null = null

  /** 将卡片绑定到自身状态(状态驱动):卡片文字随玩家动作实时变化 */
  bindCardState(textMap: Record<string, string>, subtitleMap?: Record<string, string>): this {
    this.sprite.bindState(this, textMap, subtitleMap)
    return this
  }

  // ──────────────────────────────────────────────
  // 内部:update
  // ──────────────────────────────────────────────

  private onSceneUpdate(_time: number, _delta: number): void {
    // 着地判定(blocked.down = 站在平台上,touching.down = 本帧刚碰)
    const grounded = this.body2.blocked.down || this.body2.touching.down
    if (grounded) {
      this.jumpsRemaining = this.maxJumps
    }
    this.isGrounded = grounded

    // ── 蹲下(优先级高于移动)──
    const crouchPressed = this.keyS.isDown || this.cursors.down?.isDown
    if (crouchPressed && grounded) {
      this.isCrouching = true
      this.body2.setVelocityX(0)
      this.sprite.setScale(1, CROUCH_SCALE_Y)
    } else {
      this.isCrouching = false
      this.sprite.setScale(1, 1)
    }

    // ── 水平移动(蹲下时锁定)──
    if (!this.isCrouching) {
      const left = this.keyA.isDown || this.cursors.left?.isDown
      const right = this.keyD.isDown || this.cursors.right?.isDown
      if (left && !right) {
        this.body2.setVelocityX(-PHYSICS.PLAYER_SPEED)
        this.facing = 'left'
      } else if (right && !left) {
        this.body2.setVelocityX(PHYSICS.PLAYER_SPEED)
        this.facing = 'right'
      }
      // 松开:不主动清零,靠 setDragX 自然滑行(水平惯性)
    }

    // ── 跳跃(JustDown 触发,边沿检测) ──
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.keyW) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace) ||
      Phaser.Input.Keyboard.JustDown(this.cursors.up)

    if (jumpPressed) {
      if (grounded) {
        // 一段跳
        this.body2.setVelocityY(PHYSICS.JUMP_VELOCITY)
        this.jumpsRemaining = this.maxJumps - 1
        this.onSfx?.('jump')
      } else if (this.jumpsRemaining > 0) {
        // 二段跳
        this.body2.setVelocityY(
          PHYSICS.DOUBLE_JUMP_VELOCITY * this.doubleJumpMultiplier
        )
        this.jumpsRemaining--
        this.onSfx?.('doubleJump')
      }
    }

    // ── 互动(E 键,JustDown) ──
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
      // 通过场景事件通知:玩家按了 E,场景判断附近可互动物件
      this.scene.events.emit('player-interact', {
        x: this.x,
        y: this.y,
        facing: this.facing
      })
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.scene && this.scene.events) {
      this.scene.events.off('update', this.onSceneUpdate, this)
    }
    super.destroy(fromScene)
  }
}

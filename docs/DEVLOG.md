# 狐嗦粤语 — 开发日志 (DEVLOG)

> 记录每次开发迭代的决策、变更和遇到的问题。
> 任务进度跟踪见 [TASKS.md](./TASKS.md)。

---

## 2026-07-06 · 阶段1:文档体系搭建

### 决策记录

#### 1. 技术栈选定:Vue 3 + Phaser

**背景**:原 SPEC 用原生 Canvas + 原生 HTML/JS,平台跳跃游戏的物理引擎要自己造轮子,工作量大且难维护。

**决策**:UI 外壳用 Vue 3 + Vite + TS + Pinia,游戏渲染用 Phaser 3(内置 Arcade 物理)。

**理由**:
- Phaser 是 2D 平台跳跃游戏的工业级方案,重力/碰撞/二段跳/移动平台开箱即用
- Vue 管理非游戏内 UI(菜单/地图/图鉴/设置)更优雅
- 大赛 Demo 阶段效率最高

**备选**:Vue 3 + 原生 Canvas(物理引擎要自己写)、PixiJS + Vue(无物理引擎)、纯 Phaser(UI 不优雅)。均未采用。

---

#### 2. MVP 范围:单关垂直切片

**背景**:原 GAME_DESIGN 规划 6 大区域、9+ 关卡、3 类 NPC、4 种收集物,对初赛 Demo 太重。

**决策**:初赛 Demo 只做第一关「咸鱼翻身」,7 区铺垫链 + 惊喜事件 + 伪图卡片 + 发音引擎 + 通关结算,质量优先。

**理由**:把核心创新点一次性跑通,优于铺开做半成品。

---

#### 3. 核心创新升级:从「emoji 触发」到「铺垫链思路」

**背景**:原设计的 emoji 触发太"平"——玩家找到 emoji 按 E 就通关,可玩性薄。

**决策**:升级为铺垫链思路。游戏中所有物品/人物/场景/对话都是铺垫,玩家一路经历碎片,潜意识拼凑出目标粤语金句的轮廓,最后难度完成触发句子,产生"恍然大悟"爽感。

**关键转变**:不是"蹦出角色说台词",而是"让玩家自己拼出台词"。

**例子**:第一关目标「做人如果冇梦想,跟咸鱼有咩分别?」,7区铺垫:打工→咸鱼→疑问→足球→寺庙→星爷(点题梦想,留白)→挑战→揭示归位。

---

#### 4. 伪图卡片系统:从"占位"升级为"全局视觉组件"

**背景**:现阶段没有图片资源,需要占位方案。原想法只是"框+文字"。

**决策**:升级为全局可调用的伪图卡片系统,支持:
- 文字/颜色/边框/背景/尺寸/缩放/高亮等基础属性
- `.jpg` 后缀静态 / `.gif` 后缀文字循环滚动(会心一笑的梗)
- 全局复用:场景物件/角色立绘/对话卡片/提示卡片/结算卡片
- 预留扩展接口(动画/特效/真图替换)

**长期价值**:可能省去后期大量图片资源,加载更快、性能更好、代码更简洁,形式新奇反而吸引用户。

---

#### 5. 反向引导机制

**背景**:区2 咸鱼伪图卡片显示"别碰我...",玩家出于反骨心理一定会碰。

**决策**:把这种玩家心理设计为机制——负面提示激发探索,碰了必有反馈(奖励为主,弱惩罚),让"反骨探索"成为乐趣来源。

**示例**:咸鱼"别碰我" → 玩家碰 → 咸鱼弹开撞墙 → 露出隐藏区域 → 获得金币+隐藏计数。

**写入**:DESIGN_PHILOSOPHY 原则6 + LEVEL_DESIGN 区2 设计。

---

#### 6. 对话语言规则

**背景**:全程粤语会增加认知负担,玩家可能放弃。

**决策**:铺垫链全程普通话对话,只有最终揭示的目标句子是粤语+发音。

**理由**:让粤语成为"揭示时刻",而非全程认知负担。玩家在普通话铺垫中建立理解,粤语揭示时产生"原来这样说"的爽感。

---

#### 7. 惊喜三段式叙事

**背景**:惊喜不能只是"突然蹦出角色",需要有节奏。

**决策**:三段式:铺垫(全局提示卡片预告)→ 揭示(伪图卡片显示角色+滚动文字)→ 互动(对话转化为指引/buff/解锁)。

**惊喜来源**:文化梗/网络热梗/谐音梗/粤语本地文化符号,优先选大众共鸣最强的(叶问"我要打十个" > 黄飞鸿)。

---

#### 8. 惊喜事件分类与数量

**决策**:每关必触发惊喜1个(主线,给 buff)+ 隐藏惊喜1-2个(探索,额外奖励)。

**第一关**:必触发=星爷(咸鱼翻身 buff),隐藏=钢铁腿(少林足球梗)。

---

#### 9. Buff 机制

**决策**:惊喜互动获得 buff,持续到通关,操作向优先。

**第一关**:咸鱼翻身 buff = 二段跳高度+30%,滞空更久,降低后续挑战难度但不消除挑战。

---

#### 10. 互动选择:纯娱乐不影响奖励

**决策**:揭示后 NPC 提问,3 选项,无论选什么奖励相同,每选项不同彩蛋台词。

**理由**:避免玩家选错有压力,同时增加重玩乐趣。

---

#### 11. 可扩展性原则修正:从"纯 JSON 驱动"到"分层扩展"

**背景**:原 DESIGN_PHILOSOPHY 第四节写"加关卡只加 JSON 数据,不改代码"。产品质疑:每个关卡的人物/对话/场景/复杂度可能不同,真的能做到 100% JSON 驱动?能保证关卡差异性吗?

**决策**:修正为**分层扩展**策略,不再追求"100% JSON 驱动":
- **通用层(数据驱动)**:位置/文本/卡片配置/区域顺序/对话/惊喜文本 → JSON
- **定制层(代码扩展)**:独特玩法机制(水流/风力/传送门)、独特动画、复杂对话树、新 buff 类型 → 关卡脚本(LevelScript)钩子

**判别标准修正**:
- 旧:加关卡不改代码(过度承诺,无法保证差异性)
- 新:加关卡不改**核心代码**,只需加该关卡的 JSON + 定制脚本

**理由**:
- 强行 100% JSON 驱动会让 Schema 臃肿成 DSL,难维护
- 复杂逻辑塞 JSON 反而比写代码难懂
- 限制关卡设计的创意空间(最致命)
- 分层策略既保证通用部分高效复用,又允许独特逻辑自由扩展

**影响文档**:DESIGN_PHILOSOPHY 第四节、SPEC 4.2、TECH_ARCH 2.1+5.5、DATA_MODEL 顶部说明。

---

#### 12. LEVEL_DESIGN 拆分为目录

**背景**:原 LEVEL_DESIGN.md 单文件,随着关卡增加会越来越长,且每关复杂度本身就值得一个文件。

**决策**:拆分为 `LEVEL_DESIGN/` 目录:
- `README.md`:关卡索引 + 设计模板 + 原则回顾
- `LEVEL_01_FISH.md`:第一关咸鱼翻身(从原文件迁移)
- `LEVEL_02_XXX.md`:第二关预留

**理由**:加关卡只加文件,不动其他关;单关复杂度独立维护;更清晰。

**影响文档**:删除原 LEVEL_DESIGN.md,新建 LEVEL_DESIGN/ 目录,更新所有引用(SPEC/GAME_DESIGN/ASSETS/DESIGN_PHILOSOPHY/TASKS/DEVLOG)。

---

#### 13. 可扩展性原则再修正:从"分层扩展"到"务实扩展"

**背景**:决策11 的"分层扩展"(通用层JSON+定制层LevelScript钩子)仍然偏重,产品进一步要求:只保证核心组件可扩展,关卡/人物/场景可自由定制,宗旨是游戏可玩,不被"扩展"限制死。

**决策**:DESIGN_PHILOSOPHY 第四节改为**务实扩展**三原则:
1. 核心组件(TextSprite/Speaker/Player 等)可扩展即可,不为"零代码加关卡"过度抽象
2. 每关/人物/场景可独立文件/组件/脚本,不强求统一模板或 JSON 化
3. 游戏可玩优先,扩展性与"快速做出来好玩"冲突时优先后者

**判别标准修正**:
- 旧:加关卡不改核心代码(JSON+定制脚本)
- 新:核心组件能复用到第二关且不改源码 + 第一关独特逻辑不污染核心 → 架构成立

**LevelScript 降级为可选**:初赛 Demo 第一关预计无需独特机制,可暂不实现脚本系统。

**理由**:初赛阶段以"做出好玩的 Demo"为第一目标,扩展性是加分项不是必答题。不过度设计。

**影响文档**:DESIGN_PHILOSOPHY 第四节(重写)、SPEC 4.2、TECH_ARCH 2.1+5.5、DATA_MODEL 顶部说明。

---

### 产出清单(阶段1)

✅ 9 份文档完成:
- DESIGN_PHILOSOPHY.md(项目宪法,六大设计原则)
- SPEC.md(对外规格,重写)
- GAME_DESIGN.md(通用玩法系统,重写)
- LEVEL_DESIGN/(第一关7区详写,目录拆分:README + LEVEL_01_FISH)
- TECH_ARCH.md(Vue3+Phaser 架构)
- DATA_MODEL.md(JSON Schema)
- ASSETS.md(伪图卡片清单)
- TASKS.md(任务看板)
- DEVLOG.md(本文档)

### 下一步

等待产品确认阶段1文档,确认后进入阶段2:技术骨架搭建。

---

## 2026-07-06 · 阶段2:技术骨架搭建

### 决策记录

#### 14. 项目骨架:手动创建配置文件而非脚手架

**背景**:`npm create vite` 脚手架会生成大量样板代码(默认组件/示例/路由),需要清理;且本机 PowerShell 执行策略禁用 `.ps1`,交互式脚手架可能踩坑。

**决策**:手动创建 `package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `env.d.ts`,只装必需依赖(vue / phaser / pinia + vite / vue-tsc / typescript)。

**理由**:
- 完全可控,无样板代码
- 配置最小化,后续按需加(如 vue-router 暂不需要,用条件渲染)
- `npm install` 用 `npm.cmd` 绕过 PowerShell 脚本策略

---

#### 15. Vue-Phaser 集成:GameContainer 组件 + createPhaserGame 工厂

**背景**:Vue 与 Phaser 是两种渲染范式,挂载方式需明确。

**决策**:
- `game/PhaserGame.ts` 导出 `createPhaserGame(parent: HTMLElement)` 工厂函数,纯函数无副作用
- `ui/components/GameContainer.vue` 接收 `levelId` prop,onMounted 时挂载 Phaser,onBeforeUnmount 时 `game.destroy(true)`
- 切关时用 `:key="levelId"` 强制重建,简单可靠
- Vue 容器只管生命周期,不碰游戏内部

**理由**:职责清晰,Vue 管 DOM 容器与视图路由,Phaser 管游戏内容,两者通过 eventBus/Pinia 通信。

---

#### 16. 事件总线:自实现轻量版,不依赖 Phaser.EventEmitter

**背景**:UI ↔ Game 通信需要事件总线,可选 Phaser.EventEmitter 或自实现。

**决策**:在 `shared/eventBus.ts` 自实现 `EventBus` 类(Map<type, Set<handler>>),`on()` 返回取消订阅函数,`emit()` 复制迭代器防并发修改。

**理由**:
- `shared/` 层不依赖 Phaser,UI 层可独立使用
- 类型安全:`GameEvent` 联合类型约束事件 payload
- 简单透明,无外部依赖

---

#### 17. 场景时序:PreloadScene → start LEVEL → LevelScene 末尾 launch UI

**背景**:UIScene 需监听 LevelScene.events('hud-update'),若并行 launch 时序不保证,UIScene.create 时 LevelScene 可能未就绪。

**决策**:PreloadScene.create 中 `this.scene.start(SCENE.LEVEL)`,LevelScene.create 末尾 `this.scene.launch(SCENE.UI)`。

**理由**:保证 UIScene.create 时 LevelScene 已存在,可安全 `this.scene.get(SCENE.LEVEL).events.on(...)`。时序清晰,无需延迟或重试。

---

### 产出清单(阶段2)

✅ 项目骨架:`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `env.d.ts` / `.gitignore`
✅ 依赖安装:vue@3.4 / phaser@3.87 / pinia@2.2 + vite@5.4 / vue-tsc@2.1 / typescript@5.5(52 包)
✅ 目录结构:
```
src/
├── main.ts / App.vue / styles.css
├── ui/{views/{StartMenu,ResultView}, components/GameContainer, stores/gameStore}
├── game/{PhaserGame, scenes/{Boot,Preload,Level,UI}Scene}
├── speakers/{BaseSpeaker, SpeakerManager}
└── shared/{eventBus, types, constants}
```
✅ Vue UI 外壳:条件渲染 menu/game/result 三视图,Pinia store 驱动
✅ Phaser 场景挂载:BootScene → PreloadScene → LevelScene + UIScene 跑通
✅ 事件总线:自实现,8 种 GameEvent 类型,返回取消订阅函数
✅ Pinia store:gameStore(view / currentLevelId / lastResult + startGame/finishLevel/backToMenu)
✅ 通信链路验证:
  - UI → Game:StartMenu 点击 → store.startGame → GameContainer 挂载 Phaser
  - Game → UI:LevelScene 点击"模拟通关" → eventBus.emit('level-complete') → App.vue 监听 → store.finishLevel → ResultView 显示
  - 场景内部:LevelScene 点击金币 → scene.events.emit('hud-update') → UIScene 更新 HUD
✅ typecheck 通过 / dev server 启动成功(http://127.0.0.1:5173)/ 浏览器无错误

### 验证用占位交互

阶段2 的 LevelScene 不实现玩法,只放三个占位按钮验证通信链路:
- [点击收集粤语金币] → coin-collected 事件 + HUD 更新
- [触发隐藏发现] → hidden-found 事件 + HUD 更新
- [模拟通关 → 结算] / ESC → level-complete 事件 → 跳结算页

### 遇到的问题

- **PowerShell 执行策略禁用 `npm.ps1`**:改用 `npm.cmd` 调用,绕过脚本策略限制
- **TS 5.5 不支持 `noUncheckedSideEffectImports`**:该选项是 TS 5.6+ 特性,从 tsconfig.json 移除
- **project references 要求 `composite: true`**:为简化构建链路,去掉 references,`build` 改用 `vue-tsc --noEmit` 单步校验
- **`onMounted` 未使用告警**:App.vue 初版引入但未用,清理 import

### 下一步

进入阶段3:核心系统(按 P0 优先级):
1. ★伪图卡片系统(TextSprite)— 全局视觉组件,最优先
2. 物理引擎 + 角色控制(Player)
3. 关卡数据驱动(JSON → 场景渲染)
4. 发音引擎(JyutpingSpeaker 接入)

---

## 2026-07-06 · 阶段3:核心系统(P1-P4)

### 决策记录

#### 18. TextSprite 实现:Container + 子对象,substring 实现 .gif 滚动

**背景**:伪图卡片是全局视觉组件,需支持文字/边框/背景/尺寸/.gif 滚动/高亮/动效。

**决策**:
- 继承 `Phaser.GameObjects.Container`,子对象:background(Rectangle)+ borderRect(Rectangle stroke)+ mainText(Text)+ subtitleText(可选)
- `.gif` 滚动:prepareScrollText 生成重复长串,updateScrollDisplay 每帧 substring,无需裁剪/掩码
- 动效:none / shake(随机偏移)/ glow(边框 alpha 呼吸)/ bounce(缩放呼吸)
- P2 扩展接口预留签名:setEffect / loadTexture(空实现,后续填充)
- 自动注册 scene.events.on('update'),destroy 时 off 解绑

**理由**:Container 可容纳多子对象且支持物理体(Platform/Coin/Npc 都需要);substring 滚动逻辑简单性能好,无需 Phaser 高级特性;扩展接口预留符合"核心组件可扩展"原则但不强制实现。

---

#### 19. TextSprite 删除 setFlipX:Container 类型未暴露 flipX 且中文镜像不可读

**背景**:原计划 Player 移动时翻转 TextSprite 视觉表示朝向。

**决策**:删除 setFlipX 方法。Player 不做视觉翻转,只用 facing 状态记录方向。

**理由**:
- Phaser.Container 运行时有 flipX,但 TS 类型定义未暴露,强转 any 不优雅
- 中文文字镜像后不可读,违反"伪图卡片用文字传达信息"的设计
- 阿粤立绘是文字"阿粤.jpg",翻转无意义

---

#### 20. Player 物理:Container + TextSprite 立绘,Arcade Physics + 二段跳 buff

**背景**:Player 需 A/D 移动+惯性、W/Space 跳跃+二段跳、S 蹲、E 互动。

**决策**:
- 继承 Container,内部 sprite = new TextSprite(character 类型 "阿粤.jpg")
- Arcade Physics:body2.setSize / setOffset(中心对齐)/ setCollideWorldBounds / setDragX(600 滑行)/ setMaxVelocityX
- 跳跃:JustDown 边沿检测,grounded 时一段跳,maxJumps=1;setDoubleJump(true, multiplier) 后 maxJumps=2(对应"咸鱼翻身"buff)
- 蹲下:setScale(1, 0.6) + 锁定移动
- 互动:E 键 JustDown → emit 'player-interact' {x, y, facing}

**理由**:Container + 物理体是 Phaser 平台跳跃标准方案;setDoubleJump 接口预留 buff 注入点,初赛第一关 buff = setDoubleJump(true, 1.3)。

---

#### 21. 关卡数据驱动:简化 JSON,初赛 Demo 不实现 LevelScript 钩子

**背景**:DESIGN_PHILOSOPHY 决策13 将 LevelScript 降级为可选,初赛 Demo 预计无需独特机制。

**决策**:
- 关卡数据用简化 JSON:ground / platforms / coins / npcs / revealPosition / totalCoins / totalHidden
- LevelScene 作为"关卡加载器":import JSON → 创建对象 → 配置碰撞 → 处理互动
- 碰撞配置:平台 collider + 金币 overlap(coin.collect() 返回 boolean 防重复)+ 揭示点 overlap
- E 互动:推进对话(talkingNpc.talk())或 findNearbyNpc(半径 80)
- 不实现 LevelScript 钩子系统(务实扩展原则3:游戏可玩优先)

**理由**:初赛 Demo 只做第一关,7 区铺垫链内容填充是后续子任务,无需通用钩子抽象;复杂逻辑直接写代码比硬塞 JSON/DSL 更清晰。

---

#### 22. 发音引擎务实简化:Web Audio 正弦波 + 6 声调频率映射,不追求真人发音

**背景**:TECH_ARCH 8.2 要求"粤拼→音素映射表 + Web Audio API 合成"。真语音合成需音素库/神经网络,Web Audio 无法直接合成真人发音。

**决策**:
- JyutpingSpeaker 用 OscillatorNode(正弦波)+ GainNode(ADSR 包络)合成
- 粤拼6声调 → 频率走向映射(语言学近似):调1 高平440 / 调2 高升330→440 / 调3 中平330 / 调4 低降220→165 / 调5 低升220→277 / 调6 低平220
- 音节解析:正则 `/([a-z]+)([1-6])/g` 提取字母+声调,不严格区分声母韵母
- 串行播放:async/await + Promise,每音节 220ms + 间隔 40ms
- AudioContext 懒加载(首次 speak 创建,绕过浏览器自动播放策略)
- speak(中文)无词典降级 console.warn + 静音;调用方用 speakJyutping(粤拼)
- 失败降级:不可用/异常 → 静音 + console.warn,不阻塞游戏循环

**理由**:
- 初赛 Demo 目标是"让玩家听到有6声调起伏的电子音,感知粤语声调特征",非真人发音
- 无外部资源依赖,加载快、零成本,符合"先做出好玩的 Demo"宗旨
- 声调频率映射让玩家能区分"高平/高升/低降"等声调轮廓,有语言学教育意义
- 后期可无缝替换为豆包 TTS(SpeakerManager 策略切换)

**触发点**:
- 金币拾取 → speakJyutping(coin.jyutping)(单音节,如 "leoi6")
- 句子揭示 → speakJyutping(sentence.jyutping)(整句)
- fire-and-forget(void,不阻塞游戏循环)

---

### 产出清单(阶段3 P1-P4)

✅ P1 伪图卡片系统 TextSprite:`src/game/objects/TextSprite.ts`
- Container + background/borderRect/mainText/subtitleText
- .gif 滚动(substring)/ 高亮 / 4 种动效 / 扩展接口预留

✅ P2 Player 物理控制:`src/game/objects/Player.ts`
- Container + TextSprite 立绘 / Arcade Physics / A/D+W/Space+S+E / 二段跳 buff 接口

✅ P3 关卡数据驱动:
- `src/game/data/levels/level_01_fish.json`(第一关数据:4 platforms / 4 coins / 1 npc 老伯 / revealPosition)
- `src/game/data/types.ts`(LevelData 等 TS 类型 + toSentence 转换)
- `src/game/objects/Coin.ts`(继承 TextSprite,collect() 拾取动效防重复)
- `src/game/objects/Npc.ts`(继承 TextSprite,talk() 循环推进对话)
- `src/game/scenes/LevelScene.ts`(重写:JSON 加载 + 碰撞 + 互动 + 揭示)
- `src/game/scenes/UIScene.ts`(重写:HUD + 对话卡片 + 句子揭示全屏卡片)

✅ P4 发音引擎:`src/speakers/JyutpingSpeaker.ts`
- 6 声调 → 频率映射表 + Web Audio 正弦波合成 + ADSR 包络
- AudioContext 懒加载 + 失败降级
- 注册到 SpeakerManager(PhaserGame.ts)
- 金币拾取 + 句子揭示触发 speakJyutping

### 遇到的问题

- **LevelScene 未使用的 DialogueData 导入**:typecheck 报 TS6196,移除未用 import
- **PowerShell profile 加载错误**:环境问题,不影响 npm 命令本身(npm.cmd 仍正常执行)
- **dev server 端口 5173 被占用**:Vite 自动切换到 5174

### 下一步

阶段3 后续(P1 已完成核心4项,P2 剩余):
- ⬜ 惊喜事件系统(三段式叙事)
- ⬜ 第一关7区铺垫链内容填充
- ⬜ Buff 系统(咸鱼翻身 = setDoubleJump(true, 1.3))
- ⬜ 收集系统完善 + 通关结算伏笔

阶段4:全链路联调 + 流畅性优化 + 演示打包

---

## 2026-07-06 · 阶段3 反馈修复

### 决策记录

#### 23. 发音引擎策略调整:Demo 阶段 WebSpeech 普通话优先,Jyutping 备选

**背景**:用户反馈 JyutpingSpeaker 正弦波电子音无法完整读出句子,影响揭示时刻体验。建议 Demo 先用普通话发音,Demo 完成后再调粤语/豆包 TTS。

**决策**:
- 新增 WebSpeechSpeaker(浏览器 SpeechSynthesis API,普通话 zh-CN)
- 注册顺序:WebSpeech 先注册(成为 current 默认),Jyutping 后注册(备选)
- 触发点调整:
  - 金币拾取 → speak(coin.word)(读"累/咸/梦/想"普通话)
  - 句子揭示 → speak(sentence.mandarin)(读普通话释义)
- 后期切换:speakerManager.use('jyutping') 或新增 DoubaoTTSSpeaker

**理由**:
- Demo 阶段游戏可玩性优先,发音完整性 > 语言学准确
- WebSpeech 零依赖、支持中文、发音完整,对比 Jyutping 电子音更友好
- SpeakerManager 策略模式价值体现:切换引擎不改调用方

---

#### 24. 老伯对话改普通话(对话语言规则修正)

**背景**:用户反馈老伯对话用了粤语文字("后生仔""揾到你嘅答案"),违反 DESIGN_PHILOSOPHY 第三节"全程普通话对话,只有最终揭示句子是粤语"。

**决策**:level_01_fish.json 老伯 3 句对话改普通话:
- "年轻人,打工要打到什么时候啊?"
- "咸鱼也是有梦想的...你说是不是?"
- "跳到最高处去,找到你的答案吧。"

**理由**:铺垫链全程普通话,粤语留给揭示时刻,降低认知负担。

---

#### 25. 对话框走开自动关闭

**背景**:用户反馈对话完成后人物走开,对话框没消失。

**决策**:LevelScene.update() 检测玩家与 talkingNpc 距离 > DIALOG_CLOSE_DISTANCE(120px)→ closeDialog() + emit 'close-dialog' → UIScene 隐藏对话卡片。

**理由**:走开自动关闭是对话系统标准交互,玩家无需按额外键关闭。

---

### 产出清单(反馈修复)

✅ 新增 `src/speakers/WebSpeechSpeaker.ts`(浏览器 SpeechSynthesis 普通话)
✅ PhaserGame.ts 注册顺序调整(WebSpeech 优先)
✅ LevelScene 金币/句子发音改 speak(普通话)
✅ LevelScene.update() 走远自动关闭对话
✅ level_01_fish.json 老伯对话改普通话
✅ typecheck 通过 + 浏览器无报错

### 下一步

继续阶段3后续:惊喜事件 / 7区铺垫链 / Buff / 收集结算,或进入阶段4联调。

---

## 2026-07-06 · 阶段3:7 区铺垫链 + 惊喜事件 + Buff 系统

### 决策记录

#### 26. 7 区布局:世界扩展 2400x720 + 相机跟随

**背景**:7 区内容无法塞进 1280x720 单屏,需要更大世界。

**决策**:
- LevelData 新增 worldSize 字段,第一关 2400x720
- LevelScene.create 设置 physics.world.setBounds + cameras.main.setBounds
- cameras.main.startFollow(player, true, 0.1, 0.1) 相机跟随玩家
- UIScene 所有 UI 元素 setScrollFactor(0) 固定在屏幕

**理由**:相机跟随是平台跳跃游戏标准方案,玩家始终居中,世界在背后滚动。

---

#### 27. 可互动物件:InteractableObject + action 类型 switch

**背景**:7 区有多个可互动物件(咸鱼/足球/破鞋),每个互动效果不同。

**决策**:
- InteractableObject 继承 TextSprite,加 consumed 标志防重复
- InteractAction 联合类型:kick_fish / kick_ball / trigger_surprise / hidden_shoe
- LevelScene.handleInteractableAction switch 分发,具体逻辑写代码(务实扩展原则3)
- 玩家靠近 update 检测 → emit 'show-interact-hint' → UIScene 显示提示

**理由**:复杂逻辑写代码比硬塞 JSON/DSL 清晰;action 类型可扩展,加新动作只需加 case。

---

#### 28. 惊喜三段式:executeSurprise 串行 delayedCall

**背景**:惊喜事件需要铺垫→揭示→互动三段节奏。

**决策**:
- executeSurprise(surprise) 串行执行:
  - 阶段1:emit 'surprise-setup'(UIScene 显示 hintCard + glow 动效)
  - delayedCall(delayMs) → 阶段2:emit 'surprise-reveal'(角色卡片 + 滚动文字)
  - delayedCall(2500) → 阶段3:emit 'show-dialog'(对话)+ applyBuff
- triggeredSurprises Set 防重复触发
- 物件先 playKickEffect 弹开,再开始三段式

**理由**:delayedCall 串行简单直观,无需复杂状态机;三段式节奏(铺垫3s→揭示2.5s→互动)符合设计文档。

---

#### 29. Buff 系统:setDoubleJump 接口落地

**背景**:Player.setDoubleJump 已预留接口,需在惊喜互动时启用。

**决策**:
- applyBuff(buff) 根据 effect.type 调用 player.setDoubleJump(true, 1 + value)
- value=0.3 → multiplier=1.3(二段跳高度+30%)
- emit 'show-toast' 显示 Buff 获得提示
- Buff 持续到通关(不主动取消)

**理由**:接口与实现对接,简单直接;Toast 提示让玩家感知变强。

---

### 产出清单(7 区 + 惊喜 + Buff)

✅ types.ts 扩展:InteractAction / InteractableData / BuffData / SurpriseData + LevelData 加入 interactables/surprises/worldSize
✅ level_01_fish.json 重写:7 区 12 platforms / 5 coins / 2 npcs(老伯+星爷)/ 4 interactables(咸鱼/足球/挑战咸鱼/破鞋)/ 1 surprise(星爷 buff)
✅ InteractableObject.ts:继承 TextSprite + interact() + playKickEffect() + playFlashHint()
✅ LevelScene 重写:世界 2400x720 + 相机跟随 + E 互动 switch + 惊喜三段式 + Buff 应用 + update 走远关闭/互动提示
✅ UIScene 重写:Toast + 互动提示 + surprise-setup/surprise-reveal + setScrollFactor(0) 固定 UI
✅ typecheck 通过 + 浏览器无报错

### 7 区内容落地

| 区 | 平台 | 金币 | 互动 | 碎片关键词 |
|----|------|------|------|-----------|
| 区1 打工 | 打工平台 | 累 | 老伯对话(普通话) | 打工 |
| 区2 咸鱼 | 咸鱼平台 | 咸 | 踢咸鱼(反向引导) | 咸鱼 |
| 区3 疑问 | 等号+问号平台 | - | 问号抖动 | = ? |
| 区4 足球 | 街角平台 | - | 踢足球(闪现黄金右脚) | 少林足球 |
| 区5 寺庙 | 山路+少林路平台 | 功 | - | 少林 |
| 区6 星爷 | 小广场平台 | 梦 | 星爷对话(留白)+ 隐藏破鞋(钢铁腿) | 梦想 |
| 区7 挑战 | 砖块1/2/3 | 想 | 踢挑战咸鱼(触发惊喜+buff) | 挑战 |
| 揭示 | 揭示平台 | - | 触发句子揭示+发音 | 句子归位 |

## 2026-07-06 · 阶段3完成:收集系统+通关结算+伏笔

### 决策记录

#### 30. 收集系统+通关结算完成
**背景**:
阶段3核心系统(P0-P1)完成后,需要收尾 P2:收集统计 + 三档评价 + 老伯伏笔台词。

**决策**:
- 扩展 LevelData/LevelResult 增加 `levelName` + `epilogue`
- 评价等级分三档:收集满 5 金币→「梦想家」(金),≥3→「咸鱼之王」(蓝),<3→「咸鱼翻身」(灰)
- 结算页增加「再来一次」按钮,直接重玩当前关卡
- level_01_fish.json 增加老伯伏笔台词三句,埋第二关悬念

**理由**:
- 设计目标:第一关完整体验从开始到结算,留伏笔给后续关卡

### 产出清单
- ✅ level_01_fish.json:增加 epilogue 老伯三句伏笔台词
- ✅ 共享类型:LevelResult 扩展 levelName + epilogue
- ✅ game/data/types.ts:LevelData 扩展 epilogue
- ✅ LevelScene.finishLevel:emit 完整结算数据(levelName/epilogue)
- ✅ ResultView.vue:重写,增加伏笔台词展示 +「再来一次」按钮 + 等级染色

### 遇到的问题
- 无,架构已就位(store/eventBus/ResultView),只是填充功能

### 下一步

阶段3 **全部完成**。阶段4:
- ⬜ 全链路联调(开场→7区→挑战→揭示→结算)
- ⬜ 流畅性优化
- ⬜ 演示打包部署

---

## 2026-07-06 · 阶段4:联调与优化 + 设计系统统一

### 决策记录

#### 31. 伪图卡片圆角化:Rectangle → Graphics 圆角矩形

**背景**:所有伪图卡片用 Phaser `Rectangle` 绘制,直角生硬,不符合现代 UI 审美。

**决策**:
- 将 `background`(Rectangle) 和 `borderRect`(Rectangle) 替换为 `Graphics` 对象
- 使用 `fillRoundedRect` / `strokeRoundedRect` 绘制圆角矩形
- 新增 `borderRadius` 配置项到 `TextSpriteConfig` 和 `TextSpriteTypeStyle`
- `setHighlight` 和 `glow` 动效改为 `clear() + 重绘` 模式

**理由**:
- Phaser 的 Rectangle 不支持圆角,Graphics 是唯一方案
- clear + 重绘性能足够(每帧 < 1ms),不影响游戏流畅性
- 圆角半径按类型分级:SM(4px) 用于小物件,MD(6px) 用于对话/提示,LG(10px) 用于揭示/结算

---

#### 32. .gif 滚动文字溢出修复:GeometryMask 裁剪

**背景**:`.gif` 滚动文字用像素级 x 偏移实现丝滑滚动,但 Container 不会自动裁剪子元素,文字超出卡片边框后仍然可见。

**决策**:
- 在 TextSprite 构造函数中创建 `GeometryMask`,裁剪区域为卡片内边界(减去边框+内边距)
- 同时应用到主文字和副文字,确保所有文本内容不超出卡片

**理由**:
- GeometryMask 是 Phaser 原生裁剪方案,性能好
- 圆角 mask 确保文字在圆角卡片中也不会溢出

---

#### 33. 统一设计 Token 管理

**背景**:颜色、圆角、边框等设计值散落在 `constants.ts`(Phaser) 和 Vue 组件 `scoped style` 中,修改时需多处同步。

**决策**:
- `constants.ts` 新增 `BORDER_RADIUS` 常量(SM=4/MD=6/LG=10),`TEXT_SPRITE_STYLES` 增加 `borderRadius` 字段
- `styles.css` 新增 `:root` CSS 变量(颜色/圆角/按钮),与 `constants.ts` 的值保持对应
- Vue 组件(`StartMenu.vue`/`ResultView.vue`/`App.vue`) 全部改用 `var(--xxx)` 引用

**理由**:
- 单一来源原则:修改一处全局生效
- CSS 变量 + TS 常量双轨并行,各自领域最优方案
- 后期主题切换只需改变量值

---

#### 34. 阶段4 流畅性优化:场景清理 + 掉落复活

**背景**:全链路审查发现 3 个潜在问题:
1. `LevelScene` 和 `UIScene` 的事件监听器未在场景销毁时解绑,可能内存泄漏
2. 玩家掉落世界底部后无复活机制,只能卡住
3. `UIScene.showReveal` 的键盘监听器未在场景销毁时清理

**决策**:
- `LevelScene.create` 注册 `shutdown` 事件 → `onShutdown` 清理 `player-interact`/`ESC` 监听器 + 停止 `UIScene`
- `LevelScene.update` 增加掉落检测:`player.y > worldH + 80` → `respawn(spawn)` + Toast 提示
- `UIScene` 的 reveal 键盘 `once` 监听器改为存储引用,`shutdown` 时 `off` 清理

**理由**:
- 场景关闭时清理是防止内存泄漏的标准做法
- 掉落复活是平台跳跃游戏的基础体验,防止玩家卡死
- 所有修改不影响现有游戏逻辑,纯防御性优化

---

### 产出清单

✅ 优化1:TextSprite 圆角 + 文字裁剪(GeometryMask)
✅ 优化2:统一设计 Token(constants.ts BORDER_RADIUS + styles.css CSS 变量)
✅ 优化3:Vue 组件统一使用 CSS 变量
✅ 阶段4:场景 shutdown 清理 + 掉落复活机制
✅ 全链路联调:审查通过,无同步阻塞问题
✅ typecheck + build 通过

### 下一步

阶段4 仅剩演示打包部署。初赛 Demo v0.1 基本就绪。

---

## 2026-07-07 · 阶段5:内容深化与升级 — 文档设计

### 决策记录

#### 35. 进入新设计阶段：内容深化与升级

**背景**:v0.1 基本跑通（7区铺垫链+惊喜事件+Buff+收集结算），但关卡内容单薄——NPC 对话一次性说完、没有独立场景展开剧情、没有小游戏玩法。用户提出4个方向（卡片状态驱动/子场景/NPC追捕/区域模块化），要求全部实现。

**决策**:进入 v0.2 内容深化阶段，4个方向+额外建议（音效/检查点/镜头特效/对话选项等）全部纳入设计。先更新全部文档再写代码。

**理由**:
- 4个方向是一个有机整体，需要统一设计避免互相冲突
- 卡片状态驱动是基础设施，子场景是骨架，追捕是第一个独立玩法
- 文档先行原则（DESIGN_PHILOSOPHY 第五节），确保设计思路清晰再动手

---

#### 36. 卡片状态驱动设计：可选绑定，不破坏静态文字

**背景**:用户提出"卡片根据人物状态实时显示文字"，如追捕时显示"追/逃"、打架时显示"出左腿/踢右拳"。

**决策**:
- TextSprite 新增 `bindState(source, textMap)` 方法（可选，不调用则维持静态文字）
- 任何对象实现 `StateTextSource` 接口即可驱动卡片
- 状态变化时才 `setText`，缓存 `lastState` 避免每帧重绘
- Player 和 MovableNpc 都实现 `StateTextSource`
- 状态映射表写在关卡 JSON 的 `stateBinding` 字段中

**理由**:
- 向后兼容：现有静态卡片零影响
- 数据驱动：映射表不在代码里，可灵活配置
- 可扩展：未来可扩展为"状态→样式"映射

---

#### 37. 子场景系统设计：BaseSubScene + pause/resume 协议

**背景**:借鉴马里奥管道式设计，主世界暂停时切入独立子场景。

**决策**:
- `BaseSubScene` 基类：构造时自动 `scene.pause(LEVEL)`, `complete()` 时 `scene.stop()` + `scene.resume(LEVEL)`
- 子场景类型：`chase`（追捕）、`dialogue`（剧情对话）、`fight`（打架，预留）
- 结果回传：通过 `eventBus` 的 `subscene-complete` 事件，携带 `SubSceneResult`
- LevelScene 监听回传结果，应用 `onComplete` 回调（giveBuff/unlockPath/revealCoins）

**理由**:
- Phaser 原生的 pause/resume/launch/stop 完美支持，无需自行实现状态机
- 结果回传走 eventBus 而非 Phaser events，因为子场景停止后 Phaser events 也会销毁

---

#### 38. MovableNpc 设计：继承 Npc，覆盖为动态物理体

**背景**:当前 Npc 是静态物理体（`physics.add.existing(this, true)`），无法移动。

**决策**:
- `MovableNpc` 继承 `Npc`，在构造函数中覆盖为动态物理体（`DYNAMIC_BODY`）
- AI 状态机：idle → patrol → flee → caught
- 实现 `StateTextSource` 接口，供卡片状态驱动
- 与 Player 复用同一套 Arcade Physics（重力/平台碰撞）
- 配置数据：`MovableNpcData` 含 patrolPoints/fleeSpeed/chaseTriggerRadius

**理由**:
- 继承而非修改基类，符合"务实扩展"原则
- 现有静态 NPC 不受影响
- 动态物理体复用 Player 已有的碰撞检测逻辑

---

#### 39. 区域模块化设计：zones[] + 向后兼容

**背景**:当前关卡 JSON 是扁平列表（platforms/coins/npcs 平铺），无法按区域触发子场景/检查点。

**决策**:
- 新增 `ZoneData` 接口（id/name/bounds/platforms/coins/npcs/cutsceneId/checkpointId）
- `LevelData` 新增 `zones?: ZoneData[]` 字段
- 现有 `platforms/coins/npcs` 字段保留作为 fallback
- 有 zones 时优先使用 zones

**理由**:
- 向后兼容：旧 JSON 不加 zones 也能跑
- 区域分组使得子场景触发、检查点管理、引导文字等成为可能

---

#### 40. 登台门槛设计：集齐汉字才能揭示

**背景**:当前收集金币只是增加评价等级，没有实质意义。用户提出"集齐汉字才能登台"。

**决策**:
- `revealZone` 新增 `requireCoins` 字段
- 玩家踏上揭示平台时，金币不足 → 提示"还需收集 X 个汉字"，不触发揭示
- 金币足够 → 正常揭示

**设计意图**:每个金币是一个汉字（累/咸/功/梦/想），玩家在跑跳中不知不觉收集整句粤语的所有关键词，揭示时"拼出"完整句子。

---

#### 41. 额外建议：音效/检查点/镜头/对话选项

**背景**:在用户4个方向之外，追加了8个额外建议。

**决策**:
- 阶段5 优先实现 P0（4个方向 + 登台门槛），P1（音效/检查点/对话选项），P2（镜头/粒子/视差）
- 音效用 Web Audio API 合成，SfxManager 单例，与发音引擎共用 AudioContext
- 检查点依附区域模块化，每个 Zone 入口自动保存
- 镜头特效（震动/淡入淡出）在子场景切换时使用

**理由**:
- 音效是"静音→有音效"的质变，体验提升巨大但实现成本低
- 检查点与区域模块化是自然配套，不需额外基础设施
- 其他 P2 项目等 P0 完成后再评估

---

### 产出清单（文档设计）

✅ GAME_DESIGN.md v3.0: 新增子场景系统/NPC AI与追捕/区域模块化/状态驱动卡片/音效系统/检查点/镜头特效
✅ TECH_ARCH.md v2.0: 新增子场景架构/状态绑定/MovableNpc/SfxManager/目录更新
✅ DATA_MODEL.md v2.0: 新增 ZoneData/CutsceneTrigger/ChaseSceneConfig/DialogueSceneConfig/MovableNpcData/CheckpointData/StateBinding
✅ LEVEL_DESIGN/LEVEL_01_FISH.md v2.0: 重写融入 ChaseScene/DialogueScene/状态驱动/登台门槛
✅ TASKS.md: 新增阶段5内容深化任务看板
✅ DEVLOG.md: 记录决策35-41

### 下一步

等待产品确认文档设计，确认后按照阶段5任务看板开始实现（P0优先: 卡片状态驱动 → MovableNpc → BaseSubScene → ChaseScene）。

---

## 模板:迭代记录格式

```
## YYYY-MM-DD · 阶段X:XXX

### 决策记录
#### N. 决策标题
**背景**:
**决策**:
**理由**:

### 产出清单
- ✅/⬜ 任务项

### 遇到的问题
- 问题描述 + 解决方案

### 下一步
```

---

## 2026-07-09 · 阶段6:慢动作系统 — 起步（从零开始验证）

### 决策记录

#### 50. 从零开始：SlowMoManager + RainManager 独立模块 + 手动测试按钮

**背景**:此前尝试的「子弹时间」方案（子弹系统 + 序列引擎 + 自动触发）测试效果不佳：「子弹慢慢飞」的效果难以控制，追捕结束逻辑出现冲突，且改动面过大导致调试困难。

**决策**:从零开始，采用「分步迭代」策略。

**第一步方案**（当前已完成）:
- 建立 `SlowMoManager` 独立模块（单例，~130 行）：全局 timeScale 控制 + `performance.now()` 过渡 + `freeze`/`resume`
- 建立 `RainManager` 独立模块（非单例，~100 行）：60 个 TextSprite 雨滴物理体 + 循环回收
- 在 ChaseScene 添加 T 键手动切换慢放按钮，验证核心机制
- 不接入 player/逃跑者逻辑，保持原有追捕代码不变

**分步理由**:
- 独立模块化：每个模块职责单一，可独立测试和调试
- 手动触发：先验证核心机制（timeScale 对雨滴的影响），确认无误后再接入自动逻辑
- 最小改动：仅修改 ChaseScene 3 处（导入 + 初始化 + update），不碰原有逻辑
- 可回退：git stash 保存了之前的全量改动，随时可恢复参考

**改动范围**:
- 新建：`src/game/systems/SlowMoManager.ts`（~130 行）
- 新建：`src/game/systems/RainManager.ts`（~100 行）
- 修改：`src/game/scenes/ChaseScene.ts`（+3 行导入，+40 行测试代码）
- 文档：GAME_DESIGN.md v3.2 / TECH_ARCH.md v2.1 / TASKS.md / DEVLOG.md

**测试方式**:
```
进入追捕子场景 → 看到下雨 → 按 T 键
- 按 T: 0.5s 过渡到 20% 速度（雨滴变慢）
- 再按 T: 0.3s 恢复全速
- 可反复切换
```

**已知问题与修复**:
- `body.reset()` 在 Phaser 3 中会将 `allowGravity` 重置为 `true`，导致雨滴受重力加速。修复：reset 后补设 `allowGravity=false`。
- **Phaser timeScale 语义反转**：最初误以为 `timeScale=0.2` 是 20% 速度，但 Phaser 源码注释明确 `1.0=正常/2.0=半速/0.5=双倍速`，即有效速度 = 1/timeScale。`timeScale=0.2` 实际是 5x 加速。修复：使用 `timeScale=5.0` 实现 20% 速度。
- **慢放时雨滴一顿一顿**：timeScale=5.0 时物理有效更新率 = 60/5 = 12Hz，渲染 60fps 下每 5 帧才更新一次位置。修复：等比提升 `physics.world.fps`（`newFps = baseFps × timeScale`），保持有效更新率 ≈ 60Hz。
- **慢放/恢复切换瞬间顿挫**：`setTimeScale()` 中立即把 fps 跳到目标值，但 timeScale 还在平滑过渡中，导致 fps 与 timeScale 短暂不匹配。修复：fps 调整移到 `update()` 中跟随 timeScale 每帧同步变化。
- **场景 shutdown 时空指针崩溃**：`destroy()` 在 shutdown 事件中触发时 Phaser 已清理 physics world，访问 `this.scene.physics.world.timeScale` 报 null。修复：添加 `this.scene.physics?.world` 空值防御。

**优化**:
- 新增 `SLOWMO` 配置块（`constants.ts`）：只需改 `SPEED`（默认 0.2 = 20%）即可测试不同慢放程度，timeScale、fps、界面文字全部自动推导。

**测试结果**:
- T 键切换慢放正常，全局物体速度同步变化，符合预期
- 过渡丝滑，无顿挫感
- 抓捕后正常返回主场景，无黑屏崩溃

**下一步**:
- 第一步验证通过，进入第二步：设计自动触发逻辑（距离检测 + 空中优先 + 序列引擎）

---

## 2026-07-11 · 阶段6:子弹时间触发调优 + 阈值比例化

### 决策记录

#### 51. 多维度距离门控（L1-L8） + 轨迹预测 + 障碍物检测

**背景**: 子弹时间自动触发需要精准判断"玩家何时接近 AI 逃跑者"，单一距离阈值无法覆盖各种追捕场景（水平追及、垂直起跳、AI 急速下落、对角接近等）。

**决策**: 采用多维度距离门控系统（L1-L8），由粗到细分层判定。

**L1-L4 纯距离门控**（始终可用，不依赖预测）:
| 级别 | 条件 | 适用场景 |
|------|------|---------|
| L1 | 综合距离 < 2.2×cd | 斜线贴近 |
| L2 | 水平偏移 < 1.8×cd 且垂直 < 2.2×cd | 横向追及 |
| L3 | 垂直偏移 < 1.8×cd 且水平 < 2.2×cd | 纵向跳近 |
| L4 | 距离 < cd+10px | 兜底保险，极限距离必定闪现 |

**L5-L8 基于预测的触发**（仅在轨迹不穿过障碍物时可用）:
| 级别 | 条件 | 适用场景 |
|------|------|---------|
| L5 | 预测 minDist < 0.33×cd, 距离 < 4.0×cd, 长宽比>3 | 高置信度非对角接近 |
| L6 | 预测 minDist < 0.18×cd, 距离 < 4.0×cd | 预测几乎确定交汇 |
| L7 | AI vy > 300, 距离 < 3.3×cd, dx < 1.3×cd | AI 急速下落（预测不可靠） |
| L8 | 边缘距离 < 0.55×cd, minDist < 0.18×cd, 距离 < 4.4×cd, 长宽比>3 | 垂直边缘贴近 |

**关键技术**:
- 抛物线轨迹预测：60帧@120Hz采样，AI 站平台时不施加重力
- 视线检测（hasClearLineOfSight）：排除地面/NPC脚下平台/玩家脚下平台/NPC周边安全距离
- 障碍物检测（doesPredictedTrajectoryHitObstacle）：逐段检测预测轨迹是否穿过平台，穿过则跳过 L5-L8
- 预测轨迹可视化：橙色（AI）+ 绿色（Player）虚线轨迹，终点箭头指向交汇点

**理由**: 多维度门控使不同追捕场景都有对应的触发条件，L5-L8 的预测依赖让触发更精准，L1-L4 的纯距离门控保证在预测不可靠时仍有兜底。

---

#### 52. 子弹时间阈值比例化（collisionDist 基准）

**背景**: 子弹时间门控阈值（L1-L8 + LOS 容差）全部硬编码为绝对像素值。当角色大小、世界缩放等参数调整时，需要逐个重新校准。

**决策**: 将所有像素阈值改为基于 `collisionDist`（= playerHalfW + AIHalfW + 5）的比例系数，统一配置在 `ChaseScene.BT` 静态对象中。

**改动范围**:
- `ChaseScene.ts`: 新增 `BT` 静态配置对象（~20个比例系数），`checkBulletTimeTrigger()` 和 `hasClearLineOfSight()` 改为动态计算阈值
- 删除 `PREDICTION_THRESHOLD = 50` 硬编码常量，改为 `cd * BT.PREDICTION_MULT`

**可缩放参数**（基于 collisionDist）:
- L1-L8 所有距离/偏移/边缘/minDist 阈值
- 预测阈值（PREDICTION_MULT = 1.1）
- LOS 平台对齐容差（0.33×cd）和 NPC 周边安全距离（0.55×cd）

**不可缩放参数**（需单独关注）:
- `L5_RATIO = 3` / `L8_RATIO = 3`: 长宽比，判断对角接近，与角色大小无关
- `L7_VY = 300`: AI 下落速度阈值，取决于 `PHYSICS.GRAVITY`（1200），重力调整时需重新校准
- `L4_MARGIN = 10`: 固定像素余量，不缩放（已是最小安全距离）

**理由**: 调整角色大小后，只需改 body 尺寸，所有阈值自动按比例缩放，无需逐个重调。不可缩放参数已明确标注，方便后续关注。

---

#### 53. 预测轨迹双色可视化

**背景**: 子弹时间触发后仅显示 AI（橙色）轨迹线，玩家无法直观理解自己位置与 AI 的交汇关系。

**决策**: 在 `drawPredictionTrajectory()` 中同时绘制 Player 绿色轨迹（抛物线虚线 + 箭头 + 起点圆点），与 AI 橙色轨迹并存。

**效果**: 两条轨迹终点指向同一交汇区域，玩家一眼就能理解为什么触发了子弹时间。

---

## 2026-07-12 · 阶段7:2x 分辨率升级 + 子弹时间优化 + TextSprite 颜文字重构

### 决策记录

#### 54. 2x 内部分辨率升级（1280×720 → 2560×1440）

**背景**: Phaser 3/4 均不支持通过 GameConfig 设置 resolution，FIT 缩放模式在窗口小于 1280×720 时产生二次插值，导致文字模糊。

**决策**:
- 将 `GAME_SIZE` 从 `{w:1280, h:720}` 翻倍为 `{w:2560, h:1440}`
- CSS 缩放 0.5（`canvas { zoom: 0.5 }`）保持视觉尺寸不变
- 所有游戏数值（坐标、速度、大小、JSON 数据）翻倍
- 缩放模式改为 `NONE`（非 FIT），手动计算动态 zoom：`Math.min(windowW / 2560, windowH / 1440, 0.5)`
- 添加 `window.resize` 监听实时调整 zoom

**影响范围**:
- `constants.ts`: GAME_SIZE 翻倍
- `index.html` / `styles.css`: canvas zoom 0.5 + 动态 zoom 逻辑
- 所有关卡 JSON: 坐标/尺寸翻倍
- 所有场景: 速度/位置常量翻倍

**理由**: 提高像素密度让文字清晰度大幅提升，CSS zoom 保持视觉尺寸不变。NONE 模式避免 Phaser ScaleManager 的二次插值。

**修复联动**:
- **玩家跳不上平台**: 跳跃速度增加 5%（单跳 -1120→-1160，双跳 -960→-1000）提供平台登台余量
- **文字太小**: 全局最小字体设为 28px（内部分辨率），覆盖 UIScene/LevelScene/FootballScene/TextSprite
- **AI 追捕变傻**: `chaseTriggerRadius` 未翻倍（200px→400px），导致 AI 一直处于 patrol 状态不进入 flee

---

#### 55. 子弹时间触发逻辑优化（L1-L3 重排 + 条件收紧）

**背景**: 测试发现两个问题：
1. AI 下落场景中子弹时间不触发——日志显示 L1-L3 被跳过（因其放在预测检查之后）
2. 障碍物场景中 L2 误触发——玩家穿过平台障碍物时，虽距离近但实际无法到达 AI

**决策**:
- **执行流重排**: `checkBulletTimeTrigger()` 中将 L1-L3 移到预测检查之前，确保纯距离门控始终可用
  - 新流程: L4 → isAirborne → los → 障碍物检测 → L1-L3 → 预测检查 → L5-L8
- **L1-L3 条件收紧**: 从 `trajectoryHitsObstacle` 改为 `fugitiveAirborne || predictionOk`
  - 移除 `trajectoryHitsObstacle` 条件，避免 AI 着地+平台阻挡时误触发
  - 仅当 AI 在空中（玩家可追击）或预测可靠（轨迹无遮挡）时触发
- **L5-L8 条件**: 使用 `predictionOk`（AI 和玩家轨迹均无遮挡），确保预测可靠

**障碍物检测增强**:
- 新增 `doesPlayerTrajectoryHitObstacle()`: 预测玩家 60 帧抛物线轨迹，检测是否穿过平台
- `predictionOk` = `!aiTrajectoryBlocked && !playerTrajectoryBlocked`

**理由**: L1-L3 是纯距离兜底，不应被预测检查阻塞；条件收紧避免"距离近但无法到达"的误触发。

---

#### 56. TextSprite 颜文字重构：拆分 body 为 kaomoji + bodyText 独立元素

**背景**: 之前颜文字和正文用 `\n` 分隔在同一 Text 对象中，无法独立控制样式和状态绑定。颜文字变化时可能超出卡片范围。

**决策**:
- **body 区域拆分**: kaomoji（颜文字）占 body 的 45%（上方），bodyText（普通文字）占 55%（下方）
- **独立 Text 对象**: `kaomojiObj` 和 `mainText` 分离为两个 Phaser.Text 对象
- **颜文字自动缩放**: `calcKaomojiFontSize()` 根据文字长度和卡片可用宽度计算字号，`Math.max(8, Math.floor(Math.min(maxWidth / len, maxHeight * 0.75)))`
- **状态绑定扩展**: `stateBinding` 新增 `kaomojiMap` 和 `bodyTextMap`，支持状态驱动的颜文字+正文独立更新
- **状态绑定暂停/恢复**: `pauseStateBinding()` / `resumeStateBinding()` 用于子弹时间等场景临时覆盖
- **文本拆分**: `splitKaomojiAndText()` 按第一个 `\n` 拆分颜文字和正文

**追捕场景适配**:
- 逃亡者 NPC 卡片绑定完整状态映射（header + kaomoji + bodyText）:
  - idle: 梦想 / (´・ω・`) / 发呆中
  - patrol: 梦想 / (｀・ω・´) / 巡逻中
  - flee: 梦想 / (；´Д｀) / 逃跑中
  - caught: 梦想 / (；ω；`) / 被抓住了
  - flee_empty: 梦想 / (´；ω；`) / 没子弹了
- 子弹时间覆盖: `pauseStateBinding()` + `setKaomoji('(≧∇≦)ﾉ')` + `setText('抓不到我~')`
- 恢复: `resumeNormalSpeed()` 中调用 `resumeStateBinding()`

**向后兼容**: `kaomojiMap` 和 `bodyTextMap` 均为可选参数，不传则维持原有行为。单行模式（无 `\n`）不受影响。

**理由**: 独立 Text 对象让颜文字和正文可以独立缩放、独立更新、独立状态驱动。颜文字自动缩放确保无论内容多长都不会超出卡片。

---

### 产出清单

✅ 2x 分辨率升级: GAME_SIZE 2560×1440 + CSS zoom 0.5 + 动态 zoom 计算
✅ 所有数值翻倍: 坐标/速度/尺寸/JSON 数据
✅ 跳高修复: 单跳 -1160 / 双跳 -1000（+5% 余量）
✅ 全局最小字体 28px
✅ AI 追捕修复: chaseTriggerRadius 400px（2x 缩放）
✅ 缩放模式: FIT → NONE + 动态 zoom
✅ 子弹时间流重排: L1-L3 前移到预测检查之前
✅ L1-L3 条件收紧: fugitiveAirborne || predictionOk
✅ 玩家轨迹障碍物检测: doesPlayerTrajectoryHitObstacle()
✅ TextSprite 颜文字重构: 拆分 body + 自动缩放 + 独立状态绑定
✅ 追捕场景适配: 逃亡者卡片 split 布局 + 子弹时间覆盖
✅ typecheck 通过 + 浏览器测试通过

### 下一步

进入阶段8: 第2个子场景「找区别」设计与实现。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.2 | 2026-07-12 | 阶段7:2x分辨率升级+缩放修复+子弹时间优化+TextSprite颜文字重构(决策54-56) |
| v2.1 | 2026-07-11 | 阶段6调优:子弹时间L1-L8门控+轨迹预测+障碍物检测+阈值比例化+双色轨迹可视化(决策51-53) |
| v2.0 | 2026-07-09 | 阶段6起步:慢动作系统从零开始(决策50:SlowMoManager+RainManager+T键测试/分步迭代/5项修复+SLOWMO配置块) |
| v1.9 | 2026-07-07 | 阶段5文档设计:内容深化方案(决策35-41:状态驱动/子场景/MovableNpc/区域模块化/登台门槛/音效等) |
| v1.8 | 2026-07-06 | 阶段4优化:圆角卡片+文字裁剪+统一设计Token+场景清理+掉落复活(决策31-34) |
| v1.7 | 2026-07-06 | 阶段3完成:收集系统+通关结算+伏笔(决策30:三档评价/老伯epilogue/ResultView重写) |
| v1.6 | 2026-07-06 | 7区铺垫链+惊喜事件+Buff系统(决策26-29:世界扩展/可互动物件/三段式/setDoubleJump落地) |
| v1.5 | 2026-07-06 | 阶段3反馈修复(决策23-25:WebSpeech普通话优先/老伯对话改普通话/走开自动关对话) |
| v1.4 | 2026-07-06 | 阶段3核心系统完成(决策18-22:TextSprite/Player/关卡数据驱动/JyutpingSpeaker) |
| v1.3 | 2026-07-06 | 阶段2完成:技术骨架搭建(决策14-17,Vue3+Phaser+Pinia 跑通) |
| v1.2 | 2026-07-06 | 补充决策13(可扩展性再修正为务实扩展) |
| v1.1 | 2026-07-06 | 补充决策11(可扩展性分层修正)、12(LEVEL_DESIGN 目录拆分) |
| v1.0 | 2026-07-06 | 初始化,记录阶段1全部决策 |

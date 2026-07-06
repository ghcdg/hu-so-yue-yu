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

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.5 | 2026-07-06 | 阶段3反馈修复(决策23-25:WebSpeech普通话优先/老伯对话改普通话/走开自动关对话) |
| v1.4 | 2026-07-06 | 阶段3核心系统完成(决策18-22:TextSprite/Player/关卡数据驱动/JyutpingSpeaker) |
| v1.3 | 2026-07-06 | 阶段2完成:技术骨架搭建(决策14-17,Vue3+Phaser+Pinia 跑通) |
| v1.2 | 2026-07-06 | 补充决策13(可扩展性再修正为务实扩展) |
| v1.1 | 2026-07-06 | 补充决策11(可扩展性分层修正)、12(LEVEL_DESIGN 目录拆分) |
| v1.0 | 2026-07-06 | 初始化,记录阶段1全部决策 |

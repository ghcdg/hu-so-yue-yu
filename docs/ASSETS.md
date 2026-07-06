# 狐嗦粤语 — 资源清单 (ASSETS)

> 本文档列出伪图卡片清单及后期真图替换映射。
> 伪图卡片系统设计见 [GAME_DESIGN.md 第三章](./GAME_DESIGN.md),
> 第一关设计见 [LEVEL_DESIGN/LEVEL_01_FISH.md](./LEVEL_DESIGN/LEVEL_01_FISH.md)。

---

## 一、伪图卡片清单(第一关)

### 1.1 角色立绘(character 类型,橙色边框)

| 卡片ID | 文字 | 后缀 | 说明 | 出现位置 |
|--------|------|------|------|---------|
| card_ayue | 阿粤 | .jpg | 主角立绘 | 全程 |
| card_oldman | 老伯 | .jpg | 路边老伯,开场指引 | 区1 / 结算 |
| card_starYe | 星爷 | .jpg | 周星驰NPC,点题"梦想" | 区6 |
| card_ironLeg | 钢铁腿 | .gif | 少林足球角色(隐藏惊喜) | 区6 隐藏 |
| card_fishBoss | 咸鱼老板 | .jpg | 揭示后互动选择 NPC | 揭示区 |

### 1.2 场景物件(object 类型,蓝色边框)

| 卡片ID | 文字 | 后缀 | 说明 | 互动 |
|--------|------|------|------|------|
| card_clock | 打卡机 | .jpg | 路过播音效 | 是(自动) |
| card_tiredWorker | 疲惫的打工人 | .gif | 滚动"加班到凌晨三点半...好累啊..." | 否 |
| card_hangingFish | 挂着的咸鱼 | .gif | 滚动"我是咸鱼...我躺平中...别碰我..." | 是(反向引导) |
| card_fishDiary | 咸鱼的日记 | .gif | 滚动"今天又躺了一天,梦想是什么..." | 否(隐藏区域) |
| card_equalSign | 等号 | .jpg | 可踩平台 | 否(平台) |
| card_questionMark | 问号 | .jpg | 靠近抖动 | 否 |
| card_football | 破旧足球 | .jpg | 微微发光,踢一脚弹飞 | 是 |
| card_goldenLeg | 黄金右脚 | .gif | 滚动"少林功夫+足球=?" | 否(闪现) |
| card_oldFootballShoe | 破旧的足球鞋 | .jpg | 隐藏惊喜触发物 | 是 |
| card_hangingFish2 | 挂着的咸鱼 | .gif | 滚动"我系咸鱼...我系咸鱼..." | 是(必触发惊喜) |

### 1.3 背景物件(scenery 类型,灰色边框)

| 卡片ID | 文字 | 后缀 | 说明 |
|--------|------|------|------|
| card_office | 写字楼 | .jpg | 区1 背景 |
| card_rooftop | 天台 | .jpg | 区2 背景 |
| card_graffitiWall | 墙壁涂鸦 | .jpg | 大字"打工 = 咸鱼 ?" |
| card_shaolinTemple | 少林寺 | .jpg | 区5 远景剪影 |
| card_roadSign | 路标 | .jpg | "少林寺 →" |
| card_brickWall | 砖墙 | .jpg | 可被咸鱼撞破(反向引导) |

### 1.4 对话/提示/结算卡片

| 卡片ID | 类型 | 文字 | 说明 |
|--------|------|------|------|
| card_dialogue | dialogue | (动态) | 对话框,显示 NPC/阿粤对话 |
| card_choice | dialogue | (动态) | 选择框,3个选项 |
| card_hintChallenge | hint | 跳上去,找到答案 | 区7 全局提示 |
| card_hintFishBuff | hint | 咸鱼翻身!二段跳强化! | buff 获得提示 |
| card_result | result | (动态) | 通关结算卡片 |
| card_reveal | result | (动态) | 句子揭示全屏卡片 |

### 1.5 可碎砖块

| 卡片ID | 文字 | 后缀 | 说明 |
|--------|------|------|------|
| card_breakableBrick | 碎砖 | .gif | 滚动"我碎了..." |

---

## 二、金币清单(第一关)

| 金币ID | 印字 | 粤拼 | 出现区域 |
|--------|------|------|---------|
| coin_01 | 累 | leoi6 | 区1 |
| coin_02 | 咸 | haam4 | 区2 |
| coin_03 | 鱼 | jyu4 | 区2 |
| coin_04 | 功 | gung1 | 区5 |
| coin_05 | 夫 | fu1 | 区5 |
| coin_06 | 梦 | mung6 | 区6 |
| coin_07 | 想 | soeng2 | 区6 |
| ... | ... | ... | 全关散布 |

完整金币配置见 `level_01_fish.json` 的 `coins` 字段。

---

## 三、音频资源

### 3.1 音效(Web Audio API 合成,无需音频文件)

| 音效ID | 触发时机 | 合成方式 |
|--------|---------|---------|
| sfx_jump | 跳跃 | 短促高频正弦波 |
| sfx_doubleJump | 二段跳 | 短促上扬频率 |
| sfx_coin | 金币拾取 | 清脆短音 |
| sfx_interact | 互动(E) | 中频点击音 |
| sfx_surprise | 惊喜触发 | 爆开特效音 |
| sfx_brickBreak | 砖块碎裂 | 噪音衰减 |
| sfx_levelComplete | 通关 | 上扬和弦 |
| sfx_hit | 受伤/被碰到 | 低频短音 |
| sfx_chase_start | 追捕开始 | 紧张短音 |

### 3.2 粤语发音(Jyutping 合成)

- 目标句子:`做人如果冇梦想,跟咸鱼有咩分别?`
- 金币单字发音:见上表粤拼列
- Demo 阶段使用 WebSpeechSpeaker（普通话 zh-CN）作为默认

---

## 四、后期真图替换映射

后期替换真图时,伪图卡片的 `text` + `suffix` 对应真图资源路径:

| 伪图卡片 | 真图路径(预留) |
|---------|---------------|
| 阿粤.jpg | /assets/sprites/ayue.png |
| 老伯.jpg | /assets/sprites/oldman.png |
| 星爷.jpg | /assets/sprites/starye.png |
| 挂着的咸鱼.gif | /assets/sprites/hanging_fish.png + 滚动动画 |
| 少林寺.jpg | /assets/backgrounds/shaolin_temple.png |
| ... | ... |

**替换原则**:
- 只改 TextSprite 的资源加载逻辑,不改其他代码
- `.gif` 后缀的真图需要配套精灵图/序列帧
- 替换后 `text` 可保留作为 alt 文字(无障碍)

---

## 五、字体

| 用途 | 字体 | 说明 |
|------|------|------|
| 伪图卡片文字 | 系统默认无衬线 | 现阶段不引入字体文件 |
| 粤语文字 | 系统默认 | 确保支持粤语字符(冇/咩/嘅/咗) |
| 后期可选 | 思源黑体 / 霞鹜文楷 | 美化阶段引入 |

---

## 六、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.0 | 2026-07-07 | v0.2 内容深化:新增追捕场景卡片/状态驱动卡片/音效补充 |
| v1.0 | 2026-07-06 | 初版:第一关伪图卡片清单、金币清单、音效清单、真图替换映射 |

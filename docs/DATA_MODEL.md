# 狐嗦粤语 — 数据模型文档 (DATA_MODEL)

> 本文档定义关卡数据 JSON Schema(参考用)、伪图卡片配置、角色配置、对话配置、发音数据。
> 关卡的独特玩法/动画逻辑不在 JSON 范围内,直接写在关卡脚本里。见 [TECH_ARCH.md 5.5 节](./TECH_ARCH.md)。
> 技术架构见 [TECH_ARCH.md](./TECH_ARCH.md),
> 关卡设计见 [LEVEL_DESIGN/](./LEVEL_DESIGN/)。

**注**:JSON Schema 是**参考结构**,能用 JSON 描述的关卡数据就用 JSON,复杂/独特逻辑直接写代码,不强求全部 JSON 化。详见 [DESIGN_PHILOSOPHY.md 第四节](./DESIGN_PHILOSOPHY.md)。

---

## 一、关卡数据 Schema

### 1.1 LevelSchema(顶层)

```typescript
interface LevelData {
  id: string;                    // 关卡ID,如 'level_01_fish'
  name: string;                  // 关卡名,如 '咸鱼翻身'
  themeTag: string;              // 主题标签,如 '打工同咸鱼有咩区别?'
  targetSentence: SentenceData;  // 目标句子(粤语)
  areas: AreaData[];             // 区域数组(铺垫链)
  challengeArea: ChallengeData;  // 挑战区
  revealArea: RevealData;        // 揭示区
  resultArea: ResultData;        // 结算区
  surprises: SurpriseData[];     // 惊喜事件(必触发+隐藏)
  buff: BuffData;                // 关卡 buff
  coins: CoinData[];             // 金币配置
  totalCoins: number;            // 金币总数(用于评价)
  platforms: PlatformData[];     // 平台配置(物理碰撞)
}
```

### 1.2 SentenceData(目标句子)

```typescript
interface SentenceData {
  cantonese: string;   // 粤语:做人如果冇梦想,跟咸鱼有咩分别?
  jyutping: string;    // 粤拼:zou6 jan4 jyu4 gwo2 mou5 mung6 soeng2, gan1 haam4 jyu4 jau5 me1 faan1 bit6?
  mandarin: string;    // 普通话释义:做人如果没有梦想,那跟咸鱼有什么分别?
  source?: string;     // 来源:周星驰《少林足球》
}
```

### 1.3 AreaData(铺垫链区域)

```typescript
interface AreaData {
  id: string;                    // 区域ID,如 'area_01_work'
  index: number;                 // 区域序号,从1开始
  name: string;                  // 区域名,如 '打工'
  keyword: string;               // 碎片关键词,如 '打工'
  background?: TextSpriteConfig;  // 背景伪图卡片
  objects: TextSpriteConfig[];    // 场景物件伪图卡片
  npcs?: NpcData[];              // NPC
  dialogues?: DialogueData[];     // 对话(普通话)
  coins?: CoinData[];            // 区域内金币
  reverseHint?: ReverseHintData; // 反向引导配置(可选)
}

interface ReverseHintData {
  triggerObjectId: string;       // 触发物件ID(如"挂着的咸鱼")
  hint: string;                  // 提示文字(如"别碰我...")
  onInteract: InteractionData;   // 互动后效果
}

interface InteractionData {
  animation: string;             // 动效类型(如"弹开撞墙")
  revealHiddenArea?: string;     // 揭示的隐藏区域ID
  rewards: RewardData[];         // 奖励
}
```

### 1.4 ChallengeData(挑战区)

```typescript
interface ChallengeData {
  id: string;                    // 'challenge_01'
  hint: string;                  // 提示卡片文字,如"跳上去,找到答案"
  platforms: PlatformData[];     // 砖块阶梯 + 移动平台
  breakableBricks?: BrickData[]; // 可碎砖块
  failRespawn: { x: number; y: number }; // 失败重生点
}
```

### 1.5 RevealData(揭示区)

```typescript
interface RevealData {
  id: string;                    // 'reveal_01'
  emoji: string;                 // 触发 emoji,如 '🐟'
  position: { x: number; y: number };
  sentence: SentenceData;        // 揭示的句子
  interaction?: ChoiceData;      // 互动选择(纯娱乐)
}

interface ChoiceData {
  npc: string;                   // NPC 伪图卡片ID,如 '咸鱼老板'
  question: string;              // 问题,如"打工同咸鱼,你选边个?"
  options: ChoiceOption[];       // 选项
  rewardSame: boolean;           // 奖励是否相同(纯娱乐=true)
}

interface ChoiceOption {
  text: string;                  // 选项文字
  responseEasterEgg: string;     // 彩蛋回应台词
}
```

### 1.6 ResultData(结算区)

```typescript
interface ResultData {
  evaluations: Evaluation[];     // 评价等级
  foreshadowing?: string;        // 伏笔台词(老伯埋下一关)
}

interface Evaluation {
  name: string;                  // '咸鱼翻身' / '咸鱼之王' / '梦想家'
  condition: {                   // 达成条件
    coinRatioMin?: number;       // 金币比例下限(0~1)
    hiddenFoundAll?: boolean;    // 是否需要隐藏全发现
  };
}
```

---

## 二、惊喜事件 Schema

```typescript
interface SurpriseData {
  id: string;                    // 如 'surprise_starYe'
  type: 'required' | 'hidden';   // 必触发 / 隐藏
  position: { x: number; y: number };
  threeStage: ThreeStageData;    // 三段式叙事
  reward: BuffData | RewardData; // 奖励:buff 或 资源
}

interface ThreeStageData {
  setup: {                       // 阶段1:铺垫
    hintCard: TextSpriteConfig;  // 全局提示卡片
    delayMs: number;             // 延迟(如 3000ms)
  };
  reveal: {                      // 阶段2:揭示
    characterCard: TextSpriteConfig; // 角色伪图卡片(如"叶问.gif")
    scrollText: string;          // 滚动文字(如"叶问伸手,指向地铁站的方向,说我要打十个")
  };
  interact: {                    // 阶段3:互动
    dialogue: DialogueData[];    // 互动对话
    outcome: 'guide' | 'buff' | 'unlock'; // 玩法收益类型
  };
}
```

---

## 三、伪图卡片配置 Schema

```typescript
interface TextSpriteConfig {
  id?: string;                   // 卡片ID(可被其他配置引用)
  type: 'character' | 'object' | 'scenery' | 'dialogue' | 'hint' | 'result';
  text: string;                  // 主文字(必填)
  subtitle?: string;             // 副文字(可选)
  suffix?: '.jpg' | '.gif';     // 后缀:.jpg静态 / .gif滚动 / 无
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  scale?: number;
  textColor?: string;            // 默认按 type 约定
  borderColor?: string;          // 默认按 type 约定
  bgColor?: string;
  highlight?: boolean;
  scrollSpeed?: number;          // .gif 滚动速度(字符/秒),默认 5
  interactable?: boolean;        // 是否可互动
  interactHint?: string;         // 靠近显示的互动提示(如"按 E 踢一脚")
  animation?: 'none' | 'shake' | 'glow' | 'bounce'; // 默认动效
}
```

### 类型样式默认值

| type | borderColor | textColor | bgColor |
|------|-------------|-----------|---------|
| character | #FF8C00(橙) | #FFF | transparent |
| object | #1E90FF(蓝) | #FFF | transparent |
| scenery | #888(灰) | #DDD | transparent |
| dialogue | #8B4513(棕) | #FFF | rgba(0,0,0,0.7) |
| hint | #FFD700(金) | #000 | rgba(255,255,255,0.9) |
| result | #FFD700(金) | #FFF | rgba(0,0,0,0.85) |

---

## 四、NPC / 对话 Schema

```typescript
interface NpcData {
  id: string;                    // 如 'npc_oldMan'
  card: TextSpriteConfig;        // NPC 伪图卡片
  position: { x: number; y: number };
  dialogues: DialogueData[];     // 对话列表
}

interface DialogueData {
  speaker: string;               // 说话者ID或名字
  card?: TextSpriteConfig;       // 说话者伪图卡片(立绘)
  text: string;                  // 对话内容(普通话)
  emotion?: 'normal' | 'happy' | 'sad' | 'surprised' | 'thinking';
  pauseMs?: number;              // 显示时长(自动推进),0=需玩家点击
}
```

---

## 五、Buff / 平台 / 金币 Schema

```typescript
interface BuffData {
  id: string;                    // 如 'buff_fish翻身'
  name: string;                  // '咸鱼翻身'
  description: string;           // '二段跳高度+30%,滞空更久'
  effect: {
    type: 'jumpEnhance' | 'highlightHidden' | '...';
    value: number;               // 如 0.3 表示 +30%
    duration: 'untilLevelEnd';   // 持续到通关
  };
  sourceSurpriseId: string;      // 来源惊喜事件ID
}

interface PlatformData {
  id: string;
  type: 'static' | 'moving' | 'breakable';
  position: { x: number; y: number };
  size: { width: number; height: number };
  card?: TextSpriteConfig;       // 平台伪图卡片(如"等号.jpg")
  moving?: { axis: 'x' | 'y'; range: number; speed: number }; // 移动平台
  breakable?: { hitsToBreak: number };                         // 可碎砖块
}

interface CoinData {
  id: string;
  position: { x: number; y: number };
  word: string;                  // 印的字,如 '累' '咸' '功夫'
  jyutping: string;              // 粤拼(拾取时发音)
}

interface BrickData {
  id: string;
  position: { x: number; y: number };
  card: TextSpriteConfig;        // 如"碎砖.gif"滚动"我碎了..."
  hitsToBreak: number;
}

interface RewardData {
  type: 'coin' | 'hiddenCount' | 'sentence';
  amount?: number;
  value?: string;
}
```

---

## 六、第一关数据示例(片段)

```json
{
  "id": "level_01_fish",
  "name": "咸鱼翻身",
  "themeTag": "打工同咸鱼有咩区别?",
  "targetSentence": {
    "cantonese": "做人如果冇梦想,跟咸鱼有咩分别?",
    "jyutping": "zou6 jan4 jyu4 gwo2 mou5 mung6 soeng2, gan1 haam4 jyu4 jau5 me1 faan1 bit6?",
    "mandarin": "做人如果没有梦想,那跟咸鱼有什么分别?",
    "source": "周星驰《少林足球》"
  },
  "areas": [
    {
      "id": "area_01_work",
      "index": 1,
      "name": "打工",
      "keyword": "打工",
      "objects": [
        { "type": "object", "text": "打卡机", "suffix": ".jpg", "interactable": true },
        { "type": "scenery", "text": "疲惫的打工人", "suffix": ".gif", "scrollSpeed": 5 }
      ]
    },
    {
      "id": "area_02_fish",
      "index": 2,
      "name": "咸鱼",
      "keyword": "咸鱼",
      "objects": [
        {
          "type": "object", "text": "挂着的咸鱼", "suffix": ".gif",
          "scrollSpeed": 4, "interactable": true, "interactHint": "按 E 踢一脚",
          "animation": "shake"
        }
      ],
      "reverseHint": {
        "triggerObjectId": "挂着的咸鱼",
        "hint": "我是咸鱼...我躺平中...别碰我...",
        "onInteract": {
          "animation": "弹开撞墙",
          "revealHiddenArea": "hidden_fishDiary",
          "rewards": [{ "type": "coin", "amount": 3 }, { "type": "hiddenCount" }]
        }
      }
    }
  ]
}
```

完整数据见 `src/game/data/levels/level_01_fish.json`(实现阶段创建)。

---

## 七、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-06 | 初版:关卡/惊喜/伪图卡片/NPC/对话/Buff/平台/金币 Schema |

# 项目规则 (PROJECT RULES)

> 本文档记录用户明确要求必须做和不能做的事情。所有 AI 助手必须严格遵守。

---

## 一、禁止事项

### Git 操作
- **严禁**执行任何 git 命令（包括但不限于 `git add`、`git commit`、`git push`、`git pull`、`git status`、`git log`、`git branch`、`git checkout`、`git merge`、`git rebase`、`git stash`、`git reset` 等）
- 所有 git 操作必须经过用户明确同意后才能执行
- 用户未明确指示时，不得主动提议或执行 git 操作

---

## 二、必须事项

### 编码规范
- **禁止循环依赖**：模块间不得形成循环引用（A → B → A）。即使使用 `import type`，也应避免循环依赖，因为 Vite/Rollup 模块解析可能产生未定义行为。
  - 正确做法：将共享类型定义在 `types.ts` 中，场景类从 `types.ts` 单向导入
  - 错误示例：`types.ts` 从 `ChaseScene.ts` 导入 `ChaseSceneConfig`，而 `ChaseScene.ts` 又从 `types.ts` 导入其他类型

---

## 三、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.1 | 2026-07-06 | 新增：禁止循环依赖的编码规范 |
| v1.0 | 2026-07-06 | 初始版本：禁止未经同意的 git 操作 |
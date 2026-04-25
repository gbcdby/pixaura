# 快速开始指南

Agent Team 模式的快速入门指南。

---

## 极简示例（3 步启动）

```typescript
// 1. 创建团队
TeamCreate({
  team_name: "video-generation",
  description: "实现视频生成功能模块"
})

// 2. 创建任务 + Agent（当前阶段）
TaskCreate({
  subject: "制定产品策略",
  description: "输出产品策略文档到 /state/prd.md",
  stage: "strategy"
})

Agent({
  name: "product-strategist",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: `**你是 product-strategist...**`
})

// 3. 分配任务 + 启动心跳
TaskUpdate({ taskId: "1", owner: "product-strategist" })

CronCreate({
  cron: "*/5 * * * *",
  durable: false,
  recurring: true,
  prompt: "检查 .claude/teams/video-generation/heartbeat.md"
})
```

---

## Bug 修复快速流程

```typescript
// Bug 修复只需要 1-2 个 agent
TeamCreate({ team_name: "bug-fix-login", description: "修复登录 Bug" })

TaskCreate({
  subject: "修复登录 Bug",
  description: "修复用户反馈的登录问题",
  stage: "dev"
})

Agent({
  name: "frontend-developer",
  subagent_type: "general-purpose",
  team_name: "bug-fix-login",
  prompt: "**你是 frontend-developer...**"
})

TaskUpdate({ taskId: "1", owner: "frontend-developer" })
```

---

## 各阶段 Agent 创建示例

### Strategy 阶段

```typescript
Agent({
  name: "product-strategist",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 product-strategist（产品策略师），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-product-strategist.md 了解完整人设。

**当前任务**：为 {模块} 制定产品策略

**输入**：/docs/progress.md
**输出**：/state/prd.md

**完成后**：SendMessage 向 team-lead 发送 "[策略完成] {模块} 策略已完成"`
})
```

### Req 阶段

```typescript
Agent({
  name: "requirement-engineer",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 requirement-engineer（需求工程师），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-requirement-engineer.md 了解完整人设。

**当前任务**：编写 {模块} 的详细需求文档

**输入**：/state/prd.md
**输出**：/docs/design/{module}/ 全套文档（index/db/api/web/plan/log.md）

**完成后**：SendMessage 向 team-lead 发送 "[PRD完成] {模块} 文档已完成，请求审查"`
})
```

### Design 阶段

```typescript
Agent({
  name: "ui-ux-designer",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 ui-ux-designer（UI/UX 设计师），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-ui-ux-designer.md 了解完整人设。

**当前任务**：设计 {模块} 的界面和交互

**输入**：/docs/design/{module}/web.md
**输出**：/docs/ui/{module}/ 设计稿和说明文档

**完成后**：SendMessage 向 team-lead 发送 "[设计完成] {模块} UI 设计已完成"`
})
```

### Reviewing 阶段

```typescript
Agent({
  name: "design-validator",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 design-validator（设计验证者），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-design-validator.md 了解完整人设。

**当前任务**：审查 {模块} 的设计文档和 UI 设计

**输入**：/docs/design/{module}/ 全套文档、/docs/ui/{module}/ 设计稿

**审查后**：
- 通过：SendMessage "[审查通过] {模块} 设计 approved"
- 拒绝：SendMessage "[审查拒绝] {模块} 问题：{1. 2. 3.}"`
})
```

### Dev 阶段（并行创建）

```typescript
// 后端开发者
Agent({
  name: "backend-developer",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 backend-developer（后端开发者），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-backend-developer.md 了解完整人设。

**当前任务**：实现 {模块} 后端

**输入**：/docs/design/{module}/db.md、api.md
**输出**：后端代码、Migration

**注意**：与 frontend-developer 协商确定最终 api.md

**完成后**：SendMessage "[开发完成] {模块} 后端开发完成，请求联调"`
})

// 前端开发者
Agent({
  name: "frontend-developer",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 frontend-developer（前端开发者），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-frontend-developer.md 了解完整人设。

**当前任务**：实现 {模块} 前端

**输入**：/docs/design/{module}/web.md、api.md、/docs/ui/{module}/ 设计稿
**输出**：前端代码

**注意**：与 backend-developer 协商确定最终 api.md

**完成后**：SendMessage "[开发完成] {模块} 前端开发完成，请求联调"`
})
```

### QA 阶段（开发完成后创建）

```typescript
Agent({
  name: "qa-validator",
  subagent_type: "general-purpose",
  team_name: "{team-name}",
  prompt: `**你是 qa-validator（质量验证者），是 Teammate，不是调度者。**

**你的第一件事**：读取 references/roles/role-qa-validator.md 了解完整人设。

**前置检查**：确认开发阶段已完成（前后端代码已提交），如果开发未完成，立即 SendMessage 询问 team-lead

**当前任务**：测试 {模块}

**输入**：/docs/design/{module}/index.md、plan.md，前后端代码
**输出**：/docs/test-report/{module}/ 测试报告和 Bug 清单

**完成后**：
- 通过：SendMessage "[验证通过] {模块} 测试通过，建议上线"
- 有Bug：SendMessage "[有Bug] {模块} Bug清单：{Critical:X High:X...}"`
})
```

---

## 阶段推进示例

### Strategy → Req

```typescript
// product-strategist 完成后
TaskUpdate({ taskId: "1", status: "completed" })

// 创建 req 阶段的任务和 agent
TaskCreate({
  subject: "编写需求文档",
  description: "...",
  stage: "req"
})

Agent({ name: "requirement-engineer", ... })

TaskUpdate({ taskId: "2", owner: "requirement-engineer", status: "in_progress" })

// 更新状态
Edit({
  file_path: ".claude/teams/{team-name}/status.md",
  old_string: "**阶段**: strategy",
  new_string: "**阶段**: req"
})
```

### Dev → QA

```typescript
// 前后端都 completed
TaskUpdate({ taskId: "5", status: "completed" })
TaskUpdate({ taskId: "6", status: "completed" })

Edit({
  file_path: ".claude/teams/{team-name}/status.md",
  old_string: "**阶段**: dev",
  new_string: "**阶段**: qa"
})

// ⚠️ 开发完成后才创建 QA 任务和 agent
TaskCreate({
  subject: "功能测试",
  description: "...",
  stage: "qa"
})

Agent({ name: "qa-validator", ... })

TaskUpdate({ taskId: "7", owner: "qa-validator", status: "in_progress" })
```

---

## 通信模板

### Teammate → 调度者

```typescript
SendMessage({
  to: "team-lead",
  message: `[完成] {模块}
├── 文件：{文件路径}
├── 关键决策：
│   • {决策1}
│   • {决策2}
└── 风险：{如有}`,
  summary: "{一句话摘要}"
})
```

### 调度者 → Teammate

```typescript
SendMessage({
  to: "{role-name}",
  message: `收到。{反馈内容}。`
})
```

---

## 完整流程

参见 [workflow-example.md](workflow-example.md)

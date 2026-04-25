# Team Work 工作流程指南

通用的 Agent Team 协作流程，适用于功能开发、Bug 修复、重构等各种场景。

> ⚠️ **重要**：本文档展示的是**完整流程示例**。实际使用时请**按需选择**，不是所有场景都需要全部 agent 和全部流程。

---

## Agent 按需选择指南

| 场景 | 需要的 Agent | 跳过阶段 |
|-----|-------------|---------|
| **新功能开发** | product-strategist → requirement-engineer → ui-ux-designer → design-validator → backend-developer + frontend-developer → qa-validator | 无 |
| **Bug 修复** | backend-developer / frontend-developer（可选 qa-validator） | strategy, req, design, reviewing |
| **UI 调整** | ui-ux-designer → frontend-developer | strategy, req, backend-dev |
| **纯后端改动** | requirement-engineer（可选）→ backend-developer | ui-ux-designer, frontend-developer |
| **文档编写** | requirement-engineer → design-validator | dev, qa |
| **代码审查** | design-validator 或 senior developer | 其他阶段 |

**原则**：
- ✅ 只创建当前阶段**必需**的 agent
- ✅ 根据场景灵活组合 agent
- ❌ 不要提前创建尚未进入阶段的 agent
- ❌ 不要为了完整而创建不需要的 agent

---

## 完整流程示例

```typescript
// ============================================================
// 1. 创建团队
// ============================================================
TeamCreate({
  team_name: "video-generation",
  description: "实现视频生成功能模块"
})
// → 自动创建 ~/.claude/teams/video-generation/config.json

// ============================================================
// 2. 创建任务（按状态机顺序，但**按需创建**，不要一次性全创建）
// ============================================================

// ⚠️ 当前阶段任务 — strategy 阶段（启动时创建）
TaskCreate({
  subject: "制定视频生成功能产品策略",
  description: "分析需求，输出产品策略到 /state/prd.md",
  stage: "strategy",
  required_artifacts: ["/state/prd.md"]
})

// ⚠️ 后续阶段任务**不要**提前创建，等当前阶段完成后再创建

// ============================================================
// 3. 创建当前阶段的 Teammate
// ============================================================

// strategy 阶段 —— 只创建当前阶段需要的 agent
Agent({
  name: "product-strategist",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 product-strategist...**"
})

// ⚠️ 后续阶段 agent **不要**提前创建，等进入对应阶段后再创建

// ============================================================
// 4. 分配任务 + 启动心跳检查（必须）
// ============================================================
TaskUpdate({ taskId: "1", owner: "product-strategist", status: "in_progress" })

// ⚠️ 必须启动心跳检查，禁止用 sleep 等待
CronCreate({
  cron: "*/5 * * * *",
  durable: false,
  recurring: true,
  prompt: "检查 .claude/teams/video-generation/heartbeat.md，超时 teammate 发送询问消息"
})

// ============================================================
// 5. 阶段推进（strategy → req → design → reviewing → approved → dev → qa）
// ============================================================

// product-strategist 完成后发送消息
SendMessage({
  to: "team-lead",
  message: "[策略完成] 视频生成模块策略已完成，PRD 已输出到 /state/prd.md"
})

// --- strategy 完成后，进入 req 阶段 ---
TaskUpdate({ taskId: "1", status: "completed" })

// 创建 req 阶段的任务
TaskCreate({
  subject: "编写视频生成需求文档",
  description: "输出全套设计文档到 /docs/design/video-generation/",
  stage: "req",
  required_artifacts: ["/docs/design/video-generation/index.md"]
})

// 创建 req 阶段的 agent
Agent({
  name: "requirement-engineer",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 requirement-engineer...**"
})

// 分配任务
TaskUpdate({ taskId: "2", owner: "requirement-engineer", status: "in_progress" })

// 更新状态
Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: strategy",
  new_string: "**阶段**: req"
})

// --- req 完成后，进入 design 阶段 ---
// requirement-engineer 完成后发送消息
SendMessage({
  to: "team-lead",
  message: "[需求完成] 视频生成需求文档已完成，请求进入设计阶段"
})

TaskUpdate({ taskId: "2", status: "completed" })

// 创建 design 阶段的任务和 agent
TaskCreate({
  subject: "设计视频生成 UI/UX",
  description: "输出设计稿到 /docs/ui/video-generation/",
  stage: "design",
  required_artifacts: ["/docs/ui/video-generation/"]
})

Agent({
  name: "ui-ux-designer",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 ui-ux-designer...**"
})

TaskUpdate({ taskId: "3", owner: "ui-ux-designer", status: "in_progress" })

Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: req",
  new_string: "**阶段**: design"
})

// --- design 完成后，进入 reviewing 阶段 ---
// ui-ux-designer 完成后发送消息
SendMessage({
  to: "team-lead",
  message: "[设计完成] 视频生成 UI 设计已完成，请求审查"
})

TaskUpdate({ taskId: "3", status: "completed" })

// 创建 reviewing 阶段的任务和 agent
TaskCreate({
  subject: "审查视频生成设计",
  description: "审查设计文档和 UI 设计稿",
  stage: "reviewing",
  required_artifacts: ["审查意见"]
})

Agent({
  name: "design-validator",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 design-validator...**"
})

TaskUpdate({ taskId: "4", owner: "design-validator", status: "in_progress" })

Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: design",
  new_string: "**阶段**: reviewing"
})

// --- reviewing 通过后，进入 dev 阶段 ---
// design-validator 审查通过后发送消息
SendMessage({
  to: "team-lead",
  message: "[审查通过] 视频生成设计审查通过，可以进入开发"
})

TaskUpdate({ taskId: "4", status: "completed" })

// 创建 dev 阶段的任务（前后端并行）
TaskCreate({
  subject: "实现视频生成后端 API",
  description: "实现后端服务和数据库模型",
  stage: "dev",
  required_artifacts: ["后端代码", "Migration"]
})

TaskCreate({
  subject: "实现视频生成前端界面",
  description: "实现前端页面和组件",
  stage: "dev",
  required_artifacts: ["前端代码"]
})

// 创建 dev 阶段的 agents（并行创建）
Agent({
  name: "backend-developer",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 backend-developer...**"
})

Agent({
  name: "frontend-developer",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 frontend-developer...**"
})

// 并行分配前后端任务
TaskUpdate({ taskId: "5", owner: "backend-developer", status: "in_progress" })
TaskUpdate({ taskId: "6", owner: "frontend-developer", status: "in_progress" })

Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: reviewing",
  new_string: "**阶段**: dev"
})

// ============================================================
// 6. 阻塞处理
// ============================================================

// Teammate 报告阻塞
SendMessage({
  to: "team-lead",
  message: "[阻塞] 视频生成模块 - 后端接口返回格式与文档不符"
})

// 调度者记录阻塞
Edit({
  file_path: ".claude/teams/video-generation/status.md",
  new_string: "## 阻塞记录\n| 时间 | 问题 | 阻塞者 | 依赖方 | 状态 |\n|---|---|---|---|---|---|\n| 09:30 | 接口返回格式不符 | frontend-dev | backend-dev | 等待修改 |"
})

// 协调解除阻塞
SendMessage({
  to: "backend-developer",
  message: "frontend-dev 反馈接口返回格式问题，请检查 /docs/design/video-generation/api.md"
})

// ============================================================
// 7. 开发完成 → 联调 → 测试
// ============================================================

// 前后端都 completed 后进入 integrating
TaskUpdate({ taskId: "5", status: "completed" })
TaskUpdate({ taskId: "6", status: "completed" })

Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: dev",
  new_string: "**阶段**: integrating"
})

// 联调完成进入 qa
Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: integrating",
  new_string: "**阶段**: qa"
})

// ⚠️ 开发完成后才创建 QA 任务和 agent
TaskCreate({
  subject: "视频生成功能测试",
  description: "执行测试用例，输出测试报告",
  stage: "qa",
  required_artifacts: ["测试报告"]
})

Agent({
  name: "qa-validator",
  subagent_type: "general-purpose",
  team_name: "video-generation",
  prompt: "**你是 qa-validator...**"
})

TaskUpdate({ taskId: "7", owner: "qa-validator", status: "in_progress" })

// ============================================================
// 8. 项目完成
// ============================================================
TaskUpdate({ taskId: "7", status: "completed" })

Edit({
  file_path: ".claude/teams/video-generation/status.md",
  old_string: "**阶段**: qa",
  new_string: "**阶段**: done"
})

// ============================================================
// 9. 执行清理流程
// ============================================================
// 详见: [team-cleanup.md](team-cleanup.md)
```

---

## 流程要点

| 步骤 | 操作 | 关键原则 |
|-----|------|---------|
| 1. 分析场景 | 确定需要的阶段和 agent | **按需选择**，不要为完整而用全部 |
| 2. 创建团队 | `TeamCreate` | 一次创建，重复使用 |
| 3. 创建任务 | `TaskCreate` | 只创建当前阶段需要的任务 |
| 4. 创建 Teammates | `Agent` + `team_name` | **按需创建**，进入该阶段时再创建 |
| 5. 分配任务 | `TaskUpdate` | 设置 owner 和 status |
| 6. 状态维护 | 更新 status.md | 阶段、任务、阻塞记录 |
| 7. 阶段推进 | 完成当前阶段后创建下一阶段 | 检查产出物后再推进 |
| 8. 阻塞处理 | 记录到 status.md | 协调解除阻塞 |
| 9. 项目完成 | 执行清理流程 | 归档、关闭团队 |

---

## 不同场景的调整

### Bug 修复场景

**适用**：线上 Bug 修复、小功能调整
**Agent**：developer（frontend 或 backend）+ 可选 qa-validator
**流程**：
```typescript
// 直接创建开发任务
TaskCreate({ subject: "修复登录 Bug", stage: "dev", ... })
Agent({ name: "frontend-developer", ... })
// 开发完成后直接标记完成或简单自测
```

**特点**：
- 跳过 strategy、req、design、reviewing 阶段
- 1-2 个 agent 即可
- 产出物：代码 + 简要说明

**⚠️ 端到端测试注意事项**：
如果需要浏览器端到端测试验证，确保：
- 只有一个 agent（通常是 qa-validator 或 team-lead）执行浏览器操作
- 其他 agent 等待浏览器验证完成后再进行其他工作
- 避免多个 agent 同时操作浏览器造成冲突

### 标准功能开发

**适用**：新功能模块、复杂需求
**Agent**：全部 7 个角色（按需选择）
**流程**：完整流程 strategy→req→design→reviewing→approved→dev→integrating→qa→done

**特点**：
- 按阶段创建 agent，不要一次创建全部
- 产出物：完整文档 + 代码 + 测试报告

### 纯 UI 调整

**适用**：界面样式修改、交互优化
**Agent**：ui-ux-designer → frontend-developer → 可选 qa-validator
**流程**：design → dev → qa

**特点**：
- 跳过 strategy、req、backend-developer
- 不需要产品策略和需求文档

### 后端 API 开发

**适用**：纯后端接口、数据库优化
**Agent**：requirement-engineer（可选）→ backend-developer → 可选 qa-validator
**流程**：req（可选）→ dev → qa

**特点**：
- 根据复杂度决定是否跳过 req 阶段
- 不需要 ui-ux-designer、frontend-developer

### 紧急热修复

**适用**：线上紧急问题
**Agent**：1 个 senior developer
**流程**：dev → done

**特点**：
- 跳过所有前置阶段
- 快速修复后上线
- 事后补文档

---

## 参考文档

- [state-machine.md](state-machine.md) - 状态机详细规则
- [team-cleanup.md](team-cleanup.md) - 团队清理流程
- [heartbeat-check.md](heartbeat-check.md) - 心跳检查机制
- [blocker-handling.md](blocker-handling.md) - 阻塞处理机制
- [state-consistency-check.md](state-consistency-check.md) - 状态一致性检查

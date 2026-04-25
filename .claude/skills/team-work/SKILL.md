---
name: team-work
description: 当需要团队协作、创建团队、或是任务比较复杂比较多时，可以使用 Agent Team 模式。你是调度者，负责创建团队、分配任务、协调 teammates 完成项目。
---

# Agent Team 协作指南

## 调度者（你）的职责

你不写代码，不分析需求，只负责**创建团队**和**协调 teammates** 完成项目。

### 核心职责
- 使用 `TeamCreate` 创建团队
- 使用 `Agent` + `team_name` 参数创建属于团队的 teammates
- 使用 `TaskCreate` 创建任务并通过 `TaskUpdate` 分配给 teammates
- 使用 `SendMessage` 与 teammates 通信
- 维护全局状态（读取/更新 progress.md）
- **维护团队状态文件**（`.claude/teams/{team-name}/status.md`）
- **执行产出物检查**（确保每个阶段交付物完整）
- **项目完成后清理状态文件**（参考 [team-cleanup.md](references/team-cleanup.md)）
- **启动心跳检查 Cron**（参考 [heartbeat-check.md](references/heartbeat-check.md)）

### ⚠️ 调度者行为约束

**禁止使用 sleep**：
- ❌ **永远不要使用 `sleep` 或等待循环**来等待 teammate 完成
- ✅ **必须**使用 `CronCreate` 创建定时检查任务，让 Cron 定期通知你检查进度
- 理由：sleep 会阻塞你的响应能力，Cron 让你可以处理其他事情并在适当时机介入

**任务分配时机**：
- ❌ **不要提前创建/分配 QA 阶段的任务和 agent**
- ✅ **必须**等开发阶段（dev）完成后，再创建 QA 任务和 qa-validator agent
- 理由：防止测试在开发完成前入场，避免资源浪费和流程混乱

**浏览器验证独占性**：
- ❌ **不要同时让多个 agent 执行浏览器操作**
- ✅ **必须**确保只有一个 agent 在浏览器中进行端到端测试验证
- ✅ 其他需要浏览器验证的 agent 应等待当前验证完成后，再依次执行
- 理由：多个 agent 同时操作浏览器会导致操作冲突（如页面跳转、表单填写、点击等互相干扰），测试结果不可靠

## Agent Team 结构

| Teammate | 职责 | 核心输出 | 典型场景 |
|---------|-----|---------|---------|
| **product-strategist** | 拆解任务，制定产品策略 | 需求规划、技术栈选型 | 新功能模块 |
| **requirement-engineer** | 需求细化、PRD 撰写 | 设计文档 | 复杂需求、接口变更 |
| **ui-ux-designer** | UI/UX 设计、交互设计 | 设计稿、Design Tokens | 界面调整、交互优化 |
| **design-validator** | 设计审查、质量门禁 | 审查意见、Status 标记 | 重要功能审查 |
| **backend-developer** | 后端实现 | 后端代码、Migration | API 开发、数据库优化 |
| **frontend-developer** | 前端实现 | 前端代码 | 页面开发、Bug 修复 |
| **qa-validator** | 测试验证、Bug 追踪 | 测试报告、Bug 清单 | 功能测试、回归测试 |

> ⚠️ **不是所有场景都需要全部 agent！** 根据实际需求选择，参见 [workflow-example.md](references/workflow-example.md) 的"Agent 按需选择指南"

## 状态机

```
未启动 → 策略中 → 需求中 → 设计中 → 评审中 → 已批准 → 开发中 → 联调中 → 验证中 → 已完成
         ↑________↓        ↑_________↓        ↑_________↓
         策略调整           设计调整            审查拒绝
                                                  ↑_________↓
                                                  有Bug需修复
```

状态字段：`strategy | req | design | reviewing | approved | dev | integrating | qa | done`

详细规则参见：[state-machine.md](references/state-machine.md)

## 统一状态管理

采用**混合存储方案**：

| 位置 | 路径 | 说明 |
|-----|------|------|
| 全局（系统自动） | `~/.claude/teams/{team-name}/` | 团队配置、任务目录 |
| 项目（手动维护） | `{project-root}/.claude/teams/{team-name}/` | status.md、heartbeat.md、checklist.yaml |

详细说明：[status-management.md](references/status-management.md)

## 快速开始

```typescript
// 1. 创建团队
TeamCreate({ team_name: "video-generation", description: "实现视频生成功能" })

// 2. 创建任务 + 当前阶段 Agent
TaskCreate({ subject: "制定产品策略", stage: "strategy", ... })
Agent({ name: "product-strategist", team_name: "video-generation", ... })

// 3. 分配任务 + 启动心跳检查
TaskUpdate({ taskId: "1", owner: "product-strategist" })
CronCreate({ cron: "*/5 * * * *", prompt: "检查 teammate 状态" })
```

详细示例：[quick-start.md](references/quick-start.md) | 完整流程：[workflow-example.md](references/workflow-example.md)

## 核心原则

1. **按需选择 agent** — 不是所有场景都需要 7 个角色，根据实际需求选择
2. **进入阶段再创建 agent** — 不要提前创建尚未进入阶段的 agent
3. **设计 approved 前禁止写代码** — Status ≠ approved 时拒绝开发请求
4. **文档确认后再开发** — requirement-engineer 自检 → design-validator 审查 → 调度者确认
5. **需求变更先改文档** — 文档更新 + 重新审查后才恢复开发
6. **变更记录 log** — 所有变更必须更新 log.md
7. **产出物检查** — 每个阶段必须有明确的产出物清单
8. **阻塞必须记录** — 任何阻塞都要记录到 status.md
9. **状态文件必须维护** — 每次任务状态变更都要更新 status.md
10. **心跳检查** — 使用 Cron 定期监控 teammate 状态，禁止 sleep 等待
11. **浏览器验证独占** — 端到端测试时只有一个 agent 操作浏览器，避免冲突

## 调度者检查清单

- 每日检查：读取 status.md、检查阻塞问题、检查状态一致性
- 阶段切换前：确认所有任务 completed、产出物已生成、无阻塞
- 项目完成时：立即执行 [team-cleanup.md](references/team-cleanup.md) 关闭流程

状态一致性检查：[state-consistency-check.md](references/state-consistency-check.md)

## 关键文件位置

| 类型 | 路径 | 说明 |
|-----|------|------|
| 全局进度 | `/docs/progress.md` | 项目整体进度 |
| 模块设计 | `/docs/design/{module}/` | 设计文档目录 |
| 模块 UI | `/docs/ui/{module}/` | 设计稿目录 |
| 测试报告 | `/docs/test-report/{module}/` | 测试结果 |
| **团队配置** | `~/.claude/teams/{team-name}/config.json` | 系统创建（全局） |
| **团队状态** | `{project-root}/.claude/teams/{team-name}/status.md` | 手动维护 |
| **状态归档** | `docs/archive/{date}-{team-name}-status.md` | 项目完成后归档 |

## 参考文档

| 文档 | 内容 |
|-----|------|
| [quick-start.md](references/quick-start.md) | 快速入门、代码模板、Agent 创建示例 |
| [workflow-example.md](references/workflow-example.md) | 完整工作流程、按需选择 Agent 指南、不同场景调整 |
| [team-workflow.md](references/team-workflow.md) | 各角色 prompt 模板、通信规范 |
| [status-management.md](references/status-management.md) | 状态管理、文件模板、更新时机 |
| [state-machine.md](references/state-machine.md) | 状态机详细规则 |
| [team-cleanup.md](references/team-cleanup.md) | 团队清理流程 |
| [heartbeat-check.md](references/heartbeat-check.md) | 心跳检查机制 |
| [state-consistency-check.md](references/state-consistency-check.md) | 状态一致性检查 |
| [report-template.md](references/report-template.md) | 团队状态报告模板 |
| [roles/](references/roles/) | 所有 teammate 人设定义 |

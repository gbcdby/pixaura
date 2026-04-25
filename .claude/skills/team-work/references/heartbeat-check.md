# 心跳检查机制

Team-leader 使用 Cron 定期检查 teammates 状态，避免无限等待卡住的 teammate。

## 核心思路

- **主动监控** — team-leader 不只是被动等待，而是定期主动检查
- **超时介入** — 超过 5 分钟未更新就主动询问状态
- **后台运行** — Cron 在后台运行，不影响 team-leader 其他工作

## 启动心跳检查

分配任务后启动 Cron：

```typescript
// 分配任务后立即启动心跳检查
CronCreate({
  cron: "*/5 * * * *",  // 每 5 分钟检查一次
  durable: false,        // 会话内有效，不写入磁盘
  prompt: "心跳检查：读取 heartbeat.md，检查是否有 teammate 超过 5 分钟未更新。如有，SendMessage 询问状态。",
  recurring: true
})
```

## 心跳状态文件

在团队状态目录维护 `heartbeat.md`：

**文件位置**：`{project-root}/.claude/teams/{team-name}/heartbeat.md`

**格式**：

```markdown
# Teammate 心跳状态

**团队**: {team-name}
**创建时间**: {创建时间}

| Teammate | 最后活跃时间 | 当前任务 | 状态 |
|----------|-------------|---------|------|
| frontend-developer | 2026-04-04 12:50 | Bug 1 | 正常 |
| backend-developer | 2026-04-04 12:45 | Bug 4 | 正常 |
| qa-validator | 2026-04-04 12:30 | 等待 | 正常 |
```

详见：[heartbeat-template.md](heartbeat-template.md)

## 更新心跳时机

| 时机 | 操作 |
|------|------|
| 收到 teammate 消息 | 更新最后活跃时间 |
| 收到 idle_notification | 更新最后活跃时间 |
| 分配任务 | 更新当前任务 |
| 任务完成 | 更新状态为"已完成" |

## 介入流程

Cron 检查发现超过 5 分钟未更新的 teammate：

```
超时检测 → SendMessage询问 → 等待响应(3分钟) → 判断下一步
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
                  有响应                           无响应
                    ↓                               ↓
              更新心跳时间                    标记为阻塞
              继续监控                        考虑重新分配
```

**具体步骤**：

1. **第一次超时** — SendMessage 询问："你的任务进展如何？是否遇到阻塞？"
2. **等待响应** — 给予 3 分钟响应时间
3. **无响应** — 标记为阻塞，考虑：
   - 重新分配任务给其他 teammate
   - 等待用户介入
   - 终止该 teammate（极端情况）
4. **响应正常** — 更新心跳时间，继续监控

## 心跳检查 Cron 模板

```typescript
CronCreate({
  cron: "*/5 * * * *",
  durable: false,
  recurring: true,
  prompt: `
心跳检查任务：
1. 读取 {project-root}/.claude/teams/{team-name}/heartbeat.md
2. 对比当前时间，找出超过 5 分钟未更新的 teammate
3. 如有超时 teammate，SendMessage 询问："你的任务进展如何？是否遇到阻塞需要帮助？"
4. 更新 heartbeat.md（记录检查时间）
5. 如有阻塞，更新 status.md 的阻塞问题部分
`
})
```

## 停止心跳检查

项目完成、团队清理时停止 Cron：

```typescript
// 获取 Cron ID
CronList()
// 停止心跳检查
CronDelete({ id: "心跳检查的 Cron ID" })
```

---
日期: 2026-04-04
来源: team-work skill 改进 - 解决 team-leader 无限等待问题
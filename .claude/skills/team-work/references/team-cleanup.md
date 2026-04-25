# 团队清理流程

当所有任务 completed 后，调度者执行以下流程：

## 1. 停止心跳检查

**必须首先执行！** 防止 Cron 继续在后台运行。

```typescript
// 1. 获取所有 Cron 任务
CronList()

// 2. 找到心跳检查的 Cron ID（通常名为 "heartbeat-check" 或类似）
// 3. 停止心跳检查
CronDelete({ id: "心跳检查的 Cron ID" })
```

**注意**：即使 `durable: false` 的 Cron 在会话结束时会自动停止，但任务完成后会话可能仍在继续，必须手动停止避免不必要的资源消耗。

## 2. 最终检查清单

```markdown
## 项目完成清理清单

- [ ] 所有任务状态为 completed
- [ ] 所有产出物已归档
- [ ] status.md 已更新最终状态
- [ ] 测试报告已生成
- [ ] progress.md 已更新
```

## 3. 状态文件归档

```bash
# 1. 归档状态文件
mv .claude/teams/{team-name}/status.md \
   docs/archive/{date}-{team-name}-status.md

# 2. 归档任务文件
mv .claude/teams/{team-name}/tasks/completed/* \
   docs/archive/tasks/{team-name}/

# 3. 保留 checklist.yaml 作为模板（可选）
cp .claude/teams/{team-name}/checklist.yaml \
   .claude/templates/checklist-{type}.yaml
```

## 3. 通知团队成员

```typescript
SendMessage({
  to: "*", // 广播给所有成员
  message: "项目已完成，准备关闭团队。感谢大家的贡献！"
})
```

## 关闭注意事项

**TeamDelete 可能需要多次尝试**：
- teammates 收到 shutdown_request 后可能需要时间响应
- 如果 TeamDelete 返回仍有活跃成员，等待几秒后重试
- 最多重试 3 次，如仍失败则再次发送 shutdown_request

**示例**：
```typescript
// 发送关闭请求
SendMessage({ to: "frontend-dev", type: "shutdown_request" })
SendMessage({ to: "ui-designer", type: "shutdown_request" })

// 等待响应
sleep(2000)

// 尝试关闭（可能需要多次）
TeamDelete({ team_name: "bug-fix-squad" })
```

## 4. 关闭团队

```typescript
// 等待所有成员确认关闭
TeamDelete({ team_name: "shotgroup-bugfix" })
```

## 5. 更新项目文档

```typescript
// 更新 progress.md
Edit({
  file_path: "/docs/progress.md",
  content: "添加完成的项目总结"
})
```

## 清理检查点

| 检查项 | 说明 | 命令/操作 |
|--------|------|-----------|
| **停止心跳** | Cron 已停止 | CronDelete |
| 任务归档 | 所有任务标记为 completed | TaskList 检查 |
| 状态归档 | status.md 移动到 archive | mv 命令 |
| 产出物归档 | 代码、文档、报告已保存 | 文件检查 |
| 团队关闭 | TeamDelete 成功执行 | TeamDelete 命令 |
| 进度更新 | progress.md 已更新 | Edit 命令 |

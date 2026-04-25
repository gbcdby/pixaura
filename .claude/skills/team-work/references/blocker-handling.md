# 阻塞处理机制

当队友遇到阻塞时，必须遵循以下流程：

## 1. 阻塞发现

队友遇到阻塞时，应主动发送消息：
```json
{"type": "blocker", "reason": "接口未对齐", "blocked_by": "backend-dev"}
```

调度者也应定期检查 status.md 中的阻塞记录。

## 2. 阻塞记录

调度者必须将阻塞记录到 `status.md`：

```markdown
## 阻塞记录

| 时间 | 问题 | 阻塞者 | 依赖方 | 状态 |
|------|------|--------|--------|------|
| 09:30 | 接口未对齐 | frontend-dev | backend-dev | 等待修改 |
```

## 3. 阻塞解决流程

```
发现阻塞 → 记录到 status.md → 通知依赖方 → 跟踪进度 → 解决后更新状态
```

## 4. 阻塞升级

如果阻塞超过 **30 分钟**未解决，调度者应：
- 介入协调
- 重新分配任务
- 或调整项目计划

## 阻塞消息格式

### 队友发送阻塞

```typescript
SendMessage({
  to: "team-lead",
  type: "blocker",
  content: {
    task_id: "3",
    reason: "接口返回格式与文档不符",
    blocked_by: "backend-dev",
    since: "09:30",
    severity: "high" // high | medium | low
  }
})
```

### 调度者响应

```typescript
SendMessage({
  to: "backend-dev",
  content: "Task #3 被阻塞，需要调整接口返回格式..."
})
```

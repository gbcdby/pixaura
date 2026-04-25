# Teammate 心跳状态模板

## 文件位置

`{project-root}/.claude/teams/{team-name}/heartbeat.md`

## 格式

```markdown
# Teammate 心跳状态

**团队**: {team-name}
**创建时间**: {创建时间}
**检查间隔**: 5 分钟

| Teammate | 最后活跃时间 | 当前任务 | 状态 |
|----------|-------------|---------|------|
| {teammate-name} | {YYYY-MM-DD HH:mm} | {任务描述} | 正常/阻塞/无响应 |
```

## 更新时机

1. **收到消息** — teammate 发送任何消息时更新
2. **收到 idle_notification** — teammate 进入空闲时更新
3. **分配任务** — 给 teammate 分配新任务时更新
4. **任务完成** — teammate 完成任务时更新状态为"已完成"

## 状态判断

| 状态 | 判断条件 | 操作 |
|------|---------|------|
| 正常 | 最后活跃时间 < 5 分钟 | 无需操作 |
| 超时 | 最后活跃时间 > 5 分钟 | SendMessage 询问状态 |
| 阻塞 | teammate 报告阻塞 | 更新 status.md，协调解决 |
| 无响应 | 询问后 3 分钟无回复 | 考虑重新分配任务 |

## 示例

```markdown
# Teammate 心跳状态

**团队**: storyboard-bug-fix
**创建时间**: 2026-04-04 12:00
**检查间隔**: 5 分钟

| Teammate | 最后活跃时间 | 当前任务 | 状态 |
|----------|-------------|---------|------|
| frontend-developer | 2026-04-04 12:50 | Bug 1 修复 | 正常 |
| backend-developer | 2026-04-04 12:45 | Bug 4 修复 | 正常 |
| qa-validator | 2026-04-04 12:30 | 等待开发完成 | 正常 |
```

---
日期: 2026-04-04
来源: team-work skill 改进 - 心跳检查机制
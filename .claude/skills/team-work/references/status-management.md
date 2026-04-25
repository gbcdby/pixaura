# 状态管理指南

Agent Team 模式的文件存储方案和状态管理规范。

---

## 存储方案

### 系统自动创建（全局目录）

```
~/.claude/teams/{team-name}/
├── config.json          # 团队配置（成员列表、创建时间等）
└── tasks/               # 任务目录（TaskCreate 自动创建）
    ├── task-1.json
    ├── task-2.json
    └── ...
```

**特点**：
- 系统自动创建和维护
- 存储在 `~/.claude/` 目录下（全局）
- 包含团队配置和任务列表

---

### 调度者手动维护（项目目录）

```
{project-root}/.claude/teams/{team-name}/
├── status.md            # 团队状态总览（必须维护）
├── heartbeat.md         # 心跳状态追踪
└── checklist.yaml       # 产出物检查清单
```

**特点**：
- 调度者手动创建和更新
- 存储在项目目录下（可版本控制）
- 用于追踪项目状态和协调

---

## status.md 模板

```markdown
# Team: {team-name}

> 创建时间: {YYYY-MM-DD HH:mm}
> 最后更新: {YYYY-MM-DD HH:mm}
> 当前阶段: {strategy|req|design|reviewing|approved|dev|integrating|qa|done}

---

## 阶段状态机

```
需求分析 → 策略制定 → 详细设计 → 设计评审 → 开发 → 联调 → 测试 → 完成
   {status}      {status}       {status}       {status}    {status}  {status}  {status}  {status}
```

---

## 任务清单

| ID | 任务 | 负责人 | 状态 | 产出物 | 检查点 |
|----|------|--------|------|--------|--------|
| 1 | {task-name} | {owner} | {status} | {artifact} | {checkpoint} |

---

## 阻塞记录

| 时间 | 问题 | 阻塞者 | 依赖方 | 状态 |
|------|------|--------|--------|------|
| {time} | {problem} | {blocked} | {depends_on} | {status} |

---

## 阶段产出物检查

### {current_stage} 阶段

- [ ] {artifact-1}
- [ ] {artifact-2}
- [ ] {artifact-3}

---

## 下一步行动

1. {action-1}
2. {action-2}
3. {action-3}

---

## 变更日志

| 时间 | 变更内容 | 变更人 |
|------|----------|--------|
| {time} | {change} | {who} |
```

---

## heartbeat.md 模板

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

---

## checklist.yaml 模板

```yaml
# 产出物检查清单
teams:
  video-generation:
    strategy:
      artifacts:
        - path: /state/prd.md
          required: true
          description: 产品策略文档
    req:
      artifacts:
        - path: /docs/design/video-generation/index.md
          required: true
          description: 设计文档总览
        - path: /docs/design/video-generation/db.md
          required: true
          description: 数据库设计
        - path: /docs/design/video-generation/api.md
          required: true
          description: 接口定义
    dev:
      artifacts:
        - path: apps/api/src/modules/video/
          required: true
          description: 后端代码
        - path: apps/web/src/modules/video/
          required: true
          description: 前端代码
```

---

## 状态更新时机

| 时机 | 操作 | 更新文件 |
|------|------|---------|
| 创建团队 | 初始化 status.md | status.md |
| 阶段推进 | 更新阶段标记 | status.md |
| 任务分配 | 更新任务负责人 | status.md |
| 任务完成 | 更新任务状态 | status.md |
| 发现阻塞 | 添加阻塞记录 | status.md |
| 收到消息 | 更新最后活跃时间 | heartbeat.md |
| 项目完成 | 更新为 done 状态 | status.md |

---

## 状态一致性检查

调度者应定期检查：

1. **Task 列表 vs status.md** 是否一致
2. **阶段标记** 是否与当前任务状态匹配
3. **阻塞记录** 是否有过期未处理的
4. **产出物** 是否已生成

参见：[state-consistency-check.md](state-consistency-check.md)

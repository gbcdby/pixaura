# 状态一致性检查指南

每次检查团队状态时，必须验证以下一致性，避免信息不同步导致决策错误。

## 检查清单

### 1. 团队成员一致性
**对比**: `status.md` vs `config.json`

```bash
# 检查 config.json 中的成员
Read({ file_path: "~/.claude/teams/{team-name}/config.json" })

# 对比 status.md 中的成员表格
Read({ file_path: ".claude/teams/{team-name}/status.md" })
```

**不一致处理**:
1. 以 `config.json` 为准（它是系统权威）
2. 更新 `status.md` 同步成员信息
3. 记录变更原因到「最近更新」章节

**常见场景**:
- 状态文件中提到 qa-validator，但 config.json 中没有该成员
- 某成员已分配任务但未在状态文件中记录

---

### 2. 阶段状态一致性
**对比**: `status.md` 中的阶段 vs `TaskList` 中的任务状态

```typescript
// 读取阶段
Read({ file_path: ".claude/teams/{team-name}/status.md" })
// 查找: **阶段**: xxx

// 读取任务状态
TaskList({})
```

**不一致判断**:
- 如果所有任务 completed，但阶段不是 `done` → 需要更新阶段
- 如果有 in_progress 任务，但阶段显示为已完成 → 需要修正阶段

**处理原则**:
- 以任务实际状态为准
- 阶段应反映真实进度

---

### 3. 产出物一致性
**对比**: `status.md` 中的产出物清单 vs 实际文件存在性

```bash
# 检查产出物是否真实存在
Read({ file_path: "docs/test-report/{module}/report.md" })
Read({ file_path: "docs/design/{module}/index.md" })
```

**不一致处理**:
- 如果文件不存在，将产出物标记为 `⏳ 进行中` 或 `❌ 未开始`
- 如果文件已完成，确保标记为 `✅ 已完成`

---

### 4. Bug修复专用检查
对于 Bug 修复类团队，额外检查：

```markdown
| Bug | 状态 | 代码提交 | 实际提交 |
|-----|------|----------|----------|
| #1 | ✅ 完成 | fc256c1 | git log 验证 |
```

**验证方式**:
```bash
git log --oneline -5
```

---

## 快速检查命令

```typescript
// 完整的团队状态检查流程
function checkTeamStatus(teamName: string) {
  // 1. 读取配置
  Read({ file_path: `~/.claude/teams/${teamName}/config.json` })

  // 2. 读取状态
  Read({ file_path: `.claude/teams/${teamName}/status.md` })

  // 3. 读取任务
  TaskList({})

  // 4. 检查代码提交（如有需要）
  Bash({ command: "git log --oneline -5" })
}
```

---

## 检查报告模板

发现不一致时，记录格式：

```markdown
### ⚠️ 状态不一致发现

| 检查项 | 期望值 | 实际值 | 处理方式 |
|--------|--------|--------|----------|
| 团队成员 | config.json 为准 | status.md 多出 qa-validator | 更新 status.md |
| 阶段 | done (任务已完成) | qa (测试中) | 更新为 done |

**已修正**: ✅
```

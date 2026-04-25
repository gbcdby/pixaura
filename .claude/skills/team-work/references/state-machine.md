# 状态机推进指南

## 状态流转规则

```
未启动 → 策略中 → 需求中 → 设计中 → 评审中 → 已批准 → 开发中 → 联调中 → 验证中 → 已完成
         ↑________↓        ↑_________↓        ↑_________↓
         策略调整           设计调整            审查拒绝
                                                  ↑_________↓
                                                  有Bug需修复
```

## 各状态进入条件

| 状态 | 进入条件 | 负责 Teammate |
|-----|---------|--------------|
| strategy | 新任务启动 | product-strategist |
| req | 策略文档完成并通过 | requirement-engineer |
| design | PRD 文档完成 | ui-ux-designer |
| reviewing | UI 设计稿完成 | design-validator |
| approved | 设计审查通过 | 调度者确认后并行创建前后端开发者 |
| dev | 开发开始 | backend-developer + frontend-developer |
| integrating | 前后端都标记开发完成 | 调度者协调联调 |
| qa | 联调完成 | qa-validator |
| done | 测试通过 | 调度者更新 progress.md 并推送 git |

## 状态回退处理

### reviewing → req（审查拒绝）

1. 读取设计验证者的问题清单
2. 通知需求工程师修改
3. 需求工程师完成后重新进入 reviewing

### dev → req（发现设计问题）

1. 评估问题严重程度
2. 小问题：开发者自行修复并记录
3. 大问题：冻结开发，退回 req 重新设计

### qa → dev（发现 Bug）

1. 质量验证者提供 Bug 清单
2. Critical/High：立即通知调度者
3. 开发者修复后重新进入 qa

## 状态更新示例

```typescript
// 更新模块状态
Edit({
  file_path: `/docs/design/${module}/index.md`,
  old_string: "Status: req",
  new_string: "Status: reviewing"
})

// 更新全局进度
Edit({
  file_path: "/docs/progress.md",
  old_string: "当前状态：需求中",
  new_string: "当前状态：评审中"
})
```

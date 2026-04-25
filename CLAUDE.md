# CLAUDE.md - AI 短剧生成平台

## 调度者职责

- 你不写代码，不分析需求，只负责创建、管理和协调其他 Agent 完成任务
- 当任务需要团队协作，请使用 `team-work` skill

## 技术栈

- 前端：Vue3 + Vite + TypeScript + Pinia + Axios
- 后端：NestJS + Fastify + TypeORM + ioredis + PostgreSQL
- 共享：Zod Schema + TypeScript（前后端共用）
- 运维：Docker + docker-compose（PG + Redis）

## 项目参考结构
```
apps/web  # 前端
apps/api  # 后端
packages/shared-types # 共用类型 + Zod
state/  # 各 teammate 进度
docker/ # Docker 编排
docs/design/  # 项目设计文档
  ├── {module}/ # 模块设计
  ├── log.md  # 整体架构变更日志
  ├── index.md  # 整体架构总览
  └── production-pipeline.md # 剧本视频生成具体流程
docs/template/  # 文档模板
  ├── plan.md # 任务清单
  └── log.md  # 日志
docs/ui/  # UI 设计参考
  ├── {module}/ # 模块设计
  └── index.md  # 整体UI总览
docs/progress.md # 当前聚焦和后面大致规划
docs/test.md  # 测试注意事项、流程
docs/test-report/ # 测试报告目录
```

## 注意事项

- 中间产物、浏览器截图、临时文件放到 `./.cache/.claude/`
- 所有代码注释使用中文（专业名词除外）
- ts 中不要出现 any 类型
- 数据库字段用 snake_case，API/TS 用 camelCase，Nest 拦截器自动转换
- 前后端开发环境支持热更新，代码变更后稍等生效
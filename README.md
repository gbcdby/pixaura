# Pixaura - AI 短剧生成平台

## 技术栈
- **Monorepo**: pnpm workspace
- **前端**: Vue 3.5 + Vite 6 + Pinia 3 + TypeScript 5
- **后端**: NestJS 10 + Fastify + TypeORM + ioredis + TypeScript 5
- **数据库**: PostgreSQL 18 + Redis 8.4 (Docker)
- **验证**: Zod

## Docker 一键部署（推荐）

无需安装 Node.js / pnpm，仅需 Docker。

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，配置以下必填项：
#   - NGROK_AUTHTOKEN（ngrok 内网穿透 token，用于外部回调服务）
#   - JWT_SECRET（生产环境请修改）
#   - 其他按需配置（SMS、OSS、邮件等）
```

### 2. 一键启动

```bash
# 使用 pnpm 脚本（推荐）
pnpm docker:up

# 或直接使用 docker compose
# docker compose -f docker/docker-compose.yml --profile full up -d --build
```

### 3. 日常启动（不复建镜像）

```bash
pnpm docker:start

# 或直接使用 docker compose
# docker compose -f docker/docker-compose.yml --profile full up -d
```

### 4. 访问应用

打开浏览器访问 `http://localhost`

首次启动会自动完成数据库迁移和初始数据种子化。

> **默认管理员账号**
>
> 系统初始化时会自动创建一个超级管理员用户：
> - 用户名：`admin`
> - 密码：`admin123`
>
> **⚠️ 安全提示：首次登录后请务必在「个人设置」中修改默认密码！**

> 代码更新后需重新构建：`pnpm docker:up` 或 `docker compose -f docker/docker-compose.yml --profile full up -d --build`。详见下方「脚本命令」。

### 数据持久化

Docker 部署使用以下数据卷，服务重启或升级不会丢失数据：

| 数据 | 卷名 | 说明 |
|------|------|------|
| PostgreSQL 数据 | `postgres_data` | 用户、项目、剧本等所有业务数据 |
| Redis 数据 | `redis_data` | AOF 持久化 |
| 上传文件 | `uploads_data` | 图片、视频等本地存储文件（当 STORAGE_TYPE=local 时） |

### 环境变量说明

Docker 部署只需维护一份 `.env` 文件，docker-compose 会自动读取。以下变量在容器内会被自动覆盖，无需在 `.env` 中修改：

| 变量 | Docker 内的值 | 说明 |
|------|--------------|------|
| `DATABASE_HOST` | `postgres` | 通过 Docker 网络连接数据库 |
| `REDIS_HOST` | `redis` | 通过 Docker 网络连接 Redis |
| `APP_URL` | `http://api:3000` | 后端服务内部地址 |
| `WEB_URL` | `http://localhost` | 前端访问地址 |
| `LOCAL_STORAGE_DIR` | `/app/uploads` | 容器内上传目录 |
| `NGROK_API_URL` | `http://ngrok:4040` | ngrok 容器 API 地址 |

## 本地开发模式

如需本地开发（热更新、调试），按以下步骤：

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 配置你的环境变量
```

### 3. 启动数据库

```bash
pnpm db:up
```

### 4. 开发模式

```bash
# 分别启动前后端
pnpm dev:api    # http://localhost:3000
pnpm dev:web    # http://localhost:5173
```

## 脚本命令

### 根目录

```bash
pnpm build        # 构建所有包
pnpm lint         # 代码检查
pnpm format       # 格式化代码
pnpm typecheck    # 类型检查
pnpm test         # 运行测试

# Docker 部署
pnpm docker:up    # 构建并启动所有服务（首次/代码更新后）
pnpm docker:start # 直接启动所有服务（不复建，日常使用）
pnpm docker:down  # 停止所有服务
pnpm docker:build # 重新构建镜像
pnpm docker:logs  # 查看服务日志

# 开发数据库（仅 postgres + redis）
pnpm db:up        # 启动开发数据库
pnpm db:down      # 停止开发数据库
pnpm db:logs      # 查看数据库日志
```

### 后端

```bash
cd apps/api
pnpm dev                    # 开发模式
pnpm db:migrate             # 运行 migration
pnpm db:migrate:revert      # 回滚 migration
pnpm db:generate            # 生成 migration
```


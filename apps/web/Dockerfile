# Pixaura Web - Vue3 前端 Docker 镜像
# 多阶段构建：阶段1 编译，阶段2 基于 nginx 服务静态文件

# ==================== 阶段1: 构建 ====================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm@10.5.2

# 复制 workspace 配置文件和锁文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/web/package.json ./apps/web/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web

# 构建共享类型包
RUN pnpm --filter=@pixaura/shared-types build

# 构建前端（生产模式，API 使用相对路径）
ENV NODE_ENV=production
RUN pnpm --filter=@pixaura/web build

# ==================== 阶段2: 运行（nginx） ====================
FROM nginx:alpine

# 复制前端构建产物到 nginx 默认目录
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# 复制自定义 nginx 配置
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 80 端口
EXPOSE 80

# 健康检查（Alpine 容器内 localhost 可能无法解析，使用 127.0.0.1）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1

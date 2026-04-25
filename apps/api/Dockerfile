# Pixaura API - NestJS 后端 Docker 镜像
# 多阶段构建：阶段1 编译，阶段2 精简运行镜像

# ==================== 阶段1: 构建 ====================
FROM node:22-alpine AS builder

WORKDIR /app

# 安装 pnpm 和原生模块编译依赖（使用阿里云镜像避免 CDN 问题）
RUN npm install -g pnpm@10.5.2
RUN echo "http://mirrors.aliyun.com/alpine/v3.23/main" > /etc/apk/repositories && \
    echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories && \
    apk update && apk add --no-cache python3 make g++

# 复制 workspace 配置文件和锁文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# 安装所有依赖（包含 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api

# 构建共享类型包
RUN pnpm --filter=@pixaura/shared-types build

# 构建 API（先清理缓存避免增量构建跳过，使用 --tsc 确保输出文件到磁盘）
RUN cd apps/api && rm -f tsconfig.tsbuildinfo && rm -rf dist && npx nest build --tsc

# ==================== 阶段2: 运行 ====================
FROM node:22-alpine AS runner

WORKDIR /app

# 安装 pnpm、postgresql-client（pg_isready 用于 entrypoint 等待数据库）和 dumb-init
RUN npm install -g pnpm@10.5.2 && \
    echo "http://mirrors.aliyun.com/alpine/v3.23/main" > /etc/apk/repositories && \
    echo "http://mirrors.aliyun.com/alpine/v3.23/community" >> /etc/apk/repositories && \
    apk update && apk add --no-cache postgresql16-client dumb-init

# 复制 workspace 配置文件
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# 复制构建产物
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/apps/api/dist ./dist

# 只安装生产依赖（使用 shamefully-hoist 将依赖扁平化到 node_modules）
RUN pnpm install --frozen-lockfile --prod --shamefully-hoist

# 确保上传目录存在
RUN mkdir -p /app/uploads/temp

# 暴露 API 端口
EXPOSE 3000

# 健康检查（Alpine 容器内 localhost 可能无法解析，使用 127.0.0.1）
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/docs || exit 1

# 入口脚本
COPY apps/api/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["dumb-init", "--", "docker-entrypoint.sh"]

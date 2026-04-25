#!/bin/sh
set -e

# 等待 PostgreSQL 就绪
echo "等待 PostgreSQL 就绪..."
until pg_isready -h "$DATABASE_HOST" -p "${DATABASE_PORT:-5432}" -U "${DATABASE_USER:-pixaura}" > /dev/null 2>&1; do
  echo "PostgreSQL 尚未就绪，等待 2 秒..."
  sleep 2
done
echo "PostgreSQL 已就绪"

# 兼容种子脚本的环境变量名
export DB_HOST="${DATABASE_HOST}"
export DB_PORT="${DATABASE_PORT:-5432}"
export DB_USER="${DATABASE_USER:-pixaura}"
export DB_PASS="${DATABASE_PASSWORD:-pixaura123}"
export DB_NAME="${DATABASE_NAME:-pixaura}"

# 执行数据库迁移
echo "执行数据库迁移..."
node dist/database/run-migrations.js

# 执行种子数据初始化（幂等，可重复执行）
echo "执行种子数据初始化..."
node dist/database/seeds/seed.js || echo "种子脚本执行失败，继续启动服务..."

# 启动 NestJS 应用
echo "启动 NestJS 应用..."
exec node dist/main.js

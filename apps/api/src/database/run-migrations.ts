/**
 * 数据库迁移执行脚本
 * 替代 typeorm CLI，避免 ES Module 配置问题
 *
 * 策略：迁移即唯一真相。所有表结构变更通过迁移文件管理，不依赖 synchronize()。
 */

import { AppDataSource } from "./data-source";

async function runMigrations(): Promise<void> {
  try {
    await AppDataSource.initialize();
    console.log("数据库连接成功");

    console.log("开始执行迁移...");
    // PostgreSQL 中 DDL 语句（CREATE TABLE / CREATE INDEX 等）会隐式提交事务，
    // 在事务中执行会导致不可预期的行为。因此禁用事务模式。
    const result = await AppDataSource.runMigrations({ transaction: "none" });

    if (result.length === 0) {
      console.log("没有待执行的迁移");
    } else {
      console.log(`成功执行 ${result.length} 个迁移:`);
      result.forEach((m) => console.log(`  - ${m.name}`));
    }

    await AppDataSource.destroy();
    console.log("数据库连接已关闭");
    process.exit(0);
  } catch (error) {
    console.error("迁移执行失败:", error);
    await AppDataSource.destroy().catch(() => {});
    process.exit(1);
  }
}

runMigrations();

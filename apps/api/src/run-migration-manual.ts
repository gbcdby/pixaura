import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "pixaura",
  password: process.env.DATABASE_PASSWORD || "pixaura123",
  database: process.env.DATABASE_NAME || "pixaura",
  entities: [],
  synchronize: false,
});

async function runMigration() {
  try {
    await dataSource.initialize();
    console.log("Database connected");

    // 检查表是否存在
    const tableExists = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'system_notices'
      );
    `);

    if (tableExists[0].exists) {
      console.log("Table system_notices already exists");
    } else {
      console.log("Creating system_notices table...");

      // 创建表
      await dataSource.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE system_notices (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          title varchar(200) NOT NULL,
          content text NOT NULL,
          type enum('maintenance', 'feature', 'important', 'other') DEFAULT 'other' NOT NULL,
          priority enum('high', 'medium', 'low') DEFAULT 'medium' NOT NULL,
          status enum('draft', 'published', 'unpublished') DEFAULT 'draft' NOT NULL,
          start_at timestamptz NOT NULL,
          end_at timestamptz NULL,
          is_top boolean DEFAULT false NOT NULL,
          view_count int DEFAULT 0 NOT NULL,
          created_by uuid NOT NULL,
          created_at timestamptz DEFAULT NOW() NOT NULL,
          updated_at timestamptz DEFAULT NOW() NOT NULL,
          deleted_at timestamptz NULL
        );

        CREATE INDEX idx_notices_status_time ON system_notices(status, start_at, end_at);
        CREATE INDEX idx_notices_priority ON system_notices(priority, start_at);
        CREATE INDEX idx_notices_created_by ON system_notices(created_by);

        ALTER TABLE system_notices
        ADD CONSTRAINT fk_notices_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
      `);

      console.log("Table system_notices created successfully");
    }

    // 插入 migration 记录
    const migrationExists = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM migrations
        WHERE name = 'CreateSystemNoticesTable1773000000000'
      );
    `);

    if (!migrationExists[0].exists) {
      await dataSource.query(`
        INSERT INTO migrations (name, timestamp)
        VALUES ('CreateSystemNoticesTable1773000000000', 1773000000000);
      `);
      console.log("Migration record inserted");
    }

    await dataSource.destroy();
    console.log("Migration completed");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

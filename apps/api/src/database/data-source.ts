import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import * as path from "path";

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "pixaura",
  password: process.env.DATABASE_PASSWORD || "pixaura123",
  database: process.env.DATABASE_NAME || "pixaura",
  entities: [path.join(__dirname, "..", "**", "*.entity{.ts,.js}")],
  migrations: [path.join(__dirname, "migrations", "*{.ts,.js}")],
  synchronize: false,
  logging: process.env.APP_ENV === "development",
});

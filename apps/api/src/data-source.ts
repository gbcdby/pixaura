import { DataSource } from "typeorm";

export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "pixaura",
  password: process.env.DATABASE_PASSWORD || "pixaura123",
  database: process.env.DATABASE_NAME || "pixaura",
  entities: ["src/**/*.entity.ts"],
  migrations: ["src/database/migrations/**/*.ts"],
  synchronize: false,
  logging: process.env.APP_ENV === "development",
});

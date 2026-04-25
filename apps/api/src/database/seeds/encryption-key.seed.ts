/**
 * 加密密钥初始化种子
 * 初始化系统加密密钥到数据库
 *
 * 使用方法:
 *   pnpm db:seed:encryption
 */

import { DataSource } from "typeorm";
import { SystemConfig } from "../../modules/system-admin/entities/system-config.entity";
import { User } from "../../modules/user/entities/user.entity";
import { EncryptionService } from "../../modules/model-config/services/encryption.service";

// 数据库配置
const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432"),
  username: process.env.DATABASE_USER || "pixaura",
  password: process.env.DATABASE_PASSWORD || "pixaura123",
  database: process.env.DATABASE_NAME || "pixaura",
  entities: [SystemConfig, User],
  synchronize: false,
});

async function seedEncryptionKey() {
  try {
    await dataSource.initialize();
    console.log("✓ 数据库连接成功");

    const configRepo = dataSource.getRepository(SystemConfig);

    // 检查是否已存在加密密钥
    const existingKey = await configRepo.findOne({
      where: { configKey: "security.encryption_key" },
    });

    if (existingKey?.configValue?.value) {
      console.log("✓ 加密密钥已存在，跳过初始化");
      console.log(
        "  提示: 如需重新生成密钥，请在管理后台更新 security.encryption_key 配置",
      );
      return;
    }

    // 获取一个存在的用户作为更新者
    const userResult = await dataSource.query(`SELECT id FROM users LIMIT 1`);
    const adminId =
      userResult.length > 0
        ? userResult[0].id
        : "00000000-0000-0000-0000-000000000001";

    // 生成新的加密密钥
    const encryptionService = new EncryptionService(configRepo, {
      getClient: () => ({
        get: async () => null,
        setex: async () => "OK",
        del: async () => 1,
      }),
    } as any);

    const newKey = encryptionService.generateKey();

    // 保存到数据库（使用 query builder 避免实体验证）
    await dataSource.query(
      `INSERT INTO system_config (config_key, config_value, description, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (config_key) DO NOTHING`,
      [
        "security.encryption_key",
        JSON.stringify({ value: newKey }),
        "API Key 加密密钥（AES-256-GCM）",
        adminId,
      ],
    );

    console.log("✓ 加密密钥已初始化并保存到数据库");
    console.log("  警告: 请务必备份此密钥，丢失后将无法解密已加密的 API Key！");
    console.log("  密钥可在管理后台的'系统配置'中查看和修改");
  } catch (error) {
    console.error("初始化失败:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// 运行种子
seedEncryptionKey();

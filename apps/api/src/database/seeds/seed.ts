/**
 * 数据库种子脚本
 * 用于初始化默认供应商和模型数据
 *
 * 使用方法:
 *   pnpm db:seed
 *
 * 特性:
 *   - 幂等性：多次执行不会重复创建
 *   - 跳过已存在的数据
 *   - 自动关联供应商和模型
 */

import { DataSource } from "typeorm";
import {
  Provider,
  AiModel,
  ModelProvider,
} from "../../modules/model-config/entities";
import { User } from "../../modules/user/entities/user.entity";
import { SubscriptionPricing, PricingHistory } from "../../modules/billing/entities/subscription-pricing.entity";
import { TtsVoiceEntity } from "../../modules/tts/entities/voice.entity";
import { TtsInstructionTemplateEntity } from "../../modules/tts/entities/instruction-template.entity";
import { QuotaConfig } from "../../modules/billing/entities/quota-config.entity";
import { seedProviders } from "./data/providers.seed";
import { seedModels } from "./data/models.seed";
import { seedAdminUser } from "./data/admin-user.seed";
import { seedSubscriptionPricing } from "./data/subscription-pricing.seed";
import { seedTtsVoices } from "./data/tts-voices.seed";
import { seedTtsInstructionTemplates } from "./data/tts-instruction-templates.seed";
import { seedQuotaConfig } from "./data/quota-config.seed";

// 创建数据源连接
const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER || "pixaura",
  password: process.env.DB_PASS || "pixaura123",
  database: process.env.DB_NAME || "pixaura",
  entities: [Provider, AiModel, ModelProvider, User, SubscriptionPricing, PricingHistory, TtsVoiceEntity, TtsInstructionTemplateEntity, QuotaConfig],
  synchronize: false,
});

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════");
  console.log("       数据库种子脚本 - 初始化数据");
  console.log("═══════════════════════════════════════════\n");

  try {
    await dataSource.initialize();
    console.log("✓ 数据库连接成功\n");

    console.log("─".repeat(40));
    console.log("开始初始化供应商...");
    console.log("─".repeat(40));
    await seedProviders(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化模型...");
    console.log("─".repeat(40));
    await seedModels(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化管理员用户...");
    console.log("─".repeat(40));
    await seedAdminUser(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化订阅价格...");
    console.log("─".repeat(40));
    await seedSubscriptionPricing(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化配额配置...");
    console.log("─".repeat(40));
    await seedQuotaConfig(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化TTS音色...");
    console.log("─".repeat(40));
    await seedTtsVoices(dataSource);

    console.log("\n" + "─".repeat(40));
    console.log("开始初始化TTS指令模板...");
    console.log("─".repeat(40));
    await seedTtsInstructionTemplates(dataSource);

    console.log("\n═══════════════════════════════════════════");
    console.log("          种子脚本执行完成！");
    console.log("═══════════════════════════════════════════");
  } catch (error) {
    console.error("\n✗ 种子脚本执行失败:", error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

// 直接执行
main();

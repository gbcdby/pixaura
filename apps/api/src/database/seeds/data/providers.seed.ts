/**
 * 默认供应商种子数据
 */

import { DataSource } from "typeorm";
import { Provider } from "../../../modules/model-config/entities/provider.entity";

export interface ProviderSeedData {
  providerId: string;
  providerName: string;
  providerType: "official" | "proxy" | "relay";
  baseUrl: string;
  authType: "api_key" | "aksk" | "oauth";
  checkConfig: Record<string, unknown>;
  rateLimitConfig: Record<string, unknown>;
}

export const defaultProviders: ProviderSeedData[] = [
  {
    providerId: "bailian",
    providerName: "阿里云百炼",
    providerType: "official",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    authType: "api_key",
    checkConfig: {
      interval: 30,
      timeout: 10,
    },
    rateLimitConfig: {
      requestsPerMinute: 100,
      burstAllowance: 15,
    },
  },
  {
    providerId: "evolink",
    providerName: "EvoLink",
    providerType: "official",
    baseUrl: "https://api.evolink.ai/v1",
    authType: "api_key",
    checkConfig: {
      interval: 30,
      timeout: 10,
    },
    rateLimitConfig: {
      requestsPerMinute: 100,
      burstAllowance: 15,
    },
  },
];

export async function seedProviders(dataSource: DataSource): Promise<void> {
  const providerRepo = dataSource.getRepository(Provider);
  let created = 0;
  let skipped = 0;

  for (const data of defaultProviders) {
    const existing = await providerRepo.findOne({
      where: { providerId: data.providerId },
    });

    if (existing) {
      console.log(
        `  ↷ 跳过已存在的供应商: ${data.providerName} (${data.providerId})`,
      );
      skipped++;
      continue;
    }

    const provider = providerRepo.create({
      providerId: data.providerId,
      providerName: data.providerName,
      providerType: data.providerType,
      baseUrl: data.baseUrl,
      authType: data.authType,
      apiKeyEnc: null,
      apiSecretEnc: null,
      status: "enabled",
      healthStatus: "unknown",
      checkConfig: data.checkConfig,
      rateLimitConfig: data.rateLimitConfig,
    });

    await providerRepo.save(provider);
    console.log(`  ✓ 创建供应商: ${data.providerName} (${data.providerId})`);
    created++;
  }

  console.log(`\n供应商: ${created} 个已创建, ${skipped} 个已跳过`);
}

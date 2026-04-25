/**
 * 默认配额配置种子数据
 */

import { DataSource } from "typeorm";
import {
  QuotaConfig,
  QuotaTargetType,
  QuotaCycleType,
} from "../../../modules/billing/entities/quota-config.entity";
import { SubscriptionTier } from "../../../modules/billing/entities/subscription.entity";
import { defaultModels } from "./models.seed";

export interface QuotaSeedData {
  tier: SubscriptionTier;
  cycleType: QuotaCycleType;
  targetType: QuotaTargetType;
  targetId: string;
  quotaValue: number;
}

/** 模型级别配额 */
const modelQuotas: QuotaSeedData[] = [
  // OmniHuman1.5 —— 对口型模型
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 3,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 30,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "OmniHuman1.5",
    quotaValue: 200,
  },

  // qwen3-tts-flash —— TTS 语音模型
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 20,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 300,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-flash",
    quotaValue: 1000,
  },

  // qwen3-tts-instruct-flash —— TTS 指令语音模型
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 20,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 300,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.MODEL,
    targetId: "qwen3-tts-instruct-flash",
    quotaValue: 1000,
  },
];

/** 按类别统一的默认模型级别配额 */
const defaultModelQuotaByCategory: Record<
  string,
  Record<string, { small: number; large: number }>
> = {
  TEXT_GENERATION: {
    free: { small: 50, large: 500 },
    basic: { small: 200, large: 2000 },
    pro: { small: 500, large: 10000 },
  },
  IMAGE_GENERATION: {
    free: { small: 10, large: 50 },
    basic: { small: 30, large: 200 },
    pro: { small: 100, large: 1000 },
  },
  VIDEO_GENERATION: {
    free: { small: 3, large: 10 },
    basic: { small: 10, large: 50 },
    pro: { small: 30, large: 200 },
  },
  AUDIO_GENERATION: {
    free: { small: 10, large: 50 },
    basic: { small: 30, large: 200 },
    pro: { small: 100, large: 1000 },
  },
  VOICE_GENERATION: {
    free: { small: 20, large: 100 },
    basic: { small: 50, large: 300 },
    pro: { small: 100, large: 1000 },
  },
};

/** 从模型种子动态生成模型级别配额 */
const dynamicModelQuotas: QuotaSeedData[] = [];
for (const model of defaultModels) {
  const quotas = defaultModelQuotaByCategory[model.category];
  if (!quotas) continue;

  for (const [tier, values] of Object.entries(quotas)) {
    dynamicModelQuotas.push({
      tier: tier as SubscriptionTier,
      cycleType: QuotaCycleType.SMALL,
      targetType: QuotaTargetType.MODEL,
      targetId: model.modelId,
      quotaValue: values.small,
    });
    dynamicModelQuotas.push({
      tier: tier as SubscriptionTier,
      cycleType: QuotaCycleType.LARGE,
      targetType: QuotaTargetType.MODEL,
      targetId: model.modelId,
      quotaValue: values.large,
    });
  }
}

/** 类别级别配额 */
const categoryQuotas: QuotaSeedData[] = [
  // TEXT_GENERATION
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 500,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 200,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 2000,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 500,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "TEXT_GENERATION",
    quotaValue: 10000,
  },

  // IMAGE_GENERATION
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 30,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 200,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "IMAGE_GENERATION",
    quotaValue: 1000,
  },

  // VIDEO_GENERATION
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 3,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 30,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VIDEO_GENERATION",
    quotaValue: 200,
  },

  // AUDIO_GENERATION
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 10,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 30,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 200,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "AUDIO_GENERATION",
    quotaValue: 1000,
  },

  // VOICE_GENERATION
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 20,
  },
  {
    tier: SubscriptionTier.FREE,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 50,
  },
  {
    tier: SubscriptionTier.BASIC,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 300,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.SMALL,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 100,
  },
  {
    tier: SubscriptionTier.PRO,
    cycleType: QuotaCycleType.LARGE,
    targetType: QuotaTargetType.CATEGORY,
    targetId: "VOICE_GENERATION",
    quotaValue: 1000,
  },
];

export const defaultQuotaConfigs: QuotaSeedData[] = [
  ...modelQuotas,
  ...dynamicModelQuotas,
  ...categoryQuotas,
];

export async function seedQuotaConfig(dataSource: DataSource): Promise<void> {
  const quotaRepo = dataSource.getRepository(QuotaConfig);
  let created = 0;
  let skipped = 0;

  for (const data of defaultQuotaConfigs) {
    const existing = await quotaRepo.findOne({
      where: {
        tier: data.tier,
        cycleType: data.cycleType,
        targetType: data.targetType,
        targetId: data.targetId,
      },
    });

    if (existing) {
      console.log(
        `  ↷ 跳过已存在的配额配置: ${data.targetId} (${data.tier} / ${data.cycleType})`,
      );
      skipped++;
      continue;
    }

    const config = quotaRepo.create({
      tier: data.tier,
      cycleType: data.cycleType,
      targetType: data.targetType,
      targetId: data.targetId,
      quotaValue: data.quotaValue,
      isActive: true,
    });

    await quotaRepo.save(config);
    console.log(
      `  ✓ 创建配额配置: ${data.targetId} (${data.tier} / ${data.cycleType}) = ${data.quotaValue}`,
    );
    created++;
  }

  console.log(`\n配额配置: ${created} 个已创建, ${skipped} 个已跳过`);
}

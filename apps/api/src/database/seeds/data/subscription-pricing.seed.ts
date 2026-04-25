/**
 * 订阅价格种子数据
 */

import { DataSource } from "typeorm";
import { User } from "../../../modules/user/entities/user.entity";
import {
  SubscriptionPricing,
  SubscriptionTier,
  SubscriptionPeriod,
} from "../../../modules/billing/entities/subscription-pricing.entity";

export async function seedSubscriptionPricing(
  dataSource: DataSource,
): Promise<void> {
  const pricingRepo = dataSource.getRepository(SubscriptionPricing);
  const userRepo = dataSource.getRepository(User);

  // 获取管理员用户ID作为 updatedBy
  const admin = await userRepo.findOne({ where: { username: "admin" } });
  const adminId = admin?.id;
  if (!adminId) {
    console.log("  ⚠ 管理员用户不存在，跳过订阅价格初始化");
    return;
  }

  const pricingConfigs = [
    {
      tier: SubscriptionTier.BASIC,
      period: SubscriptionPeriod.MONTHLY,
      price: 29,
      originalPrice: 39,
    },
    {
      tier: SubscriptionTier.BASIC,
      period: SubscriptionPeriod.YEARLY,
      price: 299,
      originalPrice: 468,
    },
    {
      tier: SubscriptionTier.PRO,
      period: SubscriptionPeriod.MONTHLY,
      price: 99,
      originalPrice: 129,
    },
    {
      tier: SubscriptionTier.PRO,
      period: SubscriptionPeriod.YEARLY,
      price: 999,
      originalPrice: 1548,
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const config of pricingConfigs) {
    const existing = await pricingRepo.findOne({
      where: { tier: config.tier, period: config.period },
    });

    if (existing) {
      console.log(
        `  ↷ 跳过已存在的订阅价格: ${config.tier} / ${config.period}`,
      );
      skipped++;
      continue;
    }

    const pricing = pricingRepo.create({
      tier: config.tier,
      period: config.period,
      price: config.price,
      originalPrice: config.originalPrice,
      isActive: true,
      version: 0,
      updatedBy: adminId,
    });

    await pricingRepo.save(pricing);
    console.log(
      `  ✓ 创建订阅价格: ${config.tier} / ${config.period} = ${config.price}元 (原价 ${config.originalPrice}元)`,
    );
    created++;
  }

  console.log(`\n订阅价格: ${created} 个已创建, ${skipped} 个已跳过`);
}

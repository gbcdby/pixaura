import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  Subscription,
  QuotaConfig,
  QuotaUsage,
  RechargeOrder,
  BalanceRecord,
  RechargePromotion,
} from "./entities";
import { TextGenQuotaRecord } from "./entities/text-gen-quota-record.entity";
import { AiModel } from "../model-config/entities/ai-model.entity";
import { User } from "../user/entities/user.entity";
import {
  SubscriptionPricing,
  PricingHistory,
} from "./entities/subscription-pricing.entity";
import * as services from "./services";
import * as controllers from "./controllers";
import { UserModule } from "../user/user.module";
import { RedlockService } from "../../common/services/redlock.service";
import { RedisModule } from "../../common/redis/redis.module";

/**
 * 计费模块
 * 提供额度管理、订阅管理、余额管理等功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      QuotaConfig,
      QuotaUsage,
      RechargeOrder,
      BalanceRecord,
      RechargePromotion,
      SubscriptionPricing,
      PricingHistory,
      AiModel,
      User,
      TextGenQuotaRecord,
    ]),
    UserModule,
    RedisModule,
  ],
  controllers: Object.values(controllers),
  providers: [...Object.values(services), RedlockService],
  exports: [...Object.values(services), RedlockService],
})
export class BillingModule {}

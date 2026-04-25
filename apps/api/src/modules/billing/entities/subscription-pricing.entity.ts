import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from "typeorm";
import { PricingHistory } from "./pricing-history.entity";

/**
 * 订阅等级枚举
 */
export enum SubscriptionTier {
  BASIC = "basic", // 普通订阅
  PRO = "pro", // 专业订阅
}

/**
 * 订阅周期枚举
 */
export enum SubscriptionPeriod {
  MONTHLY = "monthly", // 月度
  YEARLY = "yearly", // 年度
}

/**
 * 订阅价格配置实体
 * 存储当前生效的订阅价格配置
 */
@Entity("subscription_pricing")
@Unique("idx_subscription_pricing_tier_period", ["tier", "period"])
@Index("idx_subscription_pricing_active", ["isActive"])
export class SubscriptionPricing {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "varchar",
    length: 20,
    enum: SubscriptionTier,
  })
  tier: SubscriptionTier;

  @Column({
    type: "varchar",
    length: 10,
    enum: SubscriptionPeriod,
  })
  period: SubscriptionPeriod;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    name: "original_price",
    nullable: true,
  })
  originalPrice: number | null;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @Column({ type: "int", default: 0 })
  version: number;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @Column("uuid", { name: "updated_by" })
  updatedBy: string;

  @OneToMany(() => PricingHistory, (history) => history.pricing)
  histories: PricingHistory[];
}

// 导出 PricingHistory 供 module 使用
export { PricingHistory };

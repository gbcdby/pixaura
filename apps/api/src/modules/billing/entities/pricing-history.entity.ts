import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { SubscriptionPricing } from "./subscription-pricing.entity";

/**
 * 价格变更历史实体
 * 记录每次价格变更的详细信息
 */
@Entity("pricing_history")
@Index("idx_pricing_history_pricing_id", ["pricingId"])
@Index("idx_pricing_history_operator_id", ["operatorId"])
@Index("idx_pricing_history_changed_at", ["changedAt"])
export class PricingHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid", { name: "pricing_id" })
  pricingId: string;

  @ManyToOne(() => SubscriptionPricing, (pricing) => pricing.histories, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "pricing_id" })
  pricing: SubscriptionPricing;

  @Column("uuid", { name: "operator_id" })
  operatorId: string;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "old_price" })
  oldPrice: number;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "new_price" })
  newPrice: number;

  @Column({
    type: "varchar",
    length: 500,
    name: "change_reason",
    nullable: true,
  })
  changeReason: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "changed_at" })
  changedAt: Date;
}

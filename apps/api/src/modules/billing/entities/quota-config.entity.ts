import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { SubscriptionTier } from "./subscription.entity";

export enum QuotaTargetType {
  MODEL = "model",
  CATEGORY = "category",
}

export enum QuotaCycleType {
  SMALL = "small",
  LARGE = "large",
}

@Entity("quota_config")
@Index(["tier", "cycleType", "isActive"])
@Index(["targetType", "targetId"])
export class QuotaConfig {
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
    enum: QuotaCycleType,
    name: "cycle_type",
  })
  cycleType: QuotaCycleType;

  @Column({
    type: "varchar",
    length: 20,
    enum: QuotaTargetType,
    name: "target_type",
  })
  targetType: QuotaTargetType;

  @Column({ type: "varchar", length: 50, name: "target_id" })
  targetId: string;

  @Column({ type: "int", name: "quota_value" })
  quotaValue: number;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

export enum SubscriptionTier {
  FREE = "free",
  BASIC = "basic",
  PRO = "pro",
}

export enum SubscriptionPeriod {
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export enum SubscriptionStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

@Entity("subscription")
@Index(["userId"])
@Index(["status"])
@Index(["expiresAt"])
export class Subscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "varchar",
    length: 20,
    enum: SubscriptionTier,
    default: SubscriptionTier.FREE,
  })
  tier: SubscriptionTier;

  @Column({
    type: "varchar",
    length: 10,
    enum: SubscriptionPeriod,
    default: SubscriptionPeriod.MONTHLY,
  })
  period: SubscriptionPeriod;

  @Column({
    type: "varchar",
    length: 20,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ type: "timestamptz", name: "started_at" })
  startedAt: Date;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt: Date;

  @Column({ type: "boolean", name: "auto_renew", default: true })
  autoRenew: boolean;

  @Column({ type: "int", default: 0 })
  version: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;
}

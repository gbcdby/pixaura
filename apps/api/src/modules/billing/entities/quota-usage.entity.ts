import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from "typeorm";

export enum QuotaType {
  SMALL = "small",
  LARGE = "large",
}

export enum QuotaReason {
  GENERATION = "generation",
  EXPIRED = "expired",
  REFUND = "refund",
}

@Entity("quota_usage")
@Index(["userId", "cycleNumber"])
@Index(["targetType", "targetId"])
@Index(["createdAt"])
export class QuotaUsage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({
    type: "varchar",
    length: 10,
    enum: QuotaType,
    name: "quota_type",
  })
  quotaType: QuotaType;

  @Column({
    type: "varchar",
    length: 20,
    name: "target_type",
  })
  targetType: string;

  @Column({ type: "varchar", length: 50, name: "target_id" })
  targetId: string;

  @Column({ type: "bigint", name: "cycle_number" })
  cycleNumber: number;

  @Column({ type: "int" })
  amount: number;

  @Column({ type: "int", name: "balance_after" })
  balanceAfter: number;

  @Column({
    type: "varchar",
    length: 50,
    enum: QuotaReason,
  })
  reason: QuotaReason;

  // referenceId 用于关联业务 ID（如 shot_0, script_xxx），不一定是 UUID 格式
  @Column({ type: "varchar", length: 255, name: "reference_id", nullable: true })
  referenceId: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;
}

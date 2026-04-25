import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * 视频生成额度扣减记录实体
 * 用于存储视频生成任务的额度扣减记录
 */
@Entity("video_gen_quota_record")
@Index(["userId", "createdAt"])
@Index(["taskId"])
@Index(["status"])
export class VideoGenQuotaRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "uuid", name: "task_id" })
  taskId: string;

  @Column({ type: "uuid", name: "batch_id", nullable: true })
  batchId: string | null;

  @Column({ type: "int", name: "estimated_amount" })
  estimatedAmount: number;

  @Column({ type: "int", name: "actual_amount", default: 0 })
  actualAmount: number;

  @Column({
    type: "varchar",
    length: 20,
    enum: ["pending", "confirmed", "refunded"],
    default: "pending",
  })
  status: "pending" | "confirmed" | "refunded";

  @Column({
    type: "varchar",
    length: 20,
    enum: ["subscription", "balance"],
    name: "deducted_from",
    nullable: true, // 管理员豁免时为 null
  })
  deductedFrom: "subscription" | "balance" | null;

  @Column({ type: "uuid", name: "quota_usage_id", nullable: true })
  quotaUsageId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: {
    resolution: string;
    duration: number;
    videoMode: string;
    modelId: string;
  } | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
  confirmedAt: Date | null;

  @Column({ name: "refunded_at", type: "timestamptz", nullable: true })
  refundedAt: Date | null;

  @Column({
    type: "varchar",
    length: 500,
    name: "refund_reason",
    nullable: true,
  })
  refundReason: string | null;
}

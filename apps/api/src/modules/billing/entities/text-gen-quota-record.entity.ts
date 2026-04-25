import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * 文本生成额度扣减记录实体
 * 用于存储文本生成任务（剧本生成/解析/编辑/流式）的额度扣减记录
 */
@Entity("text_gen_quota_record")
@Index(["userId", "createdAt"])
@Index(["taskId"])
@Index(["status"])
export class TextGenQuotaRecord {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "uuid", name: "task_id" })
  taskId: string;

  @Column({ type: "int", name: "estimated_tokens" })
  estimatedTokens: number;

  @Column({ type: "int", name: "actual_tokens", default: 0 })
  actualTokens: number;

  @Column({ type: "decimal", precision: 10, scale: 4, name: "estimated_amount" })
  estimatedAmount: number;

  @Column({ type: "decimal", precision: 10, scale: 4, name: "actual_amount", default: 0 })
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
    nullable: true,
  })
  deductedFrom: "subscription" | "balance" | null;

  @Column({ type: "uuid", name: "quota_usage_id", nullable: true })
  quotaUsageId: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: {
    taskType: string;
    modelId: string;
    promptLength: number;
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

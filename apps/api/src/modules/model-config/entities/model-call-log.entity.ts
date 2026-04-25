import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("model_call_logs")
@Index(["modelId", "createdAt"])
@Index(["providerId", "createdAt"])
@Index(["status"])
@Index(["createdAt"])
export class ModelCallLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "model_id", type: "varchar", length: 100 })
  modelId: string;

  @Column({ name: "provider_id", type: "varchar", length: 50 })
  providerId: string;

  @Column({ name: "request_id", type: "varchar", length: 100 })
  requestId: string;

  @Column({ type: "varchar", length: 20 })
  status: "success" | "failed";

  @Column({ name: "response_time_ms", type: "int", nullable: true })
  responseTimeMs: number | null;

  @Column({ name: "error_code", type: "varchar", length: 50, nullable: true })
  errorCode: string | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @Column({ name: "category", type: "varchar", length: 50, nullable: true })
  category: string | null;

  @Column({ name: "token_usage", type: "jsonb", nullable: true })
  tokenUsage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("provider_health_logs")
@Index(["providerId"])
@Index(["checkedAt"])
@Index(["providerId", "checkedAt"])
export class ProviderHealthLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "provider_id", type: "varchar", length: 50 })
  providerId: string;

  @Column({ name: "check_status", type: "varchar", length: 20 })
  checkStatus: string;

  @Column({ name: "response_time_ms", type: "int", nullable: true })
  responseTimeMs: number | null;

  @Column({ name: "status_code", type: "int", nullable: true })
  statusCode: number | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: "checked_at" })
  checkedAt: Date;
}

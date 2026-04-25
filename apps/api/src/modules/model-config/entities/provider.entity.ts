import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("providers")
@Index(["providerId"], { unique: true })
@Index(["status"])
@Index(["healthStatus"])
@Index(["providerType"])
export class Provider {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "provider_id", type: "varchar", length: 50, unique: true })
  providerId: string;

  @Column({ name: "provider_name", type: "varchar", length: 100 })
  providerName: string;

  @Column({ name: "provider_type", type: "varchar", length: 20 })
  providerType: string;

  @Column({ name: "base_url", type: "varchar", length: 500 })
  baseUrl: string;

  @Column({ name: "auth_type", type: "varchar", length: 20 })
  authType: string;

  @Column({ name: "api_key_enc", type: "text", nullable: true })
  apiKeyEnc: string | null;

  @Column({ name: "api_secret_enc", type: "text", nullable: true })
  apiSecretEnc: string | null;

  @Column({ type: "varchar", length: 20, default: "enabled" })
  status: string;

  @Column({
    name: "health_status",
    type: "varchar",
    length: 20,
    default: "unknown",
  })
  healthStatus: string;

  @Column({ name: "check_config", type: "jsonb", default: {} })
  checkConfig: Record<string, unknown>;

  @Column({ name: "rate_limit_config", type: "jsonb", default: {} })
  rateLimitConfig: Record<string, unknown>;

  @Column({ name: "api_key_expires_at", type: "timestamp", nullable: true })
  apiKeyExpiresAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

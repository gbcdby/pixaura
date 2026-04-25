import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("model_adapter_configs")
@Index(["modelId"])
@Index(["providerId"])
@Index(["status"])
@Index(["modelId", "providerId"], { unique: true })
export class ModelAdapterConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "model_id", type: "varchar", length: 100 })
  modelId: string;

  @Column({ name: "provider_id", type: "varchar", length: 50 })
  providerId: string;

  @Column({ name: "provider_model_id", type: "varchar", length: 200 })
  providerModelId: string;

  @Column({ name: "api_path", type: "varchar", length: 200 })
  apiPath: string;

  @Column({
    name: "request_method",
    type: "varchar",
    length: 10,
    default: "POST",
  })
  requestMethod: string;

  @Column({ name: "allowed_paths", type: "jsonb", default: [] })
  allowedPaths: string[];

  @Column({ name: "auth_type", type: "varchar", length: 20 })
  authType: string;

  @Column({ name: "auth_config", type: "jsonb", default: {} })
  authConfig: Record<string, unknown>;

  @Column({ name: "request_mapping", type: "jsonb" })
  requestMapping: Record<string, unknown>;

  @Column({ name: "response_mapping", type: "jsonb" })
  responseMapping: Record<string, unknown>;

  @Column({ name: "error_mapping", type: "jsonb", default: {} })
  errorMapping: Record<string, unknown>;

  @Column({ name: "supports_streaming", type: "boolean", default: false })
  supportsStreaming: boolean;

  @Column({ name: "supports_async", type: "boolean", default: false })
  supportsAsync: boolean;

  @Column({ name: "timeout_ms", type: "int", default: 30000 })
  timeoutMs: number;

  @Column({ name: "retry_config", type: "jsonb", default: {} })
  retryConfig: Record<string, unknown>;

  @Column({ type: "varchar", length: 20, default: "enabled" })
  status: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

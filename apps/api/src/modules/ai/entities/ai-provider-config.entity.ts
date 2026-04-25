import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * AI 提供商配置实体
 * 存储 AI 提供商的 API 配置（加密存储）
 */
@Entity("ai_provider_config")
export class AIProviderConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "varchar",
    length: 50,
    unique: true,
    comment: "提供商名称",
  })
  provider: string;

  @Column({
    name: "api_base_url",
    type: "varchar",
    length: 500,
    comment: "API 基础地址",
  })
  apiBaseUrl: string;

  @Column({
    name: "api_key_encrypted",
    type: "text",
    comment: "加密存储的 API Key",
  })
  apiKeyEncrypted: string;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "额外配置参数",
  })
  config: Record<string, unknown> | null;

  @Column({
    name: "rate_limits",
    type: "jsonb",
    comment: "速率限制配置",
  })
  rateLimits: {
    requestsPerMinute?: number;
    tokensPerMinute?: number;
    concurrentRequests?: number;
  };

  @Column({
    type: "varchar",
    length: 20,
    default: "active",
    comment: "状态",
  })
  status: string;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt: Date;
}

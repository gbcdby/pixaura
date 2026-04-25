import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ai_models")
@Index(["modelId"], { unique: true })
@Index(["category"])
@Index(["status"])
@Index(["minTier"])
@Index(["category", "isDefault"])
export class AiModel {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "model_id", type: "varchar", length: 100, unique: true })
  modelId: string;

  @Column({ name: "model_name", type: "varchar", length: 200 })
  modelName: string;

  @Column({ type: "varchar", length: 50 })
  category: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({ name: "min_tier", type: "varchar", length: 20, default: "free" })
  minTier: string;

  @Column({ name: "is_default", type: "boolean", default: false })
  isDefault: boolean;

  @Column({ type: "varchar", length: 20, default: "enabled" })
  status: string;

  @Column({ name: "default_params", type: "jsonb", default: {} })
  defaultParams: Record<string, unknown>;

  @Column({ name: "custom_params", type: "jsonb", default: {} })
  customParams: Record<string, unknown>;

  @Column({ name: "cost_config", type: "jsonb", default: {} })
  costConfig: Record<string, unknown>;

  @Column({ name: "supported_features", type: "jsonb", default: [] })
  supportedFeatures: string[];

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

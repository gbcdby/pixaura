import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("model_providers")
@Index(["modelId"])
@Index(["providerId"])
@Index(["modelId", "priority"])
@Index(["modelId"], { unique: true, where: "is_primary = true" })
export class ModelProvider {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "model_id", type: "varchar", length: 100 })
  modelId: string;

  @Column({ name: "provider_id", type: "varchar", length: 50 })
  providerId: string;

  @Column({ name: "is_primary", type: "boolean", default: false })
  isPrimary: boolean;

  @Column({ type: "integer", default: 0 })
  priority: number;

  @Column({
    name: "provider_model_id",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  providerModelId: string | null;

  @Column({ type: "varchar", length: 20, default: "enabled" })
  status: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

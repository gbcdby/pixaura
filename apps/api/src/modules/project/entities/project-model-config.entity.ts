import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Project } from "./project.entity";
import { AiModel } from "../../model-config/entities/ai-model.entity";

export type ModelCategory =
  | "TEXT_GENERATION"
  | "IMAGE_GENERATION"
  | "VIDEO_GENERATION"
  | "AUDIO_GENERATION";

/**
 * 项目默认模型配置实体
 * 存储项目各功能类别的默认模型配置
 */
@Entity("project_model_config")
export class ProjectModelConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "项目ID",
  })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.modelConfigs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "project_id", referencedColumnName: "projectId" })
  project: Project;

  @Column({
    type: "varchar",
    length: 50,
    comment:
      "功能类别：TEXT_GENERATION/IMAGE_GENERATION/VIDEO_GENERATION/AUDIO_GENERATION",
  })
  category: ModelCategory;

  @Column({
    name: "model_id",
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "模型ID，NULL表示使用用户默认",
  })
  modelId: string | null;

  @ManyToOne(() => AiModel, { onDelete: "SET NULL" })
  @JoinColumn({ name: "model_id", referencedColumnName: "modelId" })
  model: AiModel | null;

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

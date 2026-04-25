/**
 * 图片生成结果实体
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { ImageGenerationTaskEntity } from "./image-generation-task.entity";

export type ImageGenResultStatus = "pending" | "success" | "failed";

/**
 * 图片信息
 */
export interface ImageInfo {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

/**
 * 生成参数快照
 */
export interface GenerationParams {
  prompt: string;
  negativePrompt?: string;
  seed: number;
  modelId: string;
  width: number;
  height: number;
  referenceImageUrl?: string;
  strength?: number;
}

/**
 * 错误信息
 */
export interface ResultErrorInfo {
  code: number;
  message: string;
}

/**
 * 审核状态
 */
export interface ModerationInfo {
  status: "pending" | "approved" | "rejected";
  checkedAt?: string;
  rejectReason?: string;
}

@Entity("image_generation_result")
export class ImageGenerationResultEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "task_id" })
  taskId: string;

  @ManyToOne(() => ImageGenerationTaskEntity, (task) => task.results, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "task_id" })
  task: ImageGenerationTaskEntity;

  @Column({ type: "integer", default: 0, name: "index" })
  index: number;

  @Column({ type: "varchar", length: 32, name: "type" })
  type: string;

  @Column({ type: "jsonb", default: {}, name: "image" })
  image: ImageInfo;

  @Column({ type: "jsonb", default: {}, name: "generation_params" })
  generationParams: GenerationParams;

  @Column({ type: "varchar", length: 32, default: "pending", name: "status" })
  status: ImageGenResultStatus;

  @Column({ type: "jsonb", nullable: true, name: "error" })
  error: ResultErrorInfo | null;

  @Column({ type: "jsonb", nullable: true, name: "moderation" })
  moderation: ModerationInfo | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true, name: "completed_at" })
  completedAt: Date | null;

  /**
   * 标记为成功
   */
  markAsSuccess(image: ImageInfo): void {
    this.status = "success";
    this.image = image;
    this.completedAt = new Date();
  }

  /**
   * 标记为失败
   */
  markAsFailed(error: ResultErrorInfo): void {
    this.status = "failed";
    this.error = error;
    this.completedAt = new Date();
  }

  /**
   * 是否需要审核
   */
  needsModeration(): boolean {
    return (
      this.status === "success" &&
      (!this.moderation || this.moderation.status === "pending")
    );
  }

  /**
   * 是否被审核拒绝
   */
  isRejected(): boolean {
    return this.moderation?.status === "rejected";
  }

  /**
   * 获取审核状态
   */
  getModerationStatus(): string {
    return this.moderation?.status || "pending";
  }
}

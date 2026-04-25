/**
 * 图片生成任务实体
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from "typeorm";
import { ImageGenerationResultEntity } from "./image-generation-result.entity";

export type ImageGenTaskType =
  | "text_to_image"
  | "image_to_image"
  | "batch_generation";
export type ImageGenSceneType =
  | "character_views"
  | "scene_views"
  | "prop_views"
  | "storyboard_reference";
export type ImageGenTaskStatus =
  | "pending"
  | "queued"
  | "generating"
  | "completed"
  | "partial_failed"
  | "failed"
  | "cancelled";

/**
 * 文生图配置
 */
export interface TextConfig {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  style?: string;
  parameters?: Record<string, unknown>;
}

/**
 * 图生图配置
 */
export interface ImageConfig {
  referenceImageUrl: string;
  prompt: string;
  negativePrompt?: string;
  strength: number;
  width?: number;
  height?: number;
  seed?: number;
  style?: string;
}

/**
 * 批量生成项
 */
export interface BatchItem {
  index: number;
  type: string;
  promptSuffix: string;
}

/**
 * 批量生成配置
 */
export interface BatchConfig {
  basePrompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  style?: string;
  shareSeed: boolean;
  baseSeed?: number;
  items: BatchItem[];
}

/**
 * 生成配置
 */
export interface GenerationConfig {
  modelId: string;
  textConfig?: TextConfig;
  imageConfig?: ImageConfig;
  batchConfig?: BatchConfig;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  currentStep: string;
  percentage: number;
}

/**
 * 成本信息
 */
export interface CostInfo {
  estimatedCost: number;
  actualCost: number;
  currency: string;
}

/**
 * 错误信息
 */
export interface ErrorInfo {
  code: number;
  message: string;
  details?: string;
}

@Entity("image_generation_task")
export class ImageGenerationTaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true, name: "generation_task_id" })
  generationTaskId: string | null;

  @Column({ type: "varchar", length: 50, name: "project_id" })
  projectId: string;

  @Column({ type: "uuid", name: "created_by" })
  createdBy: string;

  @Column({ type: "varchar", length: 32, name: "type" })
  type: ImageGenTaskType;

  @Column({ type: "varchar", length: 32, name: "scene_type" })
  sceneType: ImageGenSceneType;

  @Column({ type: "jsonb", default: {} })
  config: GenerationConfig;

  @Column({
    type: "jsonb",
    default: {
      total: 0,
      completed: 0,
      failed: 0,
      currentStep: "",
      percentage: 0,
    },
  })
  progress: ProgressInfo;

  @Column({
    type: "jsonb",
    default: { estimatedCost: 0, actualCost: 0, currency: "CNY" },
  })
  cost: CostInfo;

  @Column({ type: "varchar", length: 32, default: "pending" })
  status: ImageGenTaskStatus;

  @Column({ type: "jsonb", nullable: true })
  error: ErrorInfo | null;

  @Column({
    type: "varchar",
    length: 512,
    nullable: true,
    name: "callback_url",
  })
  callbackUrl: string | null;

  @Column({ type: "jsonb", nullable: true, name: "callback_payload" })
  callbackPayload: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt: Date;

  @Column({ type: "timestamptz", nullable: true, name: "started_at" })
  startedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true, name: "completed_at" })
  completedAt: Date | null;

  @DeleteDateColumn({ type: "timestamptz", nullable: true, name: "deleted_at" })
  deletedAt: Date | null;

  @OneToMany(() => ImageGenerationResultEntity, (result) => result.task, {
    cascade: true,
  })
  results: ImageGenerationResultEntity[];

  /**
   * 更新进度
   */
  updateProgress(progress: Partial<ProgressInfo>): void {
    this.progress = { ...this.progress, ...progress };
  }

  /**
   * 增加完成数
   */
  incrementCompleted(): void {
    this.progress.completed += 1;
    this.updatePercentage();
  }

  /**
   * 增加失败数
   */
  incrementFailed(): void {
    this.progress.failed += 1;
    this.updatePercentage();
  }

  /**
   * 更新百分比
   */
  private updatePercentage(): void {
    if (this.progress.total > 0) {
      this.progress.percentage = Math.round(
        ((this.progress.completed + this.progress.failed) /
          this.progress.total) *
          100,
      );
    }
  }

  /**
   * 是否可以取消
   */
  canCancel(): boolean {
    return ["pending", "queued", "generating"].includes(this.status);
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return ["completed", "partial_failed", "failed", "cancelled"].includes(
      this.status,
    );
  }

  /**
   * 获取实际成本（包含所有结果）
   */
  calculateActualCost(singleImageCost: number): number {
    if (!this.results) return 0;
    const successCount = this.results.filter(
      (r) => r.status === "success",
    ).length;
    return successCount * singleImageCost;
  }
}

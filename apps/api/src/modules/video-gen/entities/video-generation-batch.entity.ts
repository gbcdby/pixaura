import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

/**
 * 批量任务批次状态
 */
export const VideoGenBatchStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  PARTIAL_FAILED: "partial_failed",
  FAILED: "failed",
} as const;

export type VideoGenBatchStatus =
  (typeof VideoGenBatchStatus)[keyof typeof VideoGenBatchStatus];

/**
 * 视频生成批量批次实体
 */
@Entity("video_generation_batch")
export class VideoGenerationBatch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "所属项目ID",
  })
  projectId: string;

  @Column({
    name: "created_by",
    type: "uuid",
    comment: "创建者用户ID",
  })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "created_by" })
  creator: User;

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment: "批次配置（total_count, common_config）",
  })
  config: {
    totalCount: number;
    commonConfig?: {
      modelId?: string;
      outputConfig?: {
        resolution?: "480p" | "720p" | "1080p";
        aspectRatio?: "16:9" | "9:16" | "1:1";
      };
    };
  };

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment: "进度统计（total, completed, failed, pending）",
  })
  stats: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };

  @Column({
    type: "varchar",
    length: 20,
    default: VideoGenBatchStatus.PENDING,
    comment:
      "批次状态：pending / processing / completed / partial_failed / failed",
  })
  status: VideoGenBatchStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({
    name: "completed_at",
    type: "timestamp",
    nullable: true,
    comment: "完成时间",
  })
  completedAt: Date | null;
}

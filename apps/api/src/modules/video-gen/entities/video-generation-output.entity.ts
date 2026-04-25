import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { VideoGenerationTask } from "./video-generation-task.entity";

/**
 * 输出类型
 */
export const VideoGenOutputType = {
  VIDEO: "video",
  AUDIO: "audio",
  PREVIEW: "preview",
} as const;

export type VideoGenOutputType =
  (typeof VideoGenOutputType)[keyof typeof VideoGenOutputType];

/**
 * 审核状态
 */
export const ModerationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ModerationStatus =
  (typeof ModerationStatus)[keyof typeof ModerationStatus];

/**
 * 视频生成输出结果实体
 */
@Entity("video_generation_output")
export class VideoGenerationOutput {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "task_id",
    type: "uuid",
    comment: "关联任务ID",
  })
  taskId: string;

  @ManyToOne(() => VideoGenerationTask, (task) => task.outputs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "task_id" })
  task: VideoGenerationTask;

  @Column({
    type: "varchar",
    length: 20,
    comment: "输出类型：video / audio / preview",
  })
  type: VideoGenOutputType;

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment:
      "文件信息（url, thumbnail_url, format, resolution, duration, size）",
  })
  file: {
    url: string;
    thumbnailUrl?: string;
    format: string;
    resolution?: string;
    duration: number;
    size: number;
  };

  @Column({
    name: "generation_params",
    type: "jsonb",
    default: () => "'{}'",
    comment: "生成参数快照（model_id, reference_mode, video_mode, resolution）",
  })
  generationParams: {
    modelId: string;
    referenceMode: string;
    videoMode: string;
    resolution: string;
  };

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "审核状态（status, checked_at, reject_reason）",
  })
  moderation: {
    status: ModerationStatus;
    checkedAt?: string;
    rejectReason?: string;
  } | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

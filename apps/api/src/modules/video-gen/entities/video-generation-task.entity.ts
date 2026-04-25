import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { User } from "../../user/entities/user.entity";
import { VideoGenerationOutput } from "./video-generation-output.entity";

/**
 * 视频生成任务状态
 */
export const VideoGenTaskStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  GENERATING: "generating",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type VideoGenTaskStatus =
  (typeof VideoGenTaskStatus)[keyof typeof VideoGenTaskStatus];

/**
 * 视频生成任务类型
 */
export const VideoGenTaskType = {
  SINGLE: "single",
  BATCH: "batch",
} as const;

export type VideoGenTaskType =
  (typeof VideoGenTaskType)[keyof typeof VideoGenTaskType];

/**
 * 视频生成模式
 * 重命名说明：
 * - audio_driven → audio_reference（音频驱动视频生成）
 * - video_first → lip_sync（对口型模式）
 * - video_only 保持不变
 */
export const VideoMode = {
  AUDIO_REFERENCE: "audio_reference",
  LIP_SYNC: "lip_sync",
  VIDEO_ONLY: "video_only",
} as const;

export type VideoMode = (typeof VideoMode)[keyof typeof VideoMode];

/**
 * 参考模式
 */
export const ReferenceMode = {
  SINGLE_REFERENCE: "single_reference",
  MULTI_REFERENCE: "multi_reference",
} as const;

export type ReferenceMode = (typeof ReferenceMode)[keyof typeof ReferenceMode];

/**
 * 视频生成任务实体
 */
@Entity("video_generation_task")
export class VideoGenerationTask {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    name: "generation_task_id",
    type: "uuid",
    nullable: true,
    comment: "关联 generation 模块的任务ID",
  })
  generationTaskId: string | null;

  @Column({
    name: "project_id",
    type: "varchar",
    length: 50,
    comment: "所属项目ID",
  })
  projectId: string;

  @Column({
    name: "shot_id",
    type: "varchar",
    length: 50,
    comment: "关联分镜ID（如 shot_0, shot_1）",
  })
  shotId: string;

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
    type: "varchar",
    length: 20,
    default: VideoGenTaskType.SINGLE,
    comment: "任务类型：single / batch",
  })
  type: VideoGenTaskType;

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment:
      "生成配置（reference_mode, video_mode, model_id, shot_data, output_config）",
  })
  config: {
    referenceMode: ReferenceMode;
    videoMode: VideoMode;
    modelId?: string;
    shotData: {
      briefDescription: string;
      detailedDescription: string;
      sequence: Array<{
        timeStart: number;
        timeEnd: number;
        description: string;
        dialogue?: {
          speaker: string;
          speakerId: string;
          text: string;
          emotion: string;
        };
        camera?: {
          shotSize: string;
          movement: string;
        };
      }>;
      references: {
        characters: Array<{ id: string; name: string }>;
        scenes: Array<{ id: string; name: string }>;
        props: Array<{ id: string; name: string }>;
        composedImage?: string;
      };
    };
    outputConfig: {
      resolution: "480p" | "720p" | "1080p";
      aspectRatio: "16:9" | "9:16" | "1:1";
    };
  };

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment: "进度信息（current_step, percentage, steps）",
  })
  progress: {
    currentStep: string;
    percentage: number;
    steps: Array<{
      name: string;
      label: string;
      status: "pending" | "processing" | "completed" | "failed";
      progress: number;
      message?: string;
    }>;
  };

  @Column({
    type: "jsonb",
    default: () => "'{}'",
    comment: "成本信息（estimated_cost, actual_cost, currency）",
  })
  cost: {
    estimatedCost: number;
    actualCost: number;
    currency: string;
  };

  @Column({
    type: "varchar",
    length: 20,
    default: VideoGenTaskStatus.PENDING,
    comment:
      "任务状态：pending / queued / generating / completed / failed / cancelled",
  })
  status: VideoGenTaskStatus;

  @Column({
    type: "jsonb",
    nullable: true,
    comment: "错误信息（code, message, step, details）",
  })
  error: {
    code: number;
    message: string;
    details?: string;
    step?: string;
  } | null;

  @Column({
    name: "callback_url",
    type: "varchar",
    length: 512,
    nullable: true,
    comment: "回调地址",
  })
  callbackUrl: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @Column({
    name: "started_at",
    type: "timestamp",
    nullable: true,
    comment: "开始时间",
  })
  startedAt: Date | null;

  @Column({
    name: "completed_at",
    type: "timestamp",
    nullable: true,
    comment: "完成时间",
  })
  completedAt: Date | null;

  @DeleteDateColumn({ name: "deleted_at" })
  deletedAt: Date | null;

  @Column({
    name: "quota_record_id",
    type: "uuid",
    nullable: true,
    comment: "关联额度扣减记录ID",
  })
  quotaRecordId: string | null;

  @OneToMany(() => VideoGenerationOutput, (output) => output.task)
  outputs: VideoGenerationOutput[];
}

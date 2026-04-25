/**
 * 音频生成输出实体
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { AudioGenerationTaskEntity } from "./audio-generation-task.entity";

export type AudioGenOutputType =
  | "tts"
  | "lip_sync_video"
  | "bgm"
  | "ambience"
  | "sfx"
  | "mixed_audio";
export type AudioModerationStatus = "pending" | "approved" | "rejected";

/**
 * 文件信息
 */
export interface FileInfo {
  url: string;
  format: "wav" | "mp3" | "mp4";
  duration: number;
  size: number;
  sampleRate?: number;
  bitrate?: number;
}

/**
 * 混音统计
 */
export interface MixingStats {
  lufs: number;
  truePeak: number;
  dynamicRange: number;
}

/**
 * 对口型同步区域
 */
export interface SyncedRegion {
  start: number;
  end: number;
  confidence: number;
}

/**
 * 输出元数据
 */
export interface OutputMetadata {
  // TTS 元数据
  speakerId?: string;
  text?: string;
  emotion?: string;
  // BGM 元数据
  bpm?: number;
  keyPoints?: number[];
  style?: string; // BGM 风格
  tempo?: number; // BGM 节拍速度
  mock?: boolean; // 是否为 mock 数据（开发阶段）
  // 混音元数据
  stats?: MixingStats;
  // 对口型元数据
  syncedRegions?: SyncedRegion[];
  // 环境音元数据
  sceneTags?: string[];
  reverbPreset?: string;
  // 音效元数据
  sfxName?: string;
}

/**
 * 审核状态
 */
export interface ModerationInfo {
  status: AudioModerationStatus;
  checkedAt?: string;
  rejectReason?: string;
}

@Entity("audio_generation_output")
export class AudioGenerationOutputEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "task_id" })
  taskId: string;

  @Column({ type: "varchar", length: 32, name: "type" })
  type: AudioGenOutputType;

  @Column({ type: "jsonb", default: {} })
  file: FileInfo;

  @Column({ type: "jsonb", nullable: true })
  metadata: OutputMetadata | null;

  @Column({ type: "jsonb", nullable: true })
  moderation: ModerationInfo | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt: Date;

  @ManyToOne(() => AudioGenerationTaskEntity, (task) => task.outputs)
  @JoinColumn({ name: "task_id" })
  task: AudioGenerationTaskEntity;

  /**
   * 是否成功
   */
  isSuccess(): boolean {
    return !!this.file?.url && !!this.file?.duration;
  }

  /**
   * 获取审核状态
   */
  getModerationStatus(): AudioModerationStatus {
    return this.moderation?.status || "pending";
  }

  /**
   * 是否已通过审核
   */
  isApproved(): boolean {
    return this.getModerationStatus() === "approved";
  }

  /**
   * 设置审核状态
   */
  setModerationStatus(
    status: AudioModerationStatus,
    rejectReason?: string,
  ): void {
    this.moderation = {
      status,
      checkedAt: new Date().toISOString(),
      ...(rejectReason && { rejectReason }),
    };
  }

  /**
   * 获取音频时长（秒）
   */
  getDuration(): number {
    return this.file?.duration || 0;
  }

  /**
   * 获取文件大小（字节）
   */
  getSize(): number {
    return this.file?.size || 0;
  }

  /**
   * 获取格式化时长
   */
  getFormattedDuration(): string {
    const duration = this.getDuration();
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * 获取格式化文件大小
   */
  getFormattedSize(): string {
    const size = this.getSize();
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}

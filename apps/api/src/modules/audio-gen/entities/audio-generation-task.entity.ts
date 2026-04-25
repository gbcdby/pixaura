/**
 * 音频生成任务实体
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
import { AudioGenerationOutputEntity } from "./audio-generation-output.entity";

export type AudioGenTaskType =
  | "tts"
  | "lip_sync"
  | "bgm"
  | "ambience"
  | "mixing";
export type AudioGenTaskStatus =
  | "pending"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * TTS 配置
 */
export interface TTSConfig {
  text: string;
  speakerId: string;
  emotion?:
    | "neutral"
    | "happy"
    | "sad"
    | "angry"
    | "excited"
    | "fearful"
    | "surprised";
  speed: number;
  targetDuration?: number;
  // 千问 TTS 扩展字段
  voiceId?: string; // 音色 ID
  instructions?: string; // 指令控制
}

/**
 * 对口型配置
 */
export interface LipSyncConfig {
  videoUrl: string;
  audioUrl: string;
  characterId: string;
  referenceMode: "single_reference" | "multi_reference";
}

/**
 * 情绪点
 */
export interface EmotionPoint {
  time: number;
  emotion: string;
  intensity: number;
}

/**
 * BGM 配置
 */
export interface BGMConfig {
  emotionCurve: EmotionPoint[];
  duration: number;
  style?: string;
  tempo?: number;
  needBeatPoints: boolean;
  modelId?: string;
}

/**
 * 环境音配置
 */
export interface AmbienceConfig {
  sceneTags: string[];
  duration: number;
  actions?: string[];
  reverbPreset?: "small_room" | "medium_room" | "large_room" | "outdoor";
}

/**
 * 混音轨道
 */
export interface MixTrack {
  trackId: string;
  trackType: "dialogue" | "narration" | "bgm" | "ambience" | "sfx";
  audioUrl: string;
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  ducking?: {
    triggerBy: string[];
    reductionDb: number;
  };
}

/**
 * 混音配置
 */
export interface MixingConfig {
  tracks: MixTrack[];
  normalize: boolean;
  targetLufs: number;
}

/**
 * 音频任务配置
 */
export interface AudioTaskConfig {
  ttsConfig?: TTSConfig;
  lipSyncConfig?: LipSyncConfig;
  bgmConfig?: BGMConfig;
  ambienceConfig?: AmbienceConfig;
  mixingConfig?: MixingConfig;
}

/**
 * 进度信息
 */
export interface ProgressInfo {
  percentage: number;
  currentStep: string;
  message?: string;
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

@Entity("audio_generation_task")
export class AudioGenerationTaskEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true, name: "generation_task_id" })
  generationTaskId: string | null;

  @Column({ type: "varchar", length: 50, name: "project_id" })
  projectId: string;

  @Column({ type: "uuid", name: "created_by" })
  createdBy: string;

  @Column({ type: "varchar", length: 32, name: "type" })
  type: AudioGenTaskType;

  @Column({ type: "jsonb", default: {} })
  config: AudioTaskConfig;

  @Column({ type: "jsonb", default: { percentage: 0, currentStep: "" } })
  progress: ProgressInfo;

  @Column({
    type: "jsonb",
    default: { estimatedCost: 0, actualCost: 0, currency: "CNY" },
  })
  cost: CostInfo;

  @Column({ type: "varchar", length: 32, default: "pending" })
  status: AudioGenTaskStatus;

  @Column({ type: "jsonb", nullable: true })
  error: ErrorInfo | null;

  @Column({
    type: "varchar",
    length: 512,
    nullable: true,
    name: "callback_url",
  })
  callbackUrl: string | null;

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

  @OneToMany(() => AudioGenerationOutputEntity, (output) => output.task, {
    cascade: true,
  })
  outputs: AudioGenerationOutputEntity[];

  /**
   * 更新进度
   */
  updateProgress(progress: Partial<ProgressInfo>): void {
    this.progress = { ...this.progress, ...progress };
  }

  /**
   * 是否可以取消
   */
  canCancel(): boolean {
    return ["pending", "queued", "processing"].includes(this.status);
  }

  /**
   * 是否已完成
   */
  isCompleted(): boolean {
    return ["completed", "failed", "cancelled"].includes(this.status);
  }

  /**
   * 计算实际成本
   */
  calculateActualCost(baseCost: number): number {
    if (!this.outputs) return 0;
    const successCount = this.outputs.filter((o) => o.isSuccess()).length;
    return successCount * baseCost;
  }

  /**
   * 获取输出音频时长
   */
  getTotalDuration(): number {
    if (!this.outputs) return 0;
    return this.outputs.reduce((sum, o) => sum + (o.file?.duration || 0), 0);
  }
}

import { z } from "zod";

// ==================== 枚举常量 ====================

/**
 * 音频生成任务状态
 */
export const AudioGenTaskStatus = {
  PENDING: "pending",
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AudioGenTaskStatus =
  (typeof AudioGenTaskStatus)[keyof typeof AudioGenTaskStatus];

/**
 * 音频生成任务类型
 */
export const AudioGenTaskType = {
  TTS: "tts",
  LIP_SYNC: "lip_sync",
  BGM: "bgm",
  AMBIENCE: "ambience",
  MIXING: "mixing",
} as const;

export type AudioGenTaskType =
  (typeof AudioGenTaskType)[keyof typeof AudioGenTaskType];

/**
 * 音频输出类型
 */
export const AudioGenOutputType = {
  TTS: "tts",
  LIP_SYNC_VIDEO: "lip_sync_video",
  BGM: "bgm",
  AMBIENCE: "ambience",
  SFX: "sfx",
  MIXED_AUDIO: "mixed_audio",
} as const;

export type AudioGenOutputType =
  (typeof AudioGenOutputType)[keyof typeof AudioGenOutputType];

/**
 * 音频格式
 */
export const AudioFormat = {
  WAV: "wav",
  MP3: "mp3",
  MP4: "mp4",
} as const;

export type AudioFormat = (typeof AudioFormat)[keyof typeof AudioFormat];

/**
 * 音频轨道类型
 */
export const AudioTrackType = {
  DIALOGUE: "dialogue",
  NARRATION: "narration",
  BGM: "bgm",
  AMBIENCE: "ambience",
  SFX: "sfx",
} as const;

export type AudioTrackType =
  (typeof AudioTrackType)[keyof typeof AudioTrackType];

/**
 * 情绪类型
 */
export const EmotionType = {
  NEUTRAL: "neutral",
  HAPPY: "happy",
  SAD: "sad",
  ANGRY: "angry",
  EXCITED: "excited",
  FEARFUL: "fearful",
  SURPRISED: "surprised",
} as const;

export type EmotionType = (typeof EmotionType)[keyof typeof EmotionType];

/**
 * 参考模式（音频生成模块）
 * 注意：与 video-gen 模块的 ReferenceMode 相同，但独立定义以避免循环依赖
 */
export const AudioGenReferenceMode = {
  SINGLE_REFERENCE: "single_reference",
  MULTI_REFERENCE: "multi_reference",
} as const;

export type AudioGenReferenceMode =
  (typeof AudioGenReferenceMode)[keyof typeof AudioGenReferenceMode];

/**
 * 审核状态
 */
export const AudioModerationStatus = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type AudioModerationStatus =
  (typeof AudioModerationStatus)[keyof typeof AudioModerationStatus];

// ==================== JSONB 子结构 ====================

/**
 * 情绪点（用于情绪曲线）
 */
export const EmotionPointSchema = z.object({
  time: z.number().describe("时间点（秒）"),
  emotion: z.string().describe("情绪类型"),
  intensity: z.number().min(0).max(1).describe("强度 (0-1)"),
});

export type EmotionPoint = z.infer<typeof EmotionPointSchema>;

/**
 * TTS 配置
 */
export const TTSConfigSchema = z.object({
  text: z.string().max(500).describe("要转换的文本（最大500字符）"),
  speakerId: z.string().describe("角色ID，用于匹配音色"),
  emotion: z
    .enum([
      EmotionType.NEUTRAL,
      EmotionType.HAPPY,
      EmotionType.SAD,
      EmotionType.ANGRY,
      EmotionType.EXCITED,
      EmotionType.FEARFUL,
      EmotionType.SURPRISED,
    ])
    .optional()
    .describe("情绪"),
  speed: z.number().min(0.5).max(2.0).default(1.0).describe("语速 (0.5-2.0)"),
  targetDuration: z
    .number()
    .optional()
    .describe("目标时长（秒），用于调整语速匹配画面"),
  // 千问 TTS 扩展字段
  voiceId: z.string().optional().describe("音色 ID（千问 TTS 专用）"),
  instructions: z
    .string()
    .optional()
    .describe("指令控制（用于 qwen3-tts-instruct-flash）"),
});

export type TTSConfig = z.infer<typeof TTSConfigSchema>;

/**
 * 对口型配置
 */
export const LipSyncConfigSchema = z.object({
  videoUrl: z.string().describe("无声视频URL"),
  audioUrl: z.string().describe("配音音频URL"),
  characterId: z.string().describe("角色ID（用于口型参考）"),
  referenceMode: z
    .enum([
      AudioGenReferenceMode.SINGLE_REFERENCE,
      AudioGenReferenceMode.MULTI_REFERENCE,
    ])
    .default(AudioGenReferenceMode.SINGLE_REFERENCE)
    .describe("参考模式"),
});

export type LipSyncConfig = z.infer<typeof LipSyncConfigSchema>;

/**
 * BGM 配置
 */
export const BGMConfigSchema = z.object({
  emotionCurve: z.array(EmotionPointSchema).describe("情绪时间轴"),
  duration: z.number().describe("目标时长（秒）"),
  style: z.string().optional().describe("风格偏好：epic/romantic/tense/..."),
  tempo: z.number().optional().describe("节拍BPM要求"),
  needBeatPoints: z
    .boolean()
    .default(false)
    .describe("是否需要节拍点（用于卡点）"),
  modelId: z.string().optional().describe("使用的模型ID"),
});

export type BGMConfig = z.infer<typeof BGMConfigSchema>;

/**
 * 环境音配置
 */
export const AmbienceConfigSchema = z.object({
  sceneTags: z
    .array(z.string())
    .describe("场景标签：indoor/outdoor/rain/city/..."),
  duration: z.number().describe("目标时长（秒）"),
  actions: z
    .array(z.string())
    .optional()
    .describe("动作关键词：footsteps/door_closing/..."),
  reverbPreset: z
    .enum(["small_room", "medium_room", "large_room", "outdoor"])
    .optional()
    .describe("混响预设"),
});

export type AmbienceConfig = z.infer<typeof AmbienceConfigSchema>;

/**
 * 混音轨道
 */
export const MixTrackSchema = z.object({
  trackId: z.string().describe("轨道ID"),
  trackType: z
    .enum([
      AudioTrackType.DIALOGUE,
      AudioTrackType.NARRATION,
      AudioTrackType.BGM,
      AudioTrackType.AMBIENCE,
      AudioTrackType.SFX,
    ])
    .describe("轨道类型"),
  audioUrl: z.string().describe("音频URL"),
  startTime: z.number().describe("在时间轴上的起始位置（秒）"),
  endTime: z.number().describe("结束时间（秒）"),
  volume: z.number().min(0).max(1).default(1.0).describe("音量 (0-1)"),
  fadeIn: z.number().optional().describe("淡入时长（秒）"),
  fadeOut: z.number().optional().describe("淡出时长（秒）"),
  ducking: z
    .object({
      triggerBy: z.array(z.string()).describe("触发避让的轨道类型"),
      reductionDb: z.number().describe("降低音量（dB）"),
    })
    .optional()
    .describe("避让配置"),
});

export type MixTrack = z.infer<typeof MixTrackSchema>;

/**
 * 混音配置
 */
export const MixingConfigSchema = z.object({
  tracks: z.array(MixTrackSchema).max(8).describe("轨道列表（最多8轨）"),
  normalize: z.boolean().default(true).describe("是否标准化"),
  targetLufs: z.number().default(-14).describe("目标响度，默认-14"),
});

export type MixingConfig = z.infer<typeof MixingConfigSchema>;

/**
 * 音频任务配置（联合类型）
 */
export const AudioTaskConfigSchema = z.object({
  ttsConfig: TTSConfigSchema.optional(),
  lipSyncConfig: LipSyncConfigSchema.optional(),
  bgmConfig: BGMConfigSchema.optional(),
  ambienceConfig: AmbienceConfigSchema.optional(),
  mixingConfig: MixingConfigSchema.optional(),
});

export type AudioTaskConfig = z.infer<typeof AudioTaskConfigSchema>;

/**
 * 进度信息
 */
export const AudioGenProgressSchema = z.object({
  percentage: z.number().min(0).max(100).default(0).describe("进度百分比"),
  currentStep: z.string().default("").describe("当前步骤"),
  message: z.string().optional().describe("消息"),
});

export type AudioGenProgress = z.infer<typeof AudioGenProgressSchema>;

/**
 * 成本信息
 */
export const AudioGenCostSchema = z.object({
  estimatedCost: z.number().default(0).describe("预估成本"),
  actualCost: z.number().default(0).describe("实际成本"),
  currency: z.string().default("CNY").describe("货币单位"),
});

export type AudioGenCost = z.infer<typeof AudioGenCostSchema>;

/**
 * 错误信息
 */
export const AudioGenErrorSchema = z.object({
  code: z.number().describe("错误码"),
  message: z.string().describe("错误信息"),
  details: z.string().optional().describe("详细错误信息"),
});

export type AudioGenError = z.infer<typeof AudioGenErrorSchema>;

/**
 * 文件信息
 */
export const AudioFileSchema = z.object({
  url: z.string().describe("文件URL"),
  format: z
    .enum([AudioFormat.WAV, AudioFormat.MP3, AudioFormat.MP4])
    .describe("格式"),
  duration: z.number().describe("时长（秒）"),
  size: z.number().describe("文件大小（字节）"),
  sampleRate: z.number().optional().describe("采样率"),
  bitrate: z.number().optional().describe("码率"),
});

export type AudioFile = z.infer<typeof AudioFileSchema>;

/**
 * 混音统计
 */
export const MixingStatsSchema = z.object({
  lufs: z.number().describe("响度"),
  truePeak: z.number().describe("真实峰值"),
  dynamicRange: z.number().describe("动态范围"),
});

export type MixingStats = z.infer<typeof MixingStatsSchema>;

/**
 * 对口型同步区域
 */
export const SyncedRegionSchema = z.object({
  start: z.number().describe("开始时间"),
  end: z.number().describe("结束时间"),
  confidence: z.number().min(0).max(1).describe("置信度"),
});

export type SyncedRegion = z.infer<typeof SyncedRegionSchema>;

/**
 * 输出元数据
 */
export const AudioOutputMetadataSchema = z.object({
  // TTS 元数据
  speakerId: z.string().optional(),
  text: z.string().optional(),
  emotion: z.string().optional(),
  // BGM 元数据
  bpm: z.number().optional(),
  keyPoints: z.array(z.number()).optional(),
  // 混音元数据
  stats: MixingStatsSchema.optional(),
  // 对口型元数据
  syncedRegions: z.array(SyncedRegionSchema).optional(),
});

export type AudioOutputMetadata = z.infer<typeof AudioOutputMetadataSchema>;

/**
 * 审核状态
 */
export const AudioModerationSchema = z.object({
  status: z
    .enum([
      AudioModerationStatus.PENDING,
      AudioModerationStatus.APPROVED,
      AudioModerationStatus.REJECTED,
    ])
    .default(AudioModerationStatus.PENDING)
    .describe("审核状态"),
  checkedAt: z.string().datetime().optional().describe("审核时间"),
  rejectReason: z.string().optional().describe("拒绝原因"),
});

export type AudioModeration = z.infer<typeof AudioModerationSchema>;

// ==================== 请求 DTOs ====================

/**
 * 输出配置
 */
export const AudioOutputConfigSchema = z.object({
  format: z
    .enum([AudioFormat.WAV, AudioFormat.MP3])
    .default(AudioFormat.WAV)
    .describe("输出格式"),
  sampleRate: z
    .union([z.literal(16000), z.literal(24000), z.literal(48000)])
    .optional()
    .describe("采样率"),
  fadeIn: z.number().optional().describe("淡入时长（秒）"),
  fadeOut: z.number().optional().describe("淡出时长（秒）"),
});

export type AudioOutputConfig = z.infer<typeof AudioOutputConfigSchema>;

/**
 * 提交 TTS 任务 DTO
 */
export const CreateTTSTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  config: TTSConfigSchema.describe("TTS配置"),
  outputConfig: AudioOutputConfigSchema.optional().describe("输出配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateTTSTaskDto = z.infer<typeof CreateTTSTaskSchema>;

/**
 * 提交对口型任务 DTO
 */
export const CreateLipSyncTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  config: LipSyncConfigSchema.describe("对口型配置"),
  outputConfig: z
    .object({
      resolution: z
        .enum(["480p", "720p", "1080p"])
        .optional()
        .describe("输出分辨率"),
    })
    .optional()
    .describe("输出配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateLipSyncTaskDto = z.infer<typeof CreateLipSyncTaskSchema>;

/**
 * 提交 BGM 任务 DTO
 */
export const CreateBGMTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  config: BGMConfigSchema.describe("BGM配置"),
  outputConfig: AudioOutputConfigSchema.optional().describe("输出配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateBGMTaskDto = z.infer<typeof CreateBGMTaskSchema>;

/**
 * 提交环境音任务 DTO
 */
export const CreateAmbienceTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  config: AmbienceConfigSchema.describe("环境音配置"),
  outputConfig: z
    .object({
      format: z.enum([AudioFormat.WAV, AudioFormat.MP3]).optional(),
      separateSfx: z
        .boolean()
        .default(false)
        .describe("是否分离动态音效为单独文件"),
    })
    .optional()
    .describe("输出配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateAmbienceTaskDto = z.infer<typeof CreateAmbienceTaskSchema>;

/**
 * 提交混音任务 DTO
 */
export const CreateMixingTaskSchema = z.object({
  projectId: z.string().describe("项目ID"),
  config: MixingConfigSchema.describe("混音配置"),
  outputConfig: z
    .object({
      format: z.enum([AudioFormat.WAV, AudioFormat.MP3]).optional(),
    })
    .optional()
    .describe("输出配置"),
  notifyWs: z.boolean().default(true).describe("是否通过 WebSocket 通知进度"),
});

export type CreateMixingTaskDto = z.infer<typeof CreateMixingTaskSchema>;

/**
 * 取消任务 DTO
 */
export const CancelAudioGenTaskSchema = z.object({
  taskId: z.string().describe("任务ID"),
});

export type CancelAudioGenTaskDto = z.infer<typeof CancelAudioGenTaskSchema>;

// ==================== 内部接口 DTOs ====================

/**
 * 内部 TTS 请求 DTO
 */
export const InternalTTSSchema = z.object({
  projectId: z.string().describe("项目ID"),
  speakerId: z.string().describe("角色ID"),
  text: z.string().max(500).describe("文本"),
  emotion: z.string().optional(),
  speed: z.number().optional(),
  targetDuration: z.number().optional(),
});

export type InternalTTSDto = z.infer<typeof InternalTTSSchema>;

/**
 * 内部对口型请求 DTO
 */
export const InternalLipSyncSchema = z.object({
  projectId: z.string().describe("项目ID"),
  videoUrl: z.string().describe("视频URL"),
  audioUrl: z.string().describe("音频URL"),
  referenceMode: z.enum([
    AudioGenReferenceMode.SINGLE_REFERENCE,
    AudioGenReferenceMode.MULTI_REFERENCE,
  ]),
  characterId: z.string().describe("角色ID"),
});

export type InternalLipSyncDto = z.infer<typeof InternalLipSyncSchema>;

/**
 * 内部混音请求 DTO
 */
export const InternalMixingSchema = z.object({
  projectId: z.string().describe("项目ID"),
  tracks: z
    .array(
      z.object({
        audioUrl: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        volume: z.number(),
      }),
    )
    .describe("轨道列表"),
  outputFormat: z
    .enum([AudioFormat.WAV, AudioFormat.MP3])
    .default(AudioFormat.WAV),
});

export type InternalMixingDto = z.infer<typeof InternalMixingSchema>;

/**
 * 全局混音请求 DTO（video-edit 调用）
 */
export const InternalMasterMixSchema = z.object({
  projectId: z.string().describe("项目ID"),
  timelineId: z.string().describe("时间轴ID"),
  audioClips: z
    .object({
      dialogueClips: z
        .array(
          z.object({
            shotId: z.string(),
            audioUrl: z.string(),
            startTime: z.number(),
            endTime: z.number(),
          }),
        )
        .describe("对白片段"),
      narrationSegments: z
        .array(
          z.object({
            text: z.string(),
            speakerId: z.string(),
            startTime: z.number(),
            endTime: z.number(),
          }),
        )
        .optional()
        .describe("旁白段落"),
    })
    .describe("时间轴音频片段"),
  bgmConfig: z
    .object({
      emotionCurve: z.array(EmotionPointSchema),
      style: z.string().optional(),
    })
    .optional()
    .describe("BGM配置"),
  ambienceConfig: z
    .object({
      sceneTags: z.array(z.string()),
      duration: z.number(),
    })
    .optional()
    .describe("环境音配置"),
  outputConfig: z
    .object({
      format: z
        .enum([AudioFormat.WAV, AudioFormat.MP3])
        .default(AudioFormat.WAV),
      targetLufs: z.number().default(-14),
    })
    .describe("输出配置"),
  callbackUrl: z.string().optional().describe("回调URL"),
});

export type InternalMasterMixDto = z.infer<typeof InternalMasterMixSchema>;

// ==================== Response DTOs ====================

/**
 * 音频输出结果 DTO
 */
export interface AudioGenOutputDto {
  id: string;
  type: AudioGenOutputType;
  file: AudioFile;
  metadata?: AudioOutputMetadata;
  moderation?: AudioModeration;
  createdAt: string;
}

/**
 * 提交音频生成任务响应
 */
export interface CreateAudioGenTaskResponseDto {
  taskId: string;
  status: AudioGenTaskStatus;
  estimatedCost: number;
  estimatedTime?: number;
}

/**
 * 任务详情响应
 */
export interface AudioGenTaskDetailDto {
  id: string;
  generationTaskId?: string;
  projectId: string;
  type: AudioGenTaskType;
  status: AudioGenTaskStatus;
  config: AudioTaskConfig;
  progress: AudioGenProgress;
  cost: AudioGenCost;
  outputs?: AudioGenOutputDto[];
  error?: AudioGenError;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * 取消任务响应
 */
export interface CancelAudioGenTaskResponseDto {
  taskId: string;
  status: "cancelled" | "cancelling";
  refundAmount: number;
}

/**
 * 内部 TTS 响应
 */
export interface InternalTTSResponseDto {
  audioUrl: string;
  duration: number;
  format: AudioFormat;
}

/**
 * 内部对口型响应
 */
export interface InternalLipSyncResponseDto {
  videoUrl: string;
  syncedRegions: SyncedRegion[];
}

/**
 * 内部混音响应
 */
export interface InternalMixingResponseDto {
  mixedAudioUrl: string;
  duration: number;
}

/**
 * 全局混音回调数据
 */
export interface MasterMixCallbackData {
  event: "master_mix_completed";
  data: {
    taskId: string;
    projectId: string;
    timelineId: string;
    outputs: {
      dialogue: string;
      narration?: string;
      bgm: string;
      ambience: string;
      master: string;
    };
    stats: {
      duration: number;
      lufs: number;
      truePeak: number;
    };
  };
}

// ==================== WebSocket 类型 ====================

/**
 * 任务进度 WebSocket 通知
 */
export interface AudioGenProgressWebSocketDto {
  type: "audio_gen_progress";
  data: {
    taskId: string;
    projectId: string;
    type: AudioGenTaskType;
    status: AudioGenTaskStatus;
    progress: AudioGenProgress;
  };
  timestamp: number;
}

/**
 * 任务完成 WebSocket 通知
 */
export interface AudioGenCompletedWebSocketDto {
  type: "audio_gen_completed";
  data: {
    taskId: string;
    projectId: string;
    type: AudioGenTaskType;
    status: AudioGenTaskStatus;
    outputs: Array<{
      type: AudioGenOutputType;
      url: string;
      duration: number;
    }>;
  };
  timestamp: number;
}

// ==================== 前端状态类型 ====================

/**
 * 音频生成状态（Pinia）
 */
export interface AudioGenState {
  // 当前任务
  currentTask: AudioGenTaskDetailDto | null;
  taskLoading: boolean;

  // 任务列表
  tasks: AudioGenTaskDetailDto[];
  tasksLoading: boolean;
  tasksTotal: number;

  // 生成中任务
  activeTasks: AudioGenTaskDetailDto[];

  // TTS 状态
  ttsLoading: boolean;
  ttsProgress: AudioGenProgress | null;

  // 对口型状态
  lipSyncLoading: boolean;
  lipSyncProgress: AudioGenProgress | null;

  // BGM 状态
  bgmLoading: boolean;
  bgmResults: AudioGenOutputDto[];

  // 混音状态
  mixingLoading: boolean;
  mixingProgress: AudioGenProgress | null;
}

/**
 * 任务类型描述
 */
export const AUDIO_GEN_TYPE_DESCRIPTIONS: Record<
  AudioGenTaskType,
  { label: string; description: string }
> = {
  [AudioGenTaskType.TTS]: {
    label: "语音合成",
    description: "文本转语音，为角色对话和旁白生成配音",
  },
  [AudioGenTaskType.LIP_SYNC]: {
    label: "对口型",
    description: "将音频与视频合成，实现口型同步",
  },
  [AudioGenTaskType.BGM]: {
    label: "背景音乐",
    description: "根据情绪曲线匹配或生成背景音乐",
  },
  [AudioGenTaskType.AMBIENCE]: {
    label: "环境音效",
    description: "根据场景标签匹配环境音效",
  },
  [AudioGenTaskType.MIXING]: {
    label: "音频混音",
    description: "多轨道音频混合输出",
  },
};

/**
 * 任务状态描述
 */
export const AUDIO_GEN_STATUS_DESCRIPTIONS: Record<
  AudioGenTaskStatus,
  { label: string; color: string }
> = {
  [AudioGenTaskStatus.PENDING]: { label: "待提交", color: "default" },
  [AudioGenTaskStatus.QUEUED]: { label: "排队中", color: "warning" },
  [AudioGenTaskStatus.PROCESSING]: { label: "处理中", color: "processing" },
  [AudioGenTaskStatus.COMPLETED]: { label: "已完成", color: "success" },
  [AudioGenTaskStatus.FAILED]: { label: "失败", color: "error" },
  [AudioGenTaskStatus.CANCELLED]: { label: "已取消", color: "default" },
};

/**
 * 音频轨道类型描述
 */
export const AUDIO_TRACK_TYPE_DESCRIPTIONS: Record<
  AudioTrackType,
  { label: string; defaultVolume: number; priority: number }
> = {
  [AudioTrackType.DIALOGUE]: { label: "对白", defaultVolume: 1.0, priority: 5 },
  [AudioTrackType.NARRATION]: {
    label: "旁白",
    defaultVolume: 0.7,
    priority: 4,
  },
  [AudioTrackType.BGM]: { label: "背景音乐", defaultVolume: 0.25, priority: 3 },
  [AudioTrackType.AMBIENCE]: {
    label: "环境音",
    defaultVolume: 0.15,
    priority: 2,
  },
  [AudioTrackType.SFX]: { label: "音效", defaultVolume: 0.5, priority: 4 },
};

/**
 * 情绪类型描述
 */
export const EMOTION_TYPE_DESCRIPTIONS: Record<
  EmotionType,
  { label: string; emoji: string }
> = {
  [EmotionType.NEUTRAL]: { label: "平静", emoji: "😐" },
  [EmotionType.HAPPY]: { label: "开心", emoji: "😊" },
  [EmotionType.SAD]: { label: "悲伤", emoji: "😢" },
  [EmotionType.ANGRY]: { label: "愤怒", emoji: "😠" },
  [EmotionType.EXCITED]: { label: "兴奋", emoji: "🤩" },
  [EmotionType.FEARFUL]: { label: "恐惧", emoji: "😨" },
  [EmotionType.SURPRISED]: { label: "惊讶", emoji: "😲" },
};

// ==================== TTS 音色管理 DTOs ====================

/**
 * 创建 TTS 音色 DTO
 */
export const CreateTtsVoiceSchema = z.object({
  voiceId: z.string().describe("千问 TTS 音色 ID，如 Cherry, Ethan"),
  name: z.string().describe("显示名称，如 芊悦, 晨煦"),
  gender: z.enum(["female", "male", "child"]).describe("性别"),
  category: z.string().optional().describe("分类：standard, dialect"),
  style: z.string().optional().describe("风格描述"),
  previewAudioUrl: z.string().optional().describe("试听音频 URL"),
  isActive: z.boolean().optional().default(true).describe("是否启用"),
  sortOrder: z.number().optional().default(0).describe("排序"),
});

export type CreateTtsVoiceDto = z.infer<typeof CreateTtsVoiceSchema>;

/**
 * 更新 TTS 音色 DTO
 */
export const UpdateTtsVoiceSchema = z.object({
  voiceId: z.string().optional(),
  name: z.string().optional(),
  gender: z.enum(["female", "male", "child"]).optional(),
  category: z.string().optional().nullable(),
  style: z.string().optional().nullable(),
  previewAudioUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export type UpdateTtsVoiceDto = z.infer<typeof UpdateTtsVoiceSchema>;

// ==================== TTS 指令模板管理 DTOs ====================

/**
 * 创建 TTS 指令模板 DTO
 */
export const CreateTtsInstructionTemplateSchema = z.object({
  name: z.string().describe("模板名称"),
  description: z.string().optional().describe("模板描述"),
  category: z
    .string()
    .optional()
    .describe("分类：emotion, style, scene, speed"),
  content: z.string().describe("指令内容"),
  isSystem: z.boolean().optional().default(false).describe("是否系统模板"),
  isActive: z.boolean().optional().default(true).describe("是否启用"),
});

export type CreateTtsInstructionTemplateDto = z.infer<
  typeof CreateTtsInstructionTemplateSchema
>;

/**
 * 更新 TTS 指令模板 DTO
 */
export const UpdateTtsInstructionTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  content: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTtsInstructionTemplateDto = z.infer<
  typeof UpdateTtsInstructionTemplateSchema
>;

import { z } from "zod";

// ==================== 枚举常量 ====================

/**
 * 分镜状态
 */
export const StoryboardStatus = {
  PENDING_ASSET: "pending_asset",
  READY_FOR_DESCRIPTION: "ready_for_description",
  GENERATED: "generated",
  ROUGH_CUT: "rough_cut",
  AUDIO_MIXED: "audio_mixed",
  FINAL_CUT: "final_cut",
  EXPORTED: "exported",
  FAILED: "failed",
  SKIPPED: "skipped",
} as const;

export type StoryboardStatus =
  (typeof StoryboardStatus)[keyof typeof StoryboardStatus];

/**
 * 景别类型
 */
export const ShotType = {
  EXTREME_WIDE: "extreme_wide",
  WIDE: "wide",
  MEDIUM: "medium",
  CLOSE_UP: "close_up",
  EXTREME_CLOSE_UP: "extreme_close_up",
  ESTABLISHING: "establishing",
} as const;

export type ShotType = (typeof ShotType)[keyof typeof ShotType];

/**
 * 机位角度
 */
export const CameraAngle = {
  EYE_LEVEL: "eye_level",
  LOW: "low",
  HIGH: "high",
  DUTCH: "dutch",
  OVERHEAD: "overhead",
  BIRD_EYE: "bird_eye",
} as const;

export type CameraAngle = (typeof CameraAngle)[keyof typeof CameraAngle];

/**
 * 运镜方式
 */
export const CameraMovement = {
  STATIC: "static",
  PAN: "pan",
  TILT: "tilt",
  DOLLY_IN: "dolly_in",
  DOLLY_OUT: "dolly_out",
  TRUCK: "truck",
  CRANE: "crane",
  HANDHELD: "handheld",
} as const;

export type CameraMovement =
  (typeof CameraMovement)[keyof typeof CameraMovement];

/**
 * 景深类型
 */
export const FocusType = {
  SHALLOW: "shallow",
  DEEP: "deep",
} as const;

export type FocusType = (typeof FocusType)[keyof typeof FocusType];

/**
 * 转场类型（入点）
 */
export const TransitionInType = {
  CUT: "cut",
  FADE_IN: "fade_in",
  DISSOLVE: "dissolve",
  WIPE: "wipe",
  SLIDE: "slide",
} as const;

export type TransitionInType =
  (typeof TransitionInType)[keyof typeof TransitionInType];

/**
 * 转场类型（出点）
 */
export const TransitionOutType = {
  CUT: "cut",
  FADE_OUT: "fade_out",
  DISSOLVE: "dissolve",
  WIPE: "wipe",
  SLIDE: "slide",
} as const;

export type TransitionOutType =
  (typeof TransitionOutType)[keyof typeof TransitionOutType];

/**
 * 音频类型
 */
export const AudioType = {
  DIALOGUE: "dialogue",
  VOICEOVER: "voiceover",
  AMBIENT: "ambient",
  SILENT: "silent",
} as const;

export type AudioType = (typeof AudioType)[keyof typeof AudioType];

/**
 * 画面位置
 */
export const CharacterPosition = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  FOREGROUND: "foreground",
  BACKGROUND: "background",
} as const;

export type CharacterPosition =
  (typeof CharacterPosition)[keyof typeof CharacterPosition];

/**
 * 主次关系
 */
export const CharacterEmphasis = {
  MAIN: "main",
  SECONDARY: "secondary",
} as const;

export type CharacterEmphasis =
  (typeof CharacterEmphasis)[keyof typeof CharacterEmphasis];

/**
 * 图片类型
 */
export const StoryboardImageType = {
  STORYBOARD: "storyboard",
  REFERENCE: "reference",
  VARIATION: "variation",
} as const;

export type StoryboardImageType =
  (typeof StoryboardImageType)[keyof typeof StoryboardImageType];

// ==================== JSONB 子结构 ====================

/**
 * 镜头设置
 */
export const StoryboardShotSchema = z.object({
  shotType: z
    .enum([
      ShotType.EXTREME_WIDE,
      ShotType.WIDE,
      ShotType.MEDIUM,
      ShotType.CLOSE_UP,
      ShotType.EXTREME_CLOSE_UP,
      ShotType.ESTABLISHING,
    ])
    .default(ShotType.MEDIUM)
    .describe("景别"),
  angle: z
    .enum([
      CameraAngle.EYE_LEVEL,
      CameraAngle.LOW,
      CameraAngle.HIGH,
      CameraAngle.DUTCH,
      CameraAngle.OVERHEAD,
      CameraAngle.BIRD_EYE,
    ])
    .optional()
    .describe("角度"),
  movement: z
    .enum([
      CameraMovement.STATIC,
      CameraMovement.PAN,
      CameraMovement.TILT,
      CameraMovement.DOLLY_IN,
      CameraMovement.DOLLY_OUT,
      CameraMovement.TRUCK,
      CameraMovement.CRANE,
      CameraMovement.HANDHELD,
    ])
    .optional()
    .describe("运镜"),
  movementDescription: z.string().max(200).optional().describe("运镜描述"),
  focus: z
    .enum([FocusType.SHALLOW, FocusType.DEEP])
    .optional()
    .describe("景深"),
});

export type StoryboardShot = z.infer<typeof StoryboardShotSchema>;

/**
 * 时间设置
 */
export const StoryboardTimingSchema = z.object({
  duration: z.number().int().min(1).max(30).default(3).describe("时长（秒）"),
  transitionIn: z
    .enum([
      TransitionInType.CUT,
      TransitionInType.FADE_IN,
      TransitionInType.DISSOLVE,
      TransitionInType.WIPE,
      TransitionInType.SLIDE,
    ])
    .optional()
    .describe("入点转场"),
  transitionOut: z
    .enum([
      TransitionOutType.CUT,
      TransitionOutType.FADE_OUT,
      TransitionOutType.DISSOLVE,
      TransitionOutType.WIPE,
      TransitionOutType.SLIDE,
    ])
    .optional()
    .describe("出点转场"),
  transitionDuration: z
    .number()
    .min(0.1)
    .max(5)
    .optional()
    .describe("转场时长（秒）"),
});

export type StoryboardTiming = z.infer<typeof StoryboardTimingSchema>;

/**
 * 音频设置
 */
export const StoryboardAudioSchema = z.object({
  type: z
    .enum([
      AudioType.DIALOGUE,
      AudioType.VOICEOVER,
      AudioType.AMBIENT,
      AudioType.SILENT,
    ])
    .default(AudioType.SILENT)
    .describe("音频类型"),
  dialogueText: z.string().max(1000).optional().describe("对白文本"),
  dialogueCharacterId: z.string().optional().describe("对白角色ID"),
  dialogueEmotion: z.string().max(50).optional().describe("对白情绪"),
  voiceoverText: z.string().max(1000).optional().describe("旁白文本"),
  soundEffects: z.array(z.string()).optional().describe("音效描述数组"),
  musicMood: z.string().max(50).optional().describe("音乐氛围"),
});

export type StoryboardAudio = z.infer<typeof StoryboardAudioSchema>;

/**
 * 角色出镜信息
 */
export const StoryboardCharacterSchema = z.object({
  characterId: z.string().describe("角色ID"),
  position: z
    .enum([
      CharacterPosition.LEFT,
      CharacterPosition.CENTER,
      CharacterPosition.RIGHT,
      CharacterPosition.FOREGROUND,
      CharacterPosition.BACKGROUND,
    ])
    .default(CharacterPosition.CENTER)
    .describe("画面位置"),
  emphasis: z
    .enum([CharacterEmphasis.MAIN, CharacterEmphasis.SECONDARY])
    .default(CharacterEmphasis.MAIN)
    .describe("主次关系"),
  action: z.string().max(200).optional().describe("角色动作描述"),
});

export type StoryboardCharacter = z.infer<typeof StoryboardCharacterSchema>;

/**
 * 生成信息
 */
export const StoryboardGenerationInfoSchema = z.object({
  generationId: z.string().describe("生成任务ID"),
  prompt: z.string().describe("使用的提示词"),
  negativePrompt: z.string().optional().describe("负面提示词"),
  modelId: z.string().describe("使用的模型ID"),
  seed: z.number().optional().describe("随机种子"),
  createdAt: z.string().datetime().describe("生成时间"),
});

export type StoryboardGenerationInfo = z.infer<
  typeof StoryboardGenerationInfoSchema
>;

/**
 * 上传信息
 */
export const StoryboardUploadInfoSchema = z.object({
  originalFilename: z.string().describe("原始文件名"),
  fileSize: z.number().describe("文件大小（字节）"),
  mimeType: z.string().describe("MIME类型"),
  uploadedAt: z.string().datetime().describe("上传时间"),
});

export type StoryboardUploadInfo = z.infer<typeof StoryboardUploadInfoSchema>;

// ==================== 请求 DTOs ====================

/**
 * 创建分镜 DTO
 */
export const CreateStoryboardSchema = z.object({
  scriptId: z.string().optional().describe("关联剧本ID"),
  sceneId: z.string().optional().describe("关联场景ID"),
  scriptSequenceRef: z.number().int().optional().describe("关联剧本场次序号"),
  description: z.string().min(1).max(500).describe("画面描述"),
  insertAfter: z
    .number()
    .int()
    .optional()
    .describe("插入到指定序号之后，不传则追加到最后"),
  shot: StoryboardShotSchema.optional().describe("镜头设置"),
  timing: StoryboardTimingSchema.optional().describe("时间设置"),
  audio: StoryboardAudioSchema.optional().describe("音频设置"),
  characters: z
    .array(StoryboardCharacterSchema)
    .max(5)
    .optional()
    .describe("出镜角色"),
});

export type CreateStoryboardDto = z.infer<typeof CreateStoryboardSchema>;

/**
 * 更新分镜 DTO
 */
export const UpdateStoryboardSchema = z
  .object({
    sceneId: z.string().optional().nullable().describe("关联场景ID"),
    scriptSequenceRef: z
      .number()
      .int()
      .optional()
      .nullable()
      .describe("关联剧本场次序号"),
    description: z.string().min(1).max(500).optional().describe("画面描述"),
    generationPrompt: z.string().optional().nullable().describe("AI生成提示词"),
    shot: StoryboardShotSchema.optional().describe("镜头设置"),
    timing: StoryboardTimingSchema.optional().describe("时间设置"),
    audio: StoryboardAudioSchema.optional().describe("音频设置"),
    characters: z
      .array(StoryboardCharacterSchema)
      .max(5)
      .optional()
      .describe("出镜角色（全量替换）"),
  })
  .strict();

export type UpdateStoryboardDto = z.infer<typeof UpdateStoryboardSchema>;

/**
 * 查询分镜列表参数
 */
export const QueryStoryboardsSchema = z.object({
  sceneId: z.string().optional().describe("按场景筛选"),
  status: z
    .enum([
      StoryboardStatus.PENDING_ASSET,
      StoryboardStatus.READY_FOR_DESCRIPTION,
      StoryboardStatus.GENERATED,
      StoryboardStatus.ROUGH_CUT,
      StoryboardStatus.AUDIO_MIXED,
      StoryboardStatus.FINAL_CUT,
      StoryboardStatus.EXPORTED,
      StoryboardStatus.FAILED,
      StoryboardStatus.SKIPPED,
    ])
    .optional()
    .describe("按状态筛选"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("每页数量"),
});

export type QueryStoryboardsDto = z.infer<typeof QueryStoryboardsSchema>;

/**
 * 批量重排序 DTO
 */
export const ReorderStoryboardsSchema = z.object({
  storyboardIds: z
    .array(z.string())
    .min(1)
    .describe("按目标顺序排列的分镜ID数组"),
});

export type ReorderStoryboardsDto = z.infer<typeof ReorderStoryboardsSchema>;

/**
 * 批量更新状态 DTO
 */
export const BatchUpdateStatusSchema = z.object({
  storyboardIds: z.array(z.string()).min(1).describe("分镜ID列表"),
  status: z
    .enum([
      StoryboardStatus.PENDING_ASSET,
      StoryboardStatus.READY_FOR_DESCRIPTION,
      StoryboardStatus.GENERATED,
      StoryboardStatus.ROUGH_CUT,
      StoryboardStatus.AUDIO_MIXED,
      StoryboardStatus.FINAL_CUT,
      StoryboardStatus.EXPORTED,
      StoryboardStatus.FAILED,
      StoryboardStatus.SKIPPED,
    ])
    .describe("目标状态"),
});

export type BatchUpdateStatusDto = z.infer<typeof BatchUpdateStatusSchema>;

/**
 * 生成分镜 DTO
 */
export const GenerateStoryboardsSchema = z.object({
  strategy: z
    .enum(["scene_based", "paragraph_based"])
    .default("scene_based")
    .describe("生成策略：scene_based(按场景)/paragraph_based(按段落)"),
});

export type GenerateStoryboardsDto = z.infer<typeof GenerateStoryboardsSchema>;

/**
 * 生成预览图 DTO
 */
export const GenerateStoryboardImageSchema = z.object({
  style: z.string().optional().describe("画风风格，不传则使用项目默认"),
  count: z.number().int().min(1).max(3).default(1).describe("生成数量"),
  promptOverride: z.string().optional().describe("覆盖默认提示词"),
});

export type GenerateStoryboardImageDto = z.infer<
  typeof GenerateStoryboardImageSchema
>;

// ==================== Response DTOs ====================

/**
 * 分镜图片响应
 */
export interface StoryboardImageDto {
  id: string;
  type: StoryboardImageType;
  url: string;
  thumbnailUrl: string | null;
  generation: StoryboardGenerationInfo | null;
  uploadInfo: StoryboardUploadInfo | null;
  version: number;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * 角色出镜响应
 */
export interface StoryboardCharacterDto {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar?: string;
  position: CharacterPosition;
  emphasis: CharacterEmphasis;
  action: string | null;
}

/**
 * 分镜列表项响应
 */
export interface StoryboardListItemDto {
  id: string;
  sequenceNumber: number;
  sceneId: string | null;
  sceneName: string | null;
  description: string;
  status: StoryboardStatus;
  thumbnailUrl: string | null;
  duration: number;
  shotType: ShotType;
  characterCount: number;
  updatedAt: string;
}

/**
 * 分镜详情响应
 */
export interface StoryboardDetailDto {
  id: string;
  projectId: string;
  scriptId: string | null;
  sequenceNumber: number;
  sceneId: string | null;
  sceneName: string | null;
  scriptSequenceRef: number | null;
  description: string;
  generationPrompt: string | null;
  status: StoryboardStatus;
  shot: StoryboardShot;
  timing: StoryboardTiming;
  audio: StoryboardAudio;
  characters: StoryboardCharacterDto[];
  images: StoryboardImageDto[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * 生成任务响应
 */
export interface GenerateStoryboardsTaskDto {
  jobId: string;
  estimatedCount: number;
}

/**
 * 生成图片任务响应
 */
export interface GenerateStoryboardImageTaskDto {
  jobId: string;
  estimatedSeconds: number;
}

/**
 * 故事板视图数据
 */
export interface StoryboardViewDataDto {
  totalDuration: number;
  storyboardCount: number;
  groups: Array<{
    sceneId: string | null;
    sceneName: string | null;
    sceneOrder: number | null;
    items: Array<{
      id: string;
      sequenceNumber: number;
      thumbnailUrl: string | null;
      description: string;
      duration: number;
      shotType: ShotType;
      status: StoryboardStatus;
    }>;
  }>;
}

/**
 * 时间线视图数据
 */
export interface StoryboardTimelineDataDto {
  totalDuration: number;
  tracks: {
    video: Array<{
      id: string;
      sequenceNumber: number;
      startTime: number;
      duration: number;
      thumbnailUrl: string | null;
      transition: string | null;
    }>;
    audio: Array<{
      type: "dialogue" | "voiceover" | "sfx" | "music";
      storyboardId?: string;
      startTime: number;
      duration?: number;
      text?: string;
      description?: string;
    }>;
  };
}

/**
 * 状态更新结果
 */
export interface BatchUpdateStatusResultDto {
  updatedIds: string[];
  totalDuration: number;
}

// ==================== 前端状态类型 ====================

/**
 * 分镜状态（Pinia）
 */
export interface StoryboardState {
  storyboards: StoryboardListItemDto[];
  total: number;
  loading: boolean;
  currentId: string | null;
  currentDetail: StoryboardDetailDto | null;
  filters: {
    sceneId?: string;
    status?: StoryboardStatus;
  };
  viewMode: "grid" | "timeline";
  groupBy: "none" | "scene";
  editorVisible: boolean;
  editorLoading: boolean;
  generatingJobs: Map<string, { status: string; progress?: number }>;
}

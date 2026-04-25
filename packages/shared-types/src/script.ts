import { z } from "zod";

/**
 * 剧本状态
 */
export const ScriptStatus = {
  DRAFT: "draft",
  EDITING: "editing",
  AI_GENERATING: "ai_generating",
  CONFIRMED: "confirmed",
} as const;

export type ScriptStatus = (typeof ScriptStatus)[keyof typeof ScriptStatus];

/**
 * AI 任务类型
 */
export const AITaskType = {
  GENERATE: "generate",
  PARSE: "parse",
  CONTINUE: "continue",
  REWRITE: "rewrite",
  EXPAND: "expand",
  CONDENSE: "condense",
} as const;

export type AITaskType = (typeof AITaskType)[keyof typeof AITaskType];

/**
 * AI 任务状态
 */
export const AITaskStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type AITaskStatus = (typeof AITaskStatus)[keyof typeof AITaskStatus];

/**
 * 资产类型
 */
export const AssetType = {
  CHARACTER: "character",
  SCENE: "scene",
  PROP: "prop",
} as const;

export type AssetType = (typeof AssetType)[keyof typeof AssetType];

/**
 * 资产关联状态
 */
export const AssetStatus = {
  NONE: "none",
  IMPORTED: "imported",
  WILL_CREATE: "will_create",
} as const;

export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

/**
 * 段落类型
 */
export const ParagraphType = {
  ACTION: "action",
  DIALOGUE: "dialogue",
  NARRATION: "narration",
} as const;

export type ParagraphType = (typeof ParagraphType)[keyof typeof ParagraphType];

/**
 * 段落结构（向后兼容，用于旧版 AI 编辑组件）
 * @deprecated 已废弃，新代码请使用 Dialogue 或 StoryboardRef
 */
export interface Paragraph {
  id: string;
  type: ParagraphType;
  content: string;
  character?: string;
  emotion?: string;
  actions?: string[];
}

/**
 * 角色重要性
 */
export const CharacterImportance = {
  PROTAGONIST: "protagonist",
  SUPPORTING: "supporting",
  MINOR: "minor",
} as const;

export type CharacterImportance =
  (typeof CharacterImportance)[keyof typeof CharacterImportance];

/**
 * 剧本来源
 */
export const ScriptSource = {
  AI: "ai",
  IMPORT: "import",
  MANUAL: "manual",
} as const;

export type ScriptSource = (typeof ScriptSource)[keyof typeof ScriptSource];

// ==================== JSONB 子结构 ====================

/**
 * 场景设置
 */
export const SceneSettingSchema = z.object({
  time: z.string().describe('时间描述，如"傍晚"'),
  location: z.string().describe('地点描述，如"废弃工厂"'),
  atmosphere: z.string().describe('氛围，如"阴森紧张"'),
  tags: z.array(z.string()).default([]).describe("场景标签（用于环境音匹配）"),
});

export type SceneSetting = z.infer<typeof SceneSettingSchema>;

// ==================== JSONB 子结构 ====================

/**
 * 场景设置
 */
export const ImportedAssetSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceAssetId: z.string().describe("源资产ID"),
  localAssetId: z.string().describe("复制到当前项目后的资产ID"),
  copiedAt: z.string().datetime().describe("复制时间"),
});

export type ImportedAsset = z.infer<typeof ImportedAssetSchema>;

/**
 * 新建资产计划
 */
export const CreationPlanSchema = z.object({
  useDescription: z.boolean().describe("是否使用剧本描述生成提示词"),
  customPrompt: z.string().optional().describe("用户自定义提示词补充"),
});

export type CreationPlan = z.infer<typeof CreationPlanSchema>;

/**
 * 资产图片 Schema（用于持久化图片数据）
 */
export const AssetImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  thumbnailUrl: z.string().optional(),
  type: z.enum(["main", "angle", "reference", "video_reference"]),
  angleIndex: z.number().optional(),
  createdAt: z.string(),
});

/**
 * 角色引用 - 只存 ID 和剧本特定信息
 * 完整的角色数据（name, description 等）存储在独立的 characters 表
 *
 * Phase 4: 兼容字段已移除，characterId 为必填字段
 */
export const CharacterRefSchema = z.object({
  id: z.string().describe("角色引用ID（剧本内唯一）"),
  characterId: z.string().describe("关联 characters 表的资产ID（必填）"),
  // 剧本特定信息
  importance: z
    .enum([
      CharacterImportance.PROTAGONIST,
      CharacterImportance.SUPPORTING,
      CharacterImportance.MINOR,
    ])
    .describe("重要性"),
  // 资产状态
  assetStatus: z
    .enum([AssetStatus.NONE, AssetStatus.IMPORTED, AssetStatus.WILL_CREATE])
    .default(AssetStatus.NONE)
    .describe("资产关联状态"),
  importedAsset: ImportedAssetSchema.optional().describe("导入的资产信息"),
  creationPlan: CreationPlanSchema.optional().describe("新建资产计划"),
  // 千问 TTS 音色配置（可覆盖角色默认音色）
  voiceId: z.string().optional().describe("剧本级别音色覆盖"),
  voiceInstructions: z.string().optional().describe("剧本级别指令覆盖"),
});

export type CharacterRef = z.infer<typeof CharacterRefSchema>;

/**
 * 场景对话 Schema（解析时使用）
 */
const SceneDialogueSchema = z.object({
  id: z.string().optional(),
  characterName: z.string(),
  text: z.string(),
  emotion: z.string().optional(),
  actions: z.array(z.string()).optional().describe("对话中的动作描述列表"),
  isVoiceover: z.boolean().optional().default(false),
});

/**
 * 场景资产引用 - 只存 ID 和剧本特定信息
 * 完整的场景数据（name, description 等）存储在独立的 scenes 表
 *
 * Phase 4: 兼容字段已移除，sceneId 为必填字段
 */
export const SceneRefSchema = z.object({
  id: z.string().describe("场景引用ID"),
  sceneId: z.string().describe("关联 scenes 表的资产ID（必填）"),
  // 剧本特定信息：场景中的对话列表（解析时从剧本中提取）
  dialogues: z.array(SceneDialogueSchema).optional().describe("场景对话列表"),
  // 资产状态
  assetStatus: z
    .enum([AssetStatus.NONE, AssetStatus.IMPORTED, AssetStatus.WILL_CREATE])
    .default(AssetStatus.NONE)
    .describe("资产关联状态"),
  importedAsset: ImportedAssetSchema.optional().describe("导入的资产信息"),
  creationPlan: CreationPlanSchema.optional().describe("新建资产计划"),
});

export type SceneRef = z.infer<typeof SceneRefSchema>;

/**
 * 道具引用 - 只存 ID 和剧本特定信息
 * 完整的道具数据（name, description 等）存储在独立的 props 表
 *
 * Phase 4: 兼容字段已移除，propId 为必填字段
 */
export const PropRefSchema = z.object({
  id: z.string().describe("道具引用ID"),
  propId: z.string().describe("关联 props 表的资产ID（必填）"),
  // 资产状态
  assetStatus: z
    .enum([AssetStatus.NONE, AssetStatus.IMPORTED, AssetStatus.WILL_CREATE])
    .default(AssetStatus.NONE)
    .describe("资产关联状态"),
  importedAsset: ImportedAssetSchema.optional().describe("导入的资产信息"),
  creationPlan: CreationPlanSchema.optional().describe("新建资产计划"),
});

export type PropRef = z.infer<typeof PropRefSchema>;

// ==================== 分镜组类型定义（重构后）====================

/**
 * 主体检测状态
 */
export const DetectionStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type DetectionStatus =
  (typeof DetectionStatus)[keyof typeof DetectionStatus];

/**
 * 分镜视频模式（重命名后）
 * - audio_reference: 音频驱动视频生成（使用音频影响视频节奏/情绪）
 * - lip_sync: 对口型模式（图片+音频生成对口型视频）
 * - video_only: 纯视频生成（无音频影响）
 */
export const ShotVideoMode = {
  AUDIO_REFERENCE: "audio_reference",
  LIP_SYNC: "lip_sync",
  VIDEO_ONLY: "video_only",
} as const;

export type ShotVideoMode = (typeof ShotVideoMode)[keyof typeof ShotVideoMode];

/**
 * 分镜状态
 */
export const ShotStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type ShotStatus = (typeof ShotStatus)[keyof typeof ShotStatus];

/**
 * 对话 Schema（用于 ShotGroup 内嵌）
 * 注意：此 Schema 需要在 ShotGroupSchema 之前定义
 * Bug-2 修复：使用 z.lazy() 延迟引用 CharacterRegionsSchema
 */
const DialogueSchema = z.object({
  id: z.string().describe("对话 ID"),
  characterId: z.string().optional().describe("角色 ID"),
  characterName: z.string().describe("角色名称"),
  text: z.string().describe("对话文本"),
  emotion: z.string().optional().describe("情绪"),
  isVoiceover: z.boolean().default(false).describe("是否旁白"),
  // 动作描述（可选）
  actions: z.array(z.string()).optional().describe("对话中的动作描述列表"),
  // 音频相关字段
  audioUrl: z.string().optional().describe("生成的音频 URL"),
  audioDuration: z.number().optional().describe("音频时长（秒）"),
  audioStatus: z
    .enum(["pending", "processing", "completed", "failed"])
    .optional()
    .describe("音频生成状态"),
  audioTaskId: z.string().optional().describe("音频生成任务 ID"),
  // 千问 TTS 音色配置
  voiceId: z.string().optional().describe("选中的音色 ID"),
  // 指令控制（用于 qwen3-tts-instruct-flash）
  instructions: z
    .object({
      templateId: z.string().optional().describe("模板 ID"),
      content: z.string().max(1600).describe("指令内容"),
    })
    .optional()
    .describe("TTS 指令配置"),
  // Bug-2 修复：对话独立的角色框选配置（用于对口型视频生成）
  // 使用 z.lazy() 延迟引用，因为 CharacterRegionsSchema 定义在此 Schema 之后
  characterRegions: z.lazy(() => CharacterRegionsSchema).optional().describe("对话独立的角色框选配置"),
});

/**
 * 检测到的主体（主体检测 API 返回后转存）
 * 添加坐标区域，前端根据坐标渲染
 */
export const DetectedSubjectSchema = z.object({
  index: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe("主体序号（1-based，最多5个）"),
  // 主体区域坐标（百分比）
  region: z.object({
    x: z.number().min(0).max(1).describe("左上角 x 坐标（百分比 0-1）"),
    y: z.number().min(0).max(1).describe("左上角 y 坐标（百分比 0-1）"),
    width: z.number().min(0).max(1).describe("宽度（百分比 0-1）"),
    height: z.number().min(0).max(1).describe("高度（百分比 0-1）"),
  }).describe("主体区域坐标"),
  // Bug #1 修复：area 字段改为可选，主体检测 API 可能不返回此字段
  area: z.number().optional().describe("面积（排序依据）"),
});

export type DetectedSubject = z.infer<typeof DetectedSubjectSchema>;

/**
 * 单个角色的框选配置
 * 移除 maskKey，只保留坐标信息
 */
export const CharacterRegionConfigSchema = z.object({
  // 自动检测结果的索引（1-5）
  detectedIndex: z
    .number()
    .int()
    .optional()
    .describe("检测到的主体序号（1-5）"),
  // 手动框选坐标
  manualRegion: z
    .object({
      x: z.number().min(0).max(1).describe("百分比 0-1"),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional()
    .describe("手动框选坐标"),
  // 是否使用手动框选
  useManual: z
    .boolean()
    .default(false)
    .describe("true=使用手动框选，false=使用自动检测"),
});

export type CharacterRegionConfig = z.infer<typeof CharacterRegionConfigSchema>;

/**
 * 角色框选配置（mask 已转存）
 * key: characterId（必须存在于 shotGroup.characterIds 中）
 */
export const CharacterRegionsSchema = z.record(CharacterRegionConfigSchema);

export type CharacterRegions = z.infer<typeof CharacterRegionsSchema>;

/**
 * 分镜组级别视频（video_only / audio_reference 使用）
 */
export const ShotGroupVideoSchema = z.object({
  status: z
    .enum([
      ShotStatus.PENDING,
      ShotStatus.PROCESSING,
      ShotStatus.COMPLETED,
      ShotStatus.FAILED,
    ])
    .default(ShotStatus.PENDING)
    .describe("生成状态"),
  taskId: z.string().nullish().describe("任务 ID"),
  url: z.string().nullish().describe("生成的视频 URL"),
});

export type ShotGroupVideo = z.infer<typeof ShotGroupVideoSchema>;

/**
 * 分镜（对话对应的视频单元，简化版）
 * 用于 lip_sync 模式，每条对话对应一个视频
 */
export const ShotSchema = z.object({
  id: z.string().describe("分镜 ID"),
  dialogueId: z.string().describe("关联对话 ID（必填）"),
  status: z
    .enum([
      ShotStatus.PENDING,
      ShotStatus.PROCESSING,
      ShotStatus.COMPLETED,
      ShotStatus.FAILED,
    ])
    .default(ShotStatus.PENDING)
    .describe("生成状态"),
  taskId: z.string().nullish().describe("任务 ID"),
  videoUrl: z.string().nullish().describe("生成的视频 URL"),
});

export type Shot = z.infer<typeof ShotSchema>;

/**
 * 分镜组（ShotGroup）- 替代原 StoryboardRef 的分组概念
 * 前端组件命名保持 Storyboard* 不变
 */
export const ShotGroupSchema = z.object({
  id: z.string().describe("分镜组 ID"),
  sequenceNumber: z.number().int().describe("分镜组序号"),
  title: z.string().optional().describe("分镜组标题"),
  description: z.string().describe("分镜组描述"),
  // 画面信息
  mainImageId: z.string().optional().describe("分镜组主图 ID"),
  mainImageKey: z.string().optional().describe("分镜组主图 OSS 存储路径"),
  mainImageVersion: z
    .number()
    .int()
    .default(0)
    .describe("主图版本（每次生成 +1）"),
  // 图片列表（包含参考图等）
  images: z.array(AssetImageSchema).optional().describe("图片列表"),
  // 主体检测状态
  detectionStatus: z
    .enum([
      DetectionStatus.PENDING,
      DetectionStatus.PROCESSING,
      DetectionStatus.COMPLETED,
      DetectionStatus.FAILED,
    ])
    .default(DetectionStatus.PENDING)
    .describe("主体检测状态"),
  detectionError: z.string().optional().describe("检测失败原因"),
  // 检测到的主体（分镜组图生成后自动填充，已转存到项目存储）
  detectedSubjects: z
    .array(DetectedSubjectSchema)
    .optional()
    .describe("检测到的主体列表"),
  // 角色框选配置（mask 已转存）
  characterRegions: CharacterRegionsSchema.default({}).describe("角色框选配置"),
  // 出镜资源
  characterIds: z.array(z.string()).default([]).describe("角色 ID 列表"),
  sceneId: z.string().optional().describe("关联的场景设定 ID"),
  propIds: z.array(z.string()).default([]).describe("道具 ID 列表"),
  // 对话列表
  dialogues: z.array(DialogueSchema).default([]).describe("对话列表"),
  // 视频生成模式（决定视频归属）
  videoMode: z
    .enum(["video_only", "audio_reference", "lip_sync"])
    .optional()
    .describe("视频生成模式"),
  // 分镜组级别视频（video_only / audio_reference 使用）
  video: ShotGroupVideoSchema.optional().describe("分镜组级别视频"),
  // 对口型视频列表（lip_sync 使用，每条对话对应一个 Shot）
  shots: z.array(ShotSchema).default([]).describe("分镜列表"),
  // 分镜组级别配置
  referenceMode: z
    .enum(["multi_reference", "single_reference"])
    .default("multi_reference")
    .describe("参考模式"),
  // 分镜组级别的默认时长（秒）
  duration: z.number().default(3).describe("默认时长（秒）"),
  imageModelId: z.string().optional().describe("图像生成模型 ID"),
  videoModelId: z.string().optional().describe("视频生成模型 ID"),
  lipSyncModelId: z.string().optional().describe("对口型模型 ID"),
  // 分镜模式
  mode: z
    .enum(["standard", "quick", "locked"])
    .optional()
    .describe("分镜模式"),
  // 向后兼容：保留原有字段一段时间，迁移完成后可删除
  createdAt: z.string().optional().describe("[兼容] 创建时间"),
  updatedAt: z.string().optional().describe("[兼容] 更新时间"),
});

export type ShotGroup = z.infer<typeof ShotGroupSchema>;

/**
 * 分镜模式
 */
export const StoryboardMode = {
  STANDARD: "standard",
  QUICK: "quick",
  LOCKED: "locked",
} as const;

export type StoryboardMode =
  (typeof StoryboardMode)[keyof typeof StoryboardMode];

/**
 * 分镜引用Schema（简化版，用于剧本内容验证）
 */
export const StoryboardRefSchema = z.object({
  id: z.string().describe("分镜ID"),
  sequenceNumber: z.number().int().describe("序号"),
  title: z.string().optional().describe("标题"),
  description: z.string().describe("描述"),
  characterIds: z.array(z.string()).default([]).describe("角色ID列表"),
  sceneId: z.string().optional().describe("场景ID"),
  propIds: z.array(z.string()).default([]).describe("道具ID列表"),
  dialogues: z
    .array(
      z.object({
        id: z.string(),
        characterId: z.string().optional(),
        characterName: z.string(),
        text: z.string(),
        emotion: z.string().optional(),
        isVoiceover: z.boolean().default(false),
        // 动作描述（可选）
        actions: z
          .array(z.string())
          .optional()
          .describe("对话中的动作描述列表"),
        // 音频相关字段
        audioUrl: z.string().optional().describe("生成的音频URL"),
        audioDuration: z.number().optional().describe("音频时长（秒）"),
        audioStatus: z
          .enum(["pending", "processing", "completed", "failed"])
          .optional()
          .describe("音频生成状态"),
        audioTaskId: z.string().optional().describe("音频生成任务ID"),
        // 千问 TTS 音色配置
        voiceId: z.string().optional().describe("选中的音色 ID"),
        // 指令控制（用于 qwen3-tts-instruct-flash）
        instructions: z
          .object({
            templateId: z.string().optional().describe("模板ID"),
            content: z.string().max(1600).describe("指令内容"),
          })
          .optional()
          .describe("TTS指令配置"),
        // Bug-2 修复：对话独立的角色框选配置
        // 使用 z.lazy() 延迟引用
        characterRegions: z.lazy(() => CharacterRegionsSchema).optional().describe("对话独立的角色框选配置"),
      }),
    )
    .default([]),
  voiceover: z.string().optional(),
  shotType: z.string().optional(),
  cameraAngle: z.string().optional(),
  cameraMovement: z.string().optional(),
  duration: z.number().default(0),
  referenceImages: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        thumbnailUrl: z.string().optional(),
        type: z.enum(["main", "angle", "reference", "video_reference"]),
        angleIndex: z.number().optional(),
        createdAt: z.string(),
      }),
    )
    .default([]),
  // 分镜主图（由 Worker 生成后保存）
  images: z.array(AssetImageSchema).optional().describe("生成的分镜图片列表"),
  mainImageId: z.string().optional().describe("主图ID"),
  videoGeneration: z
    .object({
      prompt: z.string(),
      status: z.enum(["pending", "processing", "completed", "failed"]),
      videoUrl: z.string().optional(),
      taskId: z.string().optional(),
    })
    .optional(),
  mode: z.enum([
    StoryboardMode.STANDARD,
    StoryboardMode.QUICK,
    StoryboardMode.LOCKED,
  ]),
  // 参考模式与视频模式（刷新后需持久化）
  referenceMode: z
    .enum(["single_reference", "multi_reference"])
    .optional()
    .default("multi_reference")
    .describe("参考模式"),
  videoMode: z
    .enum(["audio_reference", "lip_sync", "video_only"])
    .optional()
    .default("audio_reference")
    .describe("视频生成模式"),
  // 分镜独立模型选择
  imageModelId: z.string().optional().describe("图像生成模型ID"),
  videoModelId: z.string().optional().describe("视频生成模型ID"),
  lipSyncModelId: z.string().optional().describe("对口型模型ID"),
  // 分镜组新增字段（角色框选配置）
  characterRegions: CharacterRegionsSchema.optional().default({}).describe("角色框选配置"),
  detectionStatus: z
    .enum([
      DetectionStatus.PENDING,
      DetectionStatus.PROCESSING,
      DetectionStatus.COMPLETED,
      DetectionStatus.FAILED,
    ])
    .optional()
    .describe("主体检测状态"),
  detectionError: z.string().optional().describe("检测错误信息"),
  detectedSubjects: z.array(DetectedSubjectSchema).optional().describe("检测到的主体"),
  shots: z.array(ShotSchema).optional().describe("子分镜列表"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StoryboardRef = z.infer<typeof StoryboardRefSchema>;

/**
 * 分镜步骤级别的默认模型配置
 */
export const ShotGroupSettingsSchema = z.object({
  defaultImageModelId: z.string().optional().describe("默认图像生成模型"),
  defaultVideoModelId: z.string().optional().describe("默认视频生成模型"),
  defaultLipSyncModelId: z.string().optional().describe("默认对口型模型"),
});

export type ShotGroupSettings = z.infer<typeof ShotGroupSettingsSchema>;

/**
 * @deprecated 使用 ShotGroupSettings 替代
 */
export type StoryboardStepSettings = ShotGroupSettings;

/**
 * 资产步骤级别的模型配置（角色/场景/道具）
 */
export const AssetStepSettingsSchema = z.object({
  modelId: z.string().optional().describe("步骤级别的默认模型"),
});

export type AssetStepSettings = z.infer<typeof AssetStepSettingsSchema>;

// ==================== 音量配置类型 ====================

/**
 * 音量配置 Schema
 * 用于 FFmpeg 导出时的音量控制
 */
export const AudioVolumeConfigSchema = z.object({
  videoEmbedded: z.number().min(0).max(1).default(1.0).describe("视频内嵌音频音量（audio_reference/lip_sync）"),
  voiceover: z.number().min(0).max(1).default(0.8).describe("旁白音量（video_only）"),
  bgmOverall: z.number().min(0).max(1).default(0.3).describe("全局 BGM 音量"),
  bgmIndividual: z.number().min(0).max(1).default(0.3).describe("片段 BGM 音量"),
  bgmUser: z.number().min(0).max(1).default(0.3).describe("用户上传 BGM 音量"),
});

export type AudioVolumeConfig = z.infer<typeof AudioVolumeConfigSchema>;

// ==================== BGM 配乐轨道类型 ====================

/**
 * BGM 配乐轨道 Schema
 */
export const BgmTrackSchema = z.object({
  id: z.string().describe("BGM 轨道 ID"),
  url: z.string().describe("音频文件 URL"),
  duration: z.number().describe("音频时长（秒）"),
  style: z.string().optional().describe("配乐风格"),
  mode: z.enum(["overall", "individual"]).describe("配乐模式：overall=整体配乐，individual=单独分镜组配乐"),
  source: z.enum(["ai", "user"]).default("ai").describe("来源：ai=AI生成，user=用户上传"),
  targetShotGroupId: z.string().optional().describe("目标分镜组 ID（individual 模式下）"),
  timelineStart: z.number().default(0).describe("时间轴起始位置（秒）"),
  volume: z.number().min(0).max(1).default(0.3).describe("音量 0-1"),
  muted: z.boolean().default(false).describe("是否静音"),
  modelId: z.string().optional().describe("生成使用的模型ID"),
  createdAt: z.string().datetime().describe("创建时间"),
});

export type BgmTrack = z.infer<typeof BgmTrackSchema>;

/**
 * 剧本内容结构
 *
 * 角色/场景/道具存储引用对象（包含 id, name, description 等）
 * 完整资产数据也存储在独立的 characters/scenes/props 表中
 */
export const ScriptContentSchema = z.object({
  characters: z.array(CharacterRefSchema).default([]).describe("角色引用列表"),
  scenes: z
    .array(SceneRefSchema)
    .default([])
    .describe("场景设定列表（保留原含义）"),
  props: z.array(PropRefSchema).default([]).describe("道具引用列表"),
  // 分镜组列表
  shotGroups: z.array(ShotGroupSchema).default([]).describe("分镜组列表"),
  shotGroupSettings:
    ShotGroupSettingsSchema.optional().describe("分镜步骤默认模型配置"),
  // 步骤级别的模型配置
  characterSettings:
    AssetStepSettingsSchema.optional().describe("角色步骤配置"),
  sceneSettings: AssetStepSettingsSchema.optional().describe("场景步骤配置"),
  propSettings: AssetStepSettingsSchema.optional().describe("道具步骤配置"),
  // 剧本步骤的模型配置（用于剧本解析）
  scriptSettings: AssetStepSettingsSchema.optional().describe("剧本步骤配置"),
  // BGM 模型配置
  bgmSettings:
    AssetStepSettingsSchema.optional().describe("BGM 步骤模型配置"),
  // 旁白音色配置
  narrationVoiceId: z.string().optional().describe("旁白音色 ID"),
  narrationInstructions: z.string().optional().describe("旁白指令控制"),
  // BGM 配乐轨道列表
  bgmTracks: z.array(BgmTrackSchema).default([]).describe("BGM 配乐轨道列表"),
  // 音量配置（用于 FFmpeg 导出）
  audioVolumeConfig: AudioVolumeConfigSchema.optional().describe("音量配置"),
  // 创作设置
  resolution: z.string().optional().describe("分辨率比例，如 9:16, 16:9, 1:1"),
  genre: z.string().optional().describe("类型：悬疑/爱情/动作等"),
});

export type ScriptContent = z.infer<typeof ScriptContentSchema>;

/**
 * 导入信息
 */
export const ImportInfoSchema = z.object({
  filename: z.string().describe("文件名"),
  format: z.enum(["txt"]).describe("文件格式"),
});

export type ImportInfo = z.infer<typeof ImportInfoSchema>;

/**
 * 资产统计
 */
export const AssetSummarySchema = z.object({
  total: z.number().int().describe("总数"),
  imported: z.number().int().describe("已导入数量"),
  willCreate: z.number().int().describe("待新建数量"),
  unprocessed: z.number().int().describe("未处理数量"),
});

export type AssetSummary = z.infer<typeof AssetSummarySchema>;

/**
 * 剧本元数据
 */
export const ScriptMetadataSchema = z.object({
  genre: z.string().optional().describe("类型：悬疑/爱情/动作等"),
  tone: z.string().optional().describe("基调：严肃/轻松/紧张等"),
  targetDuration: z.number().int().optional().describe("预估时长（分钟）"),
  totalScenes: z.number().int().default(0).describe("总场数"),
  totalParagraphs: z.number().int().default(0).describe("总段落数"),
  wordCount: z.number().int().default(0).describe("总字数"),
  aiGenerated: z.boolean().default(false).describe("是否AI生成"),
  aiModel: z.string().optional().describe("使用的模型"),
  source: z
    .enum([ScriptSource.AI, ScriptSource.IMPORT, ScriptSource.MANUAL])
    .describe("来源"),
  importInfo: ImportInfoSchema.optional().describe("导入信息"),
  assetSummary: z
    .object({
      characters: AssetSummarySchema.describe("角色统计"),
      scenes: AssetSummarySchema.describe("场景统计"),
      props: AssetSummarySchema.describe("道具统计"),
    })
    .optional()
    .describe("资产关联统计"),
});

export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;

// ==================== 请求 DTOs ====================

/**
 * AI 生成剧本 DTO
 */
export const AIGenerateScriptSchema = z.object({
  idea: z.string().min(1).max(5000).describe("创意想法"),
  genre: z.string().optional().describe("类型"),
  tone: z.string().optional().describe("基调"),
  targetDuration: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("预估时长（分钟）"),
  characterCount: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .describe("主要角色数"),
  modelId: z.string().optional().describe("指定生成模型ID（可选）"),
});

export type AIGenerateScriptDto = z.infer<typeof AIGenerateScriptSchema>;

/**
 * 导入剧本 DTO
 */
export const ImportScriptSchema = z.object({
  content: z.string().min(1).max(500000).describe("剧本文本内容"),
});

export type ImportScriptDto = z.infer<typeof ImportScriptSchema>;

/**
 * 解析剧本 DTO
 * 用于将人工可读剧本解析为结构化数据
 */
export const ParseScriptSchema = z.object({
  content: z.string().min(1).max(10000).describe("人工可读剧本文本内容"),
  modelId: z.string().optional().describe("指定解析模型ID（可选）"),
});

export type ParseScriptDto = z.infer<typeof ParseScriptSchema>;

/**
 * 创建剧本 DTO
 */
export const CreateScriptSchema = z.object({
  title: z.string().min(1).max(50).describe("剧本标题"),
  description: z.string().max(10000).optional().describe("剧本描述"),
  content: ScriptContentSchema.describe("剧本内容"),
  metadata: ScriptMetadataSchema.optional().describe("元数据"),
});

export type CreateScriptDto = z.infer<typeof CreateScriptSchema>;

/**
 * 更新剧本 DTO
 */
export const UpdateScriptSchema = z
  .object({
    title: z.string().min(1).max(50).optional().describe("剧本标题"),
    description: z.string().max(10000).optional().describe("剧本描述"),
    content: ScriptContentSchema.optional().describe("剧本内容"),
    metadata: ScriptMetadataSchema.optional().describe("元数据"),
  })
  .strict();

export type UpdateScriptDto = z.infer<typeof UpdateScriptSchema>;

/**
 * 查询剧本列表参数
 */
export const QueryScriptsSchema = z.object({
  status: z
    .enum([
      ScriptStatus.DRAFT,
      ScriptStatus.EDITING,
      ScriptStatus.AI_GENERATING,
      ScriptStatus.CONFIRMED,
    ])
    .optional()
    .describe("状态筛选"),
  keyword: z.string().optional().describe("关键词搜索"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe("每页数量"),
});

export type QueryScriptsDto = z.infer<typeof QueryScriptsSchema>;

/**
 * 确认剧本 DTO
 */
export const ConfirmScriptSchema = z.object({
  characterPlans: z
    .record(
      z.object({
        assetStatus: z.enum([
          AssetStatus.IMPORTED,
          AssetStatus.WILL_CREATE,
          AssetStatus.NONE,
        ]),
        creationPlan: CreationPlanSchema.optional(),
      }),
    )
    .optional()
    .describe("角色处理计划"),
  scenePlans: z
    .record(
      z.object({
        assetStatus: z.enum([
          AssetStatus.IMPORTED,
          AssetStatus.WILL_CREATE,
          AssetStatus.NONE,
        ]),
        creationPlan: CreationPlanSchema.optional(),
      }),
    )
    .optional()
    .describe("场景处理计划"),
  propPlans: z
    .record(
      z.object({
        assetStatus: z.enum([
          AssetStatus.IMPORTED,
          AssetStatus.WILL_CREATE,
          AssetStatus.NONE,
        ]),
        creationPlan: CreationPlanSchema.optional(),
      }),
    )
    .optional()
    .describe("道具处理计划"),
});

export type ConfirmScriptDto = z.infer<typeof ConfirmScriptSchema>;

// ==================== AI 任务 DTOs ====================

/**
 * AI 续写 DTO
 */
export const AIContinueSchema = z.object({
  sceneId: z.string().describe("场ID"),
  afterParagraphId: z.string().describe("在哪个段落后续写"),
  length: z
    .enum(["short", "medium", "long"])
    .default("medium")
    .describe("续写长度"),
  style: z
    .enum(["match", "casual", "dramatic"])
    .default("match")
    .describe("风格"),
});

export type AIContinueDto = z.infer<typeof AIContinueSchema>;

/**
 * AI 改写 DTO
 */
export const AIRewriteSchema = z.object({
  paragraphIds: z.array(z.string()).min(1).describe("要改写的段落ID列表"),
  instruction: z.string().min(1).describe('改写指令，如"让对话更口语化"'),
});

export type AIRewriteDto = z.infer<typeof AIRewriteSchema>;

/**
 * AI 扩写 DTO
 */
export const AIExpandSchema = z.object({
  paragraphIds: z.array(z.string()).min(1).describe("要扩写的段落ID列表"),
  targetLength: z
    .enum(["50%", "100%", "200%"])
    .default("100%")
    .describe("目标扩写比例"),
});

export type AIExpandDto = z.infer<typeof AIExpandSchema>;

/**
 * AI 缩写 DTO
 */
export const AICondenseSchema = z.object({
  paragraphIds: z.array(z.string()).min(1).describe("要缩写的段落ID列表"),
  targetLength: z.enum(["50%", "30%"]).default("50%").describe("目标缩写比例"),
});

export type AICondenseDto = z.infer<typeof AICondenseSchema>;

// ==================== 跨项目导入 DTOs ====================

/**
 * 跨项目导入资产 DTO
 */
export const ImportAssetFromProjectSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  sourceAssetId: z.string().describe("源资产ID"),
  assetType: z
    .enum([AssetType.CHARACTER, AssetType.SCENE, AssetType.PROP])
    .describe("资产类型"),
  targetRefId: z
    .string()
    .describe("目标引用ID（对应剧本中的 character/scene/prop ID）"),
});

export type ImportAssetFromProjectDto = z.infer<
  typeof ImportAssetFromProjectSchema
>;

/**
 * 查询可导入资产参数
 */
export const QueryImportableAssetsSchema = z.object({
  sourceProjectId: z.string().describe("源项目ID"),
  assetType: z
    .enum([AssetType.CHARACTER, AssetType.SCENE, AssetType.PROP])
    .describe("资产类型"),
  keyword: z.string().optional().describe("关键词搜索"),
  page: z.coerce.number().int().positive().default(1).describe("页码"),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("每页数量"),
});

export type QueryImportableAssetsDto = z.infer<
  typeof QueryImportableAssetsSchema
>;

// ==================== 剧本资产导入 DTOs ====================

/**
 * 创建资产并关联到剧本 DTO
 * 用于"新建资产"功能：先创建资产到项目资产库，再关联引用到剧本
 */
export const CreateAndLinkAssetSchema = z.object({
  assetType: z
    .enum([AssetType.CHARACTER, AssetType.SCENE, AssetType.PROP])
    .describe("资产类型"),
  name: z.string().min(1).max(100).describe("资产名称"),
  description: z.string().max(500).optional().describe("资产描述"),
  // 角色专属字段
  gender: z.string().max(20).optional().describe("性别（仅角色类型）"),
  age: z.string().max(20).optional().describe("年龄（仅角色类型）"),
});

export type CreateAndLinkAssetDto = z.infer<typeof CreateAndLinkAssetSchema>;

/**
 * 关联已有资产到剧本 DTO
 * 用于"从项目导入"功能：从项目资产库选择已有资产，批量关联引用到剧本
 */
export const LinkExistingAssetsSchema = z.object({
  assetType: z
    .enum([AssetType.CHARACTER, AssetType.SCENE, AssetType.PROP])
    .describe("资产类型"),
  assetIds: z.array(z.string().min(1)).min(1).describe("要关联的资产ID列表"),
});

export type LinkExistingAssetsDto = z.infer<typeof LinkExistingAssetsSchema>;

// ==================== Response DTOs ====================

/**
 * 剧本列表项响应
 */
export interface ScriptListItemDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ScriptStatus;
  metadata: ScriptMetadata;
  createdAt: string;
  updatedAt: string;
}

/**
 * 剧本详情响应
 */
export interface ScriptDetailDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ScriptStatus;
  content: ScriptContent;
  metadata: ScriptMetadata;
  confirmedAt: string | null;
  aiTaskId?: string | null; // 当前关联的 AI 生成任务ID
  createdAt: string;
  updatedAt: string;
}

/**
 * AI 任务响应
 */
export interface AITaskDto {
  id: string;
  scriptId: string;
  type: AITaskType;
  status: AITaskStatus;
  progress: number | null;
  result: unknown | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * AI 生成进度响应（WebSocket）
 */
export interface AIGenerateProgressDto {
  taskId: string;
  scriptId: string;
  type: AITaskType;
  status: AITaskStatus;
  progress: number;
  result?: unknown;
  error?: string;
}

/**
 * 可导入资产列表项
 */
export interface ImportableAssetDto {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  sourceProjectId: string;
  sourceProjectName: string;
}

/**
 * 跨项目导入结果
 */
export interface ImportAssetResultDto {
  targetAssetId: string;
  targetRefId: string;
  success: boolean;
  error?: string;
}

/**
 * 确认预览响应
 */
export interface ScriptConfirmPreviewDto {
  characters: Array<{
    id: string;
    name: string;
    description: string;
    assetStatus: AssetStatus;
    importedFrom?: string;
  }>;
  scenes: Array<{
    id: string;
    name: string;
    description?: string;
    assetStatus: AssetStatus;
  }>;
  props: Array<{
    id: string;
    name: string;
    description?: string;
    assetStatus: AssetStatus;
  }>;
  summary: {
    totalCharacters: number;
    importedCharacters: number;
    willCreateCharacters: number;
    unprocessedCharacters: number;
    totalScenes: number;
    importedScenes: number;
    willCreateScenes: number;
    unprocessedScenes: number;
    totalProps: number;
    importedProps: number;
    willCreateProps: number;
    unprocessedProps: number;
  };
}

/**
 * 创建资产并关联响应
 * 用于 createAndLinkAsset API 返回
 */
export interface CreateAndLinkAssetResponse {
  refId: string; // 剧本内引用 ID（如 CharacterRef.id）
  assetId: string; // 资产库 ID（如 characters 表的 ID）
  name: string; // 资产名称
  assetStatus: AssetStatus; // 资产关联状态
}

/**
 * 关联资产引用项
 */
export interface LinkedAssetRefItem {
  refId: string; // 剧本内引用 ID
  assetId: string; // 资产库 ID
  name: string; // 资产名称
  assetStatus: AssetStatus; // 资产关联状态
}

/**
 * 跳过的资产项
 */
export interface SkippedAssetItem {
  assetId: string; // 资产库 ID
  name: string; // 资产名称
  reason: "already_linked"; // 跳过原因
}

/**
 * 批量关联已有资产响应
 * 用于 linkExistingAssets API 返回
 */
export interface LinkExistingAssetsResponse {
  refs: LinkedAssetRefItem[]; // 成功关联的引用列表
  skipped: SkippedAssetItem[]; // 跳过的资产列表（已关联）
}

// ==================== 步骤状态类型（剧本编辑页面重构）====================

/**
 * 步骤状态
 */
export const StepStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus];

/**
 * 单个步骤状态
 */
export interface StepState {
  status: StepStatus;
  currentTaskId?: string;
  lastGeneratedAt?: string;
  modelId?: string;
  resultSummary?: {
    totalCount: number;
    completedCount: number;
  };
}

/**
 * 步骤生成状态
 */
export interface GenerationState {
  script: StepState;
  characters: StepState;
  scenes: StepState;
  props: StepState;
  storyboards: StepState;
  audio: StepState;
}

/**
 * 图片信息
 */
export interface AssetImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "main" | "angle" | "reference" | "video_reference";
  angleIndex?: number;
  createdAt: string;
}

/**
 * 扩展角色引用（带图片）
 * Phase 4: 包含 CharacterRef 的所有字段（characterId, usageCount, relatedSceneIndices）
 */
export interface CharacterRefWithImages {
  id: string;
  characterId: string; // Phase 4: 关联 characters 表的资产ID
  name: string;
  description: string;
  personality?: string;
  age?: string;
  gender?: string;
  importance: CharacterImportance;
  assetStatus: AssetStatus;
  images: AssetImage[];
  mainImageId?: string;
  assetId?: string;
  importedAsset?: ImportedAsset;
  creationPlan?: CreationPlan;
  // 已废弃字段（保留可选兼容旧数据）
  usageCount?: number;
  relatedSceneIndices?: number[];
  generationConfig?: {
    modelId: string;
    prompt?: string;
    negativePrompt?: string;
  };
  // 千问 TTS 音色配置
  voiceId?: string;
  voiceInstructions?: string;
}

/**
 * 扩展场景引用（带图片）
 * Phase 4: 包含 SceneRef 的所有字段（sceneId, dialogues, setting）
 */
export interface SceneRefWithImages {
  id: string;
  sceneId: string; // Phase 4: 关联 scenes 表的资产ID
  name: string;
  description?: string;
  assetStatus: AssetStatus;
  images: AssetImage[];
  mainImageId?: string;
  assetId?: string;
  importedAsset?: ImportedAsset;
  creationPlan?: CreationPlan;
  // Phase 4: SceneRef 剧本特定字段
  dialogues?: Array<{
    id?: string;
    characterName: string;
    text: string;
    emotion?: string;
    actions?: string[];
    isVoiceover?: boolean;
  }>;
  setting?: {
    timeOfDay?: "morning" | "afternoon" | "evening" | "night" | "unknown";
    weather?: "clear" | "cloudy" | "rainy" | "snowy" | "foggy" | "unknown";
  };
  generationConfig?: {
    modelId: string;
    prompt?: string;
  };
}

/**
 * 扩展道具引用（带图片）
 * Phase 4: 包含 PropRef 的所有字段（propId, usageCount）
 */
export interface PropRefWithImages {
  id: string;
  propId: string; // Phase 4: 关联 props 表的资产ID
  name: string;
  description?: string;
  // 已废弃字段（保留可选兼容旧数据）
  sceneIds?: string[];
  assetStatus: AssetStatus;
  images: AssetImage[];
  mainImageId?: string;
  assetId?: string;
  importedAsset?: ImportedAsset;
  creationPlan?: CreationPlan;
  // 已废弃字段（保留可选兼容旧数据）
  usageCount?: number;
  generationConfig?: {
    modelId: string;
    prompt?: string;
  };
}

/**
 * 对白信息
 */
export interface Dialogue {
  id: string;
  characterId?: string;
  characterName: string;
  text: string;
  emotion?: string;
  isVoiceover: boolean;
  // 动作描述（可选）
  actions?: string[];
  // 音频相关字段
  audioUrl?: string;
  audioDuration?: number;
  audioStatus?: "pending" | "processing" | "completed" | "failed";
  audioTaskId?: string;
  // 千问 TTS 音色配置
  voiceId?: string; // 选中的音色 ID
  // 指令控制（用于 qwen3-tts-instruct-flash）
  instructions?: {
    templateId?: string;
    content: string;
  };
}

/**
 * 音效
 */
export interface SoundEffect {
  id: string;
  name: string;
  url: string;
  triggerPoint: number;
}

// ==================== 剧本编辑详情响应 DTOs ====================

/**
 * 获取剧本编辑详情响应
 */
export interface GetScriptEditDetailResponse {
  id: string;
  title: string;
  description: string | null;
  status: ScriptStatus;
  createdAt: string;
  updatedAt: string;

  steps: {
    settings: {
      aspectRatio: "16:9" | "9:16";
      genre: string;
      tone: string;
    };

    script: {
      status: StepStatus;
      content: string;
      modelId: string;
      currentTaskId?: string;
      lastGeneratedAt?: string;
    };

    characters: {
      status: StepStatus;
      items: CharacterRefWithImages[];
      modelId: string;
      currentTaskId?: string;
      totalCount: number;
      completedCount: number;
    };

    scenes: {
      status: StepStatus;
      items: SceneRefWithImages[];
      modelId: string;
      currentTaskId?: string;
      totalCount: number;
      completedCount: number;
    };

    props: {
      status: StepStatus;
      items: PropRefWithImages[];
      modelId: string;
      currentTaskId?: string;
      totalCount: number;
      completedCount: number;
    };

    storyboards: {
      status: StepStatus;
      items: StoryboardRef[];
      modelId: string;
      currentTaskId?: string;
      totalCount: number;
    };

    audio: {
      status: StepStatus;
      bgm?: {
        url: string;
        name: string;
        duration: number;
      };
      soundEffects: SoundEffect[];
      modelId: string;
      currentTaskId?: string;
    };

    export: {
      status: StepStatus;
      availableFormats: string[];
    };
  };

  modelConfigs: {
    category: string;
    modelId: string;
    modelName: string;
  }[];
}

/**
 * 更新剧本描述请求 DTO
 */
export const UpdateScriptDescriptionSchema = z.object({
  content: z.string().min(10).max(10000).describe("剧本描述内容"),
  autoSave: z.boolean().optional().describe("是否为自动保存"),
});

export type UpdateScriptDescriptionDto = z.infer<
  typeof UpdateScriptDescriptionSchema
>;

/**
 * 更新剧本描述响应
 */
export interface UpdateScriptDescriptionResponse {
  id: string;
  content: string;
  updatedAt: string;
  hasUnsavedChanges: boolean;
}

/**
 * 重新生成剧本请求 DTO
 */
export const RegenerateScriptSchema = z.object({
  modelId: z.string().optional().describe("使用的模型ID"),
  preserveExisting: z
    .boolean()
    .default(true)
    .describe("是否保留现有内容作为参考"),
  options: z
    .object({
      genre: z.string().optional().describe("类型"),
      tone: z.string().optional().describe("基调"),
      targetDuration: z
        .number()
        .int()
        .min(1)
        .max(300)
        .optional()
        .describe("预估时长（分钟）"),
      characterCount: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("主要角色数"),
    })
    .optional(),
});

export type RegenerateScriptDto = z.infer<typeof RegenerateScriptSchema>;

/**
 * 重新生成剧本响应
 */
export interface RegenerateScriptResponse {
  taskId: string;
  status: "pending" | "processing";
  estimatedTime: number;
}

/**
 * 获取任务状态响应
 */
export interface GetTaskStatusResponse {
  taskId: string;
  type:
    | "script_generate"
    | "character_generate"
    | "scene_generate"
    | "prop_generate"
    | "storyboard_generate"
    | "video_generate"
    | "image_generate";
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * 取消任务响应
 */
export interface CancelTaskResponse {
  taskId: string;
  status: "cancelled";
  cancelledAt: string;
}

// ==================== 剧本模型配置 DTOs ====================

/**
 * 剧本模型配置项
 */
export interface ScriptModelConfigItem {
  step: string;
  modelId: string;
}

/**
 * 获取剧本模型配置响应
 */
export interface GetScriptModelConfigsResponse {
  configs: ScriptModelConfigItem[];
}

/**
 * 更新剧本模型配置请求 DTO
 */
export const UpdateScriptModelConfigsSchema = z.object({
  configs: z
    .record(z.string().min(1))
    .describe(
      "步骤到模型ID的映射，如 { script: 'model-1', characters: 'model-2' }",
    ),
});

export type UpdateScriptModelConfigsDto = z.infer<
  typeof UpdateScriptModelConfigsSchema
>;

/**
 * 更新剧本模型配置响应
 */
export interface UpdateScriptModelConfigsResponse {
  configs: ScriptModelConfigItem[];
  updatedAt: string;
}

// ==================== 统一数据源 Response DTOs ====================

/**
 * Resolved 资产响应 - 单个资产项（Ref + Asset 组合）
 * ref: 剧本中的引用信息（包含剧本特定配置）
 * asset: 素材库完整数据（可能为 null，表示未关联）
 * 注意：asset 使用 Record<string, unknown> 避免循环依赖，
 *       实际返回数据对应 CharacterDetailDto/SceneDetailDto/PropDetailDto 结构
 */
export interface ResolvedAssetItem<TRef> {
  ref: TRef;
  asset: Record<string, unknown> | null;
}

/**
 * Resolved 资产响应 - 完整响应结构
 * 返回剧本关联资产的完整数据（Ref + 素材库 Asset 组合）
 * asset 字段为素材库完整数据，结构对应各 DetailDto 类型
 */
export interface ResolvedAssetResponse {
  characters: ResolvedAssetItem<CharacterRef>[];
  scenes: ResolvedAssetItem<SceneRef>[];
  props: ResolvedAssetItem<PropRef>[];
}

// ==================== 剧本状态（Pinia）====================

/**
 * 剧本状态（Pinia）
 */
export interface ScriptState {
  scripts: ScriptListItemDto[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  loading: boolean;
  currentScript: ScriptDetailDto | null;
  aiTasks: AITaskDto[];
  aiGenerating: boolean;
  aiProgress: number;
}

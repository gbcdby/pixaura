import type {
  CharacterRef,
  SceneRef,
  PropRef,
  CharacterRefWithImages,
  SceneRefWithImages,
  PropRefWithImages,
  DetectionStatus as SharedDetectionStatus,
  ShotStatus as SharedShotStatus,
  ShotVideoMode as SharedShotVideoMode,
  Shot,
  ShotGroupVideo,
  DetectedSubject,
  CharacterRegions,
  CharacterDetailDto,
  SceneDetailDto,
  PropDetailDto,
} from "@pixaura/shared-types";

// Re-export asset types for composables
export type {
  CharacterRef,
  SceneRef,
  PropRef,
  CharacterRefWithImages,
  SceneRefWithImages,
  PropRefWithImages,
  ShotGroup,
  Shot,
  ShotGroupVideo,
  DetectedSubject,
  CharacterRegions,
} from "@pixaura/shared-types";

// Re-export shot-related enums（使用 shared-types 定义）
export type ShotVideoMode = SharedShotVideoMode;
export type DetectionStatus = SharedDetectionStatus;
export type ShotStatus = SharedShotStatus;

// 幕结构
export interface Act {
  id: string;
  name: string;
  description?: string;
  scenes?: string[];
}

// 步骤状态类型
export type StepStatusType =
  | "pending" // 待生成（前置步骤已完成，可以操作）
  | "waiting" // 待开始（前置步骤未完成，还不能操作）
  | "processing"
  | "completed"
  | "failed"
  | "parsing";

// 剧本步骤状态
export interface ScriptStepState {
  status: StepStatusType;
  content: string; // 剧本描述内容
  modelId: string; // 当前选择的模型
  isEditing: boolean; // 是否正在编辑
  hasUnsavedChanges: boolean; // 是否有未保存修改
  currentTaskId?: string;
  progress?: number; // 生成进度 0-100
  parseTaskId?: string; // 解析任务ID
  parseProgress?: number; // 解析进度 0-100
  parseMessage?: string; // 解析状态消息
  // 新增：作为单一数据源的剧本内容字段
  acts: Act[];
  summary: string;
  dialogues: DialogueItem[];
}

// 资产步骤状态（角色/场景/道具共用）
export interface AssetStepState<T> {
  status: StepStatusType;
  items: T[]; // 资产列表
  modelId: string; // 当前选择的模型
  currentTaskId?: string;
  selectedIds: string[]; // 选中的资产ID
  scrollPosition: number; // 滚动位置（恢复用）
  progress?: number;
  // F1-4: 记录哪些 refId 正在生成图片
  imageGeneratingIds: Set<string>;
  // 图片生成进度（refId -> progress 0-100）
  imageGenerationProgress: Record<string, number>;
  // 图片生成错误（refId -> 错误信息）
  imageGenerationErrors: Record<string, string>;
}

// 参考模式类型
export type ReferenceMode = "multi_reference" | "single_reference";

// 视频模式类型（已更新为新枚举值，与 shared-types ShotVideoMode 同步）
// 注意：旧值 audio_driven/video_first 已废弃，使用 audio_reference/lip_sync/video_only
export type VideoMode = "audio_reference" | "lip_sync" | "video_only";

// 视频生成信息
export interface VideoGenerationInfo {
  prompt?: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  taskId?: string;
  progress?: number; // 生成进度 0-100
}

// 对白项类型
export interface DialogueItem {
  id: string;
  characterId?: string;
  characterName: string;
  text: string;
  emotion?: string;
  isVoiceover: boolean;
  // 动作描述（可选）
  actions?: string[]; // 对话中的动作描述列表
  // 从解析结果传递时使用
  sceneIndex?: number;
  // 音频相关字段
  audioUrl?: string;
  audioDuration?: number;
  audioStatus?: "pending" | "processing" | "completed" | "failed";
  audioTaskId?: string;
  // TTS 音频生成相关字段
  voiceId?: string;
  voiceName?: string;
  speed?: number;
  // 指令控制（用于 qwen3-tts-instruct-flash）
  instructions?: {
    templateId?: string; // 模板ID（可选）
    content: string; // 指令内容
  };
  // Bug-2 修复：对话独立的角色框选配置
  characterRegions?: import("@pixaura/shared-types").CharacterRegions;
}

// 分镜图片类型（与资产图片结构保持一致）
export interface StoryboardImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "main" | "angle" | "reference" | "video_reference";
  createdAt: string;
}

// 分镜引用结构（简化版）
export interface StoryboardRef {
  id: string;
  sequenceNumber: number;
  title?: string;
  description: string;
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
  duration: number;
  status: StepStatusType;
  // 分镜模式
  mode?: "standard" | "quick" | "locked";
  // 分镜独立设置
  referenceMode?: ReferenceMode;
  videoMode?: VideoMode;
  // 镜头信息
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  // 视频生成信息
  videoGeneration?: VideoGenerationInfo;
  // 分镜独立模型选择
  imageModelId?: string; // 图像生成模型
  videoModelId?: string; // 视频生成模型
  lipSyncModelId?: string; // 对口型模型
  // 对白列表
  dialogues?: DialogueItem[];
  // 旁白
  voiceover?: string;
  // 分镜图片（AI 生成或上传的参考图）
  images?: StoryboardImage[];
  // 分镜参考图（用于生成参考）
  referenceImages?: StoryboardImage[];
  mainImageId?: string;
  // Bug #1 修复：分镜主图的 URL 或 OSS key（后端视频生成检查此字段）
  mainImageKey?: string;
  // 时间戳
  createdAt?: string;
  updatedAt?: string;
  // === shotGroups 新增字段 ===
  // 分镜组级别视频（video_only / audio_reference 使用）
  video?: ShotGroupVideo;
  // 子分镜列表
  shots?: Shot[];
  // 角色框选配置
  characterRegions?: CharacterRegions;
  // 主体检测状态
  detectionStatus?: DetectionStatus;
  detectionError?: string;
  // 检测到的主体
  detectedSubjects?: DetectedSubject[];
}

// 分镜步骤状态
export interface StoryboardStepState {
  status: StepStatusType;
  items: StoryboardRef[]; // 分镜列表
  modelId: string; // 当前选择的模型
  currentTaskId?: string;
  progress?: number;

  // 排序状态
  isReordering: boolean; // 是否正在重新排序
  draggedItemId?: string; // 当前拖拽的分镜ID

  // 视图状态
  expandedItemIds: string[]; // 展开的分镜ID
  selectedItemId?: string; // 当前选中的分镜ID

  // 分镜图片生成状态（storyboardId -> 生成中/进度/错误）
  imageGeneratingIds: Set<string>;
  imageGenerationProgress: Record<string, number>;
  imageGenerationErrors: Record<string, string>;
  // 分镜对话 AI 生成状态（storyboardId -> 是否正在生成）
  dialogueGeneratingIds: Set<string>;

  // 新增：分镜步骤级别的模型配置
  defaultImageModelId?: string;
  defaultVideoModelId?: string;
  defaultLipSyncModelId?: string;

  // 分镜解析状态（独立于资源解析）
  storyboardParseStatus?: "pending" | "processing" | "completed" | "failed";
}

// 音效信息
export interface SoundEffect {
  id: string;
  name: string;
  url: string;
  triggerPoint: number; // 触发时间点（秒）
}

// 配乐步骤状态
export interface AudioStepState {
  status: StepStatusType;
  bgm?: {
    url: string;
    name: string;
    duration: number;
  };
  soundEffects: SoundEffect[];
  modelId: string;
  currentTaskId?: string;
  progress?: number;
}

// 导出格式类型
export type ExportFormatType = "mp4" | "mov" | "webm";
export type ExportQualityType = "720p" | "1080p" | "4k";

// 分辨率类型
export type ResolutionType = "9:16" | "16:9" | "1:1";

// 电影类型
export type FilmGenreType =
  | "drama"
  | "comedy"
  | "suspense"
  | "action"
  | "romance"
  | "scifi";

// 导出步骤状态
export interface ExportStepState {
  status: StepStatusType;
  format: ExportFormatType;
  quality: ExportQualityType;
  progress?: number;
  downloadUrl?: string;
}

// 任务订阅信息（纯 WebSocket 实现）
export interface TaskSubscription {
  taskId: string;
  stepId: string;
  unsubscribe: () => void;
}

// 创作设置
export interface CreationSettings {
  resolution: ResolutionType;
  genre: FilmGenreType;
}

// Store 状态定义
export interface ScriptEditV2State {
  // 基础数据
  script: import("@pixaura/shared-types").ScriptDetailDto | null;
  projectId: string;
  scriptId: string;

  // 各步骤状态（使用 WithImages 类型，包含 name/description/images）
  steps: {
    script: ScriptStepState;
    characters: AssetStepState<CharacterRefWithImages>;
    scenes: AssetStepState<SceneRefWithImages>;
    props: AssetStepState<PropRefWithImages>;
    storyboards: StoryboardStepState;
    audio: AudioStepState;
    export: ExportStepState;
  };

  // 素材库完整数据映射（key 为 characterId/sceneId/propId）
  resolvedAssets: {
    characters: Map<string, CharacterDetailDto>;
    scenes: Map<string, SceneDetailDto>;
    props: Map<string, PropDetailDto>;
  };

  // 全局状态
  loading: boolean;
  currentStepId: string;

  // WebSocket任务订阅
  activeTasks: Map<string, TaskSubscription>;

  // 创作设置
  creationSettings: CreationSettings;
}

// 带图片的资产类型（用于内部处理）
export type AssetWithImages =
  | (CharacterRef & { images?: StoryboardImage[] })
  | (SceneRef & { images?: StoryboardImage[] })
  | (PropRef & { images?: StoryboardImage[] });

// 资产步骤键名
export type AssetStepKey = "characters" | "scenes" | "props";

// 资产类型
export type AssetType = "character" | "scene" | "prop";

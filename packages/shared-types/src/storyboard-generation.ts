// 分镜生成模块类型定义

/**
 * 生成任务状态
 */
export type GenerationJobStatus =
  | "pending"
  | "parsing"
  | "generating"
  | "mapping"
  | "preview_pending"
  | "preview_gen"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * 生成策略
 */
export type GenerationStrategy =
  | "scene_based"
  | "paragraph_based"
  | "dialogue_based"
  | "mixed";

/**
 * 生成项状态
 */
export type GenerationItemStatus =
  | "generated"
  | "confirmed"
  | "rejected"
  | "regenerating";

/**
 * 映射类型
 */
export type MappingType = "character" | "scene" | "prop";

/**
 * 出镜角色信息
 */
export interface CharacterInfo {
  characterId?: string;
  characterName: string;
  position: string;
  action?: string;
  isMatched?: boolean;
}

/**
 * 道具信息
 */
export interface PropInfo {
  propId?: string;
  propName: string;
  description?: string;
}

/**
 * 对白信息
 */
export interface DialogueInfo {
  characterId?: string;
  characterName: string;
  text: string;
  emotion?: string;
}

/**
 * 生成任务列表项
 */
export interface GenerationJobItem {
  id: string;
  projectId: string;
  scriptId: string;
  status: GenerationJobStatus;
  strategy: GenerationStrategy;
  totalCount: number | null;
  completedCount: number;
  failedCount: number;
  shotsPerScene: number;
  shotsPerDialogue: number;
  autoGeneratePreview: boolean;
  stylePreset: string | null;
  progress: {
    stage: string;
    percent: number;
    currentStep: string;
    completedCount: number;
    totalCount: number;
  } | null;
  stats: {
    generatedCount: number;
    confirmedCount: number;
    rejectedCount: number;
    previewGeneratedCount: number;
  } | null;
  aiTaskId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 生成任务详情
 */
export interface GenerationJobDetail extends GenerationJobItem {
  // 包含所有 GenerationJobItem 字段
}

/**
 * 生成分镜项
 */
export interface GenerationItem {
  id: string;
  jobId: string;
  sequenceNumber: number;
  sceneId: string | null;
  sceneName: string | null;
  scriptSequenceRef: number | null;
  description: string;
  shotType: string;
  shotAngle: string | null;
  shotMovement: string | null;
  shotFocus: string | null;
  duration: number;
  transition: string | null;
  characters: CharacterInfo[] | null;
  props: PropInfo[] | null;
  dialogues: DialogueInfo[] | null;
  voiceover: string | null;
  soundEffects: string[] | null;
  musicMood: string | null;
  audio?: {
    type: "dialogue" | "voiceover" | "ambient" | "silent";
    dialogue?: {
      characterId?: string;
      characterName: string;
      text: string;
      emotion?: string;
    } | null;
    voiceover?: string | null;
    soundEffects?: string[];
    musicMood?: string | null;
  };
  status: GenerationItemStatus;
  previewImageUrl: string | null;
  previewImageThumbnailUrl: string | null;
  previewGenerationStatus: string | null;
  previewTaskId: string | null;
  previewImageId: string | null;
  confirmedStoryboardId: string | null;
  generationPrompt: string | null;
  generationMetadata: {
    prompt: string;
    modelId: string;
    generatedAt: string;
  } | null;
  confidenceScore: number | null;
  mappingConfidence: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 生成分镜项详情
 */
export interface GenerationItemDetail extends GenerationItem {
  // 可能包含更多详情字段
  assetMappings?: {
    characters: AssetMapping[];
    scenes: AssetMapping[];
    props: AssetMapping[];
  };
}

/**
 * 资产映射
 */
export interface AssetMapping {
  id: string;
  itemId: string;
  mappingType: MappingType;
  detectedName: string;
  matchedAssetId: string | null;
  matchedAssetType: string | null;
  confidence: number;
  isCorrected: boolean;
  correctedAssetId: string | null;
  correctionUserId: string | null;
  correctionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 生成进度
 */
export interface GenerationProgress {
  job_id: string;
  status: GenerationJobStatus;
  current_stage: "parsing" | "generating" | "mapping" | "preview" | "completed";
  progress: number;
  message: string;
  completed_count: number;
  total_count: number;
}

/**
 * 生成设置
 */
export interface GenerationSettings {
  projectId: string;
  defaultStrategy: GenerationStrategy;
  defaultShotType: string | null;
  defaultDuration: number;
  autoGeneratePreview: boolean;
  autoConfirmThreshold: number | null;
  stylePreset: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 生成日志
 */
export interface GenerationLog {
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
  stage?: GenerationProgress["current_stage"];
}

/**
 * SSE 事件类型
 */
export type SSEEventType =
  | "start"
  | "progress"
  | "item_generated"
  | "complete"
  | "error";

/**
 * SSE 事件
 */
export interface SSEEvent {
  type: SSEEventType;
  job_id: string;
  timestamp: number;
  stage?: string;
  progress?: number;
  message?: string;
  completed_count?: number;
  total_count?: number;
  item?: GenerationItem;
  result?: {
    total_items: number;
    confirmed_count: number;
  };
}

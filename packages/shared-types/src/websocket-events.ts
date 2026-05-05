/**
 * WebSocket 事件类型定义
 *
 * 统一管理前后端 WebSocket 事件名称和数据类型
 * 前后端都从这里导入，避免不一致
 */

// ==================== 事件名称常量 ====================

/**
 * WebSocket 事件名称
 * 使用常量避免前后端字符串不一致
 */
export const WsEventNames = {
  // 系统事件
  PING: "ping",
  PONG: "pong",
  CONNECTION_ESTABLISHED: "connection_established",
  TOKEN_REFRESH_REQUIRED: "token_refresh_required",
  ERROR: "error",

  // 剧本生成相关
  SCRIPT_GENERATE_PROGRESS: "script:generate-progress",
  SCRIPT_GENERATE_DONE: "script:generate-done",
  SCRIPT_GENERATE_FAILED: "script:generate-failed",

  // 剧本解析相关
  SCRIPT_PARSE_PROGRESS: "script:parse-progress",

  // 分镜解析相关
  STORYBOARD_PARSE_PROGRESS: "storyboard:parse-progress",

  // 剧本编辑相关
  SCRIPT_EDIT_PROGRESS: "script:edit-progress",

  // 资产图片生成
  ASSET_IMAGE_PROGRESS: "asset:image-progress",

  // 资产视频生成
  ASSET_VIDEO_PROGRESS: "asset:video-progress",

  // 分镜批量生成
  STORYBOARD_GENERATE_PROGRESS: "storyboard:generate-progress",
  STORYBOARD_GENERATE_DONE: "storyboard:generate-done",
  STORYBOARD_GENERATE_FAILED: "storyboard:generate-failed",

  // 分镜组相关事件（重构后新增）
  SHOTGROUP_SUBJECTS_DETECTED: "shotGroup:subjects-detected",
  SHOT_VIDEO_PROGRESS: "shot:video-progress",

  // 资产 CRUD 更新事件（用于分段解析实时推送）
  ASSET_CHARACTER_UPDATE: "asset:character-update",
  ASSET_SCENE_UPDATE: "asset:scene-update",
  ASSET_PROP_UPDATE: "asset:prop-update",
  ASSET_STORYBOARD_UPDATE: "asset:storyboard-update",
  ASSET_CHARACTER_DELETE: "asset:character-delete",
  ASSET_SCENE_DELETE: "asset:scene-delete",
  ASSET_PROP_DELETE: "asset:prop-delete",
  ASSET_STORYBOARD_DELETE: "asset:storyboard-delete",

  // 通用生成任务
  GENERATION_PROGRESS: "generation_progress",
  GENERATION_COMPLETE: "generation_complete",
  GENERATION_FAILED: "generation_failed",

  // 系统通知
  QUOTA_WARNING: "quota_warning",
  SYSTEM_NOTIFICATION: "system_notification",

  // 导出相关事件
  EXPORT_PROGRESS: "export:progress",
  EXPORT_COMPLETE: "export:complete",
  EXPORT_FAILED: "export:failed",
  EXPORT_BATCH_PROGRESS: "export:batch_progress",
} as const;

// ==================== 消息数据类型 ====================

/**
 * 任务状态类型
 */
export type WsTaskStatus = "pending" | "processing" | "completed" | "failed";

/**
 * 剧本生成进度消息
 */
export interface ScriptGenerateProgressWsData {
  type: typeof WsEventNames.SCRIPT_GENERATE_PROGRESS;
  taskId: string;
  scriptId: string;
  taskType: "generate";
  status: "started" | "streaming" | "completed" | "failed";
  progress?: number;
  chunk?: string;
  result?: {
    title?: string;
    content?: unknown;
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 剧本生成完成消息
 */
export interface ScriptGenerateDoneWsData {
  type: typeof WsEventNames.SCRIPT_GENERATE_DONE;
  taskId: string;
  result?: {
    title?: string;
    description?: string;
  };
}

/**
 * 剧本生成失败消息
 */
export interface ScriptGenerateFailedWsData {
  type: typeof WsEventNames.SCRIPT_GENERATE_FAILED;
  taskId: string;
  error?: {
    message?: string;
  };
}

/**
 * 剧本解析进度消息
 */
export interface ScriptParseProgressWsData {
  type: typeof WsEventNames.SCRIPT_PARSE_PROGRESS;
  taskId: string;
  scriptId: string;
  status?: WsTaskStatus;
  progress?: number;
  message?: string;
  result?: {
    characters?: unknown[];
    scenes?: unknown[];
    props?: unknown[];
    dialogues?: unknown[];
  };
  error?: {
    message?: string;
  };
}

/**
 * 剧本编辑进度消息
 */
export interface ScriptEditProgressWsData {
  type: typeof WsEventNames.SCRIPT_EDIT_PROGRESS;
  taskId: string;
  scriptId: string;
  taskType: "continue" | "rewrite" | "expand" | "condense";
  status: "started" | "streaming" | "completed" | "failed";
  progress?: number;
  chunk?: string;
  result?: {
    paragraphs: unknown[];
    suggestedSceneTitle?: string;
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 资产图片生成进度消息
 */
export interface AssetImageProgressWsData {
  type: typeof WsEventNames.ASSET_IMAGE_PROGRESS;
  taskId: string;
  scriptId: string;
  refId: string;
  status: WsTaskStatus;
  progress?: number;
  result?: {
    imageId: string;
    url: string;
    thumbnailUrl: string | null;
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 资产视频生成进度消息
 */
export interface AssetVideoProgressWsData {
  type: typeof WsEventNames.ASSET_VIDEO_PROGRESS;
  taskId: string;
  scriptId: string;
  storyboardId: string;
  status: WsTaskStatus;
  progress?: number;
  result?: {
    videoUrl: string;
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 分镜批量生成进度消息
 */
export interface StoryboardGenerateProgressWsData {
  type: typeof WsEventNames.STORYBOARD_GENERATE_PROGRESS;
  taskId: string;
  scriptId: string;
  status?: WsTaskStatus;
  progress?: number;
  currentScene?: string;
  generatedCount?: number;
  timestamp: string;
}

/**
 * 分镜批量生成完成消息
 */
export interface StoryboardGenerateDoneWsData {
  type: typeof WsEventNames.STORYBOARD_GENERATE_DONE;
  taskId: string;
  scriptId: string;
  storyboards: Array<Record<string, unknown>>;
  progress: number;
  timestamp: string;
}

/**
 * 分镜批量生成失败消息
 */
export interface StoryboardGenerateFailedWsData {
  type: typeof WsEventNames.STORYBOARD_GENERATE_FAILED;
  taskId: string;
  scriptId: string;
  status: "failed";
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 分镜解析进度消息
 * 用于独立的分镜解析任务进度推送
 */
export interface StoryboardParseProgressWsData {
  type: typeof WsEventNames.STORYBOARD_PARSE_PROGRESS;
  taskId: string;
  scriptId: string;
  status?: WsTaskStatus;
  progress?: number;
  message?: string;
  result?: {
    shotGroups?: unknown[];
  };
  error?: {
    message?: string;
  };
  timestamp: string;
  /** 分批解析信息（可选，仅在分批模式下存在） */
  batchInfo?: {
    currentBatch: number;
    totalBatches: number;
    completedShots: number;
    estimatedTotalShots?: number;
  };
}

/**
 * 通用生成进度消息（用于 image_gen / video_gen / audio_gen 模块）
 */
export interface GenerationProgressWsData {
  taskId: string;
  projectId: string;
  taskType: "image_gen" | "video_gen" | "audio_gen";
  status: WsTaskStatus;
  progress: number;
  currentStep: string;
  message: string;
}

/**
 * 通用生成完成消息
 */
export interface GenerationCompleteWsData {
  taskId: string;
  projectId: string;
  taskType: string;
  resultUrl: string;
  metadata?: Record<string, string>;
}

/**
 * 通用生成失败消息
 */
export interface GenerationFailedWsData {
  taskId: string;
  projectId: string;
  taskType: string;
  errorCode: number;
  errorMessage: string;
  retryable: boolean;
}

/**
 * 额度告警消息
 */
export interface QuotaWarningWsData {
  warningType: "small_cycle" | "large_cycle" | "balance";
  remainingPercent: number;
  message: string;
}

/**
 * 系统通知消息
 */
export interface SystemNotificationWsData {
  notificationId: string;
  type: "info" | "warning" | "error";
  title: string;
  content: string;
  actionUrl?: string;
}

// ==================== 联合类型 ====================

/**
 * 所有剧本相关的 WebSocket 消息数据类型
 */
export type ScriptWsData =
  | ScriptGenerateProgressWsData
  | ScriptGenerateDoneWsData
  | ScriptGenerateFailedWsData
  | ScriptParseProgressWsData;

/**
 * 所有资产相关的 WebSocket 消息数据类型
 */
export type AssetWsData = AssetImageProgressWsData | AssetVideoProgressWsData;

/**
 * 所有分镜相关的 WebSocket 消息数据类型
 */
export type StoryboardWsData =
  | StoryboardGenerateProgressWsData
  | StoryboardGenerateDoneWsData
  | StoryboardGenerateFailedWsData
  | StoryboardParseProgressWsData;

// ==================== 分镜组相关事件（重构后新增）====================

/**
 * 主体检测状态
 */
export type DetectionStatusWs =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/**
 * 检测到的主体（WebSocket 传输用）
 */
export interface DetectedSubjectWsData {
  /** 主体序号（1-based，最多5个） */
  index: number;
  /** 存储路径（如 mask/20260401/abc.png） */
  maskKey: string;
  /** 预览图存储路径 */
  previewKey: string;
  /** 面积（排序依据） */
  area: number;
}

/**
 * 分镜组主体检测完成消息
 * 当分镜组图生成后自动触发主体检测，检测完成后推送此事件
 */
export interface ShotGroupSubjectsDetectedWsData {
  type: typeof WsEventNames.SHOTGROUP_SUBJECTS_DETECTED;
  /** 分镜组 ID */
  shotGroupId: string;
  /** 剧本 ID */
  scriptId: string;
  /** 检测状态 */
  detectionStatus: DetectionStatusWs;
  /** 检测到的主体列表（已转存的 mask 数据） */
  detectedSubjects?: DetectedSubjectWsData[];
  /** 检测失败原因 */
  detectionError?: string;
  /** 主图版本（每次生成 +1） */
  mainImageVersion?: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 分镜视频生成状态
 */
export type ShotVideoStatusWs =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

/**
 * 分镜视频生成进度消息
 * 每个分镜视频生成过程中推送进度
 */
export interface ShotVideoProgressWsData {
  type: typeof WsEventNames.SHOT_VIDEO_PROGRESS;
  /** 分镜组 ID */
  shotGroupId: string;
  /** 分镜 ID */
  shotId: string;
  /** 剧本 ID */
  scriptId: string;
  /** 生成状态 */
  status: ShotVideoStatusWs;
  /** 进度 0-100 */
  progress: number;
  /** 生成的视频 URL（完成后） */
  videoUrl?: string;
  /** 错误信息 */
  error?: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 所有分镜组相关的 WebSocket 消息数据类型
 */
export type ShotGroupWsData =
  | ShotGroupSubjectsDetectedWsData
  | ShotVideoProgressWsData;

// ==================== 资产 CRUD 更新事件 ====================

/**
 * 角色资产更新消息（用于分段解析实时推送）
 */
export interface AssetCharacterUpdateWsData {
  type: typeof WsEventNames.ASSET_CHARACTER_UPDATE;
  scriptId: string;
  /** 引用 ID（剧本 content.characters 中的 id） */
  refId: string;
  /** 资产库 ID（characters 表的 id） */
  assetId?: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description?: string;
  /** 重要性 */
  importance?: "protagonist" | "supporting" | "minor";
  /** 性别 */
  gender?: "male" | "female" | "other" | "unknown";
  /** 年龄 */
  age?: string;
  /** 性格 */
  personality?: string;
  /** 职业 */
  occupation?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 场景资产更新消息
 */
export interface AssetSceneUpdateWsData {
  type: typeof WsEventNames.ASSET_SCENE_UPDATE;
  scriptId: string;
  /** 引用 ID */
  refId: string;
  /** 资产库 ID */
  assetId?: string;
  /** 场景名称 */
  name: string;
  /** 场景描述 */
  description?: string;
  /** 场景设置 */
  setting?: {
    timeOfDay?: "morning" | "afternoon" | "evening" | "night" | "unknown";
    weather?: "clear" | "cloudy" | "rainy" | "snowy" | "foggy" | "unknown";
  };
  createdAt: string;
}

/**
 * 道具资产更新消息
 */
export interface AssetPropUpdateWsData {
  type: typeof WsEventNames.ASSET_PROP_UPDATE;
  scriptId: string;
  /** 引用 ID */
  refId: string;
  /** 资产库 ID */
  assetId?: string;
  /** 道具名称 */
  name: string;
  /** 道具描述 */
  description?: string;
  /** 道具类别 */
  category?: "props" | "costume" | "makeup" | "equipment";
  createdAt: string;
}

/**
 * 分镜更新消息
 */
export interface AssetStoryboardUpdateWsData {
  type: typeof WsEventNames.ASSET_STORYBOARD_UPDATE;
  scriptId: string;
  /** 分镜 ID */
  storyboardId: string;
  /** 序号 */
  sequenceNumber: number;
  /** 场景 ID */
  sceneId?: string;
  /** 角色 ID 列表 */
  characterIds: string[];
  /** 道具 ID 列表 */
  propIds: string[];
  /** 对白列表 */
  dialogues: Array<{
    id: string;
    characterId?: string;
    characterName: string;
    text: string;
    emotion?: string;
    isVoiceover?: boolean;
  }>;
  /** 画面描述 */
  description: string;
  /** 景别 */
  shotType?: string;
  /** 拍摄角度 */
  cameraAngle?: string;
  /** 运镜方式 */
  cameraMovement?: string;
  /** 时长（秒） */
  duration?: number;
  createdAt: string;
}

/**
 * 资产删除消息通用结构
 */
export interface AssetDeleteWsData {
  type:
    | typeof WsEventNames.ASSET_CHARACTER_DELETE
    | typeof WsEventNames.ASSET_SCENE_DELETE
    | typeof WsEventNames.ASSET_PROP_DELETE
    | typeof WsEventNames.ASSET_STORYBOARD_DELETE;
  scriptId: string;
  assetId: string;
}

/**
 * 所有资产 CRUD 更新相关的 WebSocket 消息数据类型
 */
export type AssetCrudWsData =
  | AssetCharacterUpdateWsData
  | AssetSceneUpdateWsData
  | AssetPropUpdateWsData
  | AssetStoryboardUpdateWsData
  | AssetDeleteWsData;

// ==================== 导出相关事件 ====================

/**
 * 导出进度消息
 */
export interface ExportProgressWsData {
  type: typeof WsEventNames.EXPORT_PROGRESS;
  taskId: string;
  batchId: string;
  projectId?: string;
  progress:
    | number
    | {
        percentage: number;
        currentStep: string;
        frameProcessed?: number;
        frameTotal?: number;
        estimatedTimeRemaining?: number;
      };
  currentStep?: string;
  message?: string;
  frameProcessed?: number;
  frameTotal?: number;
  estimatedTimeRemaining?: number;
  timestamp: string;
}

/**
 * 导出完成消息
 */
export interface ExportCompleteWsData {
  type: typeof WsEventNames.EXPORT_COMPLETE;
  taskId: string;
  batchId: string;
  projectId?: string;
  status: "completed";
  output?: {
    fileSize: number;
    duration: number;
    width: number;
    height: number;
  };
  timestamp: string;
}

/**
 * 导出失败消息
 */
export interface ExportFailedWsData {
  type: typeof WsEventNames.EXPORT_FAILED;
  taskId: string;
  batchId: string;
  projectId?: string;
  status: "failed";
  error?: {
    code: number;
    message: string;
  };
  timestamp: string;
}

/**
 * 批量导出进度消息
 */
export interface ExportBatchProgressWsData {
  type: typeof WsEventNames.EXPORT_BATCH_PROGRESS;
  batchId: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  timestamp: string;
}

/**
 * 所有导出相关的 WebSocket 消息数据类型
 */
export type ExportWsData =
  | ExportProgressWsData
  | ExportCompleteWsData
  | ExportFailedWsData
  | ExportBatchProgressWsData;

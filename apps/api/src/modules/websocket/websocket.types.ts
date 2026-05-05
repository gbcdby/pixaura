/**
 * WebSocket 类型定义
 */

import { Socket } from "socket.io";
import {
  WsEventNames,
  type WsTaskStatus,
  type ScriptGenerateProgressWsData,
  type ScriptParseProgressWsData,
  type ScriptEditProgressWsData,
  type AssetImageProgressWsData,
  type AssetVideoProgressWsData,
  type StoryboardGenerateProgressWsData,
  type StoryboardParseProgressWsData,
  type ExportProgressWsData,
  type ExportCompleteWsData,
  type ExportFailedWsData,
} from "@pixaura/shared-types";

// 重新导出事件名称常量，方便后端使用
export { WsEventNames };

// 重新导出任务状态类型
export type { WsTaskStatus };

/**
 * 认证后的 Socket 类型
 */
export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    tokenExpiresAt?: number;
    connectedAt: number;
  };
}

/**
 * WebSocket 错误码
 */
export enum WebSocketErrorCode {
  // 成功
  SUCCESS = 0,

  // 认证相关
  TOKEN_EXPIRED = 4001,
  CONNECTION_LIMIT_EXCEEDED = 4002,
  INVALID_MESSAGE_FORMAT = 4003,
  USER_DISABLED = 4004,
  TOKEN_NEAR_EXPIRY = 4005,
  MESSAGE_TOO_LARGE = 4006,
  MESSAGE_QUEUE_FULL = 4007,

  // Refresh Token 过期
  REFRESH_TOKEN_EXPIRED = 4010,

  // 服务器错误
  INTERNAL_ERROR = 4100,

  // 任务相关错误
  TASK_NOT_FOUND = 4201,
  TASK_ACCESS_DENIED = 4202,
}

/**
 * WebSocket 消息类型
 */
export enum WebSocketMessageType {
  // 系统消息
  PING = "ping",
  PONG = "pong",
  SYNC_REQUEST = "sync_request",
  SYNC_RESPONSE = "sync_response",
  CONNECTION_ESTABLISHED = "connection_established",
  TOKEN_REFRESH_REQUIRED = "token_refresh_required",
  ACK = "ack",

  // 生成任务进度
  GENERATION_PROGRESS = "generation_progress",
  GENERATION_COMPLETE = "generation_complete",
  GENERATION_FAILED = "generation_failed",

  // 导出任务进度
  EXPORT_PROGRESS = "export:progress",
  EXPORT_STATUS = "export:status",
  EXPORT_COMPLETE = "export:complete",
  EXPORT_FAILED = "export:failed",
  EXPORT_BATCH_PROGRESS = "export:batch_progress",

  // 额度告警
  QUOTA_WARNING = "quota_warning",

  // 系统通知
  SYSTEM_NOTIFICATION = "system_notification",
}

/**
 * 基础消息结构
 */
export interface WebSocketMessage<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  messageId: string;
}

/**
 * Ping 消息
 */
export interface PingMessage {
  clientTime: number;
}

/**
 * Pong 消息
 */
export interface PongMessage {
  clientTime: number;
  serverTime: number;
}

/**
 * 同步请求
 */
export interface SyncRequest {
  lastMessageId: string;
}

/**
 * 同步响应
 */
export interface SyncResponse {
  messages: WebSocketMessage[];
}

/**
 * 连接建立消息
 */
export interface ConnectionEstablishedMessage {
  userId: string;
  tokenExpiresAt: number;
  serverTime: number;
}

/**
 * Token 刷新通知
 */
export interface TokenRefreshRequiredMessage {
  expiresAt: number;
}

/**
 * ACK 消息
 */
export interface AckMessage {
  messageId: string;
}

/**
 * 生成任务进度
 */
export interface GenerationProgressMessage {
  taskId: string;
  projectId: string;
  taskType: "image_gen" | "video_gen" | "audio_gen";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  currentStep: string;
  message: string;
}

/**
 * 剧本生成进度消息
 */
export interface ScriptGenerateProgressMessage {
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
export interface ScriptGenerateDoneMessage {
  type: typeof WsEventNames.SCRIPT_GENERATE_DONE;
  taskId: string;
  scriptId: string;
  result?: {
    title?: string;
    description?: string;
  };
  timestamp: string;
}

/**
 * 剧本解析进度消息
 */
export interface ScriptParseProgressMessage {
  type: typeof WsEventNames.SCRIPT_PARSE_PROGRESS;
  taskId: string;
  scriptId: string;
  taskType: "parse";
  status: "started" | "streaming" | "completed" | "failed";
  progress?: number;
  message?: string;
  result?: {
    title?: string;
    content?: unknown;
    characters?: unknown[];
    scenes?: unknown[];
    props?: unknown[];
  };
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 剧本编辑进度消息
 */
export interface ScriptEditProgressMessage {
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
 * 订阅剧本任务消息
 */
export interface SubscribeScriptTaskMessage {
  taskId: string;
  type: "generate" | "edit";
}

/**
 * 取消订阅剧本任务消息
 */
export interface UnsubscribeScriptTaskMessage {
  taskId: string;
}

/**
 * 生成完成消息
 */
export interface GenerationCompleteMessage {
  taskId: string;
  projectId: string;
  taskType: string;
  resultUrl: string;
  metadata: Record<string, string>;
}

/**
 * 生成失败消息
 */
export interface GenerationFailedMessage {
  taskId: string;
  projectId: string;
  taskType: string;
  errorCode: number;
  errorMessage: string;
  retryable: boolean;
}

/**
 * 额度告警
 */
export interface QuotaWarningMessage {
  warningType: "small_cycle" | "large_cycle" | "balance";
  remainingPercent: number;
  message: string;
}

/**
 * 系统通知
 */
export interface SystemNotificationMessage {
  notificationId: string;
  type: "info" | "warning" | "error";
  title: string;
  content: string;
  actionUrl?: string;
}

/**
 * 导出进度消息
 */
export interface ExportProgressMessage {
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
 * 导出状态消息
 */
export interface ExportStatusMessage {
  type: typeof WsEventNames.EXPORT_COMPLETE | typeof WsEventNames.EXPORT_FAILED;
  taskId: string;
  batchId: string;
  projectId?: string;
  status: "completed" | "failed" | string;
  output?: {
    fileSize: number;
    duration: number;
    width: number;
    height: number;
  };
  error?: {
    code: number;
    message: string;
  };
  timestamp: string;
}

/**
 * 批量导出进度消息
 */
export interface ExportBatchProgressMessage {
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
 * 资产图片生成进度消息
 */
export interface AssetImageProgressMessage {
  type: typeof WsEventNames.ASSET_IMAGE_PROGRESS;
  taskId: string;
  scriptId: string;
  refId: string;
  status: "pending" | "processing" | "completed" | "failed";
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
 * 分镜视频生成进度消息
 */
export interface AssetVideoProgressMessage {
  type: typeof WsEventNames.ASSET_VIDEO_PROGRESS;
  taskId: string;
  scriptId: string;
  storyboardId: string;
  status: "pending" | "processing" | "completed" | "failed";
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
 * 一键分镜批量生成进度消息
 */
export interface StoryboardGenerateProgressMessage {
  type:
    | typeof WsEventNames.STORYBOARD_GENERATE_PROGRESS
    | typeof WsEventNames.STORYBOARD_GENERATE_DONE
    | typeof WsEventNames.STORYBOARD_GENERATE_FAILED;
  taskId: string;
  scriptId: string;
  status?: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  currentScene?: string;
  generatedCount?: number;
  storyboards?: Array<Record<string, unknown>>;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  timestamp: string;
}

/**
 * 分镜解析进度消息
 */
export interface StoryboardParseProgressMessage {
  type: typeof WsEventNames.STORYBOARD_PARSE_PROGRESS;
  taskId: string;
  scriptId: string;
  status?: "pending" | "processing" | "completed" | "failed";
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
 * 消息配置
 */
export const MESSAGE_CONFIG = {
  maxPerUser: 100, // 每用户最多 100 条
  maxSize: 64 * 1024, // 单消息最大 64KB
  ttl: 5 * 60, // 5 分钟 TTL
  globalMaxMemory: 100 * 1024 * 1024, // 100MB 全局限制
} as const;

/**
 * 连接配置
 */
export const CONNECTION_CONFIG = {
  maxConnectionsPerUser: 3, // 单用户最多 3 个连接
  heartbeatInterval: 30000, // 30 秒心跳间隔
  heartbeatTimeout: 60000, // 60 秒超时
  messageRetryInterval: 5000, // 5 秒重试间隔
  messageMaxRetries: 3, // 最多重试 3 次
  tokenExpiryThreshold: 5 * 60 * 1000, // 5 分钟过期阈值
} as const;

/**
 * Redis Key 前缀
 */
export const REDIS_KEY_PREFIX = {
  messages: "ws:messages",
  connections: "ws:connections",
  userSockets: "ws:user_sockets",
  task_subscribers: "ws:task_subscribers",
} as const;

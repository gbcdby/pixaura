/**
 * AI 模块配置
 * 集中管理 AI 相关的配置常量
 */

/**
 * 流式响应超时配置（毫秒）
 */
export const AI_STREAM_TIMEOUT_CONFIG = {
  /** 首块数据超时 */
  firstChunkTimeoutMs: parseInt(
    process.env.AI_STREAM_TIMEOUT_FIRST || "10000",
    10,
  ),
  /** 块间超时 */
  betweenChunkTimeoutMs: parseInt(
    process.env.AI_STREAM_TIMEOUT_BETWEEN || "30000",
    10,
  ),
  /** 总超时 */
  totalTimeoutMs: parseInt(process.env.AI_STREAM_TIMEOUT_TOTAL || "300000", 10),
  /** HTTP 请求超时 - 剧本生成需要更长时间，增加到5分钟 */
  requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT || "300000", 10),
};

/**
 * 默认模型配置
 */
export const DEFAULT_MODEL_CONFIG = {
  /** 默认文本生成模型 */
  textModel: process.env.DEFAULT_TEXT_MODEL || "qwen2.5-7b",
  /** 默认图像生成模型 */
  imageModel: process.env.DEFAULT_IMAGE_MODEL || "qwen-image-2.0",
  /** 默认温度 */
  temperature: 0.7,
  /** 默认最大 token */
  maxTokens: 8000,
};

/**
 * 费用计算配置（元/1000 tokens）
 */
export const COST_RATES = {
  /** 默认费率 */
  default: 0.02,
  /** 文本生成费率 */
  textGeneration: 0.02,
  /** 图像生成费率 */
  imageGeneration: 0.1,
};

/**
 * 任务类型常量
 */
export const TaskType = {
  GENERATE: "generate",
  PARSE: "parse",
  CONTINUE: "continue",
  REWRITE: "rewrite",
  EXPAND: "expand",
  CONDENSE: "condense",
} as const;

/**
 * Script AI 任务类型集合
 * 用于 Worker 任务路由判断
 */
export const SCRIPT_AI_TASK_TYPES = new Set([
  TaskType.GENERATE,
  TaskType.PARSE,
  TaskType.CONTINUE,
  TaskType.REWRITE,
  TaskType.EXPAND,
  TaskType.CONDENSE,
]);

/**
 * 错误码常量
 */
export const ErrorCode = {
  GENERATION_FAILED: "GENERATION_FAILED",
  PARSE_FAILED: "PARSE_FAILED",
  EDIT_FAILED: "EDIT_FAILED",
  STREAM_TIMEOUT: "STREAM_TIMEOUT",
  QUEUE_PROCESSING_ERROR: "QUEUE_PROCESSING_ERROR",
  GENERATION_ERROR: "GENERATION_ERROR",
} as const;

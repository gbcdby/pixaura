/**
 * Pixaura - 共享类型定义
 */

// 错误码
export * from "./error-codes";

// 权限定义
export * from "./permissions";

// API 响应格式
export * from "./api-response";

// 用户相关类型
export * from "./user";

// 模型配置相关类型
export * from "./model-config";

// 计费相关类型
export * from "./billing";

// 后台管理相关类型
export * from "./system-admin";

// 项目管理相关类型
export * from "./project";

// 剧本管理相关类型
export * from "./script";

// 角色资产库相关类型
export * from "./character";

// 场景资产库相关类型
export * from "./scene";

// 道具资产库相关类型
export * from "./prop";

// 分镜管理相关类型
export * from "./storyboard";

// 分镜自动生成相关类型
export * from "./storyboard-generation";

// 视频通用类型（VideoResolution, AspectRatio 等）
export * from "./video-common";

// 视频生成相关类型
export * from "./video-gen";

// 图片生成相关类型
export * from "./image-gen";

// 素材库相关类型
export * from "./asset";

// 音频生成相关类型
export * from "./audio-gen";

// 系统公告相关类型
export * from "./system-notice";

// WebSocket 事件类型（统一前后端事件名称）
export * from "./websocket-events";

// 存储相关类型（FileCategory、FileUploadResult 等）
export * from "./storage";

// 字幕相关类型
export * from "./subtitle";

// 导出输入数据类型（FFmpeg.wasm 导出）
export * from "./export-input";

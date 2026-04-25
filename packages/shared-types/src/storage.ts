/**
 * 存储相关类型定义
 * 用于统一约束 OSS 上传文件的分类和管理
 */

/**
 * 文件类别枚举
 * 用于统一约束 OSS 上传文件的分类
 */
export enum FileCategory {
  /** 用户头像 */
  AVATAR = "avatar",
  /** 图片素材（角色、场景、道具、分镜图片） */
  IMAGE = "image",
  /** 音频文件（TTS、配乐） */
  AUDIO = "audio",
  /** 视频文件（分镜视频、导出视频） */
  VIDEO = "video",
  /** 临时缓存（AI生成过程中的中间文件、待处理文件） */
  TEMP = "temp",
}

/**
 * 文件类别名称映射（前端显示用）
 */
export const FileCategoryNames: Record<FileCategory, string> = {
  [FileCategory.AVATAR]: "头像",
  [FileCategory.IMAGE]: "图片",
  [FileCategory.AUDIO]: "音频",
  [FileCategory.VIDEO]: "视频",
  [FileCategory.TEMP]: "临时文件",
};

/**
 * 文件上传结果
 */
export interface FileUploadResult {
  /** 文件访问 URL（相对路径 `/static/${key}`） */
  url: string;
  /** OSS Key（完整路径，不含 `/static/` 前缀） */
  key: string;
}

/**
 * 大文件上传选项
 */
export interface LargeFileUploadOptions {
  /** 分片大小（字节），默认 5MB */
  chunkSize?: number;
  /** 并发分片数，默认 3 */
  concurrent?: number;
  /** 上传进度回调 */
  onProgress?: (progress: number) => void;
}

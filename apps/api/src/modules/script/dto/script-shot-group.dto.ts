import { z } from "zod";

/**
 * 主体检测请求 Schema
 */
export const DetectSubjectsSchema = z.object({});

export type DetectSubjectsDto = z.infer<typeof DetectSubjectsSchema>;

/**
 * 主体检测结果
 * 只返回坐标区域，不返回 mask 图片
 */
export interface DetectedSubjectResult {
  index: number;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  area?: number;
}

export interface DetectSubjectsResponse {
  shotGroupId: string;
  detectionStatus: "pending" | "processing" | "completed" | "failed";
  detectedSubjects?: DetectedSubjectResult[];
  detectionError?: string;
}

/**
 * 对口型视频生成请求 Schema
 * characterId 是角色引用 ID（前端生成的字符串 ID，非 UUID）
 * croppedImageUrl 和 audioUrl 是前端已处理好的临时文件 URL（可选）
 */
export const GenerateLipSyncVideoSchema = z.object({
  characterId: z.string().min(1, "角色ID不能为空"),
  useManual: z.boolean().optional().default(false),
  prompt: z.string().max(500, "提示词过长").optional(),
  resolution: z.enum(["720", "1080"]).optional().default("1080"),
  // 前端已裁切的图片 URL（从 uploadCroppedImage 返回）
  croppedImageUrl: z.string().url("裁切图片 URL 格式不正确").optional(),
  // 前端已复制的音频 URL（从 copyDialogueAudioToTemp 返回）
  audioUrl: z.string().url("音频 URL 格式不正确").optional(),
});

export type GenerateLipSyncVideoDto = z.infer<
  typeof GenerateLipSyncVideoSchema
>;

/**
 * 对口型视频生成响应
 */
export interface GenerateLipSyncVideoResponse {
  shotGroupId: string;
  shotId: string;
  taskId: string;
  status: "pending" | "processing";
}

/**
 * 对口型视频状态查询响应
 */
export interface LipSyncVideoStatusResponse {
  shotGroupId: string;
  shotId: string;
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  videoKey?: string;
  duration?: number;
  error?: string;
}

/**
 * 手动框选上传请求 Schema
 * 只存储坐标区域，不存储图片
 * characterId 是角色引用 ID（前端生成的字符串 ID，非 UUID）
 */
export const UploadManualRegionSchema = z.object({
  characterId: z.string().min(1, "角色ID不能为空"),
  region: z.object({
    x: z.number().min(0).max(1, "x 坐标范围 0-1"),
    y: z.number().min(0).max(1, "y 坐标范围 0-1"),
    width: z.number().min(0.01).max(1, "宽度范围 0.01-1"),
    height: z.number().min(0.01).max(1, "高度范围 0.01-1"),
  }),
});

export type UploadManualRegionDto = z.infer<typeof UploadManualRegionSchema>;

/**
 * 手动框选上传响应
 * 只返回坐标区域，不返回图片
 */
export interface UploadManualRegionResponse {
  shotGroupId: string;
  characterId: string;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * 更新角色框选配置请求 Schema
 * regions 的 key 是角色引用 ID（前端生成的字符串 ID，非 UUID）
 */
export const UpdateCharacterRegionsSchema = z.object({
  regions: z.record(
    z.string(), // 角色引用 ID，前端生成的字符串 ID
    z.object({
      detectedIndex: z.number().int().min(1).max(5).optional(),
      useManual: z.boolean().optional(),
      // 手动框选坐标（可选，用于直接更新坐标）
      manualRegion: z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        width: z.number().min(0.01).max(1),
        height: z.number().min(0.01).max(1),
      }).optional(),
    }),
  ),
});

export type UpdateCharacterRegionsDto = z.infer<
  typeof UpdateCharacterRegionsSchema
>;

/**
 * 更新角色框选配置响应
 * 移除 maskKey/previewKey，只保留坐标信息
 */
export interface UpdateCharacterRegionsResponse {
  shotGroupId: string;
  characterRegions: Record<
    string,
    {
      detectedIndex?: number;
      // 手动框选坐标
      manualRegion?: { x: number; y: number; width: number; height: number };
      useManual: boolean;
    }
  >;
}

/**
 * 上传裁切图片请求 Schema
 * 用于对口型视频生成，前端裁切框选区域后上传
 */
export const UploadCroppedImageSchema = z.object({
  characterId: z.string().min(1, "角色ID不能为空"),
  imageData: z.string().min(1, "图片数据不能为空"), // base64 格式: data:image/png;base64,xxx
});

export type UploadCroppedImageDto = z.infer<typeof UploadCroppedImageSchema>;

/**
 * 上传裁切图片响应
 */
export interface UploadCroppedImageResponse {
  shotGroupId: string;
  characterId: string;
  key: string; // 临时文件相对路径（temp/xxx.png）
  url: string; // 公网可访问 URL
}

/**
 * 复制对话音频请求 Schema
 * 将对话音频复制到临时目录供火山引擎访问
 */
export const CopyDialogueAudioSchema = z.object({
  dialogueId: z.string().min(1, "对话ID不能为空"),
});

export type CopyDialogueAudioDto = z.infer<typeof CopyDialogueAudioSchema>;

/**
 * 复制对话音频响应
 */
export interface CopyDialogueAudioResponse {
  shotGroupId: string;
  dialogueId: string;
  key: string; // 临时文件相对路径（temp/xxx.wav）
  url: string; // 公网可访问 URL
}

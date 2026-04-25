import { z } from "zod";

/**
 * 生成角色请求 DTO
 */
export const GenerateCharactersSchema = z.object({
  modelId: z.string().optional().describe("使用的模型ID"),
  options: z
    .object({
      generateImages: z.boolean().default(false).describe("是否同时生成图片"),
      style: z
        .enum(["realistic", "anime", "3d"])
        .optional()
        .describe("生成风格"),
    })
    .optional(),
});

export type GenerateCharactersDto = z.infer<typeof GenerateCharactersSchema>;

/**
 * 生成场景请求 DTO
 */
export const GenerateScenesSchema = z.object({
  modelId: z.string().optional().describe("使用的模型ID"),
  options: z
    .object({
      generateImages: z.boolean().default(false).describe("是否同时生成图片"),
      style: z
        .enum(["realistic", "anime", "3d"])
        .optional()
        .describe("生成风格"),
    })
    .optional(),
});

export type GenerateScenesDto = z.infer<typeof GenerateScenesSchema>;

/**
 * 生成道具请求 DTO
 */
export const GeneratePropsSchema = z.object({
  modelId: z.string().optional().describe("使用的模型ID"),
  options: z
    .object({
      generateImages: z.boolean().default(false).describe("是否同时生成图片"),
      style: z
        .enum(["realistic", "anime", "3d"])
        .optional()
        .describe("生成风格"),
    })
    .optional(),
});

export type GeneratePropsDto = z.infer<typeof GeneratePropsSchema>;

/**
 * 批量生成资产请求 DTO
 */
export const BatchGenerateAssetsSchema = z.object({
  steps: z
    .array(z.enum(["characters", "scenes", "props"]))
    .min(1)
    .describe("要生成的步骤列表"),
  modelId: z.string().optional().describe("使用的模型ID"),
  options: z
    .object({
      generateImages: z.boolean().default(false).describe("是否同时生成图片"),
      style: z
        .enum(["realistic", "anime", "3d"])
        .optional()
        .describe("生成风格"),
    })
    .optional(),
});

export type BatchGenerateAssetsDto = z.infer<typeof BatchGenerateAssetsSchema>;

/**
 * 更新资产请求 DTO
 */
export const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(100).optional().describe("资产名称"),
  description: z.string().max(2000).optional().describe("资产描述"),
  assetType: z.enum(["character", "scene", "prop"]).describe("资产类型"),
  // 角色特有字段
  personality: z.string().max(500).optional().describe("性格（角色）"),
  age: z.string().max(50).optional().describe("年龄（角色）"),
  gender: z.string().max(20).optional().describe("性别（角色）"),
  importance: z
    .enum(["protagonist", "supporting", "minor"])
    .optional()
    .describe("重要性（角色）"),
  // 场景特有字段
  location: z.string().max(500).optional().describe("地点（场景）"),
  time: z.string().max(100).optional().describe("时间（场景）"),
  atmosphere: z.string().max(500).optional().describe("氛围（场景）"),
});

export type UpdateAssetDto = z.infer<typeof UpdateAssetSchema>;

/**
 * 生成资产图片请求 DTO
 */
export const GenerateAssetImageSchema = z.object({
  modelId: z.string().optional().describe("使用的模型ID"),
  prompt: z.string().max(2000).optional().describe("自定义提示词"),
  negativePrompt: z.string().max(1000).optional().describe("负面提示词"),
  type: z
    .enum(["main", "angle", "reference"])
    .default("main")
    .describe("图片类型"),
  angleIndex: z
    .number()
    .int()
    .optional()
    .describe("角度索引（当type为angle时）"),
});

export type GenerateAssetImageDto = z.infer<typeof GenerateAssetImageSchema>;

/**
 * 资产图片响应
 */
export interface AssetImageResponse {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "main" | "angle" | "reference";
  angleIndex?: number;
  createdAt: string;
}

/**
 * 资产响应
 */
export interface AssetResponse {
  id: string;
  name: string;
  description?: string;
  assetType: "character" | "scene" | "prop";
  assetStatus: "none" | "imported" | "will_create";
  images: AssetImageResponse[];
  mainImageId?: string;
  updatedAt: string;
}

/**
 * 生成任务响应
 */
export interface GenerateTaskResponse {
  taskId: string;
  status: "pending" | "processing";
  type:
    | "character_generate"
    | "scene_generate"
    | "prop_generate"
    | "batch_generate";
  estimatedTime: number;
}

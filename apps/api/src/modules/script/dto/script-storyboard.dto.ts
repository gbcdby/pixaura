import { z } from "zod";

/**
 * 对白信息 Schema
 */
export const DialogueSchema = z.object({
  id: z.string().describe("对白ID"),
  characterId: z.string().optional().describe("角色ID"),
  characterName: z.string().describe("角色名称"),
  text: z.string().describe("对白文本"),
  emotion: z.string().optional().describe("情绪"),
  isVoiceover: z.boolean().default(false).describe("是否为旁白"),
});

export type DialogueDto = z.infer<typeof DialogueSchema>;

/**
 * 创建分镜请求 DTO
 */
export const CreateStoryboardRefSchema = z.object({
  sequenceNumber: z.number().int().positive().describe("分镜序号"),
  title: z.string().max(200).optional().describe("分镜标题"),
  description: z.string().min(1).max(2000).describe("画面描述"),
  characterIds: z.array(z.string()).default([]).describe("关联角色ID列表"),
  sceneId: z.string().optional().describe("关联场景ID"),
  propIds: z.array(z.string()).default([]).describe("关联道具ID列表"),
  dialogues: z.array(DialogueSchema).default([]).describe("对白列表"),
  voiceover: z.string().max(1000).optional().describe("旁白文本"),
  shotType: z.string().max(50).optional().describe("镜头类型"),
  cameraAngle: z.string().max(50).optional().describe("拍摄角度"),
  cameraMovement: z.string().max(50).optional().describe("镜头运动"),
  duration: z.number().int().positive().default(3).describe("时长（秒）"),
  mode: z
    .enum(["standard", "quick", "locked"])
    .default("standard")
    .describe("分镜模式"),
  // 分镜独立模型选择
  imageModelId: z.string().optional().describe("图像生成模型ID"),
  videoModelId: z.string().optional().describe("视频生成模型ID"),
  lipSyncModelId: z.string().optional().describe("对口型模型ID"),
});

export type CreateStoryboardRefDto = z.infer<typeof CreateStoryboardRefSchema>;

/**
 * 更新分镜请求 DTO
 */
export const UpdateStoryboardRefSchema = z.object({
  title: z.string().max(200).optional().describe("分镜标题"),
  description: z.string().max(2000).optional().describe("画面描述"),
  characterIds: z.array(z.string()).optional().describe("关联角色ID列表"),
  sceneId: z.string().optional().describe("关联场景ID"),
  propIds: z.array(z.string()).optional().describe("关联道具ID列表"),
  dialogues: z.array(DialogueSchema).optional().describe("对白列表"),
  voiceover: z.string().max(1000).optional().describe("旁白文本"),
  shotType: z.string().max(50).optional().describe("镜头类型"),
  cameraAngle: z.string().max(50).optional().describe("拍摄角度"),
  cameraMovement: z.string().max(50).optional().describe("镜头运动"),
  duration: z.number().int().positive().optional().describe("时长（秒）"),
  mode: z.enum(["standard", "quick", "locked"]).optional().describe("分镜模式"),
  // 分镜独立模型选择
  imageModelId: z.string().optional().describe("图像生成模型ID"),
  videoModelId: z.string().optional().describe("视频生成模型ID"),
  lipSyncModelId: z.string().optional().describe("对口型模型ID"),
});

export type UpdateStoryboardRefDto = z.infer<typeof UpdateStoryboardRefSchema>;

/**
 * 重新排序分镜请求 DTO
 */
export const ReorderStoryboardsSchema = z.object({
  orderedIds: z.array(z.string()).min(1).describe("按新顺序排列的分镜ID列表"),
});

export type ReorderStoryboardsDto = z.infer<typeof ReorderStoryboardsSchema>;

/**
 * 续写分镜请求 DTO
 */
export const ContinueStoryboardsSchema = z.object({
  afterStoryboardId: z.string().describe("在哪个分镜后续写"),
  count: z.number().int().min(1).max(10).default(3).describe("续写数量"),
  modelId: z.string().optional().describe("使用的模型ID"),
});

export type ContinueStoryboardsDto = z.infer<typeof ContinueStoryboardsSchema>;

/**
 * 分镜图片信息
 */
export interface StoryboardImageInfo {
  id: string;
  url: string;
  thumbnailUrl?: string;
  type: "main" | "angle" | "reference";
  createdAt: string;
}

/**
 * 视频生成信息
 */
export interface VideoGenerationInfo {
  prompt: string;
  status: "pending" | "processing" | "completed" | "failed";
  videoUrl?: string;
  taskId?: string;
}

/**
 * 分镜响应
 */
export interface StoryboardRefResponse {
  id: string;
  sequenceNumber: number;
  title?: string;
  description: string;
  characterIds: string[];
  sceneId?: string;
  propIds: string[];
  dialogues: DialogueDto[];
  voiceover?: string;
  shotType?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  duration: number;
  referenceImages: StoryboardImageInfo[];
  videoGeneration?: VideoGenerationInfo;
  mode: "standard" | "quick" | "locked";
  // 分镜独立模型选择
  imageModelId?: string;
  videoModelId?: string;
  lipSyncModelId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分镜列表响应
 */
export interface StoryboardListResponse {
  items: StoryboardRefResponse[];
  total: number;
}

/**
 * 续写任务响应
 */
export interface ContinueStoryboardsResponse {
  taskId: string;
  status: "pending" | "processing";
  estimatedTime: number;
  count: number;
}

/**
 * 分镜视频生成请求 DTO
 */
export const GenerateStoryboardVideoSchema = z.object({
  storyboardId: z.string().min(1).describe("分镜ID"),
  modelId: z.string().optional().describe("视频生成模型ID（默认使用 wan2.6）"),
});

export type GenerateStoryboardVideoDto = z.infer<
  typeof GenerateStoryboardVideoSchema
>;

/**
 * 分镜视频生成任务响应
 */
export interface GenerateStoryboardVideoResponse {
  taskId: string;
  storyboardId: string;
  status: "pending" | "processing";
  estimatedTime: number;
}

/**
 * 分镜 AI 对话生成请求 DTO
 */
export const GenerateStoryboardDialogueSchema = z.object({
  storyboardId: z.string().min(1).describe("分镜ID"),
  modelId: z
    .string()
    .optional()
    .describe("文本生成模型ID（默认使用 qwen2.5-72b）"),
});

export type GenerateStoryboardDialogueDto = z.infer<
  typeof GenerateStoryboardDialogueSchema
>;

/**
 * 分镜 AI 对话生成响应
 */
export interface GenerateStoryboardDialogueResponse {
  storyboardId: string;
  dialogues: DialogueDto[];
}

/**
 * 一键生成所有分镜请求 DTO
 */
export const GenerateAllStoryboardsSchema = z.object({
  modelId: z
    .string()
    .optional()
    .describe("文本生成模型ID（默认使用 qwen2.5-72b）"),
});

export type GenerateAllStoryboardsDto = z.infer<
  typeof GenerateAllStoryboardsSchema
>;

/**
 * 一键生成所有分镜响应
 */
export interface GenerateAllStoryboardsResponse {
  taskId: string;
  status: string;
  estimatedTime: number;
}

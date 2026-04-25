import { z } from "zod";

/**
 * 字幕扩展样式
 */
export interface SubtitleExtendedStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  outlineEnabled?: boolean;
  outlineColor?: string;
  outlineWidth?: number;
  position?: "top" | "middle" | "bottom";
  alignment?: "left" | "center" | "right";
  backgroundColor?: string;
  backgroundOpacity?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  letterSpacing?: number;
  lineHeight?: number;
  marginVertical?: number;
}

/**
 * 字幕扩展样式 Schema
 */
export const SubtitleExtendedStyleSchema = z.object({
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  color: z.string().optional(),
  outlineEnabled: z.boolean().optional(),
  outlineColor: z.string().optional(),
  outlineWidth: z.number().positive().optional(),
  position: z.enum(["top", "middle", "bottom"]).optional(),
  alignment: z.enum(["left", "center", "right"]).optional(),
  backgroundColor: z.string().optional(),
  backgroundOpacity: z.number().min(0).max(1).optional(),
  shadowEnabled: z.boolean().optional(),
  shadowColor: z.string().optional(),
  shadowBlur: z.number().positive().optional(),
  shadowOffsetX: z.number().optional(),
  shadowOffsetY: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().positive().optional(),
  marginVertical: z.number().optional(),
});

/**
 * 字幕项响应
 */
export interface SubtitleItemResponse {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  text: string;
  styleOverride?: Partial<SubtitleExtendedStyle>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 字幕项响应 Schema
 */
export const SubtitleItemResponseSchema = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  text: z.string().min(1),
  styleOverride: SubtitleExtendedStyleSchema.partial().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * 字幕轨道响应
 */
export interface SubtitleTrackResponse {
  id: string;
  projectId: string;
  name: string;
  language?: string;
  isDefault: boolean;
  visible?: boolean;
  itemCount?: number;
  style: Partial<SubtitleExtendedStyle>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 字幕轨道响应 Schema
 */
export const SubtitleTrackResponseSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  language: z.string().optional(),
  isDefault: z.boolean(),
  visible: z.boolean().optional(),
  itemCount: z.number().int().nonnegative().optional(),
  style: SubtitleExtendedStyleSchema.partial(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * 字幕预设响应
 */
export interface SubtitlePresetResponse {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isDefault: boolean;
  previewText?: string;
  styleConfig: Partial<SubtitleExtendedStyle>;
  createdAt: string;
  updatedAt: string;
}

/**
 * 字幕预设响应 Schema
 */
export const SubtitlePresetResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  isSystem: z.boolean(),
  isDefault: z.boolean(),
  previewText: z.string().optional(),
  styleConfig: SubtitleExtendedStyleSchema.partial(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * 更新字幕项 DTO
 */
export interface UpdateSubtitleItemDto {
  startTime?: number;
  endTime?: number;
  text?: string;
  styleOverride?: Partial<SubtitleExtendedStyle>;
}

/**
 * 更新字幕项 DTO Schema
 */
export const UpdateSubtitleItemDtoSchema = z.object({
  startTime: z.number().nonnegative().optional(),
  endTime: z.number().positive().optional(),
  text: z.string().min(1).optional(),
  styleOverride: SubtitleExtendedStyleSchema.partial().optional(),
});

/**
 * 创建字幕预设 DTO
 */
export interface CreateSubtitlePresetDto {
  name: string;
  description?: string;
  previewText?: string;
  isDefault?: boolean;
  styleConfig: Partial<SubtitleExtendedStyle>;
}

/**
 * 创建字幕预设 DTO Schema
 */
export const CreateSubtitlePresetDtoSchema = z.object({
  name: z.string().min(1, "预设名称不能为空"),
  description: z.string().optional(),
  previewText: z.string().optional(),
  isDefault: z.boolean().optional(),
  styleConfig: SubtitleExtendedStyleSchema.partial(),
});

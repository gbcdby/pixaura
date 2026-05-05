/**
 * 剧本解析 Zod Schema
 * 供 Prompt 文件和 Worker 共用，确保 AI 输出结构与校验规则一致
 */

import { z } from "zod";

// ==================== 通用子 Schema ====================

/**
 * 对话 Schema（含容错字段）
 * AI 可能返回多种字段名变体，统一做宽松校验后转换
 */
export const DialogueSchema = z
  .object({
    // 主要字段名（Prompt 要求的标准格式）
    speakerName: z.string().optional(),
    content: z.string().optional(),
    instruction: z.string().optional(),
    actions: z.array(z.string()).optional(),
    // 容错字段名（AI 可能返回的其他格式）
    speaker: z.string().optional(),
    name: z.string().optional(),
    text: z.string().optional(),
    dialogue: z.string().optional(),
    emotion: z.string().optional(),
    mood: z.string().optional(),
  })
  .passthrough();

/**
 * 单条分镜项 Schema
 * 用于 StoryboardBatchParseResultSchema
 */
export const StoryboardItemSchema = z.object({
  sequenceNumber: z.number().int().min(1),
  sceneName: z.string(),
  characterNames: z.array(z.string()).default([]),
  propNames: z.array(z.string()).default([]),
  dialogues: z.array(DialogueSchema).default([]),
  description: z.string(),
  shotType: z.string().optional(),
  cameraAngle: z.string().optional(),
  cameraMovement: z.string().optional(),
  duration: z.number().optional(),
});

// ==================== 解析结果 Schema ====================

/** 角色解析结果 Schema */
export const CharacterParseResultSchema = z.object({
  characters: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      personality: z.string().optional(),
      age: z.string().optional(),
      occupation: z.string().optional(),
      importance: z
        .enum(["protagonist", "supporting", "minor"])
        .optional(),
      gender: z.enum(["male", "female", "unknown"]).optional(),
    }),
  ),
});

/** 场景解析结果 Schema */
export const SceneParseResultSchema = z.object({
  scenes: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      setting: z
        .object({
          timeOfDay: z
            .enum([
              "morning",
              "afternoon",
              "evening",
              "night",
              "unknown",
            ])
            .optional(),
          weather: z
            .enum([
              "clear",
              "cloudy",
              "rainy",
              "snowy",
              "foggy",
              "unknown",
            ])
            .optional(),
        })
        .optional(),
    }),
  ),
});

/** 道具解析结果 Schema */
export const PropParseResultSchema = z.object({
  props: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      category: z
        .enum(["props", "costume", "makeup", "equipment"])
        .optional(),
    }),
  ),
});

/** 分镜大纲提取结果 Schema */
export const StoryboardOutlineSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneIndex: z
          .number()
          .int()
          .min(1)
          .describe(
            "场景在原剧本中的顺序索引，从 1 开始",
          ),
        sceneName: z
          .string()
          .min(1)
          .max(100)
          .describe("场景名称，仅地点，不含时间"),
        summary: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "场景内容摘要，包含主要情节、出场角色、关键对话",
          ),
        estimatedShots: z
          .number()
          .int()
          .min(1)
          .max(20)
          .describe("预估该场景可拆分的分镜数量"),
        anchorText: z
          .string()
          .min(10)
          .max(150)
          .describe(
            "该场景在原文中的起始段落（前30-50字），必须与原文完全一致，用于定位场景边界",
          ),
      }),
    )
    .min(1),
});

/** 单批次分镜解析结果 Schema（局部编号版） */
export const StoryboardBatchParseResultSchema = z.object({
  storyboards: z.array(StoryboardItemSchema),
});

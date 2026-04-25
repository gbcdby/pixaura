import { z } from "zod";

/**
 * 视频通用常量
 * 被 video-gen 和 video-edit 模块共享
 */

/**
 * 视频分辨率
 */
export const VideoResolution = {
  P480: "480p",
  P720: "720p",
  P1080: "1080p",
} as const;

export type VideoResolution =
  (typeof VideoResolution)[keyof typeof VideoResolution];

/**
 * 画幅比例
 */
export const AspectRatio = {
  R16_9: "16:9",
  R9_16: "9:16",
  R1_1: "1:1",
} as const;

export type AspectRatio = (typeof AspectRatio)[keyof typeof AspectRatio];

/**
 * Zod Schema - 分辨率
 */
export const VideoResolutionSchema = z.enum([
  VideoResolution.P480,
  VideoResolution.P720,
  VideoResolution.P1080,
]);

/**
 * Zod Schema - 画幅比例
 */
export const AspectRatioSchema = z.enum([
  AspectRatio.R16_9,
  AspectRatio.R9_16,
  AspectRatio.R1_1,
]);

/**
 * 分辨率描述
 */
export const VIDEO_RESOLUTION_DESCRIPTIONS: Record<
  VideoResolution,
  { label: string; width: number; height: number }
> = {
  [VideoResolution.P480]: { label: "480p", width: 854, height: 480 },
  [VideoResolution.P720]: { label: "720p", width: 1280, height: 720 },
  [VideoResolution.P1080]: { label: "1080p", width: 1920, height: 1080 },
};

/**
 * 画幅比例描述
 */
export const ASPECT_RATIO_DESCRIPTIONS: Record<
  AspectRatio,
  { label: string; ratio: number }
> = {
  [AspectRatio.R16_9]: { label: "16:9 宽屏", ratio: 16 / 9 },
  [AspectRatio.R9_16]: { label: "9:16 竖屏", ratio: 9 / 16 },
  [AspectRatio.R1_1]: { label: "1:1 方形", ratio: 1 },
};

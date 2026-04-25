import { z } from "zod";
import { AudioVolumeConfigSchema } from "./script";
import { SubtitleExtendedStyleSchema } from "./subtitle";

/**
 * 导出视频分辨率
 */
export const ExportResolutionSchema = z.enum(["480p", "720p", "1080p"]);
export type ExportResolution = z.infer<typeof ExportResolutionSchema>;

/**
 * 导出视频宽高比
 */
export const ExportAspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
export type ExportAspectRatio = z.infer<typeof ExportAspectRatioSchema>;

/**
 * 导出视频片段
 */
export const ExportVideoClipSchema = z.object({
  id: z.string().describe("片段 ID"),
  sourceUrl: z.string().describe("视频源 URL"),
  timelineStart: z.number().min(0).describe("时间轴起始位置（秒）"),
  timelineEnd: z.number().min(0).describe("时间轴结束位置（秒）"),
  trimIn: z.number().min(0).describe("裁剪起始点（秒）"),
  trimOut: z.number().min(0).describe("裁剪结束点（秒）"),
});

export type ExportVideoClip = z.infer<typeof ExportVideoClipSchema>;

/**
 * 导出视频轨道
 */
export const ExportVideoTrackSchema = z.object({
  id: z.string().describe("轨道 ID"),
  index: z.number().int().min(0).describe("轨道序号"),
  clips: z.array(ExportVideoClipSchema).describe("视频片段列表"),
});

export type ExportVideoTrack = z.infer<typeof ExportVideoTrackSchema>;

/**
 * 导出音频轨道类型
 */
export const ExportAudioTrackTypeSchema = z.enum([
  "video_embedded",
  "voiceover",
  "bgm_overall",
  "bgm_individual",
  "bgm_user",
]);
export type ExportAudioTrackType = z.infer<typeof ExportAudioTrackTypeSchema>;

/**
 * 导出音频片段
 */
export const ExportAudioClipSchema = z.object({
  id: z.string().describe("片段 ID"),
  sourceUrl: z.string().describe("音频源 URL"),
  timelineStart: z.number().min(0).describe("时间轴起始位置（秒）"),
  timelineEnd: z.number().min(0).describe("时间轴结束位置（秒）"),
  volume: z.number().min(0).max(1).describe("音量 0-1"),
});

export type ExportAudioClip = z.infer<typeof ExportAudioClipSchema>;

/**
 * 导出音频轨道
 */
export const ExportAudioTrackSchema = z.object({
  id: z.string().describe("轨道 ID"),
  type: ExportAudioTrackTypeSchema.describe("音频轨道类型"),
  index: z.number().int().min(0).describe("轨道序号"),
  muted: z.boolean().describe("是否静音"),
  clips: z.array(ExportAudioClipSchema).describe("音频片段列表"),
});

export type ExportAudioTrack = z.infer<typeof ExportAudioTrackSchema>;

/**
 * 导出字幕项
 */
export const ExportSubtitleItemSchema = z.object({
  id: z.string().describe("字幕项 ID"),
  startTime: z.number().min(0).describe("起始时间（秒）"),
  endTime: z.number().min(0).describe("结束时间（秒）"),
  text: z.string().describe("字幕文本"),
});

export type ExportSubtitleItem = z.infer<typeof ExportSubtitleItemSchema>;

/**
 * 导出字幕轨道
 */
export const ExportSubtitleTrackSchema = z.object({
  id: z.string().describe("轨道 ID"),
  index: z.number().int().min(0).describe("轨道序号"),
  visible: z.boolean().describe("是否可见"),
  isDefault: z.boolean().describe("是否默认轨道"),
  defaultStyle: SubtitleExtendedStyleSchema.partial().optional().describe("默认样式"),
  items: z.array(ExportSubtitleItemSchema).describe("字幕项列表"),
});

export type ExportSubtitleTrack = z.infer<typeof ExportSubtitleTrackSchema>;

/**
 * 导出时间轴信息
 */
export const ExportTimelineSchema = z.object({
  duration: z.number().min(0).describe("总时长（秒）"),
  resolution: ExportResolutionSchema.describe("分辨率"),
  aspectRatio: ExportAspectRatioSchema.describe("宽高比"),
  frameRate: z.number().int().min(1).default(30).describe("帧率"),
});

export type ExportTimeline = z.infer<typeof ExportTimelineSchema>;

/**
 * 导出输入数据 Schema
 * 用于前端 FFmpeg.wasm 导出的数据格式
 */
export const ExportInputDataSchema = z.object({
  scriptId: z.string().describe("剧本 ID"),
  projectId: z.string().describe("项目 ID"),

  timeline: ExportTimelineSchema.describe("时间轴信息"),

  videoTracks: z.array(ExportVideoTrackSchema).describe("视频轨道列表"),

  audioTracks: z.array(ExportAudioTrackSchema).describe("音频轨道列表"),

  subtitleTracks: z.array(ExportSubtitleTrackSchema).describe("字幕轨道列表"),

  audioVolumeConfig: AudioVolumeConfigSchema.optional().describe("音量配置"),
});

export type ExportInputData = z.infer<typeof ExportInputDataSchema>;
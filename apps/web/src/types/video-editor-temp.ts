/**
 * 临时类型定义文件
 * 用于替代已删除的 video-editor/types，等待视频编辑器重构
 */

// 基础类型
export type Time = number;
export type TrackId = string;

// 片段数据
export interface StoryboardClipData {
  storyboardId: string;
  shotId?: string;
  order: number;
  videoUrl: string;
  duration: number;
  thumbnail?: string;
  timelineStart: number;
  trim: {
    start: number;
    end: number;
  };
}

// 音频轨道
export interface AudioTrack {
  id: TrackId;
  type: "dialogue" | "voiceover" | "bgm";
  name: string;
  audioUrl: string;
  duration: number;
  timelineStart: number;
  trim: {
    start: number;
    end: number;
  };
  volume: number;
  muted: boolean;
  color: string;
}

// 导出配置
export interface ExportConfig {
  format: "mp4" | "webm" | "mov";
  resolution: "480p" | "720p" | "1080p";
  fps: number;
  videoCodec: "h264" | "h265" | "vp9";
  audioCodec: "aac" | "opus";
  bitrate: {
    video: number;
    audio: number;
  };
  range: {
    start: number;
    end: number;
  };
  /** 是否烧录字幕 */
  includeSubtitles?: boolean;
}

// 导出进度
export interface ExportProgress {
  status: "idle" | "preparing" | "processing" | "encoding" | "done" | "completed" | "error";
  progress: number;
  stage: string;
  estimatedTime: number;
}

// 拖拽选项
export interface DragOptions {
  onSeek?: (time: Time) => void;
  onTrim?: (id: string, edge: "start" | "end" | "left" | "right", time: Time) => void;
  onMove?: (id: string, time: Time) => void;
}
/**
 * 视频编辑器类型定义
 */

import type { ShotGroup } from '@pixaura/shared-types';

/**
 * 视频源（分镜视频片段）
 */
export interface VideoSource {
  url: string;
  name: string;
  /**
   * 视频实际时长（秒）
   * 来源：mp4box 解析视频文件得到，存储在 videoDurationCache
   * 注意：这不是 shot.duration（视频生成时的目标时长参数）
   *       shot.duration 只是告诉模型生成多长的视频，实际生成结果可能略有偏差
   */
  duration: number;
  shotGroupId: string;
  shotId?: string;
  isBlackScreen?: boolean; // 是否为黑屏占位
}

/**
 * 轨道类型
 */
export type TrackType = 'video' | 'audio' | 'text';

/**
 * 轨道片段
 */
export interface Clip {
  id?: string; // 片段唯一标识（用于导出等场景）
  name: string;
  start: number; // 秒
  duration: number; // 秒
  audioKey?: string; // 音频片段的预设 key
  audioUrl?: string; // 音频片段的实际 URL（如 TTS 生成的旁白）
  /**
   * 音频实际时长（秒）
   * 用于旁白音频裁切：音频显示时长（duration）与视频片段对齐，
   * 但播放时如果超出音频实际时长（audioActualDuration），则停止播放
   */
  audioActualDuration?: number;
  shotGroupId?: string;
  shotId?: string;
  isBlackScreen?: boolean; // 是否为黑屏占位片段
}

/**
 * 轨道定义
 */
export interface Track {
  name: string;
  icon: string; // fa-film | fa-microphone | fa-font
  iconClass: 'video' | 'audio' | 'text';
  type: TrackType;
  clips: Clip[];
}

/**
 * 轨道状态（音量、静音）
 */
export interface TrackState {
  volume: number; // 0-100
  muted: boolean;
}

/**
 * 时间轴数据
 */
export interface TimelineData {
  totalDuration: number;
  tracks: Track[];
}

/**
 * 音乐风格
 */
export type MusicStyle = 'cherry' | 'serena' | 'ethan';

/**
 * AI 配乐请求参数
 */
export interface AIMusicRequest {
  style: MusicStyle;
  duration: number;
  targetClip?: Clip; // 片段配乐时使用
}

/**
 * 片段信息（右键菜单）
 */
export interface ClipInfo {
  trackIndex: number;
  clipIndex: number;
  clip: Clip;
}

/**
 * Toast 类型
 */
export type ToastType = 'success' | 'error' | 'info';

/**
 * Toast 消息
 */
export interface ToastMessage {
  id: string;
  message: string;
  icon: string;
  type: ToastType;
}

/**
 * 字幕项（与 PreviewArea 保持一致）
 */
export interface SubtitleItem {
  text: string;
  startTime: number;
  endTime: number;
  characterName?: string;
}

/**
 * 视频编辑器 Props
 */
export interface VideoEditorProps {
  projectId: string;
  scriptId: string;
  shotGroups: ShotGroup[];
}

/**
 * 全屏模式
 */
export type FullscreenMode = 'video' | 'workspace' | 'none';

/**
 * 音频预设配置
 */
export interface AudioPreset {
  key: MusicStyle;
  url: string;
  name: string;
}

/**
 * 生成进度状态
 */
export interface GeneratingState {
  visible: boolean;
  text: string;
  progress: number;
}
/**
 * TTS 音色相关类型定义
 * 用于剧本编辑页面分镜对话音色选择
 */

/**
 * 音色性别分类
 */
export type VoiceGender = "female" | "male" | "child" | "dialect";

/**
 * 音色信息
 */
export interface TTSVoice {
  id: string;
  voiceId: string; // DashScope 音色 ID
  name: string; // 音色中文名
  nameEn?: string; // 音色英文名
  gender: VoiceGender;
  category?: "standard" | "dialect";
  style?: string; // 风格标签
  previewAudioUrl?: string; // 试听音频 URL
  isActive: boolean;
  sortOrder: number;
}

/**
 * 音色选择器 Props
 */
export interface VoiceSelectorProps {
  modelValue?: string; // 选中的音色 ID
  gender?: VoiceGender; // 性别筛选
  disabled?: boolean;
}

/**
 * 指令输入组件 Props
 */
export interface InstructionsInputProps {
  modelValue?: string; // 指令内容
  maxLength?: number; // 默认 1600
  placeholder?: string;
  disabled?: boolean;
}

/**
 * 指令模板
 */
export interface TTSInstructionTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  isSystem: boolean;
}

/**
 * 音色卡片 Props
 */
export interface VoiceCardProps {
  voice: TTSVoice;
  selected: boolean;
  disabled?: boolean;
  playing?: boolean;
}

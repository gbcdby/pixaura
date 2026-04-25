import type { Shot, DetectionStatus, CharacterRegions } from "@pixaura/shared-types";
import type { StoryboardRef } from "../../store/types";
import type { ModelOptionWithPrice } from "@/stores/script-models";

// 重新导出 Shot 相关类型
export type { Shot, DetectionStatus, CharacterRegions } from "@pixaura/shared-types";
// 重新导出 StoryboardRef（使用 store 中的类型定义）
export type { StoryboardRef } from "../../store/types";

// 分镜模式类型
export type StoryboardMode = "standard" | "quick" | "locked";

// 对话项类型（与 store 保持一致）
export interface DialogueItem {
  id: string;
  characterId?: string;
  characterName?: string;
  text: string;
  emotion?: string;
  isVoiceover?: boolean;
  type?: "dialogue" | "voiceover"; // 前端展示用
  // 动作描述（可选）
  actions?: string[]; // 对话中的动作描述列表
  // 音频相关字段
  audioUrl?: string;
  audioDuration?: number;
  audioStatus?: "pending" | "processing" | "completed" | "failed";
  audioTaskId?: string;
  // TTS 音色配置
  voiceId?: string; // 选中音色 ID
  // 指令控制（用于 qwen3-tts-instruct-flash）
  instructions?: {
    templateId?: string; // 模板ID（可选）
    content: string; // 指令内容
  };
  // Bug-9: 对话独立的角色框选配置
  characterRegions?: CharacterRegions;
}

// Props 类型
export interface StoryboardCardProps {
  data: StoryboardRef;
  index: number;
  loading?: boolean;
  characterOptions?: { label: string; value: string; avatar?: string }[];
  sceneOptions?: { label: string; value: string }[];
  propOptions?: { label: string; value: string }[];
  // 模型选择相关
  imageModelOptions?: ModelOptionWithPrice[];
  videoModelOptions?: ModelOptionWithPrice[];
  lipSyncModelOptions?: ModelOptionWithPrice[];
  // 步骤级别默认模型（Fix B：继承默认模型）
  defaultImageModelId?: string;
  defaultVideoModelId?: string;
  defaultLipSyncModelId?: string;
  projectId?: string;
  scriptId?: string;
  // 图片生成状态
  imageGenerating?: boolean;
  imageGenerationProgress?: number;
  imageGenerationError?: string;
  // 对话 AI 生成状态
  dialogueGenerating?: boolean;
  // 容器宽高比（根据剧本分辨率设置）
  aspectRatio?: string;
  // 最大参考图数量
  maxReferenceImages?: number;
  // 视频是否正在生成中
  videoGenerating?: boolean;
  // 音频生成状态（正在生成音频的对话ID）
  audioGenerating?: string | null;
  // === shotGroups 新增字段 ===
  // 子分镜列表（shotGroups 结构）
  shots?: Shot[];
  // 主体检测状态
  detectionStatus?: DetectionStatus;
  detectionError?: string;
}

// Emits 类型
export interface StoryboardCardEmits {
  (e: "update", data: StoryboardRef): void;
  (e: "delete", id: string): void;
  (e: "duplicate", id: string): void;
  (e: "move", id: string, direction: "up" | "down"): void;
  (e: "modeChange", id: string, mode: StoryboardMode): void;
  (e: "generateDialogue", id: string): void;
  (e: "generateVideo", id: string): void;
  (e: "generateImage", id: string, modelId: string): void;
  (e: "dialogueUpdate", id: string, dialogues: DialogueItem[]): void;
  // 模型变更事件
  (e: "imageModelChange", id: string, modelId: string): void;
  (e: "videoModelChange", id: string, modelId: string): void;
  (e: "lipSyncModelChange", id: string, modelId: string): void;
  // 图片参考图上传/删除
  (e: "uploadReference", id: string, file: File): void;
  (e: "deleteReference", id: string, imageId: string): void;
  // 视频参考图上传/删除
  (e: "uploadVideoReference", id: string, file: File): void;
  (e: "deleteVideoReference", id: string, imageId: string): void;
  // 主图上传
  (e: "uploadMainImage", id: string, file: File): void;
  // 音频生成
  (e: "generateAudio", storyboardId: string, dialogueId: string, voiceId?: string): void;
  (e: "deleteAudio", storyboardId: string, dialogueId: string): void;
  // shotGroups 新增事件
  (e: "openRegionPanel", shotGroupId: string): void;
  // 视频生成事件（options 包含前端已处理的 URL）
  (e: "generateShotVideo", shotGroupId: string, shotId: string, characterId: string, options?: { croppedImageUrl?: string; audioUrl?: string }): void;
  // 重试视频生成事件
  (e: "retryShotVideo", shotGroupId: string, shotId: string, characterId: string): void;
  (e: "startDetection", shotGroupId: string): void;
  // Bug #5: 更新角色框选配置事件
  (e: "updateRegion", shotGroupId: string, characterId: string, config: import("@pixaura/shared-types").CharacterRegionConfig): void;
}

// 选项类型
export interface ModeOption {
  label: string;
  value: StoryboardMode;
}

export interface ReferenceModeOption {
  label: string;
  value: "multi_reference" | "single_reference";
}

export interface VideoModeOption {
  label: string;
  value: "audio_reference" | "lip_sync" | "video_only";
}

// 更多菜单选项类型
export interface MoreOption {
  label?: string;
  key: string;
  disabled?: boolean;
  icon?: () => ReturnType<typeof import("vue").h>;
  type?: "divider";
}

// TTS 音色类型
export interface TTSVoice {
  id: string;
  voiceId: string;
  name: string;
  nameEn?: string;
  gender: "female" | "male" | "child" | "dialect";
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  isActive: boolean;
}

// TTS 指令模板类型
export interface TTSInstructionTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  content: string;
  isSystem: boolean;
}

/**
 * 模型配置相关常量
 */
import type { FunctionCategory } from "@pixaura/shared-types";
import type { Component } from "vue";
import {
  PencilOutline,
  ImageOutline,
  VideocamOutline,
  MusicalNotesOutline,
  MicOutline,
} from "@vicons/ionicons5";

/**
 * 模型类别配置项
 */
export interface ModelCategoryConfig {
  key: FunctionCategory;
  label: string;
  description: string;
  icon: Component;
}

/**
 * 用户端模型类别配置（5个类别）
 * 用于 DefaultModels.vue 等用户设置页面
 */
export const USER_MODEL_CATEGORIES: ModelCategoryConfig[] = [
  {
    key: "TEXT_GENERATION",
    label: "文本生成",
    description: "剧本、对白等文本内容生成",
    icon: PencilOutline,
  },
  {
    key: "IMAGE_GENERATION",
    label: "图片生成",
    description: "分镜图、封面等图片生成",
    icon: ImageOutline,
  },
  {
    key: "VIDEO_GENERATION",
    label: "视频生成",
    description: "短剧视频内容生成",
    icon: VideocamOutline,
  },
  {
    key: "AUDIO_GENERATION",
    label: "音频生成",
    description: "配音、音效等音频生成",
    icon: MusicalNotesOutline,
  },
  {
    key: "LIP_SYNC",
    label: "对口型",
    description: "角色对口型视频生成",
    icon: MicOutline,
  },
];

/**
 * 项目设置模型类别配置（5个类别）
 * 用于 ProjectSettings.vue 等项目设置页面
 */
export const PROJECT_MODEL_CATEGORIES: ModelCategoryConfig[] = [
  {
    key: "TEXT_GENERATION",
    label: "文本生成",
    description: "剧本、对白等文本内容生成",
    icon: PencilOutline,
  },
  {
    key: "IMAGE_GENERATION",
    label: "图片生成",
    description: "分镜图、封面等图片生成",
    icon: ImageOutline,
  },
  {
    key: "VIDEO_GENERATION",
    label: "视频生成",
    description: "短剧视频内容生成",
    icon: VideocamOutline,
  },
  {
    key: "AUDIO_GENERATION",
    label: "音频生成",
    description: "配音、音效等音频生成",
    icon: MusicalNotesOutline,
  },
  {
    key: "LIP_SYNC",
    label: "对口型",
    description: "角色对口型视频生成",
    icon: MicOutline,
  },
];

/**
 * 默认选项标签
 */
export const DEFAULT_OPTION_LABEL = "使用默认";

/**
 * 系统默认标签
 */
export const SYSTEM_DEFAULT_LABEL = "系统默认";

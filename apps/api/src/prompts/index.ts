/**
 * 系统提示词统一导出
 * 集中管理所有 AI 生成相关的提示词模板
 */

// 剧本相关提示词
export {
  SCRIPT_GENERATE_SYSTEM_PROMPT,
  buildScriptGenerateUserPrompt,
} from "./script-generate";

export {
  SCRIPT_PARSE_SYSTEM_PROMPT,
  buildScriptParseUserPrompt,
  // 分段解析提示词
  CHARACTER_PARSE_SYSTEM_PROMPT,
  buildCharacterParseUserPrompt,
  SCENE_PARSE_SYSTEM_PROMPT,
  buildSceneParseUserPrompt,
  PROP_PARSE_SYSTEM_PROMPT,
  buildPropParseUserPrompt,
  // 分批解析提示词
  STORYBOARD_OUTLINE_SYSTEM_PROMPT,
  buildStoryboardOutlineUserPrompt,
  STORYBOARD_BATCH_PARSE_SYSTEM_PROMPT,
  buildStoryboardBatchParseUserPrompt,
} from "./script-parse";

export {
  SCRIPT_CONTINUE_SYSTEM_PROMPT,
  SCRIPT_REWRITE_SYSTEM_PROMPT,
  SCRIPT_EXPAND_SYSTEM_PROMPT,
  SCRIPT_CONDENSE_SYSTEM_PROMPT,
  buildScriptContinueUserPrompt,
  buildScriptRewriteUserPrompt,
  buildScriptExpandUserPrompt,
  buildScriptCondenseUserPrompt,
} from "./script-edit";

// 图像生成参考图提示词构建工具
export {
  buildQwenImageContent,
  buildQwenImageRequest,
  buildTaggedPrompt,
  type ReferenceImageItem,
  type ReferenceImageType,
} from "./image-reference-prompt";
export {
  buildStoryboardVideoPrompt,
  type AssetImageLike,
  type AssetRefLike,
  type StoryboardDialogueLike,
  type StoryboardReferenceImageLike,
  type StoryboardLike,
  type VideoPromptBuildResult,
} from "./storyboard-video-prompt";

// 分镜相关提示词
export {
  STORYBOARD_GENERATE_SYSTEM_PROMPT,
  STORYBOARD_PREVIEW_SYSTEM_PROMPT,
  buildStoryboardGenerateUserPrompt,
  buildStoryboardPreviewUserPrompt,
} from "./storyboard-generate";

// 分镜对话生成提示词
export {
  DIALOGUE_GENERATE_SYSTEM_PROMPT,
  buildDialogueGeneratePrompt,
} from "./dialogue-generate";

// 资产图片提示词（简化版）
export { buildScriptAssetImagePrompt } from "./asset-generate";

// 共享工具函数
/**
 * 生成唯一 ID
 */
export function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = `${prefix}_`;
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 为 AI 生成的剧本内容分配 ID
 * 注意：已移除 acts 结构，直接处理 characters/scenes/props
 * 注意：返回类型与 ScriptContent 类型不一致，仅用于旧版解析流程（已废弃）
 * @deprecated 新版解析流程请使用 script-parse.worker.ts 中的分段解析
 */
export function assignIdsToScriptContent(content: {
  characters?: Array<{
    name: string;
    description?: string;
    personality?: string;
    age?: string;
    gender?: string;
    importance?: string;
  }>;
  scenes?: Array<{
    name: string;
    description?: string;
  }>;
  props?: Array<{
    name: string;
    description?: string;
    sceneIds?: string[];
  }>;
}): Record<string, unknown> {
  // 处理角色
  const characters = (content.characters || []).map((char) => ({
    id: generateId("char"),
    name: char.name,
    description: char.description || "",
    personality: char.personality,
    age: char.age,
    gender: char.gender,
    importance: (char.importance || "supporting") as
      | "protagonist"
      | "supporting"
      | "minor",
    assetStatus: "none" as const,
  }));

  // 处理场景
  const scenes = (content.scenes || []).map((scene) => ({
    id: generateId("sceneref"),
    name: scene.name,
    description: scene.description,
    assetStatus: "none" as const,
  }));

  // 处理道具
  const props = (content.props || []).map((prop) => ({
    id: generateId("prop"),
    name: prop.name,
    description: prop.description,
    assetStatus: "none" as const,
  }));

  return {
    characters,
    scenes,
    props,
    storyboards: [],
  };
}

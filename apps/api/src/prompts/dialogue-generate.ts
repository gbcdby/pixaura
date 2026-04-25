/**
 * 分镜对话生成提示词
 * 用于为分镜画面中的角色生成对话台词
 */

/** 分镜对话生成系统提示词 */
export const DIALOGUE_GENERATE_SYSTEM_PROMPT =
  "你是一位专业的短剧编剧。请根据以下分镜描述，为画面中的人物生成1-3句简短、自然的对话台词。";

/**
 * 构建分镜对话生成用户提示词
 * @param description 分镜描述
 * @param characterNames 画面中的角色名称列表
 */
export function buildDialogueGeneratePrompt(
  description: string,
  characterNames: string,
): string {
  return `分镜描述：${description}
画面中的角色：${characterNames}

要求：
- 台词要符合场景氛围和角色特点
- 每句台词格式：【角色名】台词内容
- 台词简短精炼，符合短剧风格
- 只输出台词，不要额外说明

请直接输出台词：`;
}

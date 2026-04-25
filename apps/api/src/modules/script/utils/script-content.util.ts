/**
 * 剧本内容处理工具
 * 提供剧本内容统计、计算等功能
 */

/**
 * 用于计算统计的剧本内容结构（包含完整对象信息）
 * 注意：这与 shared-types 中的 ScriptContent 类型不同，
 * shared-types 的 ScriptContent 只存储 ID 引用（字符串数组）
 */
export interface ScriptContentForStats {
  // 使用 shotGroups 替代 storyboards
  shotGroups?: Array<{
    description?: string;
    dialogues?: Array<{
      text?: string;
      characterName?: string;
    }>;
  }>;
  // 向后兼容：保留 storyboards 字段（迁移期间兼容）
  storyboards?: Array<{
    description?: string;
    dialogues?: Array<{
      text?: string;
      characterName?: string;
    }>;
  }>;
  characters?: Array<{
    name?: string;
    description?: string;
  }>;
  scenes?: Array<{
    name?: string;
    description?: string;
  }>;
  props?: Array<{
    name?: string;
    description?: string;
  }>;
}

export interface ScriptStats {
  wordCount: number;
  totalScenes: number;
  totalParagraphs: number;
}

/**
 * 计算剧本字数统计
 * 中文字符 + 英文单词
 * @param content 剧本内容
 * @returns 字数统计结果
 */
export function calculateScriptStats(
  content: ScriptContentForStats,
): ScriptStats {
  let wordCount = 0;
  let totalScenes = 0;
  let totalParagraphs = 0;

  // 优先从 shotGroups 中统计，如果不存在则回退到 storyboards（兼容期）
  const groups = content.shotGroups || content.storyboards || [];
  for (const group of groups) {
    totalScenes++;
    if (group.description) {
      totalParagraphs++;
      wordCount += countWords(group.description);
    }
    for (const dialogue of group.dialogues || []) {
      totalParagraphs++;
      if (dialogue.text) {
        wordCount += countWords(dialogue.text);
      }
    }
  }

  // 从角色描述中统计
  for (const character of content.characters || []) {
    if (character.description) {
      wordCount += countWords(character.description);
    }
  }

  // 从场景描述中统计
  for (const scene of content.scenes || []) {
    if (scene.description) {
      wordCount += countWords(scene.description);
    }
  }

  // 从道具描述中统计
  for (const prop of content.props || []) {
    if (prop.description) {
      wordCount += countWords(prop.description);
    }
  }

  return { wordCount, totalScenes, totalParagraphs };
}

/**
 * 计算文本字数
 * 中文字符 + 英文单词
 */
function countWords(text: string): number {
  let count = 0;
  count += (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  count += (text.match(/[a-zA-Z]+/g) || []).length;
  return count;
}

/**
 * 计算剧本字数（简化版本）
 * @param content 剧本内容
 * @returns 字数
 */
export function calculateScriptWordCount(
  content: ScriptContentForStats,
): number {
  return calculateScriptStats(content).wordCount;
}

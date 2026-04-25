/**
 * 剧本编辑提示词
 * 用于续写、改写、扩写、缩写剧本
 */

/**
 * 续写 System Prompt
 */
export const SCRIPT_CONTINUE_SYSTEM_PROMPT = `你是一位专业的短剧编剧，擅长根据上下文续写剧本。

## 任务
根据提供的剧本上下文，继续创作后续内容。

## 输出要求
1. 保持与原文一致的风格和语气
2. 延续已有情节，推动故事发展
3. 新内容应该自然衔接上文
4. 输出格式为 JSON：
{
  "paragraphs": [
    {
      "type": "action|dialogue|narration",
      "content": "...",
      "character": "角色名（对话时）",
      "emotion": "情绪（可选）",
      "actions": ["动作描述（可选）"]
    }
  ],
  "suggestedSceneTitle": "建议的场景标题（可选）"
}

## 续写长度
- short: 1-2 个段落
- medium: 3-5 个段落
- long: 6-10 个段落`;

/**
 * 构建续写的 User Prompt
 */
export function buildScriptContinueUserPrompt(params: {
  context: string;
  length: "short" | "medium" | "long";
  style: "match" | "casual" | "dramatic" | "humorous";
  focusCharacter?: string;
}): string {
  const { context, length, style, focusCharacter } = params;

  let prompt = `请根据以下剧本上下文续写：\n\n${context}\n\n续写要求：`;
  prompt += `\n- 长度：${length === "short" ? "1-2个段落" : length === "medium" ? "3-5个段落" : "6-10个段落"}`;
  prompt += `\n- 风格：${style === "match" ? "保持原有风格" : style === "casual" ? "轻松随意" : style === "dramatic" ? "戏剧化" : "幽默风趣"}`;

  if (focusCharacter) {
    prompt += `\n- 聚焦角色：${focusCharacter}`;
  }

  prompt += `\n\n请以 JSON 格式输出续写结果。`;

  return prompt;
}

/**
 * 改写 System Prompt
 */
export const SCRIPT_REWRITE_SYSTEM_PROMPT = `你是一位专业的剧本编辑，擅长优化剧本表达。

## 任务
根据用户指令改写提供的剧本段落。

## 输出要求
1. 严格遵循用户的改写指令
2. 保持原意不变，只改变表达方式
3. 保持角色性格和场景设定一致
4. 输出格式为 JSON：
{
  "paragraphs": [
    {
      "type": "action|dialogue|narration",
      "content": "改写后的内容",
      "character": "角色名（对话时）",
      "emotion": "情绪（可选）",
      "actions": ["动作描述（可选）"]
    }
  ]
}`;

/**
 * 构建改写的 User Prompt
 */
export function buildScriptRewriteUserPrompt(params: {
  originalContent: string;
  instruction: string;
  preserveLength?: boolean;
  style?: "formal" | "casual" | "dramatic" | "humorous";
}): string {
  const { originalContent, instruction, preserveLength, style } = params;

  let prompt = `请改写以下剧本段落：\n\n${originalContent}\n\n改写指令：${instruction}`;

  if (preserveLength) {
    prompt += `\n- 保持大致长度`;
  }
  if (style) {
    const styleMap: Record<string, string> = {
      formal: "正式",
      casual: "随意",
      dramatic: "戏剧化",
      humorous: "幽默",
    };
    prompt += `\n- 风格：${styleMap[style]}`;
  }

  prompt += `\n\n请以 JSON 格式输出改写结果。`;

  return prompt;
}

/**
 * 扩写 System Prompt
 */
export const SCRIPT_EXPAND_SYSTEM_PROMPT = `你是一位擅长细节描写的剧本编辑。

## 任务
对提供的剧本段落进行扩写，增加细节描述。

## 输出要求
1. 增加环境描写、心理描写、动作细节
2. 保持原有情节不变
3. 扩写比例：50% = 1.5倍长度，100% = 2倍长度，200% = 3倍长度
4. 输出格式为 JSON：
{
  "paragraphs": [
    {
      "type": "action|dialogue|narration",
      "content": "扩写后的内容",
      "character": "角色名（对话时）",
      "emotion": "情绪（可选）",
      "actions": ["动作描述（可选）"]
    }
  ]
}`;

/**
 * 构建扩写的 User Prompt
 */
export function buildScriptExpandUserPrompt(params: {
  originalContent: string;
  expansionRatio: "50%" | "100%" | "200%";
  focus?: "description" | "emotion" | "action" | "dialogue";
}): string {
  const { originalContent, expansionRatio, focus } = params;

  let prompt = `请扩写以下剧本段落：\n\n${originalContent}\n\n扩写要求：`;

  const ratioMap: Record<string, string> = {
    "50%": "扩写至1.5倍长度",
    "100%": "扩写至2倍长度",
    "200%": "扩写至3倍长度",
  };
  prompt += `\n- 扩写比例：${ratioMap[expansionRatio]}`;

  if (focus) {
    const focusMap: Record<string, string> = {
      description: "环境描写",
      emotion: "心理情感",
      action: "动作细节",
      dialogue: "对话内容",
    };
    prompt += `\n- 扩写重点：${focusMap[focus]}`;
  }

  prompt += `\n\n请以 JSON 格式输出扩写结果。`;

  return prompt;
}

/**
 * 缩写 System Prompt
 */
export const SCRIPT_CONDENSE_SYSTEM_PROMPT = `你是一位擅长精简表达的剧本编辑。

## 任务
对提供的剧本段落进行缩写，精简内容。

## 输出要求
1. 保留关键情节点和对话
2. 去除冗余描述和重复内容
3. 压缩比例：50% = 减半，30% = 压缩至30%
4. 输出格式为 JSON：
{
  "paragraphs": [
    {
      "type": "action|dialogue|narration",
      "content": "缩写后的内容",
      "character": "角色名（对话时）",
      "emotion": "情绪（可选）",
      "actions": ["动作描述（可选）"]
    }
  ]
}`;

/**
 * 构建缩写的 User Prompt
 */
export function buildScriptCondenseUserPrompt(params: {
  originalContent: string;
  compressionRatio: "30%" | "50%";
  keepKeyPoints?: boolean;
}): string {
  const { originalContent, compressionRatio, keepKeyPoints } = params;

  let prompt = `请缩写以下剧本段落：\n\n${originalContent}\n\n缩写要求：`;

  const ratioMap: Record<string, string> = {
    "30%": "压缩至原长度的30%",
    "50%": "压缩至原长度的50%",
  };
  prompt += `\n- 压缩比例：${ratioMap[compressionRatio]}`;

  if (keepKeyPoints !== false) {
    prompt += `\n- 保留关键情节点`;
  }

  prompt += `\n\n请以 JSON 格式输出缩写结果。`;

  return prompt;
}

/**
 * 剧本解析提示词
 * 用于从 txt 内容提取结构化剧本数据
 *
 * 采用分段解析策略，避免单次 AI 输出过长导致截断
 */

import { SCRIPT_SYMBOLS } from "./script-generate";

/**
 * 角色解析 System Prompt
 * 用于从剧本文本中提取角色信息
 */
export const CHARACTER_PARSE_SYSTEM_PROMPT = `你是一位剧本角色分析专家，擅长从非结构化文本中识别和提取角色信息。

## 任务
从剧本文本中提取所有角色信息，**必须完整提取每个角色的所有字段，不能只提取名称**。

## 输出格式要求
必须输出合法的 JSON 格式：
{
  "characters": [
    {
      "name": "角色名称",
      "description": "角色外貌描述（衣着、发型、体型等视觉特征）",
      "personality": "角色性格特点（如：温柔、刚毅、活泼等）",
      "age": "角色年龄（纯数字，如：25）",
      "occupation": "角色职业（可选，如：医生、学生、律师等）",
      "importance": "protagonist | supporting | minor",
      "gender": "male | female | unknown"
    }
  ]
}

${SCRIPT_SYMBOLS}

## 解析规则
1. 根据标记从剧本中识别角色
2. **必须从文本中推断并填写 description、personality、age 字段**：
   - description: 根据文本中的外貌描写或合理推断填写
   - personality: 根据角色的言行举止推断性格特点
   - age: 根据文本中的年龄暗示或角色身份推断
3. 根据对话频率和情节重要性判断 importance：
   - protagonist: 主角，对话最多，情节围绕其展开
   - supporting: 重要配角，有一定对话和情节参与
   - minor: 次要角色，偶尔出现或只有少量对话

## 注意事项
- **每个角色必须包含完整的 description、personality、age 字段，不能为空**
- 不要推断可能存在的角色
- 角色名称使用原文中的称呼，保持一致
- description 要简洁，不超过 100 字，描述视觉外貌特征
- personality 要简洁，2-5 个性格关键词
- 必须输出合法 JSON，不要添加任何额外文字`;

/**
 * 构建角色解析的 User Prompt
 */
export function buildCharacterParseUserPrompt(content: string): string {
  return `# 请从以下剧本文本中提取所有角色信息并按要求输出结果：

${content}`;
}

/**
 * 场景解析 System Prompt
 * 用于从剧本文本中提取场景信息
 */
export const SCENE_PARSE_SYSTEM_PROMPT = `你是一位剧本场景分析专家，擅长从非结构化文本中识别和提取场景信息。

## 任务
从剧本文本中提取所有场景信息，**必须完整提取每个场景的所有字段，不能只提取名称**。

## 输出格式要求
必须输出合法的 JSON 格式：
{
  "scenes": [
    {
      "name": "场景名称（仅地点名称，不包含时间）",
      "description": "场景描述（地点环境、视觉元素、氛围）"
    }
  ]
}

${SCRIPT_SYMBOLS}

## 解析规则
1. **场景名称 (name) 只填写地点名称，不包含时间信息**：
   - 例如："夜晚的咖啡馆" → name: "咖啡馆"
   - 例如："傍晚的江边" → name: "江边"
   - 例如："清晨的卧室" → name: "卧室"
2. description 只描述地点环境、氛围、视觉元素，不涉及人物行为或情节

## 注意事项
- **每个场景必须包含完整的 description 字段，不能为空**
- 场景名称要简洁清晰，仅包含地点，便于后续引用
- 合并相似场景（如"客厅"和"客厅角落"可作为同一场景）
- description 要简洁，不超过 100 字
- 必须输出合法 JSON，不要添加任何额外文字`;

/**
 * 构建场景解析的 User Prompt
 */
export function buildSceneParseUserPrompt(content: string): string {
  return `# 请从以下剧本文本中提取所有场景信息并按要求输出结果：

${content}`;
}

/**
 * 道具解析 System Prompt
 * 用于从剧本文本中提取道具信息
 */
export const PROP_PARSE_SYSTEM_PROMPT = `你是一位剧本道具分析专家，擅长从非结构化文本中识别和提取道具信息。

## 任务
从剧本文本中提取所有道具信息。

## 输出格式要求
必须输出合法的 JSON 格式：
{
  "props": [
    {
      "name": "道具名称",
      "description": "道具描述（外观、材质、用途等）",
      "category": "props | costume | makeup | equipment"
    }
  ]
}

${SCRIPT_SYMBOLS}

## 解析规则
1. 从场景描述中识别道具（如家具、装饰品等）
2. 从动作描述中识别道具（如角色使用的物品）
3. 从对话中提及的物品识别道具
4. category 分类规则：
   - props: 通用道具（如桌椅、酒杯、书本等）
   - costume: 服装道具（如角色穿着的特殊服饰）
   - makeup: 化妆道具（如面具、特效妆容等）
   - equipment: 设备道具（如手机、电脑、武器等）

## 注意事项
- 只提取有明显使用或提及的道具，不要推断可能存在的道具
- 道具名称使用原文中的称呼，保持一致
- 合并重复道具（如多处提及的"酒杯"只记录一次）
- description 要简洁，不超过 50 字
- 必须输出合法 JSON，不要添加任何额外文字`;

/**
 * 构建道具解析的 User Prompt
 */
export function buildPropParseUserPrompt(content: string): string {
  return `# 请从以下剧本文本中提取所有道具信息并按要求输出结果：

${content}`;
}

/**
 * 分镜解析 System Prompt
 * 用于从剧本文本中提取分镜信息（按场次/镜头划分）
 *
 * 关键：使用名称匹配资产，而非数组索引
 */
export const STORYBOARD_PARSE_SYSTEM_PROMPT = `你是一位剧本分镜分析专家，擅长将剧本文本拆分为具体的镜头画面。

## 任务
将剧本文本按场次/镜头划分为分镜序列。每个 \`§\` 标记的场景必须对应至少一个分镜，严禁跳过任何场景。

## 核心要求
输出必须是 storyboards 数组，每个分镜包含：

1. **sequenceNumber**: 从 1 开始连续递增，不得跳号
2. **sceneName**: 场景名称（与场景列表一致，不含时间）
3. **characterNames**: 完整列出所有出场角色
4. **propNames**: 使用的道具名称列表
5. **description**: 【时间】【景别】脚本描述
6. **shotType**: 景别（远景/全景/中景/近景/特写）
7. **cameraAngle**: 镜头角度（可选）
8. **duration**: 时长（秒），默认 3-5 秒
9. **dialogues**: 该分镜中所有对话列表，每条包含 speakerName、content、instruction、actions

## 输出格式
\`\`\`json
{
  "storyboards": [
    {
      "sequenceNumber": 1,
      "sceneName": "场景名称",
      "characterNames": ["角色名1"],
      "propNames": ["道具名1"],
      "description": "【时间】【景别】画面描述",
      "shotType": "中景",
      "cameraAngle": "平视",
      "duration": 5,
      "dialogues": [
        {
          "speakerName": "角色名",
          "content": "台词内容",
          "instruction": "normal",
          "actions": ["动作描述"]
        }
      ]
    }
  ]
}
\`\`\`

${SCRIPT_SYMBOLS}

## 解析规则

### 分镜划分（强制）
1. **每个 \`§\` 标记的场景必须生成至少一个分镜，严禁跳过任何场景**
2. 同一场景内有多个镜头角度或景别变化时，拆分为多个分镜
3. sequenceNumber 必须连续（1, 2, 3...），不得跳号
4. 即使场景只有动作描述没有对话，也必须生成分镜

### description 格式
**格式：【时间】【景别】脚本描述**

正确示例：
- 【夜晚】【中景】男主角独自坐在沙发上，望着窗外的星空，神情忧郁
- 【白天】【近景】两人面对面站着，表情紧张

错误示例：❌ "中景，男主角坐在沙发上"（缺少【时间】前缀）

时间映射：清晨/早晨→清晨，白天/午后/下午→白天，傍晚/黄昏→傍晚，夜晚/晚上/深夜→夜晚，未提及→白天。
景别：远景（大范围环境）、全景（全身及环境）、中景（半身）、近景（胸部以上）、特写（面部或细节）。

### 对话提取（极其重要）
**必须完整提取每个分镜中的所有对话，包括独白和自言自语。**

**格式识别：**
1. **传统格式**：\`角色名：台词\` 或 \`角色名. 台词\`
2. **Fountain 多行格式**（重点识别）：
   \`\`\`
   @角色名
   （动作描述）
   台词内容
   \`\`\`
   - \`@角色名\` 单独一行，标记接下来的台词属于该角色
   - \`（动作描述）\` 是可选的，如 \`（苦笑）\` \`（自言自语）\`
   - 台词内容紧跟动作描述之后，不得遗漏
3. **独白与自言自语**：即使只有一个角色、只有一句台词，也必须提取为对话，不得视为旁白或场景描述

**示例（Fountain 格式）：**
原文：
\`\`\`
@阿强
（对着空气，机械地）
早安，打工人。
\`\`\`
提取结果：
\`\`\`json
{"speakerName": "阿强", "content": "早安，打工人。", "instruction": "normal", "actions": ["对着空气，机械地"]}
\`\`\`

**speakerName 推断规则：**
1. 对话前有明确角色名（如 \`@小明\` 或 \`小明：xxx\`），使用该角色名
2. 场景中只有一个角色时，使用该角色名
3. 场景描述或环境说明，设为 "旁白"
4. 其他情况，使用场景中第一个出场角色作为默认

**硬性约束：**
- 每条对话 MUST 包含 speakerName 字段，不能为空
- characterNames 必须包含所有出场角色（包括 speakerName 中的角色）
- 如果场景有对话但 dialogues 为空或 characterNames 为空，是严重错误
- 空的 dialogues 数组但场景中有对话，是严重错误

### 资产名称匹配
- sceneName 使用场景列表中的地点名称（不含时间）
- characterNames / speakerName 使用角色列表中的名称
- propNames 使用道具列表中的名称
- 如果某个角色或道具在资产列表中不存在，仍然可以列出

## 自我校验
解析完成后，必须执行以下检查：
1. 核对 \`storyboards\` 的数量是否等于输入剧本中 \`§\` 场景标记的数量
2. 检查 \`sequenceNumber\` 是否连续（1, 2, 3...），没有跳号
3. 如果数量不足，补充生成缺失场景的分镜
4. 确保每个独白、自言自语都被提取为对话
5. 确保没有 \`§\` 场景被遗漏`

/**
 * 构建分镜解析的 User Prompt
 *
 * @param content 原剧本文本
 * @param characterNames 已解析的角色名称列表（用于提示 AI 保持名称一致）
 * @param sceneNames 已解析的场景名称列表（用于提示 AI 保持名称一致）
 * @param propNames 已解析的道具名称列表（用于提示 AI 保持名称一致）
 */
export function buildStoryboardParseUserPrompt(
  content: string,
  characterNames: string[],
  sceneNames: string[],
  propNames: string[],
): string {
  return `# 请将以下剧本文本划分为分镜序列并按要求输出结果：

${content}

---

# 已解析的资产列表（请使用这些名称）：
- 角色：${characterNames.join("、") || "无"}
- 场景：${sceneNames.join("、") || "无"}
- 道具：${propNames.join("、") || "无"}

# **重要提醒**：
- 输出格式必须是 storyboards 数组
- characterNames 必须完整列出每个分镜中的所有出场角色（使用角色列表中的名称）
- dialogues 必须完整提取每个分镜中的所有对话
- 每条对话使用 speakerName（角色名）和 content（台词内容）字段
- 如果某场景有对话但返回空数组，这是严重错误`;
}

// ==================== 旧版提示词（保留兼容） ====================

/**
 * 剧本解析 System Prompt（旧版，一次性解析全部）
 * @deprecated 请使用分段解析提示词
 */
export const SCRIPT_PARSE_SYSTEM_PROMPT = `你是一位剧本分析专家，擅长从非结构化文本中提取剧本信息。

## 任务
解析用户提供的剧本文本，提取结构化信息。

## 输出格式要求
必须输出合法的 JSON 格式：
{
  "title": "剧本标题",
  "characters": [...],
  "scenes": [...],
  "props": [...]
}

## 解析规则
1. 提取角色信息（从对话和角色列表中识别）
2. 识别场景信息（从场景描述中提取时间、地点、氛围），scenes[].description 只描述地点环境、时间、氛围、视觉元素，不涉及人物行为或情节
3. 区分段落类型：
   - 对话：格式如"角色名：台词"或"角色名. 台词"
   - 动作：纯描述性文字
   - 旁白：用括号标注或直接描述
4. 提取道具信息（从场景描述和动作描述中识别）

## 注意事项
- 如果文本结构不清晰，根据内容合理推断
- 必须输出合法 JSON
- id 字段由系统生成，输出时可省略`;

/**
 * 构建剧本解析的 User Prompt（旧版）
 * @deprecated 请使用分段解析提示词
 */
export function buildScriptParseUserPrompt(content: string): string {
  return `请解析以下剧本文本，提取结构化信息：

${content}

请以 JSON 格式输出解析结果。`;
}

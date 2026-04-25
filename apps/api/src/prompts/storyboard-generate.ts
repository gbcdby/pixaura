/**
 * 分镜生成提示词
 * 用于从剧本内容生成分镜描述
 */

/**
 * 分镜生成 System Prompt
 */
export const STORYBOARD_GENERATE_SYSTEM_PROMPT = `你是一位专业的分镜师，擅长将剧本内容转化为视觉化的分镜组描述。

## 任务
根据剧本场景内容，生成详细的分镜组（ShotGroup）描述，用于指导后续的图像生成。

## 输出格式要求
严格输出 JSON，不要包含任何额外说明：
{
  "shotGroups": [
    {
      "id": "uuid-字符串（使用标准UUID格式）",
      "sequenceNumber": 1,
      "title": "分镜组标题（可选，如：开场、高潮、结尾等）",
      "description": "分镜组画面描述（具体、可视觉化，包含光线、构图、人物动作）",
      "characterIds": ["角色名1", "角色名2"],
      "sceneId": "场景名称",
      "propIds": ["道具名1"],
      "dialogues": [
        {
          "id": "uuid-字符串",
          "characterId": "角色名",
          "characterName": "角色名",
          "text": "台词内容",
          "emotion": "情绪（如：愤怒、悲伤、平静）",
          "isVoiceover": false,
          "actions": ["动作描述数组"]
        }
      ],
      "shots": [
        {
          "id": "uuid-字符串",
          "dialogueId": "对应对话的uuid",
          "videoMode": "video_only",
          "duration": 3
        }
      ],
      "referenceMode": "multi_reference",
      "imageModelId": "",
      "videoModelId": "",
      "lipSyncModelId": ""
    }
  ]
}

## 字段说明

### ShotGroup 字段
- **id**: 分镜组唯一标识符，必须使用 UUID 格式（如：550e8400-e29b-41d4-a716-446655440000）
- **sequenceNumber**: 分镜组序号，从 1 开始递增
- **title**: 分镜组标题，可选，用于描述该组的主题
- **description**: 画面描述，应具体、可视觉化，包含光线、构图、人物动作
- **characterIds**: 出场角色名称列表
- **sceneId**: 关联的场景名称
- **propIds**: 使用的道具名称列表
- **dialogues**: 该分镜组中的对话列表
- **shots**: 分镜列表，每个对话对应一个 shot
- **referenceMode**: 参考模式，固定为 "multi_reference"
- **imageModelId/videoModelId/lipSyncModelId**: 模型ID，可为空字符串

### Dialogue 字段
- **id**: 对话唯一ID，UUID 格式
- **characterId**: 角色ID（角色名称）
- **characterName**: 角色名称
- **text**: 对话内容
- **emotion**: 情绪描述（如：愤怒、悲伤、平静、开心等）
- **isVoiceover**: 是否旁白，false 表示角色对话
- **actions**: 动作描述数组

### Shot 字段
- **id**: shot 唯一ID，UUID 格式
- **dialogueId**: 关联的对话ID，必须与 dialogues 中的某个 id 对应
- **videoMode**: 视频模式，固定为 "video_only"
- **duration**: 时长（秒），根据对话长度估算，默认 3-5 秒

## 对白分配原则
- 将场景对白合理分配到各分镜组中，不要每个分镜组都重复所有对白
- 无对白的镜头（如动作、环境镜头）dialogues 设为空数组 []，shots 也为空数组 []
- isVoiceover: true 表示旁白，false 表示角色对话
- shots 数组必须与 dialogues 一一对应

## 分镜组设计原则
1. **分组逻辑**：
   - 按场景段落划分分镜组
   - 每个分镜组应包含一个相对完整的视觉单元
   - 有对话的场景，每个对话对应一个 shot

2. **时长控制**：
   - 一般镜头：2-4秒
   - 对话镜头：根据台词长度调整
   - 关键情绪镜头：可适当延长

## 注意事项
- **id 字段必须使用 UUID 格式**
- **shots 数组必须与 dialogues 一一对应**
- 描述要具体、可视觉化
- 考虑实际拍摄可行性
- 保持与剧本内容的一致性`;

/**
 * 构建分镜生成的 User Prompt
 */
export function buildStoryboardGenerateUserPrompt(params: {
  sceneName: string;
  sceneDescription?: string;
  location?: string;
  characters: Array<{
    name: string;
    description?: string;
  }>;
  dialogues?: Array<{
    characterName: string;
    text: string;
  }>;
  shotCount?: number;
}): string {
  const {
    sceneName,
    sceneDescription,
    location,
    characters,
    dialogues,
    shotCount = 3,
  } = params;

  let prompt = `请为以下剧本场景生成 ${shotCount} 个分镜：\n\n`;

  prompt += `场景名称：${sceneName}\n`;

  if (sceneDescription) {
    prompt += `场景描述：${sceneDescription}\n`;
  }

  if (location) {
    prompt += `地点：${location}\n`;
  }

  if (characters.length > 0) {
    prompt += `\n出场角色：\n`;
    characters.forEach((char) => {
      prompt += `- ${char.name}${char.description ? `：${char.description}` : ""}\n`;
    });
  }

  if (dialogues && dialogues.length > 0) {
    prompt += `\n场景对白：\n`;
    dialogues.forEach((dialogue) => {
      prompt += `${dialogue.characterName}："${dialogue.text}"\n`;
    });
  }

  prompt += `\n请生成 ${shotCount} 个分镜，以 JSON 格式输出。`;

  return prompt;
}

/**
 * 分镜预览图生成 System Prompt
 */
export const STORYBOARD_PREVIEW_SYSTEM_PROMPT = `你是一位专业的 AI 绘画提示词工程师，擅长将分镜描述转化为高质量的图像生成提示词。

## 任务
根据分镜描述，生成适合 AI 图像生成的英文提示词。

## 输出格式
{
  "prompt": "主提示词（英文）",
  "negativePrompt": "负面提示词（英文）",
  "style": "cinematic|realistic|anime|oil_painting",
  "aspectRatio": "16:9"
}

## 提示词编写原则
1. 主提示词：
   - 使用英文，逗号分隔
   - 包含：场景、角色、动作、情绪、光线、构图
   - 从宏观到微观描述
   - 使用专业摄影和电影术语

2. 负面提示词：
   - 排除低质量、模糊、变形等问题
   - 排除与场景无关的元素

3. 风格选择：
   - cinematic：电影感，适合大多数场景
   - realistic：写实风格
   - anime：动漫风格
   - oil_painting：油画风格`;

/**
 * 构建分镜预览图生成的 User Prompt
 */
export function buildStoryboardPreviewUserPrompt(params: {
  description: string;
  shotType: string;
  characters?: string[];
  lighting?: string;
  style?: string;
}): string {
  const {
    description,
    shotType,
    characters,
    lighting,
    style = "cinematic",
  } = params;

  let prompt = `请将以下分镜描述转化为 AI 图像生成提示词：\n\n`;

  prompt += `分镜描述：${description}\n`;
  prompt += `景别：${shotType}\n`;

  if (characters && characters.length > 0) {
    prompt += `角色：${characters.join("、")}\n`;
  }

  if (lighting) {
    prompt += `光线：${lighting}\n`;
  }

  prompt += `\n期望风格：${style}\n`;
  prompt += `\n请以 JSON 格式输出英文提示词。`;

  return prompt;
}

/**
 * 千问图像生成提示词构建工具 (qwen-image-2.0 系列)
 *
 * 将参考图和提示词组装成符合千问 multimodal-generation API 格式的 content 数组。
 * 参考图放在 content 数组前面，text 放在最后。
 *
 * content 数组顺序：
 *   1 ~ N     : 参考图（按传入顺序，每张图附带类型标识）
 *   N+1       : text（提示词前面添加各图的类型说明）
 *
 * 示例输出:
 * ```
 * [
 *   { image: "https://..." },  // 图一
 *   { image: "https://..." },  // 图二
 *   { image: "https://..." },  // 图三
 *   { text: "角色(图一)，场景(图二)，道具(图三)：生成一张..." }
 * ]
 * ```
 */

export type ReferenceImageType = "character" | "scene" | "prop" | "reference";

export interface ReferenceImageItem {
  /** 图片 URL */
  url: string;
  /** 图片类型，用于在 text 中标识 */
  type: ReferenceImageType;
  /** 可选的名称（如角色名、场景名），用于更详细的标识 */
  name?: string;
}

/**
 * 将数字转为中文序数（图一、图二 … 图二十）
 */
function toChineseOrdinal(n: number): string {
  const units = [
    "",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
    "十一",
    "十二",
    "十三",
    "十四",
    "十五",
    "十六",
    "十七",
    "十八",
    "十九",
    "二十",
  ];
  if (n >= 1 && n <= units.length - 1) return `图${units[n]}`;
  return `图${n}`;
}

/**
 * 获取类型中文名称
 */
function getTypeLabel(type: ReferenceImageType): string {
  const labels: Record<ReferenceImageType, string> = {
    character: "角色",
    scene: "场景",
    prop: "道具",
    reference: "参考图",
  };
  return labels[type] || "参考图";
}

/**
 * 根据参考图列表构建带类型标识的提示词
 *
 * @param prompt       原始提示词
 * @param references   参考图列表（带类型信息）
 * @returns            带标识的提示词，例如："角色(图一)，场景(图二)：生成一张..."
 */
export function buildTaggedPrompt(
  prompt: string,
  references: ReferenceImageItem[],
): string {
  if (references.length === 0) return prompt;

  const identifiers: string[] = [];
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const ordinal = toChineseOrdinal(i + 1);
    const typeLabel = getTypeLabel(ref.type);
    if (ref.name) {
      identifiers.push(`${typeLabel}(${ordinal}, ${ref.name})`);
    } else {
      identifiers.push(`${typeLabel}(${ordinal})`);
    }
  }

  return `${identifiers.join("，")}：${prompt}`;
}

/**
 * 构建千问图像生成的 content 数组
 *
 * @param prompt       原始提示词
 * @param references   参考图列表（带类型信息）
 * @returns            content 数组（image 在前，text 在后）
 */
export function buildQwenImageContent(
  prompt: string,
  references: ReferenceImageItem[],
): Array<{ image?: string; text?: string }> {
  const content: Array<{ image?: string; text?: string }> = [];

  // 1. 参考图放在前面
  for (const ref of references) {
    content.push({ image: ref.url });
  }

  // 2. 构建带标识的提示词
  content.push({ text: buildTaggedPrompt(prompt, references) });

  console.log("content:", content);
  return content;
}

/**
 * 构建千问图像生成的完整请求体（用于 DashScope multimodal-generation API）
 *
 * @param modelId       模型 ID（如 qwen-image-2.0-pro）
 * @param prompt        原始提示词
 * @param references    参考图列表（带类型信息）
 * @param options       可选参数（width, height, seed, negativePrompt, n）
 * @returns             完整的请求体对象
 */
export function buildQwenImageRequest(
  modelId: string,
  prompt: string,
  references: ReferenceImageItem[],
  options?: {
    width?: number;
    height?: number;
    seed?: number;
    negativePrompt?: string;
    n?: number;
    promptExtend?: boolean;
    watermark?: boolean;
  },
): {
  model: string;
  input: {
    messages: Array<{
      role: string;
      content: Array<{ image?: string; text?: string }>;
    }>;
  };
  parameters: Record<string, unknown>;
} {
  const width = options?.width || 1024;
  const height = options?.height || 1024;

  return {
    model: modelId,
    input: {
      messages: [
        {
          role: "user",
          content: buildQwenImageContent(prompt, references),
        },
      ],
    },
    parameters: {
      n: options?.n ?? 1,
      negative_prompt: options?.negativePrompt || "",
      prompt_extend: options?.promptExtend ?? false,
      watermark: options?.watermark ?? false,
      size: `${width}*${height}`,
      ...(options?.seed !== undefined && { seed: options.seed }),
    },
  };
}

/**
 * JSON 截断修复工具
 * 用于处理 AI 输出被截断导致 JSON 无法解析的问题
 *
 * 核心流程：AI 输出 → detectJsonTruncation → repairTruncatedJson → Zod.safeParse → 成功写入 / 失败降级
 */

import { z } from "zod";

/**
 * 截断检测结果
 */
export interface TruncationDetectionResult {
  /** 是否被截断 */
  isTruncated: boolean;
  /** 截断类型 */
  truncationType:
    | "none"
    | "incomplete_string"
    | "incomplete_array"
    | "incomplete_object"
    | "unknown";
  /** 检测到的缺失括号 */
  missingBrackets: {
    curly: number; // 缺失的 }
    square: number; // 缺失的 ]
    quotes: number; // 缺失的引号
  };
  /** 检测详情（用于日志） */
  details: string;
}

/**
 * 修复结果
 */
export interface RepairResult<T> {
  /** 是否修复成功 */
  success: boolean;
  /** 修复后的数据（可能为部分数据） */
  data: T | null;
  /** Zod 校验结果 */
  validation: z.SafeParseReturnType<unknown, T>;
  /** 是否使用了部分提取 */
  isPartial: boolean;
  /** 错误信息 */
  error?: string;
  /** 修复详情（用于日志） */
  repairDetails: string;
}

/**
 * 检测 JSON 是否被截断
 *
 * @param text 待检测的文本
 * @returns 截断检测结果
 */
export function detectJsonTruncation(text: string): TruncationDetectionResult {
  if (!text || typeof text !== "string") {
    return {
      isTruncated: false,
      truncationType: "none",
      missingBrackets: { curly: 0, square: 0, quotes: 0 },
      details: "输入为空或非字符串",
    };
  }

  // 清理 markdown 代码块标记
  const cleanedText = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .replace(/```/g, "")
    .trim();

  // 尝试直接解析，如果成功则未被截断
  try {
    JSON.parse(cleanedText);
    return {
      isTruncated: false,
      truncationType: "none",
      missingBrackets: { curly: 0, square: 0, quotes: 0 },
      details: "JSON 格式完整，解析成功",
    };
  } catch {
    // 解析失败，继续检测截断
  }

  // 统计括号数量
  const brackets = countBrackets(cleanedText);

  // 判断截断类型
  let truncationType: TruncationDetectionResult["truncationType"] = "unknown";
  let details = "";

  if (brackets.quotes % 2 !== 0) {
    truncationType = "incomplete_string";
    details = `字符串未闭合，引号数量为奇数 (${brackets.quotes})`;
  } else if (brackets.square > 0) {
    truncationType = "incomplete_array";
    details = `数组未闭合，缺少 ${brackets.square} 个 ]`;
  } else if (brackets.curly > 0) {
    truncationType = "incomplete_object";
    details = `对象未闭合，缺少 ${brackets.curly} 个 }`;
  } else if (brackets.square < 0 || brackets.curly < 0) {
    truncationType = "unknown";
    details = "括号数量异常（闭合括号多于开括号），可能格式错误";
  }

  const isTruncated =
    brackets.curly > 0 || brackets.square > 0 || brackets.quotes % 2 !== 0;

  return {
    isTruncated,
    truncationType,
    missingBrackets: {
      curly: Math.max(0, brackets.curly),
      square: Math.max(0, brackets.square),
      quotes: brackets.quotes % 2,
    },
    details: isTruncated ? details : "JSON 格式虽有异常但未检测到明显截断",
  };
}

/**
 * 统计括号数量（开括号 - 闭合括号）
 * 正数表示缺少闭合括号，负数表示闭合括号过多
 */
function countBrackets(text: string): {
  curly: number;
  square: number;
  quotes: number;
} {
  let curly = 0;
  let square = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // 处理转义字符
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    // 处理引号
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // 在字符串内部不统计括号
    if (inString) {
      continue;
    }

    // 统计括号
    if (char === "{") curly++;
    else if (char === "}") curly--;
    else if (char === "[") square++;
    else if (char === "]") square--;
  }

  // 统计引号数量
  let quotes = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') quotes++;
  }

  return { curly, square, quotes };
}

/**
 * 尝试修复截断的 JSON
 *
 * 策略：
 * 1. 补全缺失的闭合括号
 * 2. 处理未闭合的字符串
 * 3. 移除尾部不完整的元素
 *
 * @param text 截断的 JSON 文本
 * @returns 修复后的 JSON 文本，或 null 表示无法修复
 */
export function repairTruncatedJson(text: string): string | null {
  if (!text || typeof text !== "string") {
    return null;
  }

  // 清理 markdown 代码块标记
  let cleanedText = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .replace(/```/g, "")
    .trim();

  // 检测截断情况
  const detection = detectJsonTruncation(cleanedText);

  if (!detection.isTruncated) {
    // 未截断但可能有其他问题，尝试解析
    try {
      JSON.parse(cleanedText);
      return cleanedText;
    } catch {
      return null;
    }
  }

  // 根据截断类型进行修复
  switch (detection.truncationType) {
    case "incomplete_string":
      cleanedText = repairIncompleteString(cleanedText);
      break;
    case "incomplete_array":
      cleanedText = repairIncompleteArray(cleanedText);
      break;
    case "incomplete_object":
      cleanedText = repairIncompleteObject(cleanedText);
      break;
    default:
      // 尝试通用修复
      cleanedText = repairGeneric(cleanedText);
  }

  // 验证修复结果
  try {
    JSON.parse(cleanedText);
    return cleanedText;
  } catch {
    return null;
  }
}

/**
 * 修复未闭合的字符串
 */
function repairIncompleteString(text: string): string {
  // 找到最后一个未闭合的引号位置
  let inString = false;
  let escapeNext = false;
  let lastQuoteIndex = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      if (inString) {
        inString = false;
      } else {
        inString = true;
        lastQuoteIndex = i;
      }
    }
  }

  // 如果有未闭合的字符串，在末尾添加引号
  if (inString) {
    return text + '"';
  }

  return text;
}

/**
 * 修复未闭合的数组
 */
function repairIncompleteArray(text: string): string {
  const brackets = countBrackets(text);

  // 先修复可能的字符串问题
  let repaired = repairIncompleteString(text);

  // 查找最后一个有效的数组元素位置
  // 策略：找到最后一个完整的值，然后闭合数组

  // 计算需要添加的括号
  const missingSquare = Math.max(0, brackets.square);

  // 尝试找到合适的截断点
  // 移除尾部不完整的元素（如 "name": "abc，后面没有引号和逗号）
  repaired = removeTrailingIncompleteElement(repaired);

  // 重新计算括号
  const newBrackets = countBrackets(repaired);

  // 添加缺失的闭合括号
  // 注意：需要先闭合对象，再闭合数组
  const missingCurly = Math.max(0, newBrackets.curly);
  const finalMissingSquare = Math.max(0, newBrackets.square);

  repaired =
    repaired + "}".repeat(missingCurly) + "]".repeat(finalMissingSquare);

  return repaired;
}

/**
 * 修复未闭合的对象
 */
function repairIncompleteObject(text: string): string {
  const brackets = countBrackets(text);

  // 先修复可能的字符串问题
  let repaired = repairIncompleteString(text);

  // 移除尾部不完整的键值对
  repaired = removeTrailingIncompleteElement(repaired);

  // 重新计算括号
  const newBrackets = countBrackets(repaired);

  // 添加缺失的闭合括号
  const missingCurly = Math.max(0, newBrackets.curly);
  const missingSquare = Math.max(0, newBrackets.square);

  repaired = repaired + "]".repeat(missingSquare) + "}".repeat(missingCurly);

  return repaired;
}

/**
 * 通用修复策略
 */
function repairGeneric(text: string): string {
  // 先修复字符串
  let repaired = repairIncompleteString(text);

  // 移除不完整的尾部
  repaired = removeTrailingIncompleteElement(repaired);

  // 计算并添加缺失的括号
  const brackets = countBrackets(repaired);

  // 先闭合数组，再闭合对象（符合 JSON 嵌套顺序）
  repaired = repaired + "]".repeat(Math.max(0, brackets.square));
  repaired = repaired + "}".repeat(Math.max(0, brackets.curly));

  return repaired;
}

/**
 * 移除尾部不完整的元素
 *
 * 例如：
 * - {"name": "abc, "age": 30 → {"name": "abc"} 或 {"name": "abc"
 * - [{"id": 1}, {"id": 2, "nam → [{"id": 1}]
 */
function removeTrailingIncompleteElement(text: string): string {
  // 移除尾部的不完整键值对
  // 策略：找到最后一个逗号或开括号后的位置，截断到那里

  // 匹配尾部可能的不完整模式
  // 1. 键没有值：, "key": 后面没有值
  // 2. 值不完整：, "key": "value 后面没有引号
  // 3. 对象不完整：, { 后面不完整

  // 查找最后一个完整的值结束位置
  const patterns = [
    // 完整的字符串值：, "key": "value"
    /,\s*"[^"]+"\s*:\s*"[^"]*"\s*$/g,
    // 完整的数字值：, "key": 123
    /,\s*"[^"]+"\s*:\s*\d+\.?\d*\s*$/g,
    // 完整的布尔值：, "key": true/false
    /,\s*"[^"]+"\s*:\s*(true|false|null)\s*$/g,
    // 完整的对象值（简单情况）：, "key": {}
    /,\s*"[^"]+"\s*:\s*\{\s*\}\s*$/g,
    // 完整的数组值（简单情况）：, "key": []
    /,\s*"[^"]+"\s*:\s*\[\s*\]\s*$/g,
  ];

  // 尝试移除不完整的尾部
  // 找到最后一个逗号的位置（不在字符串内部）
  let lastCommaIndex = -1;
  let inString = false;
  let escapeNext = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") braceDepth++;
      else if (char === "}") braceDepth--;
      else if (char === "[") bracketDepth++;
      else if (char === "]") bracketDepth--;
      else if (char === "," && braceDepth <= 1 && bracketDepth <= 1) {
        lastCommaIndex = i;
      }
    }
  }

  // 如果找到最后一个逗号，检查后面是否完整
  if (lastCommaIndex > 0) {
    const afterComma = text.slice(lastCommaIndex + 1).trim();

    // 检查逗号后面是否有完整的值
    // 简单判断：如果逗号后面有完整的键值对，保留它
    // 否则截断到逗号位置

    // 尝试截断到逗号位置
    const truncated = text.slice(0, lastCommaIndex);

    // 验证截断后的括号
    const brackets = countBrackets(truncated);

    // 如果截断后括号更接近平衡，则使用截断版本
    const originalBrackets = countBrackets(text);
    const originalImbalance =
      Math.abs(originalBrackets.curly) + Math.abs(originalBrackets.square);
    const truncatedImbalance =
      Math.abs(brackets.curly) + Math.abs(brackets.square);

    if (truncatedImbalance < originalImbalance) {
      return truncated;
    }
  }

  return text;
}

/**
 * 从截断的 JSON 中提取已完整的数组
 *
 * 用于当修复失败时，尽可能提取已完整的数据
 *
 * @param text 截断的 JSON 文本
 * @param key 要提取的数组键名（如 "characters", "scenes", "props"）
 * @returns 提取的数组数据，或 null 表示无法提取
 */
export function extractPartialArray<T>(text: string, key: string): T[] | null {
  if (!text || !key) {
    return null;
  }

  // 清理文本
  const cleanedText = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .replace(/```/g, "")
    .trim();

  // 查找目标数组的开始位置
  // 匹配模式："key": [
  const arrayStartPattern = new RegExp(`"${key}"\\s*:\\s*\\[`, "g");
  const match = arrayStartPattern.exec(cleanedText);

  if (!match) {
    // 未找到目标数组
    return null;
  }

  const startIndex = match.index + match[0].length;

  // 提取数组内容
  // 策略：逐个解析数组元素，直到遇到不完整的元素
  const arrayContent = cleanedText.slice(startIndex);
  const elements: T[] = [];

  // 使用状态机解析数组元素
  let currentElement = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;
  let elementStarted = false;

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];

    if (escapeNext) {
      escapeNext = false;
      currentElement += char;
      continue;
    }

    if (char === "\\" && inString) {
      escapeNext = true;
      currentElement += char;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      currentElement += char;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceDepth++;
        elementStarted = true;
        currentElement += char;
      } else if (char === "}") {
        braceDepth--;
        currentElement += char;

        // 检查是否完成一个元素
        if (braceDepth === 0 && bracketDepth === 0 && elementStarted) {
          // 尝试解析这个元素
          try {
            const parsed = JSON.parse(currentElement.trim()) as T;
            elements.push(parsed);
          } catch {
            // 解析失败，跳过这个不完整的元素
          }
          currentElement = "";
          elementStarted = false;
        }
      } else if (char === "[") {
        bracketDepth++;
        currentElement += char;
      } else if (char === "]") {
        bracketDepth--;
        currentElement += char;

        // 数组结束
        if (bracketDepth < 0) {
          break;
        }
      } else if (char === "," && braceDepth === 0 && bracketDepth === 0) {
        // 元素分隔符，重置
        currentElement = "";
        elementStarted = false;
      } else if (char === "}" || char === "]") {
        // 可能是外层结构，跳过
        break;
      } else {
        currentElement += char;
      }
    } else {
      currentElement += char;
    }

    // 如果遇到数组结束符号，停止解析
    if (braceDepth === 0 && bracketDepth < 0) {
      break;
    }
  }

  // 处理最后一个可能不完整的元素
  if (currentElement.trim() && braceDepth === 0 && bracketDepth === 0) {
    try {
      const parsed = JSON.parse(currentElement.trim()) as T;
      elements.push(parsed);
    } catch {
      // 最后一个元素不完整，忽略
    }
  }

  return elements.length > 0 ? elements : null;
}

/**
 * 使用 Zod Schema 校验并修复 JSON
 *
 * 核心流程：AI 输出 → detectJsonTruncation → repairTruncatedJson → Zod.safeParse → 成功写入 / 失败降级
 *
 * @param text AI 输出的文本
 * @param schema Zod Schema 用于校验
 * @param extractKeys 当修复失败时，尝试提取的部分数组键名
 * @returns 修复和校验结果
 */
export function parseAndValidateJson<T>(
  text: string,
  schema: z.ZodSchema<T>,
  extractKeys: string[] = [],
): RepairResult<T> {
  // 1. 检测截断
  const detection = detectJsonTruncation(text);

  // 2. 尝试直接解析
  let jsonText = text;

  // 清理 markdown 代码块
  jsonText = jsonText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .replace(/```/g, "")
    .trim();

  // 3. 如果检测到截断，尝试修复
  if (detection.isTruncated) {
    const repaired = repairTruncatedJson(jsonText);
    if (repaired) {
      jsonText = repaired;
    }
  }

  // 4. 尝试解析 JSON
  let parsedData: unknown;
  try {
    parsedData = JSON.parse(jsonText);
  } catch (parseError) {
    // 5. JSON 解析失败，尝试提取部分数据
    const partialData: Record<string, unknown> = {};

    for (const key of extractKeys) {
      const partialArray = extractPartialArray<T[]>(text, key);
      if (partialArray) {
        partialData[key] = partialArray;
      }
    }

    if (Object.keys(partialData).length > 0) {
      // 有部分数据可以提取
      const validation = schema.safeParse(partialData);
      return {
        success: validation.success,
        data: validation.success ? validation.data : null,
        validation,
        isPartial: true,
        error: `JSON 解析失败: ${(parseError as Error).message}`,
        repairDetails: `检测到 ${detection.truncationType} 截断，尝试提取部分数据。提取的键: ${Object.keys(partialData).join(", ")}`,
      };
    }

    return {
      success: false,
      data: null,
      validation: { success: false, error: new z.ZodError([]) },
      isPartial: false,
      error: `JSON 解析失败: ${(parseError as Error).message}`,
      repairDetails: `检测到 ${detection.truncationType} 截断，修复失败且无法提取部分数据`,
    };
  }

  // 6. Zod 校验
  const validation = schema.safeParse(parsedData);

  if (validation.success) {
    return {
      success: true,
      data: validation.data,
      validation,
      isPartial: false,
      repairDetails: detection.isTruncated
        ? `检测到 ${detection.truncationType} 截断并成功修复`
        : "JSON 格式完整，无需修复",
    };
  }

  // 7. Zod 校验失败，记录详细错误
  return {
    success: false,
    data: null,
    validation,
    isPartial: false,
    error: "Zod 校验失败",
    repairDetails: `JSON 解析成功但校验失败。错误: ${JSON.stringify(validation.error.errors)}`,
  };
}

/**
 * 安全解析 JSON 并校验（简化版）
 *
 * 用于快速替换现有的 safeJsonParse 调用
 *
 * @param text JSON 文本
 * @param schema Zod Schema
 * @param fallback 回退值
 * @returns 解析结果或回退值
 */
export function safeParseWithSchema<T>(
  text: string,
  schema: z.ZodSchema<T>,
  fallback: T | null = null,
): T | null {
  const result = parseAndValidateJson(text, schema);

  if (result.success) {
    return result.data;
  }

  // 尝试使用部分数据
  if (result.isPartial && result.data) {
    return result.data;
  }

  return fallback;
}

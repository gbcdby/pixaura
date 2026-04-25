/**
 * JSON 处理工具
 * 提供 JSON 清理、解析等常用功能
 */

/**
 * 清理 JSON 文本，移除 markdown 代码块标记
 * @param text 原始文本
 * @returns 清理后的文本
 */
export function cleanJsonText(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gi, "")
    .replace(/```/g, "")
    .trim();
}

/**
 * 安全地解析 JSON，支持多种回退策略
 * @param text JSON 文本
 * @param fallback 解析失败时的回退值
 * @returns 解析结果或回退值
 */
export function safeJsonParse<T>(
  text: string,
  fallback: T | null = null,
): T | null {
  try {
    // 首先尝试直接解析
    return JSON.parse(text) as T;
  } catch {
    // 清理后重试
    try {
      const cleaned = cleanJsonText(text);
      return JSON.parse(cleaned) as T;
    } catch {
      // 尝试提取 JSON 部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(cleanJsonText(jsonMatch[0])) as T;
        } catch {
          // 忽略二次解析错误
        }
      }
      return fallback;
    }
  }
}

/**
 * 验证对象是否为有效的 JSON 结构
 * @param obj 待验证对象
 * @returns 是否为有效结构
 */
export function isValidJsonStructure(
  obj: unknown,
): obj is Record<string, unknown> {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj);
}

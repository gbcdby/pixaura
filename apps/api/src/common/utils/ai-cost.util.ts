/**
 * AI 费用计算工具
 * 提供统一的 token 费用计算方法
 */

/**
 * 计算 AI 调用费用
 * @param tokens token 数量
 * @param ratePer1K 每 1000 token 的价格（默认 0.02 元）
 * @returns 计算后的费用（保留 4 位小数）
 */
export function calculateAICost(
  tokens: number,
  ratePer1K: number = 0.02,
): number {
  return Math.round((tokens / 1000) * ratePer1K * 10000) / 10000;
}

/**
 * 估算 prompt 的 token 数量（粗略估算）
 * 中文字符约 1 token，英文单词约 1.3 tokens
 * @param text 文本内容
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;

  // 中文字符 1:1，英文单词 1:1.3，其他字符 1:0.5
  return Math.ceil(chineseChars + englishWords * 1.3 + otherChars * 0.5);
}

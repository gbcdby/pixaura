/**
 * 字幕文本智能换行
 * 根据容器宽度和字体大小，用 Canvas 测量文本宽度，优先在标点处断开
 */

/**
 * 将长文本按容器宽度换行，返回带 \n 的多行文本
 * @param text 原始文本
 * @param containerWidth 容器可用宽度（px）
 * @param fontSize 字体大小（px）
 * @param fontWeight 字重，默认 500
 * @param fontFamily 字体，默认中文字体回退栈
 */
export function wrapSubtitleText(
  text: string,
  containerWidth: number,
  fontSize: number,
  fontWeight: number = 500,
  fontFamily: string = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
): string {
  if (!text || containerWidth <= 0 || fontSize <= 0) return text;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text;

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // 单行能放下，直接返回
  if (ctx.measureText(text).width <= containerWidth) {
    return text;
  }

  const lines: string[] = [];
  let current = "";

  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > containerWidth && current.length > 0) {
      // 尝试回退到上一个标点处断开
      const match = current.match(/[，、；：。！？，,;:!?][^，、；：。！？，,;:!?]*$/);
      const lastPunct = match ? (match.index ?? -1) + 1 : -1;

      if (lastPunct > 0) {
        lines.push(current.slice(0, lastPunct));
        current = current.slice(lastPunct) + char;
      } else {
        lines.push(current);
        current = char;
      }
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines.join("\n");
}

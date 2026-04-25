/**
 * 时间格式化工具函数
 */

/**
 * 格式化时间为 MM:SS 格式
 * @param seconds 秒数
 * @returns MM:SS 格式的字符串
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 格式化时间为精确格式 MM:SS.S
 * @param seconds 秒数
 * @returns MM:SS.S 格式的字符串
 */
export function formatTimePrecise(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${String(minutes).padStart(2, '0')}:${secs.padStart(4, '0')}`;
}
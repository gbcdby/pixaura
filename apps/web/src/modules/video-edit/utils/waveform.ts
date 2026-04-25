/**
 * 波形绘制工具函数
 */

/**
 * 在 Canvas 上绘制简化波形
 * @param canvas Canvas 元素
 * @param start 起始时间（秒）
 * @param duration 持续时长（秒）
 */
export function drawWaveform(
  canvas: HTMLCanvasElement,
  start: number,
  duration: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 波形参数
  const barWidth = 2;
  const gap = 1;
  const totalBars = Math.floor(width / (barWidth + gap));

  for (let i = 0; i < totalBars; i++) {
    // 模拟波形振幅（基于时间计算伪波形）
    const t = start + (i / totalBars) * duration;
    const base = Math.sin(t * 2.5) * 0.3 + 0.5;
    const noise = Math.sin(t * 17.3 + i * 0.5) * 0.2;
    const amplitude = Math.max(0.05, Math.min(1, base + noise));

    // 计算柱形高度
    const barHeight = amplitude * height * 0.7;
    const x = i * (barWidth + gap);
    const y = (height - barHeight) / 2;

    // 绘制波形柱
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}
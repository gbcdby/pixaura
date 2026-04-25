/**
 * 轨道颜色定义
 */

/**
 * 轨道类型对应的 CSS 变量颜色
 */
export const trackColors = {
  video: {
    bg: 'var(--track-video)',
    bgGradient: 'linear-gradient(135deg, var(--track-video), #245A4A)',
    border: 'var(--track-video-border)',
    icon: 'var(--track-video)',
    text: '#B8EDE0',
  },
  audio: {
    bg: 'var(--track-audio)',
    bgGradient: 'linear-gradient(135deg, var(--track-audio), #4A2D7A)',
    border: 'var(--track-audio-border)',
    icon: 'var(--track-audio)',
    text: '#D4B8F0',
  },
  text: {
    bg: 'var(--track-text)',
    bgGradient: 'linear-gradient(135deg, var(--track-text), #7A5A2D)',
    border: 'var(--track-text-border)',
    icon: 'var(--track-text)',
    text: '#F0DDB8',
  },
};

/**
 * 获取轨道图标
 * @param type 轨道类型
 * @param index 轨道索引（用于区分不同音频轨道）
 * @returns Font Awesome icon 类名
 */
export function getTrackIcon(type: string, index: number = 0): string {
  if (type === 'video') {
    return 'fa-film';
  }
  if (type === 'text') {
    return 'fa-font';
  }
  // 音频轨道根据索引返回不同图标
  if (index === 2) {
    return 'fa-volume-high'; // BGM
  }
  if (index === 3) {
    return 'fa-music'; // 音效
  }
  return 'fa-microphone'; // 旁白
}
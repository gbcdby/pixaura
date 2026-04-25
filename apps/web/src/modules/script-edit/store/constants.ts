import type { ResolutionType, FilmGenreType } from "./types";

// 分辨率选项
export const RESOLUTION_OPTIONS: {
  label: string;
  value: ResolutionType;
  width: number;
  height: number;
}[] = [
  { label: "竖屏 9:16", value: "9:16", width: 1080, height: 1920 },
  { label: "横屏 16:9", value: "16:9", width: 1920, height: 1080 },
];

// 电影类型选项
export const FILM_GENRE_OPTIONS: { label: string; value: FilmGenreType }[] = [
  { label: "剧情", value: "drama" },
  { label: "喜剧", value: "comedy" },
  { label: "悬疑", value: "suspense" },
  { label: "动作", value: "action" },
  { label: "爱情", value: "romance" },
  { label: "科幻", value: "scifi" },
];

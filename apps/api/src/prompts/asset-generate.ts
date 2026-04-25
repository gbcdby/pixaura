/**
 * 资产图片提示词
 * 用于剧本资产（角色/场景/道具）的图像生成
 */

const suffixMap: Record<"character" | "scene" | "prop", string> = {
  character:
    "full body front view, pure white background, facing camera, standing straight, arms at sides, complete figure in frame, centered composition, symmetrical, distant camera, zoomed out, wide shot",
  scene:
    "clean empty environment, geometric order, pristine surfaces, soft ambient lighting, no clutter, neutral tones, minimalist, 8k",
  prop: "clean product shot, pure white background, single object centered, seamless neutral background, soft studio lighting, pristine condition, sharp focus, 8k",
};

/**
 * 构建剧本资产（角色/场景/道具）的图像生成提示词
 * 供 script-asset.service.ts 使用
 *
 * @param name 资产名称
 * @param description 资产描述
 * @param assetKind 资产类型（character/scene/prop）
 * @param customPrompt 自定义提示词追加（可选）
 * @param extras 附加信息（角色性别/年龄，可选）
 */
export function buildScriptAssetImagePrompt(
  name: string,
  description: string,
  assetKind: "character" | "scene" | "prop",
  customPrompt?: string,
  extras?: { gender?: string; age?: string },
): string {
  const parts: string[] = [name, description];

  // 角色专属：将性别和年龄加入提示词
  if (assetKind === "character") {
    if (extras?.gender?.trim()) parts.push(extras.gender.trim());
    if (extras?.age?.trim()) parts.push(`${extras.age.trim()}岁`);
  }

  parts.push(suffixMap[assetKind]);

  let prompt = parts.join(", ");
  if (customPrompt?.trim()) {
    prompt = `${prompt}, ${customPrompt.trim()}`;
  }
  return prompt;
}

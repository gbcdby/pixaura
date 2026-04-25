/**
 * 分镜视频生成提示词构建工具
 *
 * 将分镜结构化数据组装成多模态视频生成提示词。
 * 提示词中的「图N」与 imageUrls 数组中的索引（1-based）一一对应。
 *
 * 图片排列顺序（imageUrls 数组）：
 *   多参考生视频模式 (multi_reference):
 *     1 ~ K     : 角色主图（按 characterIds 顺序）
 *     K+1       : 场景主图（若有）
 *     K+2 ~ K+M : 道具主图（按 propIds 顺序）
 *     K+M+1 ~   : 分镜参考图（referenceImages，按上传顺序）
 *   分镜图生视频模式 (single_reference):
 *     仅包含分镜的主图（mainImageUrl）
 */

export interface AssetImageLike {
  id: string;
  url: string;
  type: string;
}

export interface AssetRefLike {
  id: string;
  name: string;
  images?: AssetImageLike[];
  mainImageId?: string;
}

export interface StoryboardDialogueLike {
  characterName: string;
  text: string;
  emotion?: string;
  isVoiceover?: boolean;
  /** 音频 URL（用于音频参考模式） */
  audioUrl?: string;
  /** 动作描述列表 */
  actions?: string[];
}

export interface StoryboardReferenceImageLike {
  id: string;
  url: string;
}

export interface StoryboardLike {
  description: string;
  characterIds?: string[];
  sceneId?: string;
  propIds?: string[];
  dialogues?: StoryboardDialogueLike[];
  referenceImages?: StoryboardReferenceImageLike[];
  referenceMode?: "single_reference" | "multi_reference";
  /** 分镜主图 URL（分镜图生视频模式下用于视频生成） */
  mainImageUrl?: string;
}

export interface VideoPromptBuildResult {
  /** 组装后的提示词文本 */
  prompt: string;
  /** 按提示词顺序排列的图片 URL 列表（传给模型的 multi_reference imageUrls） */
  imageUrls: string[];
  /** 音频 URL 数组（音频参考模式使用） */
  audioUrls?: string[];
}

/**
 * 从资产的 images 列表中取主图 URL。
 * 优先使用 mainImageId 指向的图片，其次取第一张 type=main 的图片。
 */
function getMainImageUrl(asset: AssetRefLike): string | null {
  const images = asset.images ?? [];
  if (!images.length) return null;

  if (asset.mainImageId) {
    const main = images.find((img) => img.id === asset.mainImageId);
    if (main?.url) return main.url;
  }

  const mainTyped = images.find((img) =>
    ["main", "front_view", "panorama", "wide_shot"].includes(img.type),
  );
  if (mainTyped?.url) return mainTyped.url;

  return images[0]?.url ?? null;
}

/**
 * 将数字转为中文序数（图一、图二 … 图九十九）
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
 * 将数字转为音频中文序数（音频一、音频二 …）
 */
function toAudioOrdinal(n: number): string {
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
  if (n >= 1 && n <= units.length - 1) return `音频${units[n]}`;
  return `音频${n}`;
}

/**
 * 构建分镜视频生成提示词。
 *
 * @param storyboard  当前分镜数据
 * @param allCharacters 剧本全量角色列表
 * @param allScenes 剧本全量场景列表
 * @param allProps 剧本全量道具列表
 * @param options 可选配置
 *   - isAudioRefMode: 是否为音频参考模式（音频驱动视频生成）
 *   - accessibleAudioUrls: 已转换为可访问链接的音频 URL 数组（与角色对话一一对应）
 */
export function buildStoryboardVideoPrompt(
  storyboard: StoryboardLike,
  allCharacters: AssetRefLike[],
  allScenes: AssetRefLike[],
  allProps: AssetRefLike[],
  options?: {
    isAudioRefMode?: boolean;
    accessibleAudioUrls?: string[];
  },
): VideoPromptBuildResult {
  const imageUrls: string[] = [];
  const audioUrls: string[] = [];
  const lines: string[] = [];

  // 判断参考模式（默认多参考生视频）
  const isSingleReference = storyboard.referenceMode === "single_reference";
  const isAudioRefMode = options?.isAudioRefMode ?? false;
  const accessibleAudioUrls = options?.accessibleAudioUrls ?? [];

  // ── 画面描述 ──────────────────────────────────────────────
  lines.push(storyboard.description.trim());
  lines.push("");

  // ── 角色（仅多参考生视频模式显示）──────────────────────────────────
  if (!isSingleReference) {
    const characterIds = storyboard.characterIds ?? [];
    const involvedCharacters = characterIds
      .map((id) => allCharacters.find((c) => c.id === id))
      .filter(Boolean) as AssetRefLike[];

    if (involvedCharacters.length > 0) {
      lines.push("## 角色");
      for (const char of involvedCharacters) {
        const url = getMainImageUrl(char);
        if (url) {
          imageUrls.push(url);
          lines.push(`- ${char.name}：${toChineseOrdinal(imageUrls.length)}`);
        } else {
          // 无图时仅列名，不占图位
          lines.push(`- ${char.name}`);
        }
      }
      lines.push("");
    }
  }

  // ── 场景（仅多参考生视频模式显示）──────────────────────────────────
  if (!isSingleReference) {
    const sceneId = storyboard.sceneId;
    if (sceneId) {
      const scene = allScenes.find((s) => s.id === sceneId);
      if (scene) {
        const url = getMainImageUrl(scene);
        lines.push("## 场景");
        if (url) {
          imageUrls.push(url);
          lines.push(`- ${scene.name}：${toChineseOrdinal(imageUrls.length)}`);
        } else {
          lines.push(`- ${scene.name}`);
        }
        lines.push("");
      }
    }
  }

  // ── 道具（仅多参考生视频模式显示）──────────────────────────────────
  if (!isSingleReference) {
    const propIds = storyboard.propIds ?? [];
    const involvedProps = propIds
      .map((id) => allProps.find((p) => p.id === id))
      .filter(Boolean) as AssetRefLike[];

    if (involvedProps.length > 0) {
      lines.push("## 道具");
      for (const prop of involvedProps) {
        const url = getMainImageUrl(prop);
        if (url) {
          imageUrls.push(url);
          lines.push(`- ${prop.name}：${toChineseOrdinal(imageUrls.length)}`);
        } else {
          lines.push(`- ${prop.name}`);
        }
      }
      lines.push("");
    }
  }

  // ── 参考图（多参考生视频模式：分镜参考图；分镜图生视频模式：分镜主图）───────────────────
  if (isSingleReference) {
    // 分镜图生视频模式：只使用分镜主图
    if (storyboard.mainImageUrl) {
      lines.push("## 参考图");
      imageUrls.push(storyboard.mainImageUrl);
      lines.push(`- 分镜主图：${toChineseOrdinal(imageUrls.length)}`);
      lines.push("");
    }
  } else {
    // 多参考生视频模式：使用分镜的参考图列表
    const referenceImages = storyboard.referenceImages ?? [];
    if (referenceImages.length > 0) {
      lines.push("## 参考图");
      for (const refImg of referenceImages) {
        if (refImg.url) {
          imageUrls.push(refImg.url);
          lines.push(`- 参考图：${toChineseOrdinal(imageUrls.length)}`);
        }
      }
      lines.push("");
    }
  }

  // ── 对话 ──────────────────────────────────────────────────
  const dialogues = storyboard.dialogues ?? [];
  if (dialogues.length > 0) {
    // 音频参考模式：简洁格式，包含所有音频（含旁白），标注序号
    if (isAudioRefMode && accessibleAudioUrls.length > 0) {
      lines.push("## 对口型音频（不要擅自更改音频顺序和内容，音频后的括号内为对话时的情绪/动作，画面不要出现字幕）");
      // 处理所有对话（包括旁白），按原顺序标注序号
      for (let i = 0; i < dialogues.length; i++) {
        const dialogue = dialogues[i];
        const audioUrl = accessibleAudioUrls[i];
        if (audioUrl) {
          audioUrls.push(audioUrl);
          // 构建表演信息（情绪 + 动作）
          let perfInfo = "";
          if (dialogue.emotion || (dialogue.actions && dialogue.actions.length > 0)) {
            const parts: string[] = [];
            if (dialogue.emotion) parts.push(dialogue.emotion);
            if (dialogue.actions && dialogue.actions.length > 0) {
              parts.push(dialogue.actions.join("、"));
            }
            perfInfo = `（${parts.join("，")}）`;
          }
          lines.push(`- ${dialogue.characterName}：${toAudioOrdinal(audioUrls.length)}${perfInfo}`);
        }
      }
      lines.push("");
    } else {
      // 非音频参考模式：不包含任何对话/旁白内容
      // 直接跳过，不写入 prompt
    }
  }

  return {
    prompt: lines.join("\n").trimEnd(),
    imageUrls,
    audioUrls: audioUrls.length > 0 ? audioUrls : undefined,
  };
}

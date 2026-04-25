<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NButton,
  NIcon,
  NSelect,
  NInput,
  NEmpty,
  NImage,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  Add,
  Mic,
  Close,
  VolumeHigh,
  Refresh,
  WarningOutline,
  ArrowUp,
  ArrowDown,
  VideocamOutline,
} from "@vicons/ionicons5";
import type { DialogueItem, TTSVoice } from "./types";
import type {
  Shot,
  CharacterRegions,
  CharacterRegionConfig,
} from "@pixaura/shared-types";
import { useTtsStore } from "@/stores/tts";
import { type TTSInstructionTemplateDto } from "@/api/tts";
import { scriptApi } from "@/modules/script/api";
import { useImageCrop } from "@/composables/useImageCrop";
import AudioPlayer from "./AudioPlayer.vue";
import ShotPreview from "./ShotPreview.vue";
import RegionSelectModal from "./RegionSelectModal.vue";
import DialogueImagePreview from "./DialogueImagePreview.vue";

interface Props {
  dialogues: DialogueItem[];
  isReadonly: boolean;
  loading?: boolean;
  characterOptions?: { label: string; value: string; avatar?: string }[];
  // 音频相关
  audioGenerating?: string | null; // 正在生成音频的对话ID
  scriptId?: string;
  storyboardId?: string;
  // TTS 音色列表
  voices?: TTSVoice[];
  voicesLoading?: boolean;
  // 角色音色映射（用于对话音色继承）
  characterVoiceMap?: Record<string, { voiceId?: string; voiceName?: string }>;
  // 旁白音色
  narrationVoiceId?: string;
  narrationVoiceName?: string;
  // 对口型模式相关
  isLipSyncMode?: boolean;
  // 视频预览宽高比（格式如 "9/16"）
  aspectRatio?: string;
  // 分镜组 ID（用于 ShotCard 事件）
  shotGroupId?: string;
  // 分镜列表（用于视频预览）
  shots?: Shot[];
  // 角色框选配置（用于 mask 预览）
  characterRegions?: CharacterRegions;
  // 检测到的主体（用于自动检测的区域）
  detectedSubjects?: Array<{
    index: number;
    region: { x: number; y: number; width: number; height: number };
    area?: number;
  }>;
  // 视频生成状态映射（shotId -> generating）
  shotGeneratingMap?: Record<string, boolean>;
  // 视频生成进度映射（shotId -> progress）
  shotProgressMap?: Record<string, number>;
  // 分镜图主图 URL（用于角色框选预览）
  storyboardMainImageUrl?: string;
  // 项目 ID（用于上传框选图片）
  projectId?: string;
  // 音频参考模式相关（多参考生视频音频参考模式）
  maxAudioRefs?: number; // 模型最大音频参考数
  characterDialogueCount?: number; // 当前角色对话数量（排除旁白）
  isAudioRefMode?: boolean; // 是否为音频参考模式
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  voices: () => [],
  voicesLoading: false,
  characterVoiceMap: () => ({}),
  narrationVoiceId: undefined,
  narrationVoiceName: undefined,
  isLipSyncMode: false,
  aspectRatio: "9/16",
  shots: () => [],
  characterRegions: () => ({}),
  shotGeneratingMap: () => ({}),
  shotProgressMap: () => ({}),
  storyboardMainImageUrl: "",
  projectId: "",
  maxAudioRefs: 0,
  characterDialogueCount: 0,
  isAudioRefMode: false,
});

const emit = defineEmits<{
  (e: "add-dialogue", type: "dialogue" | "voiceover"): void;
  (e: "update-dialogue", id: string, updates: Partial<DialogueItem>): void;
  (
    e: "update-dialogue-local",
    id: string,
    updates: Partial<DialogueItem>,
  ): void;
  (e: "flush-dialogue-update"): void;
  (e: "remove-dialogue", id: string): void;
  (e: "generate-audio", dialogueId: string, voiceId?: string): void;
  (e: "move-dialogue", dialogueId: string, direction: "up" | "down"): void;
  // ShotCard 视频生成事件
  // croppedImageUrl 和 audioUrl 是前端已处理的临时文件 URL（可选）
  (e: "generate-shot-video", shotGroupId: string, shotId: string, characterId: string, options?: { croppedImageUrl?: string; audioUrl?: string }): void;
  (e: "play-shot-video", shotGroupId: string, shotId: string): void;
  (e: "retry-shot-video", shotGroupId: string, shotId: string, characterId: string): void;
  // 角色框选弹窗
  (e: "open-region-modal", characterId?: string): void;
  // 更新角色框选配置（分镜组级别）
  (e: "update-region", shotGroupId: string, characterId: string, config: CharacterRegionConfig): void;
  // Bug-9: 更新对话独立的角色框选配置
  (e: "update-dialogue-region", dialogueId: string, characterId: string, config: CharacterRegionConfig): void;
}>();

const message = useMessage();
const dialog = useDialog();
const ttsStore = useTtsStore();
const { cropImage, isCropping } = useImageCrop();

// 是否已有旁白（用于限制旁白数量）
const hasExistingVoiceover = computed(() =>
  props.dialogues.some((d) => d.isVoiceover),
);

// 是否已有角色对话（用于对话/旁白按钮互斥）
const hasExistingDialogue = computed(() =>
  props.dialogues.some((d) => !d.isVoiceover),
);

// 是否可以添加旁白（旁白只能有一条）
const canAddVoiceover = computed(() => {
  // 已有角色对话时不能添加旁白
  if (hasExistingDialogue.value) return false;
  // 已有旁白时不能继续添加旁白（旁白只能有一条）
  if (hasExistingVoiceover.value) return false;
  return true;
});

// 旁白添加禁用原因（用于 tooltip 提示）
const voiceoverAddDisabledReason = computed(() => {
  if (hasExistingDialogue.value) {
    return "当前分镜组已有角色对话，无法继续添加旁白";
  }
  if (hasExistingVoiceover.value) {
    return "当前分镜组已有旁白，最多只能添加一条旁白";
  }
  return "";
});

// 是否可以添加角色对话（音频参考模式下需检查数量限制）
const canAddDialogue = computed(() => {
  // 已有旁白时不能添加角色对话
  if (hasExistingVoiceover.value) return false;
  // 非音频参考模式下，无限制
  if (!props.isAudioRefMode || props.maxAudioRefs === 0) return true;
  // 音频参考模式下，检查数量限制
  return props.characterDialogueCount < props.maxAudioRefs;
});

// 对话添加禁用原因（用于 tooltip 提示）
const dialogueAddDisabledReason = computed(() => {
  if (hasExistingVoiceover.value) {
    return "当前分镜组已有旁白，无法继续添加对话";
  }
  if (props.isAudioRefMode && props.maxAudioRefs > 0 && props.characterDialogueCount >= props.maxAudioRefs) {
    return `当前视频模型最多支持 ${props.maxAudioRefs} 条音频参考，已达上限`;
  }
  return "";
});

// 播放互斥控制：存储各对话播放器的引用
const audioPlayerRefs = ref<
  Record<string, InstanceType<typeof AudioPlayer> | null>
>({});

// 当前正在播放的对话 ID
const currentPlayingDialogueId = ref<string | null>(null);

// 处理播放事件：暂停其他播放器
function handleAudioPlay(dialogueId: string) {
  // 如果已有其他播放器正在播放，暂停它
  if (
    currentPlayingDialogueId.value &&
    currentPlayingDialogueId.value !== dialogueId
  ) {
    const prevPlayer = audioPlayerRefs.value[currentPlayingDialogueId.value];
    if (prevPlayer) {
      prevPlayer.pause();
    }
  }
  currentPlayingDialogueId.value = dialogueId;
}

// 处理暂停事件
function handleAudioPause(dialogueId: string) {
  if (currentPlayingDialogueId.value === dialogueId) {
    currentPlayingDialogueId.value = null;
  }
}

// 设置播放器引用
function setAudioPlayerRef(dialogueId: string, el: unknown) {
  // Vue template ref 回调返回类型包含 Element | ComponentPublicInstance | null
  // 需要判断是否为组件实例
  if (el && typeof el === "object" && "pause" in el) {
    audioPlayerRefs.value[dialogueId] = el as InstanceType<typeof AudioPlayer>;
  } else {
    audioPlayerRefs.value[dialogueId] = null;
  }
}

/**
 * 获取对话的角色选项列表
 * 当对话的 characterId 不在主选项中时（如 ID 已过期），
 * 自动追加一个以 characterName 为标签的兜底选项，避免显示原始 UUID。
 * Bug-7: 尝试从 characterOptions 中查找 avatar
 */
function getDialogueCharacterOptions(dialogue: DialogueItem) {
  const opts = props.characterOptions || [];
  if (
    dialogue.characterId &&
    dialogue.characterName &&
    !opts.some((o) => o.value === dialogue.characterId)
  ) {
    // Bug-7: 尝试从其他选项中查找 avatar（可能角色ID格式不同但同角色）
    let avatar: string | undefined = undefined;
    // 尝试通过角色名称匹配查找 avatar
    const matchByName = opts.find(o => o.label === dialogue.characterName);
    if (matchByName?.avatar) {
      avatar = matchByName.avatar;
    }
    return [
      ...opts,
      { label: dialogue.characterName, value: dialogue.characterId, avatar },
    ];
  }
  return opts;
}

// 添加对话
function addDialogue(type: "dialogue" | "voiceover" = "dialogue") {
  emit("add-dialogue", type);
}

// 更新对话本地状态（不触发保存，用于实时回显）
function updateDialogueLocal(id: string, updates: Partial<DialogueItem>) {
  emit("update-dialogue-local", id, updates);
}

// 更新对话并立即上报父组件（用于 select 等离散变更）
function updateDialogue(id: string, updates: Partial<DialogueItem>) {
  emit("update-dialogue", id, updates);
}

// 对话文本失焦时上报父组件（blur 保存）
function flushDialogueUpdate() {
  emit("flush-dialogue-update");
}

// 删除对话（带确认弹窗）
function removeDialogue(id: string) {
  const dialogue = props.dialogues.find((d) => d.id === id);
  const dialogueType = dialogue?.isVoiceover ? "旁白" : "对话";

  dialog.warning({
    title: "确认删除",
    content: `确定要删除这条${dialogueType}吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("remove-dialogue", id);
    },
  });
}

/**
 * 检查对话是否有可用音色
 * - 角色对话：检查 dialogue.voiceId 或 characterVoiceMap[characterId]?.voiceId
 * - 旁白对话：检查 dialogue.voiceId 或 narrationVoiceId
 */
function hasVoice(dialogue: DialogueItem): boolean {
  // 角色对话未选角色时，直接视为无音色
  if (!dialogue.isVoiceover && !dialogue.characterId) {
    return false;
  }

  // 对话自身有音色配置，直接返回有
  if (dialogue.voiceId) return true;

  // 旁白对话：检查旁白默认音色
  if (dialogue.isVoiceover) {
    return !!props.narrationVoiceId;
  }

  // 角色对话：检查角色默认音色
  if (dialogue.characterId) {
    const characterVoice = props.characterVoiceMap[dialogue.characterId];
    return !!characterVoice?.voiceId;
  }

  // 没有角色也没有旁白标记，视为无音色
  return false;
}

/**
 * 获取音色缺失的原因提示
 */
function getVoiceMissingReason(dialogue: DialogueItem): string {
  // 角色对话未选角色
  if (!dialogue.isVoiceover && !dialogue.characterId) {
    return "请先选择角色";
  }
  if (dialogue.isVoiceover) {
    return "旁白未配置音色，请在剧本角色步骤中设置旁白音色";
  }
  if (dialogue.characterId) {
    const characterName = dialogue.characterName || "该角色";
    return `${characterName}未配置音色，请在剧本角色步骤中设置角色音色`;
  }
  return "请先选择角色或标记为旁白";
}

// ========== Bug-8: 角色框蒙层显示相关方法 ==========

// 角色颜色数组（与 MediaBlock.vue 保持一致）
const CHARACTER_COLORS = [
  "#2080f0", // 蓝色
  "#18a058", // 绿色
  "#f0a020", // 橙色
  "#d03050", // 红色
  "#8b5cf6", // 紫色
  "#06b6d4", // 青色
  "#f43f5e", // 粉红
  "#84cc16", // 黄绿
];

// 获取角色颜色
function getCharacterColor(characterId: string): string {
  const options = props.characterOptions || [];
  const index = options.findIndex((o) => o.value === characterId);
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

// 获取角色的框选区域坐标
function getCharacterRegion(characterId: string): { x: number; y: number; width: number; height: number } | undefined {
  const config = props.characterRegions?.[characterId];
  if (!config) return undefined;

  // 手动框选优先
  if (config.useManual && config.manualRegion) {
    return config.manualRegion;
  }

  // 自动检测：根据 detectedIndex 获取对应主体的区域
  if (config.detectedIndex !== undefined && props.detectedSubjects) {
    const subject = props.detectedSubjects.find(s => s.index === config.detectedIndex);
    if (subject?.region) {
      return subject.region;
    }
  }

  return undefined;
}

// Bug-9: 获取对话的角色框选区域（优先使用对话自身的 characterRegions）
function getDialogueCharacterRegion(dialogue: DialogueItem, characterId: string): { x: number; y: number; width: number; height: number } | undefined {
  // 优先使用对话自身的 characterRegions
  const dialogueConfig = dialogue.characterRegions?.[characterId];
  if (dialogueConfig) {
    if (dialogueConfig.useManual && dialogueConfig.manualRegion) {
      return dialogueConfig.manualRegion;
    }
  }

  // fallback 到分镜组级别的 characterRegions
  return getCharacterRegion(characterId);
}

// Bug-9: 检查对话是否使用手动框选（优先使用对话自身的配置）
function isDialogueUsingManual(dialogue: DialogueItem, characterId: string): boolean {
  // 优先检查对话自身的配置
  const dialogueConfig = dialogue.characterRegions?.[characterId];
  if (dialogueConfig) {
    return dialogueConfig.useManual || false;
  }
  // fallback 到分镜组级别
  return isUsingManual(characterId);
}

// 检查是否使用手动框选
function isUsingManual(characterId: string): boolean {
  return props.characterRegions?.[characterId]?.useManual || false;
}

// 生成对话音频
function handleGenerateAudio(dialogueId: string) {
  const dialogue = props.dialogues.find((d) => d.id === dialogueId);
  if (!dialogue) {
    return;
  }

  // 校验音色配置
  if (!hasVoice(dialogue)) {
    message.warning(getVoiceMissingReason(dialogue));
    return;
  }

  // 获取实际使用的 voiceId（优先级：dialogue.voiceId > characterVoiceMap/narrationVoiceId）
  let voiceId: string | undefined = dialogue.voiceId;
  if (!voiceId) {
    if (dialogue.isVoiceover) {
      voiceId = props.narrationVoiceId;
    } else if (dialogue.characterId) {
      const characterVoice = props.characterVoiceMap?.[dialogue.characterId];
      voiceId = characterVoice?.voiceId;
    }
  }

  emit("generate-audio", dialogueId, voiceId);
}

// 检查对话是否正在生成音频
function isAudioGenerating(dialogueId: string): boolean {
  return props.audioGenerating === dialogueId;
}

// 上移对话
function moveDialogueUp(dialogueId: string) {
  emit("move-dialogue", dialogueId, "up");
}

// 下移对话
function moveDialogueDown(dialogueId: string) {
  emit("move-dialogue", dialogueId, "down");
}

// 判断是否可以上移
function canMoveUp(dialogueId: string): boolean {
  const index = props.dialogues.findIndex((d) => d.id === dialogueId);
  return index > 0;
}

// 判断是否可以下移
function canMoveDown(dialogueId: string): boolean {
  const index = props.dialogues.findIndex((d) => d.id === dialogueId);
  return index < props.dialogues.length - 1;
}

// ========== 指令模板选择 ==========

// Category 英文→中文映射
const CATEGORY_MAP: Record<string, string> = {
  emotion: "情感",
  style: "风格",
  speed: "语速",
  scene: "场景",
};

// 组件挂载时加载指令模板
ttsStore.loadInstructionTemplates();

// 计算对话区域的预览区域应该怎么布局
const previewLayout = ref("row");
const previewLayoutWidth = ref("240px");
const previewLayoutHeight = ref("240px");

watch(() => props.aspectRatio, () => {
  const [w, h] = props.aspectRatio.split("/");
  const ratio = parseInt(w) / parseInt(h);

  if (ratio > 1) {
    previewLayout.value = "column";
    previewLayoutWidth.value = "240px";
    previewLayoutHeight.value = `${240 / ratio}px`;
  } else {
    previewLayout.value = "row";
    previewLayoutWidth.value = `${240 * ratio}px`;
    previewLayoutHeight.value = "240px";
  }
}, {
  immediate: true,
});

// 指令模板选项（按分类分组）
const instructionOptions = computed(() => {
  const templates = ttsStore.instructionTemplates.filter(
    (t) => t.isActive !== false,
  );
  // 按分类分组
  const grouped: Record<string, TTSInstructionTemplateDto[]> = {};
  templates.forEach((t) => {
    // 使用中文映射，未知 category 显示原始值或"其他"
    const category =
      (t.category && CATEGORY_MAP[t.category]) || t.category || "其他";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(t);
  });

  // 转换为 NSelect group 格式
  return Object.entries(grouped).map(([category, items]) => ({
    type: "group" as const,
    label: category,
    key: category,
    children: items.map((t) => ({
      label: t.name,
      value: t.id,
      content: t.content,
    })),
  }));
});

// 解析当前指令获取选中的模板 ID
function parseInstructionToTemplateId(
  instructions: { templateId?: string; content: string } | undefined,
): string | undefined {
  return instructions?.templateId;
}

// 将选中的模板转换为指令对象（包含 templateId + content）
function templateToInstruction(
  templateId: string | undefined,
  templates: TTSInstructionTemplateDto[],
): { templateId?: string; content: string } | undefined {
  if (!templateId) return undefined;
  const template = templates.find((t) => t.id === templateId);
  if (!template) return undefined;
  return {
    templateId,
    content: template.content,
  };
}

// 指令选择变更（单选模式）
function handleInstructionChange(
  dialogueId: string,
  templateId: string | undefined,
) {
  const instruction = templateToInstruction(
    templateId,
    ttsStore.instructionTemplates,
  );
  emit("update-dialogue", dialogueId, { instructions: instruction });
}

// 获取音频按钮状态（只负责生成，不负责播放）
function getAudioButtonState(dialogue: DialogueItem): {
  icon: typeof Mic;
  type: "primary" | "success" | "error" | "warning" | "default";
  disabled: boolean;
  tooltip: string;
} {
  // 生成中/处理中状态
  if (isAudioGenerating(dialogue.id) || dialogue.audioStatus === "processing") {
    return {
      icon: Mic,
      type: "primary",
      disabled: true,
      tooltip: "生成中...",
    };
  }

  // 生成失败
  if (dialogue.audioStatus === "failed") {
    return {
      icon: Refresh,
      type: "error",
      disabled: false,
      tooltip: "重新生成音频",
    };
  }

  // 检查是否有音色配置
  if (!hasVoice(dialogue)) {
    return {
      icon: WarningOutline,
      type: "warning",
      disabled: false,
      tooltip: getVoiceMissingReason(dialogue),
    };
  }

  // 已有音频：显示重新生成
  if (dialogue.audioStatus === "completed" && dialogue.audioUrl) {
    return {
      icon: Refresh,
      type: "success",
      disabled: false,
      tooltip: "重新生成音频",
    };
  }

  // 无音频：显示生成
  return {
    icon: Mic,
    type: "default",
    disabled: !dialogue.text || dialogue.text.trim().length === 0,
    tooltip: "生成音频",
  };
}

// ========== 视频预览相关计算属性 ==========

// 获取对话对应的 shot（根据 dialogueId 匹配）
function getShotByDialogueId(dialogueId: string): Shot | undefined {
  if (!props.shots || props.shots.length === 0) return undefined;
  return props.shots.find((shot) => shot.dialogueId === dialogueId);
}

// ========== 简化版框选弹窗状态 ==========

// 弹窗显示状态
const showRegionSelectModal = ref(false);
// 当前选中的角色 ID
const currentRegionCharacterId = ref<string | undefined>(undefined);
// Bug-9: 当前选中的对话 ID（用于更新对话独立的 characterRegions）
const currentRegionDialogueId = ref<string | undefined>(undefined);

// 打开简化版框选弹窗（对话列表内独立使用）
// Bug-2 修复：接受 dialogueId 作为第一个参数，确保正确识别当前对话
function openSimpleRegionModal(dialogueId: string, characterId?: string) {
  currentRegionCharacterId.value = characterId;
  // Bug-2 修复：直接使用传入的 dialogueId，而不是通过 find() 查找
  // 之前的 find() 方法在多个对话有相同角色时会返回第一个匹配的对话，导致保存到错误的对话
  currentRegionDialogueId.value = dialogueId;
  showRegionSelectModal.value = true;
}

// 获取当前角色名称
const currentCharacterName = computed(() => {
  if (!currentRegionCharacterId.value) return "角色";
  const option = props.characterOptions?.find(o => o.value === currentRegionCharacterId.value);
  return option?.label || "角色";
});

// Bug #1 修复：获取当前角色的初始框选区域
// 优先从对话自身的 characterRegions 获取，再 fallback 到分镜组级别
const currentInitialRegion = computed(() => {
  if (!currentRegionCharacterId.value) return undefined;

  // 优先从当前对话的 characterRegions 获取
  if (currentRegionDialogueId.value) {
    const dialogue = props.dialogues.find(d => d.id === currentRegionDialogueId.value);
    if (dialogue?.characterRegions) {
      const dialogueConfig = dialogue.characterRegions[currentRegionCharacterId.value];
      if (dialogueConfig?.manualRegion) {
        return dialogueConfig.manualRegion;
      }
    }
  }

  // fallback 到分镜组级别的 characterRegions
  if (!props.characterRegions) return undefined;
  const config = props.characterRegions[currentRegionCharacterId.value];
  return config?.manualRegion;
});

// 处理框选确认 - 只存储坐标区域
// Bug-9: 更新对话独立的 characterRegions，不影响分镜组参考图
async function handleRegionConfirm(
  region: { x: number; y: number; width: number; height: number },
  _maskDataUrl: string, // 保留参数以兼容 RegionSelectModal，但不再使用
) {
  if (!currentRegionCharacterId.value) {
    message.warning("缺少角色 ID，无法保存框选配置");
    return;
  }

  // Bug-9: 更新对话独立的 characterRegions
  // 直接使用传入的 region 构建配置，不调用后端 API
  const config: CharacterRegionConfig = {
    useManual: true,
    manualRegion: region,
  };

  // 通过新的 emit 事件更新对话独立的 characterRegions
  if (currentRegionDialogueId.value) {
    emit("update-dialogue-region", currentRegionDialogueId.value, currentRegionCharacterId.value, config);
    message.success("框选配置已保存");
  } else {
    // 如果没有 dialogueId，则 fallback 到旧的分镜组级别更新
    if (!props.projectId || !props.scriptId || !props.shotGroupId) {
      message.warning("缺少必要的参数，无法保存框选配置");
      return;
    }
    try {
      const response = await scriptApi.uploadManualRegion(
        props.projectId,
        props.scriptId,
        props.shotGroupId,
        {
          characterId: currentRegionCharacterId.value,
          region,
        },
      );
      // 注意：API 响应拦截器已经解包响应，response 直接是 { shotGroupId, characterId, region }
      const typedResponse = response as unknown as { shotGroupId: string; characterId: string; region: { x: number; y: number; width: number; height: number } };
      const fallbackConfig: CharacterRegionConfig = {
        useManual: true,
        manualRegion: typedResponse.region,
      };
      emit("update-region", props.shotGroupId || "", currentRegionCharacterId.value, fallbackConfig);
      message.success("框选配置已保存");
    } catch (error) {
      message.error("保存框选配置失败");
      console.error("保存框选配置失败:", error);
    }
  }

  showRegionSelectModal.value = false;
}

// ========== 视频按钮相关方法 ==========

/**
 * 生成视频按钮点击处理（添加 characterId 参数）
 * 流程：
 * 1. 裁切框选区域的图片
 * 2. 上传裁切图片到临时目录
 * 3. 复制音频到临时目录
 * 4. 使用公网 URL 调用视频生成 API
 */
async function handleGenerateShotVideo(shotGroupId: string, dialogueId: string, characterId: string) {
  // 检查分镜组ID
  if (!shotGroupId) {
    message.error("分镜组ID缺失，请刷新页面重试");
    return;
  }

  // 检查剧本ID
  if (!props.scriptId) {
    message.error("剧本ID缺失，请刷新页面重试");
    return;
  }

  // 检查项目ID
  if (!props.projectId) {
    message.error("项目ID缺失，请刷新页面重试");
    return;
  }

  // Bug-2 修复：根据 dialogueId 查找对应的 shot
  const shot = getShotByDialogueId(dialogueId);
  if (!shot) {
    message.error("未找到对应的分镜数据，请先保存对话后重试");
    console.error("[handleGenerateShotVideo] 未找到shot:", { shotGroupId, dialogueId, shots: props.shots });
    return;
  }

  // 检查shot是否有ID
  if (!shot.id) {
    message.error("分镜数据异常，请刷新页面重试");
    console.error("[handleGenerateShotVideo] shot缺少ID:", shot);
    return;
  }

  // 获取对话数据
  const dialogue = props.dialogues.find((d) => d.id === dialogueId);
  if (!dialogue) {
    message.error("未找到对话数据");
    return;
  }

  // 获取角色框选区域（优先使用对话自身的配置）
  const region = getDialogueCharacterRegion(dialogue, characterId);
  if (!region) {
    message.error("未找到角色框选区域，请先配置框选");
    return;
  }

  // 检查分镜图是否存在
  if (!props.storyboardMainImageUrl) {
    message.error("分镜图不存在，请先生成分镜图");
    return;
  }

  // 检查音频是否存在
  if (dialogue.audioStatus !== "completed" || !dialogue.audioUrl) {
    message.error("对话音频不存在，请先生成音频");
    return;
  }

  try {
    // 1. 裁切框选区域的图片
    message.loading("正在裁切图片...", { duration: 0 });
    const croppedImageBlob = await cropImage(props.storyboardMainImageUrl, region);

    // 2. 上传裁切图片到临时目录（Blob + FormData，比 base64 节省约 33% 体积）
    message.loading("正在上传裁切图片...", { duration: 0 });
    const croppedImageResponse = await scriptApi.uploadCroppedImage(
      props.projectId,
      props.scriptId,
      shotGroupId,
      characterId,
      croppedImageBlob,
    );

    // 3. 复制音频到临时目录
    message.loading("正在复制音频...", { duration: 0 });
    const audioResponse = await scriptApi.copyDialogueAudioToTemp(
      props.projectId,
      props.scriptId,
      shotGroupId,
      dialogueId,
    );

    // 4. 使用返回的公网 URL 调用视频生成 API
    // 将裁切图片 URL 和音频 URL 传递给父组件
    message.destroyAll();
    emit("generate-shot-video", shotGroupId, shot.id, characterId, {
      croppedImageUrl: (croppedImageResponse as unknown as { key: string; url: string }).url,
      audioUrl: (audioResponse as unknown as { key: string; url: string }).url,
    });

  } catch (error) {
    message.destroyAll();
    console.error("[handleGenerateShotVideo] 视频生成失败:", error);
    message.error(`视频生成失败: ${(error as Error).message}`);
  }
}

// ========== 视频按钮辅助方法 ==========

/**
 * 检查视频生成按钮是否应该禁用
 * 条件：分镜图和音频必须齐全，角色必须有框选配置
 */
function isVideoButtonDisabled(dialogueId: string): {
  disabled: boolean;
  tooltip: string;
} {
  // 检查是否正在裁切
  if (isCropping.value) {
    return {
      disabled: true,
      tooltip: "正在处理图片...",
    };
  }

  // 检查分镜图是否存在
  if (!props.storyboardMainImageUrl) {
    return {
      disabled: true,
      tooltip: "请先生成或上传分镜图",
    };
  }

  // 检查对话音频是否存在
  const dialogue = props.dialogues.find((d) => d.id === dialogueId);
  if (!dialogue || dialogue.audioStatus !== "completed" || !dialogue.audioUrl) {
    return {
      disabled: true,
      tooltip: "请先生成对话音频",
    };
  }

  // Bug-10 修复：检查角色是否有框选配置（优先检查对话级别）
  // 旁白对话（无角色）无法生成对口型视频
  if (!dialogue.characterId) {
    return {
      disabled: true,
      tooltip: "旁白对话无法生成对口型视频",
    };
  }

  // Bug-10 修复：优先检查对话级别的 characterRegions
  let regionConfig = dialogue.characterRegions?.[dialogue.characterId];

  // 如果对话级别没有，再检查分镜组级别
  if (!regionConfig) {
    regionConfig = props.characterRegions?.[dialogue.characterId];
  }

  if (!regionConfig) {
    return {
      disabled: true,
      tooltip: "该角色未配置框选区域，请点击左侧图片上的框选按钮配置",
    };
  }

  // 检查是否有有效的框选坐标（自动检测或手动框选）
  const hasValidRegion = !!(
    regionConfig.detectedIndex ||
    (regionConfig.manualRegion && regionConfig.useManual)
  );
  if (!hasValidRegion) {
    return {
      disabled: true,
      tooltip: "该角色未配置框选区域，请点击左侧图片上的框选按钮配置",
    };
  }

  // 检查是否正在生成视频
  if (isShotGenerating(dialogueId)) {
    return {
      disabled: true,
      tooltip: "视频生成中...",
    };
  }

  return {
    disabled: false,
    tooltip: "生成视频",
  };
}

// 检查对话对应的 shot 是否正在生成视频
function isShotGenerating(dialogueId: string): boolean {
  const shot = getShotByDialogueId(dialogueId);
  if (!shot) return false;
  // 优先使用 shotGeneratingMap（用于 API 调用期间的临时状态）
  if (props.shotGeneratingMap[shot.id]) return true;
  // 然后检查 shot.status
  return shot.status === "processing";
}

// 获取视频按钮文本
function getShotVideoButtonText(dialogueId: string): string {
  // 正在裁切/处理
  if (isCropping.value) {
    return "处理中...";
  }
  const shot = getShotByDialogueId(dialogueId);
  // 正在生成
  if (isShotGenerating(dialogueId)) {
    // Shot 类型已简化，progress 从 shotProgressMap 读取
    const progress = shot ? (props.shotProgressMap[shot.id] || 0) : 0;
    return `生成中 ${progress}%`;
  }
  // 已有视频：重新生成
  if (shot && shot.videoUrl) {
    return "重新生成";
  }
  // 无视频：生成视频
  return "生成视频";
}
</script>

<template>
  <div
    class="dialogue-section"
    :class="{ 'lipsync-mode': isLipSyncMode }"
  >
    <div class="section-header">
      <label class="section-label"> 对话 </label>
    </div>

    <!-- 对口型模式：每条对话左侧视频 + 右侧对话内容 -->
    <template v-if="isLipSyncMode">
      <div class="dialogue-list lipsync-dialogue-list">
        <div
          v-for="dialogue in dialogues"
          :key="dialogue.id"
          class="dialogue-item lipsync-dialogue-item"
        >
          <!-- 左侧预览区域 -->
          <div class="preview-modules">
            <!-- 角色框选预览（使用 Canvas 合成蒙层） -->
            <div class="region-preview-wrapper">
              <!-- 任务 5: 使用 Canvas 合成的图片预览 -->
              <DialogueImagePreview
                v-if="storyboardMainImageUrl && dialogue.characterId && getDialogueCharacterRegion(dialogue, dialogue.characterId)"
                :image-url="storyboardMainImageUrl"
                :region="getDialogueCharacterRegion(dialogue, dialogue.characterId)!"
                :is-manual="isDialogueUsingManual(dialogue, dialogue.characterId)"
                :color="getCharacterColor(dialogue.characterId)"
                :aspect-ratio="aspectRatio"
                :is-readonly="isReadonly"
                :show-select-btn="isLipSyncMode"
                @select-region="openSimpleRegionModal(dialogue.id, dialogue.characterId)"
              />
              <!-- 无框选时显示原图 -->
              <n-image
                v-else-if="storyboardMainImageUrl"
                :src="storyboardMainImageUrl"
                class="preview-image"
                object-fit="cover"
                height="100%"
                width="100%"
              />
              <!-- 无分镜图时显示占位 -->
              <div
                v-if="!storyboardMainImageUrl"
                class="region-placeholder"
                :style="{ aspectRatio: aspectRatio }"
              >
                <span style="font-size: 12px; color: #888">图片待生成</span>
              </div>
            </div>
            <!-- 视频预览（纯预览，无按钮） -->
            <div class="shot-preview-wrapper">
              <ShotPreview
                :shot="getShotByDialogueId(dialogue.id)"
                :aspect-ratio="aspectRatio"
                :is-generating="shotGeneratingMap[getShotByDialogueId(dialogue.id)?.id || '']"
                :generation-progress="shotProgressMap[getShotByDialogueId(dialogue.id)?.id || ''] || 0"
              />
            </div>
          </div>

          <!-- 右侧：对话编辑区域 -->
          <div class="dialogue-edit-area">
            <!-- 第一行：左侧音频播放器+生成按钮 + 右侧操作按钮 -->
            <div class="dialogue-audio-row">
              <!-- 左侧：音频播放器区域 + 生成按钮 -->
              <div class="audio-area-left">
                <!-- 音频播放器容器 -->
                <div class="audio-player-wrapper">
                  <!-- 音频已完成：显示播放器 -->
                  <template
                    v-if="dialogue.audioStatus === 'completed' && dialogue.audioUrl"
                  >
                    <AudioPlayer
                      :ref="(el) => setAudioPlayerRef(dialogue.id, el)"
                      :src="dialogue.audioUrl"
                      @play="handleAudioPlay(dialogue.id)"
                      @pause="handleAudioPause(dialogue.id)"
                    />
                  </template>

                  <!-- 生成中状态：显示 Loading 提示（无转圈动画） -->
                  <template
                    v-else-if="
                      isAudioGenerating(dialogue.id) ||
                        dialogue.audioStatus === 'processing'
                    "
                  >
                    <div class="audio-loading">
                      <n-icon size="14" color="#2080f0">
                        <VideocamOutline />
                      </n-icon>
                      <span class="audio-status-text">音频生成中...</span>
                    </div>
                  </template>

                  <!-- 生成失败：显示错误提示 -->
                  <template v-else-if="dialogue.audioStatus === 'failed'">
                    <div class="audio-error">
                      <n-icon size="14" color="#d03050">
                        <WarningOutline />
                      </n-icon>
                      <span>生成失败</span>
                    </div>
                  </template>

                  <!-- 无音频：显示占位 -->
                  <template v-else>
                    <div class="audio-placeholder">
                      <n-icon size="14">
                        <VolumeHigh />
                      </n-icon>
                      <span>暂无音频</span>
                    </div>
                  </template>
                </div>

                <!-- 生成/重新生成按钮 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      text
                      size="tiny"
                      :type="getAudioButtonState(dialogue).type"
                      :disabled="
                        getAudioButtonState(dialogue).disabled ||
                          isReadonly ||
                          loading
                      "
                      class="audio-btn"
                      @click="handleGenerateAudio(dialogue.id)"
                    >
                      <n-icon size="16">
                        <component :is="getAudioButtonState(dialogue).icon" />
                      </n-icon>
                    </n-button>
                  </template>
                  {{ getAudioButtonState(dialogue).tooltip }}
                </n-tooltip>
              </div>

              <!-- 分隔符：区分音频功能和对话操作 -->
              <div class="audio-divider" />

              <!-- 右侧：排序和删除按钮 -->
              <div class="action-buttons">
                <!-- 上移按钮 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      text
                      size="tiny"
                      :disabled="isReadonly || loading || !canMoveUp(dialogue.id)"
                      class="move-btn"
                      @click="moveDialogueUp(dialogue.id)"
                    >
                      <n-icon size="16">
                        <ArrowUp />
                      </n-icon>
                    </n-button>
                  </template>
                  上移
                </n-tooltip>

                <!-- 下移按钮 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      text
                      size="tiny"
                      :disabled="isReadonly || loading || !canMoveDown(dialogue.id)"
                      class="move-btn"
                      @click="moveDialogueDown(dialogue.id)"
                    >
                      <n-icon size="16">
                        <ArrowDown />
                      </n-icon>
                    </n-button>
                  </template>
                  下移
                </n-tooltip>

                <!-- 删除按钮 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      text
                      size="tiny"
                      type="error"
                      :disabled="isReadonly || loading"
                      class="delete-btn"
                      @click="removeDialogue(dialogue.id)"
                    >
                      <n-icon size="16">
                        <Close />
                      </n-icon>
                    </n-button>
                  </template>
                  删除对话
                </n-tooltip>
              </div>
            </div>

            <!-- 第二行：角色 + 指令 + 对话文本 -->
            <div class="dialogue-content-row">
              <n-select
                :value="dialogue.characterId"
                :options="getDialogueCharacterOptions(dialogue)"
                :placeholder="dialogue.isVoiceover ? '旁白' : '角色'"
                aria-label="角色"
                size="small"
                class="character-select"
                :consistent-menu-width="false"
                :disabled="isReadonly || loading"
                @update:value="
                  (val) => {
                    const char = characterOptions?.find((o) => o.value === val);
                    updateDialogue(dialogue.id, {
                      characterId: val,
                      characterName: char?.label || '',
                      isVoiceover: dialogue.isVoiceover,
                    });
                  }
                "
              />

              <!-- 指令模板选择 -->
              <n-select
                :value="parseInstructionToTemplateId(dialogue.instructions)"
                :options="instructionOptions"
                placeholder="指令"
                aria-label="指令模板"
                size="small"
                class="instruction-select"
                clearable
                :consistent-menu-width="false"
                :disabled="isReadonly || loading"
                :loading="ttsStore.instructionTemplatesLoading"
                @update:value="
                  (id: string | undefined) =>
                    handleInstructionChange(dialogue.id, id)
                "
              />

              <n-input
                v-model:value="dialogue.text"
                placeholder="输入对话..."
                aria-label="对话内容"
                size="small"
                :disabled="isReadonly || loading"
                class="dialogue-input"
                @update:value="
                  (val) => updateDialogueLocal(dialogue.id, { text: val })
                "
                @blur="flushDialogueUpdate"
              />
            </div>

            <!-- 第三行：动作输入 -->
            <div class="dialogue-actions-row">
              <n-input
                :value="(dialogue.actions || []).join(',')"
                placeholder="动作/表情"
                aria-label="动作"
                size="small"
                :maxlength="200"
                :disabled="isReadonly || loading"
                class="actions-input"
                @update:value="
                  (val: string) => {
                    const actions = val
                      .split(',')
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    updateDialogue(dialogue.id, { actions });
                  }
                "
              />
            </div>

            <!-- 第四行：右下角视频生成按钮（仅对口型模式显示） -->
            <div
              v-if="!isReadonly && isLipSyncMode"
              class="video-btn-row"
            >
              <n-tooltip>
                <template #trigger>
                  <n-button
                    type="primary"
                    size="small"
                    :disabled="loading || isVideoButtonDisabled(dialogue.id).disabled"
                    @click="handleGenerateShotVideo(shotGroupId || '', dialogue.id, dialogue.characterId || '')"
                  >
                    <template #icon>
                      <n-icon><VideocamOutline /></n-icon>
                    </template>
                    {{ getShotVideoButtonText(dialogue.id) }}
                  </n-button>
                </template>
                {{ isVideoButtonDisabled(dialogue.id).tooltip }}
              </n-tooltip>
            </div>
          </div>
        </div>

        <n-empty
          v-if="dialogues.length === 0"
          description="暂无对话"
          size="small"
        />
      </div>

      <div
        v-if="!isReadonly"
        class="dialogue-actions"
      >
        <span :style="{ cursor: canAddDialogue ? 'pointer' : 'not-allowed' }">
          <n-tooltip
            v-if="!canAddDialogue"
            trigger="hover"
            placement="top"
          >
            <template #trigger>
              <n-button
                size="small"
                disabled
                @click="addDialogue('dialogue')"
              >
                <template #icon>
                  <n-icon><Add /></n-icon>
                </template>
                对话
              </n-button>
            </template>
            {{ dialogueAddDisabledReason }}
          </n-tooltip>
          <n-button
            v-else
            size="small"
            :disabled="loading"
            @click="addDialogue('dialogue')"
          >
            <template #icon>
              <n-icon><Add /></n-icon>
            </template>
            对话
          </n-button>
        </span>
        <span :style="{ cursor: canAddVoiceover ? 'pointer' : 'not-allowed' }">
          <n-tooltip
            v-if="!canAddVoiceover"
            trigger="hover"
            placement="top"
          >
            <template #trigger>
              <n-button
                size="small"
                disabled
                @click="addDialogue('voiceover')"
              >
                <template #icon>
                  <n-icon><Mic /></n-icon>
                </template>
                旁白
              </n-button>
            </template>
            {{ voiceoverAddDisabledReason }}
          </n-tooltip>
          <n-button
            v-else
            size="small"
            :disabled="loading"
            @click="addDialogue('voiceover')"
          >
            <template #icon>
              <n-icon><Mic /></n-icon>
            </template>
            旁白
          </n-button>
        </span>
      </div>
    </template>

    <!-- 非对口型模式：普通对话列表 -->
    <template v-else>
      <div class="dialogue-list">
        <div
          v-for="dialogue in dialogues"
          :key="dialogue.id"
          class="dialogue-item"
        >
          <!-- 第一行：左侧音频播放器+生成按钮 + 右侧操作按钮 -->
          <div class="dialogue-audio-row">
            <!-- 左侧：音频播放器区域 + 生成按钮 -->
            <div class="audio-area-left">
              <!-- 音频播放器容器 -->
              <div class="audio-player-wrapper">
                <!-- 音频已完成：显示播放器 -->
                <template
                  v-if="dialogue.audioStatus === 'completed' && dialogue.audioUrl"
                >
                  <AudioPlayer
                    :ref="(el) => setAudioPlayerRef(dialogue.id, el)"
                    :src="dialogue.audioUrl"
                    @play="handleAudioPlay(dialogue.id)"
                    @pause="handleAudioPause(dialogue.id)"
                  />
                </template>

                <!-- 生成中状态：显示 Loading 提示（无转圈动画） -->
                <template
                  v-else-if="
                    isAudioGenerating(dialogue.id) ||
                      dialogue.audioStatus === 'processing'
                  "
                >
                  <div class="audio-loading">
                    <n-icon size="14" color="#2080f0">
                      <VideocamOutline />
                    </n-icon>
                    <span class="audio-status-text">音频生成中...</span>
                  </div>
                </template>

                <!-- 生成失败：显示错误提示 -->
                <template v-else-if="dialogue.audioStatus === 'failed'">
                  <div class="audio-error">
                    <n-icon size="14" color="#d03050">
                      <WarningOutline />
                    </n-icon>
                    <span>生成失败</span>
                  </div>
                </template>

                <!-- 无音频：显示占位 -->
                <template v-else>
                  <div class="audio-placeholder">
                    <n-icon size="14">
                      <VolumeHigh />
                    </n-icon>
                    <span>暂无音频</span>
                  </div>
                </template>
              </div>

              <!-- 生成/重新生成按钮 -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="tiny"
                    :type="getAudioButtonState(dialogue).type"
                    :disabled="
                      getAudioButtonState(dialogue).disabled ||
                        isReadonly ||
                        loading
                    "
                    class="audio-btn"
                    @click="handleGenerateAudio(dialogue.id)"
                  >
                    <n-icon size="16">
                      <component :is="getAudioButtonState(dialogue).icon" />
                    </n-icon>
                  </n-button>
                </template>
                {{ getAudioButtonState(dialogue).tooltip }}
              </n-tooltip>
            </div>

            <!-- 分隔符：区分音频功能和对话操作 -->
            <div class="audio-divider" />

            <!-- 右侧：排序和删除按钮 -->
            <div class="action-buttons">
              <!-- 上移按钮 -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="tiny"
                    :disabled="isReadonly || loading || !canMoveUp(dialogue.id)"
                    class="move-btn"
                    @click="moveDialogueUp(dialogue.id)"
                  >
                    <n-icon size="16">
                      <ArrowUp />
                    </n-icon>
                  </n-button>
                </template>
                上移
              </n-tooltip>

              <!-- 下移按钮 -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="tiny"
                    :disabled="isReadonly || loading || !canMoveDown(dialogue.id)"
                    class="move-btn"
                    @click="moveDialogueDown(dialogue.id)"
                  >
                    <n-icon size="16">
                      <ArrowDown />
                    </n-icon>
                  </n-button>
                </template>
                下移
              </n-tooltip>

              <!-- 删除按钮 -->
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    text
                    size="tiny"
                    type="error"
                    :disabled="isReadonly || loading"
                    class="delete-btn"
                    @click="removeDialogue(dialogue.id)"
                  >
                    <n-icon size="16">
                      <Close />
                    </n-icon>
                  </n-button>
                </template>
                删除对话
              </n-tooltip>
            </div>
          </div>

          <!-- 第二行：角色 + 指令 + 对话文本 -->
          <div class="dialogue-content-row">
            <n-select
              :value="dialogue.characterId"
              :options="getDialogueCharacterOptions(dialogue)"
              :placeholder="dialogue.isVoiceover ? '旁白' : '角色'"
              aria-label="角色"
              size="small"
              class="character-select"
              :consistent-menu-width="false"
              :disabled="isReadonly || loading"
              @update:value="
                (val) => {
                  // Bug 修复：同步更新 characterName，避免 fallback 选项与原选项重复
                  // 使用 :value + @update:value 替代 v-model:value，避免与 emit 处理器冲突
                  // 旁白条目选了角色后仍保持 isVoiceover: true，不会变成角色对话
                  const char = characterOptions?.find((o) => o.value === val);
                  updateDialogue(dialogue.id, {
                    characterId: val,
                    characterName: char?.label || '',
                    isVoiceover: dialogue.isVoiceover,
                  });
                }
              "
            />

            <!-- 指令模板选择 -->
            <n-select
              :value="parseInstructionToTemplateId(dialogue.instructions)"
              :options="instructionOptions"
              placeholder="指令"
              aria-label="指令模板"
              size="small"
              class="instruction-select"
              clearable
              :consistent-menu-width="false"
              :disabled="isReadonly || loading"
              :loading="ttsStore.instructionTemplatesLoading"
              @update:value="
                (id: string | undefined) =>
                  handleInstructionChange(dialogue.id, id)
              "
            />

            <n-input
              v-model:value="dialogue.text"
              placeholder="输入对话..."
              aria-label="对话内容"
              size="small"
              :maxlength="500"
              show-count
              :disabled="isReadonly || loading"
              class="dialogue-input"
              @update:value="
                (val) => updateDialogueLocal(dialogue.id, { text: val })
              "
              @blur="flushDialogueUpdate"
            />
          </div>

          <!-- 第三行：动作输入 -->
          <div class="dialogue-actions-row">
            <n-input
              :value="(dialogue.actions || []).join(',')"
              placeholder="动作/表情"
              aria-label="动作"
              size="small"
              :disabled="isReadonly || loading"
              class="actions-input"
              @update:value="
                (val: string) => {
                  const actions = val
                    .split(',')
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
                  updateDialogue(dialogue.id, { actions });
                }
              "
            />
          </div>
        </div>

        <n-empty
          v-if="dialogues.length === 0"
          description="暂无对话"
          size="small"
        />
      </div>

      <div
        v-if="!isReadonly"
        class="dialogue-actions"
      >
        <span :style="{ cursor: canAddDialogue ? 'pointer' : 'not-allowed' }">
          <n-tooltip
            v-if="!canAddDialogue"
            trigger="hover"
            placement="top"
          >
            <template #trigger>
              <n-button
                size="small"
                disabled
                @click="addDialogue('dialogue')"
              >
                <template #icon>
                  <n-icon><Add /></n-icon>
                </template>
                对话
              </n-button>
            </template>
            {{ dialogueAddDisabledReason }}
          </n-tooltip>
          <n-button
            v-else
            size="small"
            :disabled="loading"
            @click="addDialogue('dialogue')"
          >
            <template #icon>
              <n-icon><Add /></n-icon>
            </template>
            对话
          </n-button>
        </span>
        <span :style="{ cursor: canAddVoiceover ? 'pointer' : 'not-allowed' }">
          <n-tooltip
            v-if="!canAddVoiceover"
            trigger="hover"
            placement="top"
          >
            <template #trigger>
              <n-button
                size="small"
                disabled
                @click="addDialogue('voiceover')"
              >
                <template #icon>
                  <n-icon><Mic /></n-icon>
                </template>
                旁白
              </n-button>
            </template>
            {{ voiceoverAddDisabledReason }}
          </n-tooltip>
          <n-button
            v-else
            size="small"
            :disabled="loading"
            @click="addDialogue('voiceover')"
          >
            <template #icon>
              <n-icon><Mic /></n-icon>
            </template>
            旁白
          </n-button>
        </span>
      </div>
    </template>

    <!-- 角色框选弹窗（支持宽高比限制和拖拽移动） -->
    <RegionSelectModal
      v-if="isLipSyncMode"
      :show="showRegionSelectModal"
      :image-url="storyboardMainImageUrl || ''"
      :character-name="currentCharacterName"
      :initial-region="currentInitialRegion"
      :aspect-ratio="aspectRatio"
      mode="full"
      title="框选角色区域"
      @update:show="showRegionSelectModal = $event"
      @confirm="handleRegionConfirm"
    />
  </div>
</template>

<style scoped lang="scss">
.dialogue-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #666;
      margin-bottom: 0;
    }
  }

  .dialogue-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 10px;
  }

  .dialogue-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #eee;

    // 第一行：音频播放器 + 操作按钮
    .dialogue-audio-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .audio-area-left {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;

        .audio-player-wrapper {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;

          .audio-loading {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 6px;
            padding: 4px 12px;
            background: #e6f4ff;
            border-radius: 6px;
            border: 1px solid #91caff;
            height: 32px;
            flex: 1;

            .audio-status-text {
              font-size: 12px;
              color: #2080f0;
              white-space: nowrap;
              font-weight: 500;
            }
          }

          .audio-error {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 6px;
            padding: 4px 12px;
            background: #fff0f0;
            border: 1px solid #fbc4c4;
            border-radius: 6px;
            color: #d03050;
            font-size: 12px;
            height: 32px;
            flex: 1;

            span {
              white-space: nowrap;
            }
          }

          .audio-placeholder {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 6px;
            padding: 4px 12px;
            background: #f5f7fa;
            border: 1px dashed #dcdfe6;
            border-radius: 6px;
            color: #909399;
            font-size: 12px;
            height: 32px;
            flex: 1;

            span {
              white-space: nowrap;
            }
          }
        }

        .audio-btn {
          padding: 2px 4px;
          opacity: 0.6;
          flex-shrink: 0;

          :deep(.n-icon) {
            font-size: 16px;
          }

          &:hover:not(:disabled) {
            opacity: 1;
          }
        }
      }

      .audio-divider {
        width: 1px;
        height: 16px;
        background: #dcdfe6;
        margin: 0 8px;
        flex-shrink: 0;
      }

      .action-buttons {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;

        .move-btn,
        .delete-btn {
          padding: 2px 4px;
          opacity: 0.6;

          :deep(.n-icon) {
            font-size: 16px;
          }

          &:hover:not(:disabled) {
            opacity: 1;
          }
        }

        .delete-btn:hover:not(:disabled) {
          color: #d03050;
        }

        .move-btn:hover:not(:disabled) {
          color: #18a058;
        }
      }
    }

    // 第二行：角色 + 指令 + 对话文本
    .dialogue-content-row {
      display: flex;
      align-items: center;
      gap: 8px;

      .character-select {
        width: 120px;
        min-width: 120px;
      }

      .instruction-select {
        width: 100px;
        min-width: 100px;
      }

      .dialogue-input {
        flex: 1;
      }
    }

    // 第三行：动作输入
    .dialogue-actions-row {
      display: flex;
      align-items: center;

      .actions-input {
        flex: 1;
      }
    }
  }

  .dialogue-actions {
    display: flex;
    gap: 8px;
  }

  // 对口型模式布局
  &.lipsync-mode {
    // 对口型模式下的对话列表布局
    .lipsync-dialogue-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    // 每条对话项：左侧预览模块 + 右侧编辑区域
    .lipsync-dialogue-item {
      display: flex;
      flex-direction: row;
      gap: 12px;
      padding: 12px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e8e8e8;

      // 左侧预览模块区域
      .preview-modules {
        display: flex;
        flex-direction: v-bind(previewLayout);
        gap: 8px;
        flex-shrink: 0;

        .region-preview-wrapper,
        .shot-preview-wrapper {
          width: v-bind(previewLayoutWidth);
          height: v-bind(previewLayoutHeight);
        }

        .region-preview-wrapper {
          position: relative;

          .preview-image {
            width: 100%;
            height: 100%;
            border-radius: 8px;
          }

          .region-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f5f5;
            border-radius: 8px;
            border: 1px dashed #ddd;
          }
        }

        .shot-preview-wrapper {
          // ShotPreview 组件样式调整
          :deep(.shot-preview) {
            width: 100%;
            height: 100%;
          }
        }
      }

      // 右侧编辑区域
      .dialogue-edit-area {
        flex: 1;
        min-width: 300px;
        display: flex;
        flex-direction: column;
        gap: 8px;

        // 视频按钮行（右下角最下方）
        .video-btn-row {
          display: flex;
          justify-content: flex-end;
          margin-top: auto;
          padding-top: 8px;
        }
      }
    }

    // 移除旧的 lipsync-layout 样式
    .lipsync-layout {
      display: none;
    }
  }
}

// Select 选项样式优化
.select-option-with-tag {
  display: flex;
  align-items: center;
  padding: 4px 0;

  :deep(.n-tag) {
    font-size: 12px;
    padding: 0 8px;
  }
}

.select-option-avatar {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 4px;
  object-fit: cover;
}

// Bug-7: 选中后 Tag 样式
.select-tag-with-avatar {
  display: flex;
  align-items: center;
  padding: 2px 4px;
}

.select-tag-avatar {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 4px;
  object-fit: cover;
}

.select-tag-label {
  font-size: 12px;
}
</style>

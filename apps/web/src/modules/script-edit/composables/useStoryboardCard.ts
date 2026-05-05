import { ref, computed, watch, toRaw } from "vue";
import { useMessage } from "naive-ui";
import { useScriptModelsStore } from "@/stores/script-models";
import { useScriptEditStore } from "../store/scriptEdit";
import type {
  StoryboardMode,
  DialogueItem,
  StoryboardCardProps,
  StoryboardCardEmits,
} from "../components/storyboard/types";

export function useStoryboardCard(
  props: StoryboardCardProps,
  emit: StoryboardCardEmits,
) {
  const message = useMessage();
  const scriptModelsStore = useScriptModelsStore();
  const scriptEditStore = useScriptEditStore();

  // 本地模型选择状态（Fix B：优先使用分镜自身模型，其次使用步骤默认模型）
  const selectedImageModel = ref(
    props.data.imageModelId || props.defaultImageModelId || "",
  );
  const selectedVideoModel = ref(
    props.data.videoModelId || props.defaultVideoModelId || "",
  );
  const selectedLipSyncModel = ref(
    props.data.lipSyncModelId || props.defaultLipSyncModelId || "",
  );

  // 是否有可用模型
  const hasImageModels = computed(
    () =>
      props.imageModelOptions!.length > 0 ||
      scriptModelsStore.getImageModelOptionsForStep("storyboards").length > 0,
  );
  const hasVideoModels = computed(
    () =>
      props.videoModelOptions!.length > 0 ||
      scriptModelsStore.videoGenerationModels.length > 0,
  );
  // Bug 修复：使用 store 的 lipSyncModels 计算属性，确保响应式依赖正确追踪
  const hasLipSyncModels = computed(
    () =>
      props.lipSyncModelOptions!.length > 0 ||
      scriptModelsStore.lipSyncModels.length > 0,
  );

  // 是否正在加载模型
  const isLoadingModels = computed(() => scriptModelsStore.isLoading);

  // 获取有效的模型选项
  const effectiveImageModelOptions = computed(() =>
    props.imageModelOptions!.length > 0
      ? props.imageModelOptions!
      : scriptModelsStore.getImageModelOptionsForStep("storyboards"),
  );
  const effectiveVideoModelOptions = computed(() =>
    props.videoModelOptions!.length > 0
      ? props.videoModelOptions!
      : scriptModelsStore.videoGenerationModels,
  );
  // Bug 修复：使用 store 的 lipSyncModels 计算属性，确保响应式依赖正确追踪
  const effectiveLipSyncModelOptions = computed(() =>
    props.lipSyncModelOptions!.length > 0
      ? props.lipSyncModelOptions!
      : scriptModelsStore.lipSyncModels,
  );

  // 监听 data 变化同步模型选择（优先使用分镜自身模型）
  watch(
    () => props.data.imageModelId,
    (newId) => {
      if (newId) selectedImageModel.value = newId;
    },
    { immediate: true },
  );

  watch(
    () => props.data.videoModelId,
    (newId) => {
      if (newId) selectedVideoModel.value = newId;
    },
    { immediate: true },
  );

  watch(
    () => props.data.lipSyncModelId,
    (newId) => {
      if (newId) selectedLipSyncModel.value = newId;
    },
    { immediate: true },
  );

  // 监听步骤默认模型变化：仅当分镜没有自身模型时，跟随步骤默认值更新
  watch(
    () => props.defaultImageModelId,
    (newId) => {
      if (newId && !props.data.imageModelId) selectedImageModel.value = newId;
    },
  );
  watch(
    () => props.defaultVideoModelId,
    (newId) => {
      if (newId && !props.data.videoModelId) selectedVideoModel.value = newId;
    },
  );
  watch(
    () => props.defaultLipSyncModelId,
    (newId) => {
      if (newId && !props.data.lipSyncModelId)
        selectedLipSyncModel.value = newId;
    },
  );

  // 本地状态
  const mode = ref<StoryboardMode>(props.data.mode || "standard");
  // Bug 修复：监听 props.data.mode 变化，确保刷新后正确显示
  watch(
    () => props.data.mode,
    (newMode) => {
      if (newMode) mode.value = newMode;
    },
  );
  // 分镜描述本地缓存（仅 blur 时才触发保存）
  const localDescription = ref(props.data.description || "");
  watch(
    () => props.data.description,
    (newDesc) => {
      localDescription.value = newDesc || "";
    },
  );

  // 对话列表：本地编辑状态，会响应 props.data.dialogues 的变化
  const dialogues = ref<DialogueItem[]>([]);

  // 对话原始值快照（用于 blur 时检测是否有实际变更，避免无意义保存）
  let originalDialoguesSnapshot = "";

  // Bug #2 关键修复：直接监听 props.data.dialogues，确保 Vue 正确追踪依赖
  // 之前的 JSON.stringify 方式无法正确触发响应式更新
  watch(
    () => props.data.dialogues,
    (newDialogues) => {
      // Bug #2 调试：打印 watch 触发
      console.log("[useStoryboardCard watch] 触发, storyboardId:", props.data.id);
      console.log("[useStoryboardCard watch] newDialogues:", newDialogues?.map(d => ({
        id: d.id,
        audioStatus: d.audioStatus,
        audioUrl: d.audioUrl ? '有' : '无',
        audioDuration: d.audioDuration,
      })));
      if (!newDialogues) {
        dialogues.value = [];
        return;
      }
      // 转换为本地格式
      const formattedDialogues: DialogueItem[] = newDialogues.map((d) => ({
        ...d,
        type: (d.isVoiceover ? "voiceover" : "dialogue") as
          | "dialogue"
          | "voiceover",
      }));
      dialogues.value = formattedDialogues;

      // 同步原始值快照（父组件更新数据后重置基准）
      originalDialoguesSnapshot = JSON.stringify(
        dialogues.value.map((d) => toRaw(d)),
      );

      // 检查角色对话是否缺少 characterId，给出警告
      const invalidDialogues = dialogues.value.filter(
        (d) => !d.isVoiceover && !d.characterId,
      );
      if (invalidDialogues.length > 0) {
        console.warn(
          "[useStoryboardCard] 发现未选角色的角色对话:",
          invalidDialogues.map((d) => d.id),
        );
        // 不自动修复，保留原始数据，由 UI 层的 hasVoice 校验拦截音频生成
      }
    },
    { immediate: true, deep: true },
  );

// 对话列表变化时自动切换视频模式 - 已删除，用户决策：完全去除自动切换逻辑
// watch(dialogues, ...)

  const duration = ref(props.data.duration || 3);
  // Bug 修复：监听 props.data.duration 变化，确保刷新后正确同步
  watch(
    () => props.data.duration,
    (newDuration) => {
      if (newDuration && newDuration !== duration.value) {
        duration.value = newDuration;
      }
    },
  );
  const isExpanded = ref(true);

  // 判断是否有非旁白对话
  const hasDialogue = computed(() => {
    return props.data.dialogues?.some((d) => !d.isVoiceover) ?? false;
  });

  // 是否已有旁白（用于限制旁白数量）
  const hasExistingVoiceover = computed(() =>
    dialogues.value.some((d) => d.isVoiceover),
  );

  // 是否全是旁白对话（包含空列表场景，空列表时也可选择"无对话"模式）
  const hasOnlyVoiceover = computed(() =>
    dialogues.value.every((d) => d.isVoiceover),
  );

  // 是否全是角色对话（非旁白）
  const hasOnlyCharacterDialogue = computed(() =>
    dialogues.value.length > 0 && dialogues.value.every((d) => !d.isVoiceover),
  );

  // 是否混合对话（同时有角色对话和旁白）
  const hasMixedDialogue = computed(() =>
    dialogues.value.some((d) => d.isVoiceover) &&
    dialogues.value.some((d) => !d.isVoiceover),
  );

  // 参考模式选择（根据对话情况动态设置默认值）
  // 有对话：single_reference（分镜图生视频），无对话：multi_reference（多参考生视频）
  const referenceMode = ref<"multi_reference" | "single_reference">(
    props.data.referenceMode ||
      (hasDialogue.value ? "single_reference" : "multi_reference"),
  );

  // 视频模式选择
  // 有对话：lip_sync（对口型），无对话：video_only（无对话）
  const videoMode = ref<"audio_reference" | "lip_sync" | "video_only">(
    props.data.videoMode || (hasDialogue.value ? "lip_sync" : "video_only"),
  );

  // Bug 修复：监听 props.data.referenceMode 和 props.data.videoMode 变化，确保刷新后正确显示
  watch(
    () => props.data.referenceMode,
    (newMode) => {
      if (newMode) referenceMode.value = newMode;
    },
  );
  watch(
    () => props.data.videoMode,
    (newMode) => {
      if (newMode) videoMode.value = newMode;
    },
  );

  // 模式选项（隐藏"快速"模式）
  const modeOptions = [
    { label: "标准", value: "standard" as const },
    // { label: "快速", value: "quick" as const }, // 暂时隐藏
    { label: "锁定", value: "locked" as const },
  ];

  // 参考模式选项
  const referenceModeOptions = [
    { label: "多参考生视频", value: "multi_reference" as const },
    { label: "分镜图生视频", value: "single_reference" as const },
  ];

  // 视频模式选项
  const videoModeOptions = [
    { label: "音频参考", value: "audio_reference" as const },
    { label: "对口型", value: "lip_sync" as const },
    { label: "无对话", value: "video_only" as const },
  ];

  // 是否只读（锁定模式）
  const isReadonly = computed(() => mode.value === "locked");

  // 是否快速模式
  const isQuickMode = computed(() => mode.value === "quick");

  // 从模型 defaultParams 获取最大参考图数量
  const maxImageRefImages = computed<number>(() => {
    const params = scriptModelsStore.getModelDefaultParams(
      selectedImageModel.value,
    );
    const val =
      params.max_references ??
      params.maxReferences ??
      params.max_references_images ??
      params.maxReferencesImages;
    return typeof val === "number" ? val : (props.maxReferenceImages ?? 0);
  });

  const maxVideoRefImages = computed(() => {
    const params = scriptModelsStore.getModelDefaultParams(
      selectedVideoModel.value,
    );
    const val =
      params.max_references ??
      params.maxReferences ??
      params.max_references_images ??
      params.maxReferencesImages;
    return typeof val === "number" ? val : 0;
  });

  // 时长选项：从视频模型的 defaultParams.duration 获取
  // 如果模型没有定义，使用默认选项 [3, 5, 10]
  // label 只显示数字，单位由组件统一显示
  const durationOptions = computed(() => {
    const params = scriptModelsStore.getModelDefaultParams(
      selectedVideoModel.value,
    );
    // duration 可能是 snake_case 或 camelCase
    const durationList = params.duration ?? params.durations;
    if (Array.isArray(durationList) && durationList.length > 0) {
      return durationList.map((d) => ({
        label: `${d}`,
        value: d,
      }));
    }
    // 默认选项
    return [
      { label: "3", value: 3 },
      { label: "5", value: 5 },
      { label: "10", value: 10 },
    ];
  });

  // 时长 slider 的 marks 格式：{ value: 'label' }
  // 只显示数字，单位由组件统一显示
  const durationMarks = computed<Record<number, string>>(() => {
    const marks: Record<number, string> = {};
    for (const opt of durationOptions.value) {
      marks[opt.value] = `${opt.value}`;
    }
    return marks;
  });

  // slider 的最小/最大值
  const durationMin = computed(() => {
    const values = durationOptions.value.map((o) => o.value);
    return Math.min(...values);
  });

  const durationMax = computed(() => {
    const values = durationOptions.value.map((o) => o.value);
    return Math.max(...values);
  });

  // 当视频模型切换导致 options 变化时，检查当前时长是否在新模型的选项中
  // 如果不在，向上取最接近的合法值（不小于当前值的最小选项，若无则取最大）
  watch(
    () => durationOptions.value,
    (newOptions, oldOptions) => {
      // 首次计算或模型数据尚未加载时不自动调整，避免初始化阶段覆盖后端计算值
      if (!oldOptions || oldOptions.length === 0) return;
      if (!selectedVideoModel.value) return;

      const currentDuration = duration.value;
      const availableValues = newOptions.map((o) => o.value);
      if (!availableValues.includes(currentDuration) && newOptions.length > 0) {
        // 向上取最接近：找到 >= currentDuration 的最小选项
        const candidates = availableValues.filter((v) => v >= currentDuration);
        const newDuration =
          candidates.length > 0
            ? Math.min(...candidates)
            : Math.max(...availableValues);
        duration.value = newDuration;
        // 自动上报更新
        emit("update", { ...toRaw(props.data), duration: newDuration });
      }
    },
  );

  // 视频模型支持的最大音频参考数量
  const maxVideoRefAudios = computed(() => {
    const params = scriptModelsStore.getModelDefaultParams(
      selectedVideoModel.value,
    );
    const val = params.max_references_audios ?? params.maxReferencesAudios ?? 0;
    return typeof val === "number" ? val : 0;
  });

  // 当前分镜组的角色对话数量（排除旁白）
  const characterDialogueCount = computed(() =>
    dialogues.value.filter((d) => !d.isVoiceover).length,
  );

  // 所有对话中音频未完成的数量（多参考+音频参考模式下检查）
  const incompleteAudioDialogueCount = computed(() =>
    dialogues.value.filter(
      (d) => d.audioStatus !== "completed" || !d.audioUrl,
    ).length,
  );

  // 所有对话的音频是否都已完成
  const allDialogueAudioCompleted = computed(() => {
    if (dialogues.value.length === 0) return true; // 无对话时视为满足条件
    return dialogues.value.every(
      (d) => d.audioStatus === "completed" && d.audioUrl,
    );
  });

  // 音频未完成时的提示信息
  const incompleteAudioMessage = computed(() => {
    if (incompleteAudioDialogueCount.value === 0) return "";
    return `有 ${incompleteAudioDialogueCount.value} 条对话的音频尚未生成完成，请先生成对话音频`;
  });

  // 是否可以添加角色对话（音频参考模式下检查数量限制）
  const canAddCharacterDialogue = computed(() => {
    // 旁白不受限制，只有角色对话受 max_references_audios 限制
    return characterDialogueCount.value < maxVideoRefAudios.value;
  });

  // 是否超过音频参考数量限制（用于提示用户）
  const isOverAudioRefLimit = computed(() => {
    if (maxVideoRefAudios.value === 0) return false;
    return characterDialogueCount.value > maxVideoRefAudios.value;
  });

  // 超限时的提示信息
  const audioRefLimitMessage = computed(() => {
    if (!isOverAudioRefLimit.value) return "";
    const excess = characterDialogueCount.value - maxVideoRefAudios.value;
    return `当前视频模型最多支持 ${maxVideoRefAudios.value} 条音频参考，已有 ${characterDialogueCount.value} 条角色对话，请删除 ${excess} 条对话后生成视频`;
  });

  // 视频模型的 generation_mode 参数
  // "first_last_frame" = 分镜图生视频模式（单一参考）
  // "multi_reference" = 多参考生视频模式
  const videoModelGenerationMode = computed<
    "first_last_frame" | "multi_reference" | null
  >(() => {
    const params = scriptModelsStore.getModelDefaultParams(
      selectedVideoModel.value,
    );
    const val = params.generation_mode ?? params.generationMode;
    if (val === "first_last_frame" || val === "multi_reference") {
      return val;
    }
    return null;
  });

  // 当前选择的模型是否支持参考图
  const isImageModelSupportReference = computed(
    () => maxImageRefImages.value > 0,
  );

  // 音频参考模式是否可用
  // 条件：参考模式为"多参考生视频"且视频模型支持音频上传（max_references_audios > 0）
  // 且角色对话数量不超过限制
  const isAudioDrivenAvailable = computed(() => {
    if (referenceMode.value !== "multi_reference") return false;
    if (maxVideoRefAudios.value === 0) return false;
    // 检查角色对话数量是否超过限制
    if (characterDialogueCount.value > maxVideoRefAudios.value) return false;
    return true;
  });

  // 音频参考模式不可用原因（用于 tooltip 提示）
  const audioDrivenUnavailableReason = computed(() => {
    if (referenceMode.value !== "multi_reference") {
      return "音频参考模式仅支持「多参考生视频」参考模式，请先切换参考模式";
    }
    if (maxVideoRefAudios.value === 0) {
      return "当前视频生成模型不支持音频上传，请选择支持音频的视频模型";
    }
    // 超限提示
    if (characterDialogueCount.value > maxVideoRefAudios.value) {
      return audioRefLimitMessage.value;
    }
    return "";
  });

  // 多参考生视频模式是否可用
  // 条件：当参考模式为 multi_reference 时，需要视频模型支持多参考
  const isMultiReferenceModeAvailable = computed(() => {
    if (referenceMode.value === "single_reference") {
      // 分镜图生视频模式，不限制，所有模型都可用
      return true;
    }
    // 多参考生视频模式，需要模型支持 multi_reference
    return videoModelGenerationMode.value === "multi_reference";
  });

  // 多参考模式不可用原因（用于 tooltip 提示）
  const multiReferenceUnavailableReason = computed(() => {
    if (referenceMode.value !== "multi_reference") {
      return ""; // 分镜图生视频模式不需要提示
    }
    if (videoModelGenerationMode.value !== "multi_reference") {
      return "当前视频模型不支持「多参考生视频」模式，请选择支持多参考的视频模型或切换为「分镜图生视频」模式";
    }
    return "";
  });

  // 检查出镜资产是否有图片（用于分镜图生视频模式）
  // Bug 修复：显式获取响应式依赖，确保状态变化时能正确触发重新计算
  const missingAssetImages = computed(() => {
    const missing: string[] = [];

    // Bug 修复：通过 computed 显式追踪 characters/scenes/props 的响应式依赖
    // 直接访问 items 确保 Vue 能正确追踪数组变化
    const charactersItems = scriptEditStore.steps.characters.items;
    const scenesItems = scriptEditStore.steps.scenes.items;
    const propsItems = scriptEditStore.steps.props.items;

    // Phase 4: ref 无 images/name 字段，使用运行时类型断言 + resolvedAssets
    type AssetWithImages = { images?: Array<{ type: string; url?: string }> };

    // 检查角色
    for (const charId of props.data.characterIds || []) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（characterId）
      const char = charactersItems.find((c) => c.id === charId || c.characterId === charId);
      // Bug 修复：检查 images 数组中是否有 type=main 且 url 存在的图片（运行时追加）
      const charRuntime = char as AssetWithImages;
      const hasMainImage = charRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (char && !hasMainImage) {
        // Phase 4: 从 resolvedAssets 获取 name，fallback 到 char.name
        const charName = scriptEditStore.getResolvedCharacterById(char.characterId)?.name
          ?? (char as { name?: string }).name;
        missing.push(`角色"${charName || charId.slice(0, 8)}"`);
      }
    }

    // 检查场景
    if (props.data.sceneId) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（sceneId）
      const scene = scenesItems.find((s) => s.id === props.data.sceneId || s.sceneId === props.data.sceneId);
      const sceneRuntime = scene as AssetWithImages;
      const hasMainImage = sceneRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (scene && !hasMainImage) {
        // Phase 4: 从 resolvedAssets 获取 name，fallback 到 scene.name
        const sceneName = scriptEditStore.getResolvedSceneById(scene.sceneId)?.name
          ?? (scene as { name?: string }).name;
        missing.push(`场景"${sceneName || props.data.sceneId.slice(0, 8)}"`);
      }
    }

    // 检查道具
    for (const propId of props.data.propIds || []) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（propId）
      const prop = propsItems.find((p) => p.id === propId || p.propId === propId);
      const propRuntime = prop as AssetWithImages;
      const hasMainImage = propRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (prop && !hasMainImage) {
        // Phase 4: 从 resolvedAssets 获取 name，fallback 到 prop.name
        const propName = scriptEditStore.getResolvedPropById(prop.propId)?.name
          ?? (prop as { name?: string }).name;
        missing.push(`道具"${propName || propId.slice(0, 8)}"`);
      }
    }

    // Bug 修复：添加调试日志，帮助排查响应式更新问题
    console.log("[missingAssetImages computed] 重新计算, missing:", missing.length, {
      characterIds: props.data.characterIds,
      sceneId: props.data.sceneId,
      propIds: props.data.propIds,
      charactersCount: charactersItems.length,
      scenesCount: scenesItems.length,
      propsCount: propsItems.length,
    });

    return missing;
  });

  // 分镜图生视频模式下视频不可用原因
  const singleReferenceVideoUnavailableReason = computed(() => {
    if (missingAssetImages.value.length === 0) return "";
    return `${missingAssetImages.value.join("、")}尚未生成图片`;
  });

  // 多参考生视频模式下视频不可用原因（同样需要检查出镜素材图片）
  const multiReferenceVideoUnavailableReason = computed(() => {
    // 先检查模型是否支持多参考模式
    if (videoModelGenerationMode.value !== "multi_reference") {
      return ""; // 这个由 multiReferenceUnavailableReason 处理
    }
    // 检查音频参考模式下必须有角色对话
    // 检查音频数量是否超限（多参考+音频参考模式）
    if (
      videoMode.value === "audio_reference" &&
      characterDialogueCount.value > maxVideoRefAudios.value
    ) {
      return audioRefLimitMessage.value;
    }
    // 检查所有对话的音频是否全部生成完成（多参考+音频参考模式）
    if (
      videoMode.value === "audio_reference" &&
      !allDialogueAudioCompleted.value
    ) {
      return incompleteAudioMessage.value;
    }
    // 检查素材图片
    if (missingAssetImages.value.length === 0) return "";
    return `${missingAssetImages.value.join("、")}尚未生成图片，无法作为视频参考`;
  });

  // 是否可以生成视频（综合检查）
  const canGenerateVideo = computed(() => {
    // video_only 模式：检查旁白音频是否已生成
    if (videoMode.value === "video_only") {
      // 如果有旁白对话，检查音频是否已生成
      const voiceover = dialogues.value.find((d) => d.isVoiceover);
      if (voiceover) {
        if (voiceover.audioStatus !== "completed" || !voiceover.audioUrl) {
          return false;
        }
      }
    }

    // 多参考模式+音频参考模式下，检查音频数量是否超限
    if (
      referenceMode.value === "multi_reference" &&
      videoMode.value === "audio_reference" &&
      characterDialogueCount.value > maxVideoRefAudios.value
    ) {
      return false;
    }

    // 多参考模式+音频参考模式下，检查所有对话音频是否完成
    if (
      referenceMode.value === "multi_reference" &&
      videoMode.value === "audio_reference" &&
      !allDialogueAudioCompleted.value
    ) {
      return false;
    }

    // 检查音频参考模式是否匹配
    if (
      videoMode.value === "audio_reference" &&
      !isAudioDrivenAvailable.value
    ) {
      return false;
    }
    // 检查多参考模式是否匹配
    if (
      referenceMode.value === "multi_reference" &&
      !isMultiReferenceModeAvailable.value
    ) {
      return false;
    }
    // 多参考/单参考模式下检查出镜资产图片
    if (missingAssetImages.value.length > 0) {
      return false;
    }

    return true;
  });

  // duration 是否超出视频模型支持的最大时长
  const durationExceedsMax = computed(() => {
    return duration.value > durationMax.value;
  });

  // duration 超限时生成视频按钮的 tooltip 提示
  const durationExceedsMaxReason = computed(() => {
    if (!durationExceedsMax.value) return "";
    return `当前分镜音频总时长 ${duration.value} 秒超出视频模型最大时长 ${durationMax.value} 秒，请删减对话或更换模型`;
  });

  // video_only 模式下旁白音频未生成的原因提示
  const voiceoverAudioUnavailableReason = computed(() => {
    if (videoMode.value !== "video_only") return "";

    const voiceover = dialogues.value.find((d) => d.isVoiceover);
    if (!voiceover) return "";

    if (voiceover.audioStatus !== "completed" || !voiceover.audioUrl) {
      return "无对话模式下，需先生成旁白音频再生成视频";
    }

    return "";
  });

  // 是否可以生成图片（已选择图像模型、模型支持参考图、且未在生成中、出镜素材已生成图片）
  const canGenerateImage = computed(() => {
    if (!selectedImageModel.value) return false;
    if (!isImageModelSupportReference.value) return false;
    if (props.imageGenerating) return false;
    if (missingAssetImages.value.length > 0) return false;
    return true;
  });

  // 处理模式切换
  function handleModeChange(value: string) {
    mode.value = value as StoryboardMode;
    emit("modeChange", props.data.id, mode.value);
  }

  // 处理描述 blur 保存（失焦时才上报，避免每次按键都触发保存）
  function handleDescriptionBlur() {
    if (localDescription.value !== props.data.description) {
      // BUG 修复：使用 toRaw 获取原始数据，避免展开响应式代理时丢失 images 等字段
      // cameraMovement 已融入 description，清空独立字段
      emit("update", {
        ...toRaw(props.data),
        description: localDescription.value,
        cameraMovement: undefined,
      });
    }
  }

  // 处理角色选择更新
  function handleCharacterUpdate(value: string[]) {
    console.log("[handleCharacterUpdate] 角色选择更新:", value);
    emit("update", { ...toRaw(props.data), characterIds: value });
  }

  // 处理场景选择更新
  function handleSceneUpdate(value: string | null) {
    console.log("[handleSceneUpdate] 场景选择更新:", value);
    emit("update", { ...toRaw(props.data), sceneId: value || undefined });
  }

  // 处理道具选择更新
  function handlePropUpdate(value: string[]) {
    console.log("[handlePropUpdate] 道具选择更新:", value);
    emit("update", { ...toRaw(props.data), propIds: value });
  }

  // 处理时长更新
  function handleDurationUpdate(value: string | number) {
    const numValue = typeof value === "string" ? parseInt(value, 10) : value;
    if (numValue > 0) {
      duration.value = numValue;
      emit("update", { ...toRaw(props.data), duration: numValue });
    }
  }

  // 处理参考模式更新
  function handleReferenceModeUpdate(value: string) {
    referenceMode.value = value as "multi_reference" | "single_reference";
    emit("update", {
      ...toRaw(props.data),
      referenceMode: referenceMode.value,
    });
  }

  // 处理视频模式更新
  function handleVideoModeUpdate(value: string) {
    // 如果尝试切换到音频参考模式但条件不满足，阻止切换并提示
    if (value === "audio_reference" && !isAudioDrivenAvailable.value) {
      message.warning(audioDrivenUnavailableReason.value);
      return;
    }
    // 对口型模式：必须全是角色对话（无旁白）
    if (value === "lip_sync" && !hasOnlyCharacterDialogue.value) {
      message.warning("对口型模式要求对话列表中全部是角色对话（无旁白）");
      return;
    }
    // 无对话模式：必须全是旁白或无对话
    if (value === "video_only" && !hasOnlyVoiceover.value) {
      message.warning("无对话模式要求对话列表中没有角色对话（全是旁白或无对话）");
      return;
    }
    videoMode.value = value as "audio_reference" | "lip_sync" | "video_only";
    emit("update", { ...toRaw(props.data), videoMode: videoMode.value });
  }

  // 添加对话
  function addDialogue(type: "dialogue" | "voiceover" = "dialogue") {
    const newDialogue: DialogueItem = {
      id: `dialogue_${Date.now()}`,
      text: "",
      type,
      isVoiceover: type === "voiceover",
      characterName: type === "voiceover" ? "旁白" : undefined,
    };
    dialogues.value = [...dialogues.value, newDialogue];
    emit("dialogueUpdate", props.data.id, dialogues.value);
  }

  // 更新对话本地状态（不触发保存，用于实时回显）
  function updateDialogueLocal(id: string, updates: Partial<DialogueItem>) {
    const index = dialogues.value.findIndex((d) => d.id === id);
    if (index !== -1) {
      dialogues.value[index] = { ...dialogues.value[index], ...updates };
    }
  }

  // 更新对话并立即上报父组件（用于 select 等离散变更）
  function updateDialogue(id: string, updates: Partial<DialogueItem>) {
    const index = dialogues.value.findIndex((d) => d.id === id);
    if (index !== -1) {
      dialogues.value[index] = { ...dialogues.value[index], ...updates };
      emit("dialogueUpdate", props.data.id, dialogues.value);
    }
  }

  // 对话文本失焦时上报父组件（blur 保存，内容无变化则跳过）
  function flushDialogueUpdate() {
    const current = JSON.stringify(dialogues.value.map((d) => toRaw(d)));
    if (current === originalDialoguesSnapshot) return;

    emit("dialogueUpdate", props.data.id, dialogues.value);
    originalDialoguesSnapshot = current;
  }

  // 删除对话
  function removeDialogue(id: string) {
    dialogues.value = dialogues.value.filter((d) => d.id !== id);
    emit("dialogueUpdate", props.data.id, dialogues.value);
  }

  // 移动对话（上移或下移）
  function moveDialogue(id: string, direction: "up" | "down") {
    const index = dialogues.value.findIndex((d) => d.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= dialogues.value.length) return;

    // 交换位置
    const newDialogues = [...dialogues.value];
    [newDialogues[index], newDialogues[newIndex]] = [
      newDialogues[newIndex],
      newDialogues[index],
    ];
    dialogues.value = newDialogues;
    emit("dialogueUpdate", props.data.id, dialogues.value);
  }

  // 生成分镜对话
  function handleGenerateDialogue() {
    if (!props.data.description) {
      message.warning("请先填写分镜描述");
      return;
    }
    emit("generateDialogue", props.data.id);
  }

  // 生成分镜视频
  function handleGenerateVideo() {
    // 检查音频参考模式是否匹配
    if (
      videoMode.value === "audio_reference" &&
      !isAudioDrivenAvailable.value
    ) {
      message.warning(audioDrivenUnavailableReason.value);
      return;
    }
    // 检查多参考模式是否匹配
    if (
      referenceMode.value === "multi_reference" &&
      !isMultiReferenceModeAvailable.value
    ) {
      message.warning(multiReferenceUnavailableReason.value);
      return;
    }
    // Bug 修复：本地二次校验（防御性编程），即使 computed 没更新也能正确校验
    const localMissing = checkMissingAssetImagesLocally();
    if (
      referenceMode.value === "multi_reference" &&
      localMissing.length > 0
    ) {
      message.warning(`${localMissing.join("、")}尚未生成图片，无法作为视频参考`);
      return;
    }
    // 检查单图参考模式下出镜资产图片
    if (
      referenceMode.value === "single_reference" &&
      localMissing.length > 0
    ) {
      message.warning(`${localMissing.join("、")}尚未生成图片，请先生成资源图片`);
      return;
    }
    emit("generateVideo", props.data.id);
  }

  // 处理生成图片
  function handleGenerateImage() {
    if (!selectedImageModel.value) {
      message.warning("请先选择图像生成模型");
      return;
    }
    if (!isImageModelSupportReference.value) {
      message.warning(
        "当前模型不支持参考图，请切换到一个支持参考图的模型（如 qwen-image-2.0）",
      );
      return;
    }
    if (!props.data.description) {
      message.warning("请先填写分镜描述");
      return;
    }

    // Bug 修复：本地二次校验（防御性编程），即使 computed 没更新也能正确校验
    const localMissing = checkMissingAssetImagesLocally();
    if (localMissing.length > 0) {
      message.warning(`${localMissing.join("、")}尚未生成图片，请先生成资源图片`);
      return;
    }

    emit("generateImage", props.data.id, selectedImageModel.value);
  }

  /**
   * Bug 修复：本地检查缺失的素材图片（防御性编程）
   * 直接从 store 获取最新数据，不依赖 computed 的响应式更新
   * Phase 4: 使用运行时类型断言 + resolvedAssets
   */
  function checkMissingAssetImagesLocally(): string[] {
    const missing: string[] = [];
    const charactersItems = scriptEditStore.steps.characters.items;
    const scenesItems = scriptEditStore.steps.scenes.items;
    const propsItems = scriptEditStore.steps.props.items;
    type AssetWithImages = { images?: Array<{ type: string; url?: string }> };

    // 检查角色
    for (const charId of props.data.characterIds || []) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（characterId）
      const char = charactersItems.find((c) => c.id === charId || c.characterId === charId);
      const charRuntime = char as AssetWithImages;
      const hasMainImage = charRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (char && !hasMainImage) {
        const charName = scriptEditStore.getResolvedCharacterById(char.characterId)?.name
          ?? (char as { name?: string }).name;
        missing.push(`角色"${charName || charId.slice(0, 8)}"`);
      }
    }

    // 检查场景
    if (props.data.sceneId) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（sceneId）
      const scene = scenesItems.find((s) => s.id === props.data.sceneId || s.sceneId === props.data.sceneId);
      const sceneRuntime = scene as AssetWithImages;
      const hasMainImage = sceneRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (scene && !hasMainImage) {
        const sceneName = scriptEditStore.getResolvedSceneById(scene.sceneId)?.name
          ?? (scene as { name?: string }).name;
        missing.push(`场景"${sceneName || props.data.sceneId.slice(0, 8)}"`);
      }
    }

    // 检查道具
    for (const propId of props.data.propIds || []) {
      // Bug 修复：同时支持前端 ref ID（id）和数据库 UUID（propId）
      const prop = propsItems.find((p) => p.id === propId || p.propId === propId);
      const propRuntime = prop as AssetWithImages;
      const hasMainImage = propRuntime?.images?.some((img: { type: string; url?: string }) => img.type === "main" && img.url);
      if (prop && !hasMainImage) {
        const propName = scriptEditStore.getResolvedPropById(prop.propId)?.name
          ?? (prop as { name?: string }).name;
        missing.push(`道具"${propName || propId.slice(0, 8)}"`);
      }
    }

    return missing;
  }

  // 处理图像模型变更（仅上报事件，StoryboardStep 负责立即保存）
  function handleImageModelChange(modelId: string) {
    selectedImageModel.value = modelId;
    emit("imageModelChange", props.data.id, modelId);
  }

  // 处理视频模型变更（仅上报事件，StoryboardStep 负责立即保存）
  function handleVideoModelChange(modelId: string) {
    selectedVideoModel.value = modelId;
    emit("videoModelChange", props.data.id, modelId);
  }

  // 处理对口型模型变更（仅上报事件，StoryboardStep 负责立即保存）
  function handleLipSyncModelChange(modelId: string) {
    selectedLipSyncModel.value = modelId;
    emit("lipSyncModelChange", props.data.id, modelId);
  }

  // 处理 n-upload 参考图上传
  function handleReferenceUpload(file: File) {
    emit("uploadReference", props.data.id, file);
  }

  // 处理参考图删除
  function handleDeleteReference(imageId: string) {
    emit("deleteReference", props.data.id, imageId);
  }

  // 处理视频参考图上传
  function handleVideoReferenceUpload(file: File) {
    emit("uploadVideoReference", props.data.id, file);
  }

  // 处理视频参考图删除
  function handleDeleteVideoReference(imageId: string) {
    emit("deleteVideoReference", props.data.id, imageId);
  }

  // 处理主图上传
  function handleMainImageUpload(file: File) {
    emit("uploadMainImage", props.data.id, file);
  }

  // 生成对话音频
  function handleGenerateAudio(dialogueId: string, voiceId?: string) {
    emit("generateAudio", props.data.id, dialogueId, voiceId);
  }

  // 删除对话音频
  function handleDeleteAudio(dialogueId: string) {
    emit("deleteAudio", props.data.id, dialogueId);
  }

  // ShotCard 事件处理（添加 characterId 参数和 options 参数）
  function handleGenerateShotVideo(shotGroupId: string, shotId: string, characterId: string, options?: { croppedImageUrl?: string; audioUrl?: string }) {
    emit("generateShotVideo", shotGroupId, shotId, characterId, options);
  }

  function handlePlayShotVideo(shotGroupId: string, shotId: string) {
    // 播放视频逻辑：可以通过获取 shot 数据来播放
    // 这里暂时不做处理，由父组件决定播放方式
    console.log("[handlePlayShotVideo] 播放分镜视频:", shotGroupId, shotId);
  }

  function handleRetryShotVideo(shotGroupId: string, shotId: string, characterId: string) {
    emit("generateShotVideo", shotGroupId, shotId, characterId, undefined);
  }

  // Bug-9: 处理对话独立的角色框选配置更新
  // 对话框选独立保存，不影响分镜组参考图
  // 分镜组参考图 → 对话分镜 是单向继承（在 DialogueSection.vue 的 getDialogueCharacterRegion 中实现）
  function handleUpdateDialogueRegion(
    dialogueId: string,
    characterId: string,
    config: import("@pixaura/shared-types").CharacterRegionConfig
  ) {
    const idx = dialogues.value.findIndex((d) => d.id === dialogueId);
    if (idx !== -1) {
      const currentDialogue = dialogues.value[idx];
      const currentRegions = currentDialogue.characterRegions || {};
      const updatedRegions: import("@pixaura/shared-types").CharacterRegions = {
        ...currentRegions,
        [characterId]: config,
      };
      // 更新对话的 characterRegions - 使用 splice 确保响应式更新
      const updatedDialogue = {
        ...currentDialogue,
        characterRegions: updatedRegions,
      };
      dialogues.value.splice(idx, 1, updatedDialogue);
      // 对话框选独立保存，不更新分镜组级别的 characterRegions
      // 分镜组参考图 → 对话分镜 是单向继承，在 DialogueSection.vue 的 getDialogueCharacterRegion 中实现
      // 触发保存
      flushDialogueUpdate();
    }
  }

  // 处理更多菜单选择
  function handleMoreSelect(key: string) {
    switch (key) {
      case "moveUp":
        emit("move", props.data.id, "up");
        break;
      case "moveDown":
        emit("move", props.data.id, "down");
        break;
      case "duplicate":
        emit("duplicate", props.data.id);
        break;
      case "delete":
        emit("delete", props.data.id);
        break;
    }
  }

  return {
    // 状态
    mode,
    localDescription,
    dialogues,
    duration,
    isExpanded,
    referenceMode,
    videoMode,
    selectedImageModel,
    selectedVideoModel,
    selectedLipSyncModel,

    // 计算属性
    isReadonly,
    isQuickMode,
    hasImageModels,
    hasVideoModels,
    hasLipSyncModels,
    isLoadingModels,
    effectiveImageModelOptions,
    effectiveVideoModelOptions,
    effectiveLipSyncModelOptions,
    maxImageRefImages,
    maxVideoRefImages,
    maxVideoRefAudios,
    characterDialogueCount,
    canAddCharacterDialogue,
    isOverAudioRefLimit,
    audioRefLimitMessage,
    durationOptions,
    durationMarks,
    durationMin,
    durationMax,
    videoModelGenerationMode,
    isImageModelSupportReference,
    canGenerateImage,
    isAudioDrivenAvailable,
    audioDrivenUnavailableReason,
    isMultiReferenceModeAvailable,
    multiReferenceUnavailableReason,
    missingAssetImages,
    singleReferenceVideoUnavailableReason,
    multiReferenceVideoUnavailableReason,
    voiceoverAudioUnavailableReason,
    canGenerateVideo,
    durationExceedsMax,
    durationExceedsMaxReason,
    hasExistingVoiceover,
    hasOnlyVoiceover,
    hasOnlyCharacterDialogue,
    hasMixedDialogue,

    // 选项
    modeOptions,
    referenceModeOptions,
    videoModeOptions,

    // 方法
    handleModeChange,
    handleDescriptionBlur,
    handleCharacterUpdate,
    handleSceneUpdate,
    handlePropUpdate,
    handleDurationUpdate,
    handleReferenceModeUpdate,
    handleVideoModeUpdate,
    addDialogue,
    updateDialogueLocal,
    updateDialogue,
    flushDialogueUpdate,
    removeDialogue,
    moveDialogue,
    handleGenerateDialogue,
    handleGenerateVideo,
    handleGenerateImage,
    handleImageModelChange,
    handleVideoModelChange,
    handleLipSyncModelChange,
    handleReferenceUpload,
    handleDeleteReference,
    handleVideoReferenceUpload,
    handleDeleteVideoReference,
    handleMainImageUpload,
    handleGenerateAudio,
    handleDeleteAudio,
    handleGenerateShotVideo,
    handlePlayShotVideo,
    handleRetryShotVideo,
    handleUpdateDialogueRegion,
    handleMoreSelect,
  };
}

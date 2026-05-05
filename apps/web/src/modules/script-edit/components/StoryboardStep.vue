<script setup lang="ts">
import { computed, ref, watch, toRaw, nextTick } from "vue";
import {
  NButton,
  NIcon,
  NEmpty,
  NSelect,
  NTooltip,
  NModal,
  useMessage,
  useDialog,
} from "naive-ui";
import { useDebounceFn } from "@vueuse/core";
import { Add, Film, Image, Videocam, Mic, Flash, Refresh } from "@vicons/ionicons5";
import {
  useScriptEditStore,
  type StoryboardRef,
  RESOLUTION_OPTIONS,
} from "../store/scriptEdit";
import type { DialogueItem as CardDialogueItem } from "./storyboard/types";
import WorkflowStep from "./WorkflowStep.vue";
import StoryboardCard from "./StoryboardCard.vue";
import CharacterRegionPanel from "./storyboard/CharacterRegionPanel.vue";
import ManualRegionModal from "./storyboard/ManualRegionModal.vue";
import RegionOverlay from "./storyboard/RegionOverlay.vue";
import { useScriptModelsStore, renderModelOptionWithPrice } from "@/stores/script-models";
import { useTtsStore } from "@/stores/tts";
import { scriptApi } from "@/modules/script/api";
import { enqueueUpdate } from "../store/modules";

// Props
const props = defineProps<{
  projectId: string;
  scriptId: string;
  // 计算后的状态（考虑依赖链），优先使用此状态
  computedStatus?: import("../store/types").StepStatusType;
}>();

// Emits
const emit = defineEmits<{
  (e: "generated"): void;
  (e: "error", message: string): void;
}>();

// Stores
const scriptEditStore = useScriptEditStore();
const scriptModelsStore = useScriptModelsStore();
const ttsStore = useTtsStore();

// Message & Dialog
const message = useMessage();
const dialog = useDialog();

// 本地状态
const isGenerating = ref(false);

// 组件挂载时加载音色数据
ttsStore.loadVoices();

/**
 * 比较当前分镜组与上次保存状态，返回变更的 groupId 列表。
 * 如果发生新增/删除/重排序，返回 null（应使用 PUT 整段替换）。
 */
function getChangedGroupIds(
  current: StoryboardRef[],
  saved: StoryboardRef[],
): string[] | null {
  const currentIds = current.map((s) => s.id);
  const savedIds = saved.map((s) => s.id);

  // 新增/删除/重排序 → 整段 PUT
  if (currentIds.length !== savedIds.length) return null;
  for (let i = 0; i < currentIds.length; i++) {
    if (currentIds[i] !== savedIds[i]) return null;
  }

  const changed: string[] = [];
  for (let i = 0; i < current.length; i++) {
    if (
      JSON.stringify(toRaw(current[i])) !== JSON.stringify(toRaw(saved[i]))
    ) {
      changed.push(current[i].id);
    }
  }
  return changed;
}

// 实际保存逻辑（供 debounce 包装版和立即版共用）
async function doSaveStoryboards() {
  if (!props.projectId || !props.scriptId) {
    console.warn("[doSaveStoryboards] 缺少 projectId 或 scriptId，跳过保存");
    return;
  }

  // 创建快照用于回滚
  scriptEditStore.createSnapshot();

  try {
    const now = new Date().toISOString();

    // 直接使用 Store 中的数据构建保存请求（单一数据源）
    const storyboardsToSave = storyboards.value.map((s) => {
      const raw = toRaw(s);
      // BUG 修复：深拷贝 images 数组，避免响应式引用问题
      const imagesCopy = raw.images ? [...raw.images] : [];
      // Bug 修复：深拷贝 characterRegions 对象，确保框选数据正确保存
      const characterRegionsCopy = raw.characterRegions ? { ...raw.characterRegions } : {};
      // Bug #1 修复：获取分镜主图信息
      const mainImg = imagesCopy.find((img) => img.type === "main");
      return {
        ...raw,
        images: imagesCopy,
        characterRegions: characterRegionsCopy,
        mainImageId: raw.mainImageId ?? mainImg?.id,
        // Bug #1 修复：同步 mainImageKey，后端视频生成检查此字段
        mainImageKey: raw.mainImageKey ?? mainImg?.url,
        referenceImages: raw.referenceImages ? [...raw.referenceImages] : [],
        // 确保必填字段存在
        mode: raw.mode || "standard",
        createdAt: raw.createdAt || now,
        updatedAt: now,
      };
    });

    // 使用细粒度端点保存分镜数据和设置（避免整份 content 覆盖竞态）
    // 通过 buildContentForSave 将 StoryboardRef 转换为 ShotGroup 格式
    const shotGroupsForSave = scriptEditStore.buildContentForSave({
      shotGroups: storyboardsToSave,
    }).shotGroups;

    // 保存前检查模型配置是否实际变化，避免分镜内容修改时连带触发 storyboard-settings
    const prevImageModel = scriptEditStore.steps.storyboards.defaultImageModelId;
    const prevVideoModel = scriptEditStore.steps.storyboards.defaultVideoModelId;
    const prevLipSyncModel = scriptEditStore.steps.storyboards.defaultLipSyncModelId;
    const nextImageModel = selectedImageModel.value || undefined;
    const nextVideoModel = selectedVideoModel.value || undefined;
    const nextLipSyncModel = selectedLipSyncModel.value || undefined;
    const hasModelChange =
      prevImageModel !== nextImageModel ||
      prevVideoModel !== nextVideoModel ||
      prevLipSyncModel !== nextLipSyncModel;

    // 更新步骤级别的模型配置到 store（单一数据源）
    scriptEditStore.steps.storyboards.defaultImageModelId = nextImageModel;
    scriptEditStore.steps.storyboards.defaultVideoModelId = nextVideoModel;
    scriptEditStore.steps.storyboards.defaultLipSyncModelId = nextLipSyncModel;

    await enqueueUpdate(`script:${props.scriptId}`, async () => {
      const changedIds = getChangedGroupIds(
        storyboards.value,
        lastSavedShotGroups.value,
      );
      // 无任何分镜组变更 → 跳过保存
      if (changedIds && changedIds.length === 0) {
        console.log("[doSaveStoryboards] 无变更，跳过保存");
        return;
      }
      // 只有一个分镜组发生变更且没有新增/删除/重排序 → 走 PATCH 细粒度更新
      if (changedIds && changedIds.length === 1) {
        const groupId = changedIds[0];
        const changedGroup = shotGroupsForSave.find((g) => g.id === groupId);
        if (changedGroup) {
          console.log(
            `[doSaveStoryboards] 单组 PATCH: groupId=${groupId}`,
          );
          await scriptApi.updateShotGroup(
            props.projectId,
            props.scriptId,
            groupId,
            changedGroup,
          );
        } else {
          await scriptApi.updateShotGroups(
            props.projectId,
            props.scriptId,
            shotGroupsForSave,
          );
        }
      } else {
        console.log(
          `[doSaveStoryboards] 整段 PUT: changedIds=${changedIds?.join(",") ?? "null"}`,
        );
        await scriptApi.updateShotGroups(
          props.projectId,
          props.scriptId,
          shotGroupsForSave,
        );
      }
      // 只有模型配置实际变化时才调用 storyboard-settings，减少无意义请求
      if (hasModelChange) {
        await scriptApi.updateStoryboardSettings(
          props.projectId,
          props.scriptId,
          {
            defaultImageModelId: nextImageModel,
            defaultVideoModelId: nextVideoModel,
            defaultLipSyncModelId: nextLipSyncModel,
          },
        );
      }
    });

    // 保存成功后更新基准快照
    lastSavedShotGroups.value = JSON.parse(
      JSON.stringify(storyboards.value.map((s) => toRaw(s))),
    );

    // 成功后清除快照
    scriptEditStore.clearSnapshot();
  } catch (error) {
    console.error("保存分镜失败:", error);
    // 回滚到快照状态
    scriptEditStore.restoreSnapshot();
    message.error("保存失败，请重试");
    throw error;
  }
}

// 防抖保存：用于 select 变更等离散操作（blur 保存的文本输入不需要这个）
const saveStoryboards = useDebounceFn(() => {
  doSaveStoryboards();
}, 500);

// 模型选择状态
const selectedImageModel = ref("");
const selectedVideoModel = ref("");
const selectedLipSyncModel = ref("");

// 初始化完成标志（初始化期间的变更不触发保存）
const initialized = ref(false);

// 模型选项 - 使用 store 的计算属性，确保响应式依赖正确追踪
const imageModelOptions = computed(() =>
  scriptModelsStore.getImageModelOptionsForStep("storyboards"),
);
// Bug 修复：使用 store 的 videoGenerationModels 和 lipSyncModels 计算属性
const videoModelOptions = computed(() => scriptModelsStore.videoGenerationModels);
const lipSyncModelOptions = computed(() => scriptModelsStore.lipSyncModels);

// 是否有可用模型
const hasImageModels = computed(() => imageModelOptions.value.length > 0);
const hasVideoModels = computed(() => videoModelOptions.value.length > 0);
const hasLipSyncModels = computed(() => lipSyncModelOptions.value.length > 0);

// 是否正在加载模型
const isLoadingModels = computed(() => scriptModelsStore.isLoading);

// 等待脚本和模型都加载完成后初始化步骤级别模型选择（只执行一次）
const stopInitWatch = watch(
  [() => scriptEditStore.script, () => scriptModelsStore.hasLoaded],
  ([script, modelsLoaded]) => {
    if (!script || !modelsLoaded) return;

    const settings = (script.content as Record<string, unknown>)
      ?.shotGroupSettings as Record<string, string> | undefined;

    // 优先使用已保存的步骤配置，否则回退到模型库默认值
    if (settings?.defaultImageModelId) {
      selectedImageModel.value = settings.defaultImageModelId;
    } else if (hasImageModels.value) {
      const defaultModelId = scriptModelsStore.getDefaultModelId("storyboards");
      const firstValue = imageModelOptions.value[0]?.value;
      selectedImageModel.value =
        defaultModelId || (firstValue !== undefined ? String(firstValue) : "");
    }

    if (settings?.defaultVideoModelId) {
      selectedVideoModel.value = settings.defaultVideoModelId;
    } else if (hasVideoModels.value) {
      const firstValue = videoModelOptions.value[0]?.value;
      selectedVideoModel.value = firstValue !== undefined ? String(firstValue) : "";
    }

    if (settings?.defaultLipSyncModelId) {
      selectedLipSyncModel.value = settings.defaultLipSyncModelId;
    } else if (hasLipSyncModels.value) {
      const firstValue = lipSyncModelOptions.value[0]?.value;
      selectedLipSyncModel.value = firstValue !== undefined ? String(firstValue) : "";
    }

    nextTick(() => {
      initialized.value = true;
      // 延迟关闭 isInitializing，确保所有 watch 都不会在初始化期间触发保存
      setTimeout(() => {
        isInitializing.value = false;
        console.log("[StoryboardStep] 初始化完成，isInitializing = false");
      }, 100);
      stopInitWatch(); // 初始化完成后停止监听，避免重复执行

      // 初始化 lastSavedShotGroups，作为后续变更检测的基准
      lastSavedShotGroups.value = JSON.parse(
        JSON.stringify(storyboards.value.map((s) => toRaw(s))),
      );

      // Bug 1 修复：移除自动持久化逻辑
      // 原逻辑检查 storyboards 字段是否为空来决定是否自动保存，但现在使用 shotGroups 字段
      // 即使 DB 中有 shotGroups 数据，storyboards 字段为空也会触发不必要的保存
      // 分镜数据现在由 Worker 生成并通过 loadScript 加载，前端无需自动持久化
    });
  },
  { immediate: true },
);

// 监听分镜列表引用变更（如 generateStoryboardsFromScenes 重新生成后），自动持久化到后端
// 注意：仅监听数组引用变更（非深度监听），避免与各操作的手动 saveStoryboards 重复
// BUG 修复：添加 isInitializing 标志，避免初始化时触发保存覆盖 DB 中的分镜图片
const isInitializing = ref(true);
// 防止模型变更 watch 和 storyboards watch 双重触发保存
const isModelChangeSaving = ref(false);
// 记录上次成功保存的分镜组状态，用于检测变更粒度（单组 PATCH vs 整段 PUT）
const lastSavedShotGroups = ref<StoryboardRef[]>([]);

watch(
  () => scriptEditStore.steps.storyboards.items,
  (newItems, oldItems) => {
    // 初始化期间不触发保存，避免覆盖 DB 中 Worker 已保存的分镜图片
    if (!initialized.value || isInitializing.value) {
      return;
    }
    // 模型变更期间跳过，避免双重保存
    if (isModelChangeSaving.value) {
      return;
    }
    // 只有数组引用变更时才触发（如 generateStoryboardsFromScenes 重赋值）
    if (newItems !== oldItems) {
      saveStoryboards();
    }
  },
);

// 监听步骤级别模型变更：同步更新所有 shot，并立即保存
watch(
  [selectedImageModel, selectedVideoModel, selectedLipSyncModel],
  async (
    [newImage, newVideo, newLipSync],
    [oldImage, oldVideo, oldLipSync],
  ) => {
    if (!initialized.value) {
      return;
    }

    // BUG 修复：遍历所有输入框和文本域，强制触发 blur 事件
    // 典型场景：用户修改角色描述后直接点击模型选择器，描述的 blur 事件可能未触发或未处理完
    // 解决方案：遍历所有 input 和 textarea，确保所有未提交的数据同步到 Store
    const inputs = document.querySelectorAll("input, textarea");
    inputs.forEach((el) => {
      if (el instanceof HTMLElement && document.activeElement === el) {
        el.blur();
      }
    });
    // 等待所有 blur 事件处理完成（Vue 响应式更新）
    await nextTick();
    // 额外等待一个微任务周期，确保 emit 传播到父组件并更新 store
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 设置标志位，防止另一个 watch 双重触发保存
    isModelChangeSaving.value = true;
    try {
      storyboards.value.forEach((_s, i) => {
        const updated = { ...storyboards.value[i] };
        if (newImage !== oldImage) updated.imageModelId = newImage;
        if (newVideo !== oldVideo) updated.videoModelId = newVideo;
        if (newLipSync !== oldLipSync) updated.lipSyncModelId = newLipSync;
        storyboards.value[i] = updated;
      });
      await doSaveStoryboards();
    } finally {
      isModelChangeSaving.value = false;
    }
  },
);

// 计算属性
// Bug #2 修复：直接访问 items，确保 Vue 正确追踪依赖
const storyboards = computed({
  get: () => scriptEditStore.steps.storyboards.items,
  set: (value) => {
    scriptEditStore.steps.storyboards.items = value;
  },
});

// stepState 用于访问其他 storyboard 步骤状态（status、modelId 等）
const stepState = computed(() => scriptEditStore.steps.storyboards);
// 实际使用的状态（优先使用传入的计算状态）
const stepStatus = computed(
  () => props.computedStatus ?? stepState.value.status,
);
const hasStoryboards = computed(() => storyboards.value.length > 0);

// 分镜解析步骤的动态描述文案（展示分批进度信息）
const stepDescription = computed(() => {
  const batchInfo = stepState.value.parseBatchInfo;
  if (
    stepState.value.storyboardParseStatus === "processing" &&
    batchInfo
  ) {
    const { currentBatch, totalBatches, completedShots, estimatedTotalShots } =
      batchInfo;
    const totalText = estimatedTotalShots
      ? `预计共 ${estimatedTotalShots} 个`
      : "";
    return `正在解析第 ${currentBatch}/${totalBatches} 批分镜（已解析 ${completedShots} 个）${totalText}`;
  }
  // 默认静态描述
  return "将剧本转换为分镜脚本";
});

// 分镜解析进度（用于进度条显示）
const parseProgress = computed(() => {
  if (stepState.value.storyboardParseStatus === "processing") {
    return stepState.value.progress || 0;
  }
  return 0;
});

// 角色、场景、道具选项数据
// Bug 修复：使用单一数据源 steps.items，避免 characterMap 中 id/characterId 双重 key 导致重复
// Phase 4 后：name 字段从 resolvedAssets 获取（ref 中无 name）
const characterOptions = computed(() => {
  const items = scriptEditStore.steps.characters.items;
  const characterMap = scriptEditStore.characterMap;
  // Bug-3 修复：添加 avatar 字段用于显示角色素材图片
  const optionsMap = new Map<string, { label: string; value: string; avatar?: string }>();
  // 用于快速查找：支持 id 和 characterId 都能找到对应的 value
  const idToValueMap = new Map<string, string>();

  // 辅助函数：获取角色的素材主图 URL
  const getAvatarUrl = (char: { images?: Array<{ type: string; url?: string }> }): string | undefined => {
    return char.images?.find((img) => img.type === "main")?.url;
  };

  // 辅助函数：获取角色名称
  // 优先从 resolvedAssets 获取，fallback 到 steps.characters.items（解析结果可能已包含 name）
  const getCharacterName = (characterId: string): string | undefined => {
    return scriptEditStore.getResolvedCharacterById(characterId)?.name
      ?? items.find((c) => c.characterId === characterId)?.name;
  };

  // 1. 优先从 steps.characters.items 添加选项（单一数据源）
  if (items.length > 0) {
    for (const c of items) {
      // 统一使用 characterId（assetId）作为选项 value，若不存在则使用 id（refId）
      const optionValue = c.characterId || c.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = c.characterId ? getCharacterName(c.characterId) : undefined;
      if (optionValue && name) {
        // 只在 value 不存在时添加选项
        if (!optionsMap.has(optionValue)) {
          // Bug-3 修复：添加 avatar 字段
          const avatar = getAvatarUrl(c as { images?: Array<{ type: string; url?: string }> });
          optionsMap.set(optionValue, { label: name, value: optionValue, avatar });
        }
        // 记录 id -> value 和 characterId -> value 的映射
        idToValueMap.set(c.id, optionValue);
        if (c.characterId) {
          idToValueMap.set(c.characterId, optionValue);
        }
      }
    }
  } else {
    // 2. 仅当 items 为空时，从 characterMap 获取（兜底）
    const addedValues = new Set<string>();
    for (const char of characterMap.values()) {
      const optionValue = char.characterId || char.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = char.characterId ? getCharacterName(char.characterId) : undefined;
      if (optionValue && name && !addedValues.has(optionValue)) {
        // Bug-3 修复：添加 avatar 字段
        const avatar = getAvatarUrl(char as { images?: Array<{ type: string; url?: string }> });
        optionsMap.set(optionValue, { label: name, value: optionValue, avatar });
        addedValues.add(optionValue);
        idToValueMap.set(char.id, optionValue);
        if (char.characterId) {
          idToValueMap.set(char.characterId, optionValue);
        }
      }
    }
  }

  // 3. 为分镜中已选中但不在选项列表中的角色 ID 添加 fallback 选项
  for (const storyboard of storyboards.value) {
    for (const charId of storyboard.characterIds || []) {
      if (charId && !idToValueMap.has(charId) && !optionsMap.has(charId)) {
        // Phase 4：从 resolvedAssets 获取 name
        const name = getCharacterName(charId);
        if (name) {
          // Bug-3 修复：添加 avatar 字段（resolvedAssets 中无 images，使用 characterMap）
          const char = characterMap.get(charId);
          const avatar = getAvatarUrl(char as { images?: Array<{ type: string; url?: string }> });
          optionsMap.set(charId, { label: name, value: charId, avatar });
        } else {
          const shortId = charId.substring(0, 8);
          optionsMap.set(charId, { label: `角色(${shortId}...)`, value: charId });
        }
      }
    }
    // 对话中的角色 ID 也需要处理
    for (const dialogue of storyboard.dialogues || []) {
      if (dialogue.characterId && !idToValueMap.has(dialogue.characterId) && !optionsMap.has(dialogue.characterId)) {
        // Phase 4：从 resolvedAssets 获取 name
        const name = getCharacterName(dialogue.characterId);
        if (name) {
          // Bug-3 修复：添加 avatar 字段
          const char = characterMap.get(dialogue.characterId);
          const avatar = getAvatarUrl(char as { images?: Array<{ type: string; url?: string }> });
          optionsMap.set(dialogue.characterId, { label: name, value: dialogue.characterId, avatar });
        } else if (dialogue.characterName) {
          optionsMap.set(dialogue.characterId, { label: dialogue.characterName, value: dialogue.characterId });
        } else {
          const shortId = dialogue.characterId.substring(0, 8);
          optionsMap.set(dialogue.characterId, { label: `角色(${shortId}...)`, value: dialogue.characterId });
        }
      }
    }
  }

  return Array.from(optionsMap.values());
});

const sceneOptions = computed(() => {
  const items = scriptEditStore.steps.scenes.items;
  const sceneMap = scriptEditStore.sceneMap;
  // 使用 value 作为 key 来避免重复选项
  const optionsMap = new Map<string, { label: string; value: string }>();
  // 用于快速查找
  const idToValueMap = new Map<string, string>();

  // 辅助函数：获取场景名称
  // 优先从 resolvedAssets 获取，fallback 到 steps.scenes.items（解析结果可能已包含 name）
  const getSceneName = (sceneId: string): string | undefined => {
    return scriptEditStore.getResolvedSceneById(sceneId)?.name
      ?? items.find((s) => s.sceneId === sceneId)?.name;
  };

  // 1. 优先从 steps.scenes.items 添加选项（单一数据源）
  if (items.length > 0) {
    for (const s of items) {
      // 统一使用 sceneId（assetId）作为选项 value，若不存在则使用 id（refId）
      const optionValue = s.sceneId || s.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = s.sceneId ? getSceneName(s.sceneId) : undefined;
      if (optionValue && name) {
        // 只在 value 不存在时添加选项
        if (!optionsMap.has(optionValue)) {
          optionsMap.set(optionValue, { label: name, value: optionValue });
        }
        // 记录 id -> value 和 sceneId -> value 的映射
        idToValueMap.set(s.id, optionValue);
        if (s.sceneId) {
          idToValueMap.set(s.sceneId, optionValue);
        }
      }
    }
  } else {
    // 2. 仅当 items 为空时，从 sceneMap 获取（兜底）
    const addedValues = new Set<string>();
    for (const scene of sceneMap.values()) {
      const optionValue = scene.sceneId || scene.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = scene.sceneId ? getSceneName(scene.sceneId) : undefined;
      if (optionValue && name && !addedValues.has(optionValue)) {
        optionsMap.set(optionValue, { label: name, value: optionValue });
        addedValues.add(optionValue);
        idToValueMap.set(scene.id, optionValue);
        if (scene.sceneId) {
          idToValueMap.set(scene.sceneId, optionValue);
        }
      }
    }
  }

  // 3. 为分镜中已选中但不在选项列表中的场景 ID 添加 fallback 选项
  // 这确保即使场景数据未加载完成，也能正确显示场景名称
  for (const storyboard of storyboards.value) {
    if (storyboard.sceneId && !idToValueMap.has(storyboard.sceneId) && !optionsMap.has(storyboard.sceneId)) {
      // Phase 4：从 resolvedAssets 获取 name
      const name = getSceneName(storyboard.sceneId);
      if (name) {
        optionsMap.set(storyboard.sceneId, { label: name, value: storyboard.sceneId });
      } else {
        // 如果 resolvedAssets 中也没有，显示 ID 前 8 位作为 fallback
        const shortId = storyboard.sceneId.substring(0, 8);
        optionsMap.set(storyboard.sceneId, { label: `场景(${shortId}...)`, value: storyboard.sceneId });
      }
    }
  }

  return Array.from(optionsMap.values());
});

const propOptions = computed(() => {
  const items = scriptEditStore.steps.props.items;
  const propMap = scriptEditStore.propMap;
  // 使用 value 作为 key 来避免重复选项
  const optionsMap = new Map<string, { label: string; value: string }>();
  // 用于快速查找
  const idToValueMap = new Map<string, string>();

  // 辅助函数：获取道具名称
  // 优先从 resolvedAssets 获取，fallback 到 steps.props.items（解析结果可能已包含 name）
  const getPropName = (propId: string): string | undefined => {
    return scriptEditStore.getResolvedPropById(propId)?.name
      ?? items.find((p) => p.propId === propId)?.name;
  };

  // 1. 优先从 steps.props.items 添加选项（单一数据源）
  if (items.length > 0) {
    for (const p of items) {
      // 统一使用 propId（assetId）作为选项 value，若不存在则使用 id（refId）
      const optionValue = p.propId || p.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = p.propId ? getPropName(p.propId) : undefined;
      if (optionValue && name) {
        // 只在 value 不存在时添加选项
        if (!optionsMap.has(optionValue)) {
          optionsMap.set(optionValue, { label: name, value: optionValue });
        }
        // 记录 id -> value 和 propId -> value 的映射
        idToValueMap.set(p.id, optionValue);
        if (p.propId) {
          idToValueMap.set(p.propId, optionValue);
        }
      }
    }
  } else {
    // 2. 仅当 items 为空时，从 propMap 获取（兜底）
    const addedValues = new Set<string>();
    for (const prop of propMap.values()) {
      const optionValue = prop.propId || prop.id;
      // Phase 4：从 resolvedAssets 获取 name
      const name = prop.propId ? getPropName(prop.propId) : undefined;
      if (optionValue && name && !addedValues.has(optionValue)) {
        optionsMap.set(optionValue, { label: name, value: optionValue });
        addedValues.add(optionValue);
        idToValueMap.set(prop.id, optionValue);
        if (prop.propId) {
          idToValueMap.set(prop.propId, optionValue);
        }
      }
    }
  }

  // 3. 为分镜中已选中但不在选项列表中的道具 ID 添加 fallback 选项
  for (const storyboard of storyboards.value) {
    for (const propId of storyboard.propIds || []) {
      if (propId && !idToValueMap.has(propId) && !optionsMap.has(propId)) {
        // Phase 4：从 resolvedAssets 获取 name
        const name = getPropName(propId);
        if (name) {
          optionsMap.set(propId, { label: name, value: propId });
        } else {
          const shortId = propId.substring(0, 8);
          optionsMap.set(propId, { label: `道具(${shortId}...)`, value: propId });
        }
      }
    }
  }

  return Array.from(optionsMap.values());
});

// 角色音色映射（characterId -> { voiceId, voiceName }）
// Bug #3 修复：同时建立 char.id 和 char.characterId 到音色配置的映射
// 因为对话的 characterId 可能是前端 ref ID（char.id）或数据库 UUID（char.characterId）
const characterVoiceMap = computed(() => {
  const map: Record<string, { voiceId?: string; voiceName?: string }> = {};
  for (const char of scriptEditStore.steps.characters.items) {
    if (char.voiceId) {
      // 从音色列表中查找音色名称
      const voice = ttsStore.voices.find((v) => v.voiceId === char.voiceId);
      const voiceConfig = {
        voiceId: char.voiceId,
        voiceName: voice?.name,
      };
      // 使用 char.id 作为 key（前端 ref ID）
      map[char.id] = voiceConfig;
      // 如果有 characterId（数据库 UUID），也建立映射
      if (char.characterId) {
        map[char.characterId] = voiceConfig;
      }
    }
  }
  return map;
});

// 旁白音色（从剧本 content 中获取）
const narrationVoiceId = computed(() => {
  const content = scriptEditStore.script?.content as
    | Record<string, unknown>
    | undefined;
  return content?.narrationVoiceId as string | undefined;
});

const narrationVoiceName = computed(() => {
  if (!narrationVoiceId.value) return undefined;
  const voice = ttsStore.voices.find((v) => v.voiceId === narrationVoiceId.value);
  return voice?.name;
});

// 根据剧本分辨率计算宽高比
const storyboardAspectRatio = computed(() => {
  const resolution = scriptEditStore.creationSettings.resolution;
  const opt = RESOLUTION_OPTIONS.find((r) => r.value === resolution);
  if (opt) {
    return `${opt.width}/${opt.height}`;
  }
  return "9/16"; // 默认竖屏
});

// 空状态提示文案（区分无资源和有资源但无分镜）
const emptyStateDescription = computed(() => {
  const hasCharactersOrScenes =
    scriptEditStore.steps.characters.items.length > 0 ||
    scriptEditStore.steps.scenes.items.length > 0;

  if (!hasCharactersOrScenes) {
    return "请先在剧本步骤解析角色或场景资源";
  }
  return "请点击「解析分镜」生成分镜数据";
});

const actionButtons = computed(() => {
    const buttons = [];
    const isGeneratingAll = !!stepState.value.currentTaskId;

    // 检查是否有角色或场景数据（分镜解析前置条件）
    const hasCharactersOrScenes =
      scriptEditStore.steps.characters.items.length > 0 ||
      scriptEditStore.steps.scenes.items.length > 0;

    // 分镜解析状态
    const isParsingStoryboards =
      stepState.value.storyboardParseStatus === "processing";
    const isStoryboardParseFailed =
      stepState.value.storyboardParseStatus === "failed";

    // 1. 分镜解析按钮（始终显示，条件：有角色或场景）
    if (hasCharactersOrScenes) {
      buttons.push({
        key: "parse-storyboards",
        label: hasStoryboards.value
          ? (isParsingStoryboards ? "解析中..." : "重新解析")
          : (isParsingStoryboards ? "解析中..." : "分镜解析"),
        type: hasStoryboards.value ? "default" as const : "primary" as const,
        disabled: isParsingStoryboards,
        loading: isParsingStoryboards,
        icon: hasStoryboards.value || isStoryboardParseFailed ? Refresh : Flash,
      });
    }

    // 2. 一键生成分镜按钮（有分镜且有待生成状态时显示）
    // 修复：排除分镜解析中状态，避免解析完成后多出此按钮
    if (
      hasStoryboards.value &&
      !isGeneratingAll &&
      stepState.value.storyboardParseStatus !== "processing" &&
      (stepStatus.value === "pending" || stepStatus.value === "failed")
    ) {
      buttons.push({
        key: "generate",
        label: "一键生成分镜",
        type: "primary" as const,
        disabled: false,
        loading: isGenerating.value,
      });
    }
    return buttons;
  });

// 添加分镜
function handleAddStoryboard() {
  const now = new Date().toISOString();
  const newStoryboard: StoryboardRef = {
    id: `storyboard_${Date.now()}`,
    sequenceNumber: storyboards.value.length + 1,
    description: "",
    characterIds: [],
    propIds: [],
    duration: 3,
    status: "pending",
    mode: "standard",
    createdAt: now,
    updatedAt: now,
    // 继承步骤级别的模型选择
    imageModelId: selectedImageModel.value,
    videoModelId: selectedVideoModel.value,
    lipSyncModelId: selectedLipSyncModel.value,
    dialogues: [],
  };
  storyboards.value.push(newStoryboard);
  message.success("添加分镜成功");
  saveStoryboards(); // Fix D：触发自动保存
}

// 更新分镜
function handleUpdateStoryboard(data: StoryboardRef) {
  const index = storyboards.value.findIndex((s) => s.id === data.id);
  if (index !== -1) {
    // BUG 修复：保留原有的 images 和 mainImageId，避免被 undefined 覆盖
    // 典型场景：修改 referenceMode 时，emit 的 data 可能不包含 images 字段
    const existing = toRaw(storyboards.value[index]) as unknown as Record<
      string,
      unknown
    >;
    const incoming = toRaw(data) as unknown as Record<string, unknown>;

    const mergedData = {
      ...incoming,
      // 优先使用传入的 images，否则保留原有的
      images: incoming.images ?? existing.images,
      mainImageId: incoming.mainImageId ?? existing.mainImageId,
      referenceImages: incoming.referenceImages ?? existing.referenceImages,
      videoGeneration: incoming.videoGeneration ?? existing.videoGeneration,
    } as unknown as StoryboardRef;

    storyboards.value[index] = mergedData;
    // 初始化期间不触发保存，避免覆盖 DB 中 Worker 已保存的分镜图片
    if (!isInitializing.value) {
      saveStoryboards(); // Fix D：触发自动保存
    }
  } else {
    console.warn("[handleUpdateStoryboard] 未找到分镜:", data.id);
  }
}

// 删除分镜
function handleDeleteStoryboard(id: string) {
  dialog.warning({
    title: "确认删除",
    content: "确定要删除这个分镜吗？此操作不可撤销。",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      const index = storyboards.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        storyboards.value.splice(index, 1);
        storyboards.value.forEach((s, i) => {
          s.sequenceNumber = i + 1;
        });
        message.success("删除成功");
        saveStoryboards(); // Fix D：触发自动保存
      }
    },
  });
}

// Fix D：处理对白更新并自动保存
async function handleDialogueUpdate(
  storyboardId: string,
  dialogues: CardDialogueItem[],
) {
  const index = storyboards.value.findIndex((s) => s.id === storyboardId);
  if (index !== -1) {
    // BUG 修复：保存前先让所有输入框失去焦点，触发 blur 事件
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName !== "BODY"
    ) {
      activeElement.blur();
      await nextTick();
    }

    // 映射为 store DialogueItem（characterName 不可为空）
    const mapped = dialogues.map((d) => {
      let instructions = d.instructions;
      // 如果 instructions 是字符串，转换为对象格式（兼容旧数据）
      if (typeof instructions === "string") {
        instructions = { content: instructions };
      }
      return {
        ...d,
        instructions,
        characterName: d.characterName || "",
        isVoiceover: d.type === "voiceover" || d.isVoiceover || false,
        // 确保 actions 字段被保留（用于前端显示）
        actions: d.actions || [],
        // Bug-2 修复：确保 characterRegions 字段被保留（对话独立的角色框选配置）
        characterRegions: d.characterRegions,
      };
    });

    // BUG 修复：使用 toRaw 获取原始数据，避免展开响应式代理时丢失 images 等字段
    // 注意：不再自动切换 videoMode，由用户自行决定
    storyboards.value[index] = {
      ...toRaw(storyboards.value[index]),
      dialogues: mapped,
    };
    await doSaveStoryboards();
  }
}

// 处理操作按钮点击
async function handleAction(actionKey: string) {
  if (actionKey === "generate") {
    isGenerating.value = true;
    try {
      await scriptEditStore.generateAllStoryboards(
        selectedImageModel.value || undefined,
      );
      message.info("分镜生成任务已提交，请稍候...");
      emit("generated");
    } catch (error) {
      message.error("分镜生成失败，请稍后重试");
      console.error("分镜批量生成失败:", error);
    } finally {
      isGenerating.value = false;
    }
  } else if (actionKey === "parse-storyboards") {
    // 检查前置条件
    const hasCharactersOrScenes =
      scriptEditStore.steps.characters.items.length > 0 ||
      scriptEditStore.steps.scenes.items.length > 0;

    if (!hasCharactersOrScenes) {
      dialog.warning({
        title: "提示",
        content: "请先在剧本步骤解析角色或场景资源",
        positiveText: "确定",
      });
      return;
    }

    // 有分镜内容时，显示确认对话框
    if (hasStoryboards.value) {
      dialog.warning({
        title: "确认重新解析",
        content: "重新解析会清空之前的分镜组数据，是否继续？",
        positiveText: "确认",
        negativeText: "取消",
        onPositiveClick: async () => {
          // 1. 先清空前端分镜数据（立即生效）
          scriptEditStore.clearStoryboards();

          // 2. 再调用 API 重新解析（传递 props 中的 ID）
          try {
            await scriptEditStore.parseStoryboards(
              true,
              props.projectId,
              props.scriptId,
            ); // force=true
            message.success("分镜解析任务已启动");
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : "分镜解析失败，请稍后重试";
            message.error(errMsg);
            console.error("分镜解析失败:", error);
          }
        },
      });
    } else {
      // 无分镜内容时，直接解析（传递 props 中的 ID）
      try {
        await scriptEditStore.parseStoryboards(
          false,
          props.projectId,
          props.scriptId,
        ); // force=false
        message.success("分镜解析任务已启动");
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "分镜解析失败，请稍后重试";
        message.error(errMsg);
        console.error("分镜解析失败:", error);
      }
    }
  }
}

// 移动分镜（向上或向下）
function handleMoveStoryboard(id: string, direction: "up" | "down") {
  const index = storyboards.value.findIndex((s) => s.id === id);
  if (index === -1) return;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= storyboards.value.length) return;

  // 交换位置
  const list = [...storyboards.value];
  [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
  // 更新序号
  list.forEach((s, i) => {
    s.sequenceNumber = i + 1;
  });
  storyboards.value = list;
  saveStoryboards();
}

// 复制分镜
function handleDuplicateStoryboard(id: string) {
  const index = storyboards.value.findIndex((s) => s.id === id);
  if (index === -1) return;

  const original = storyboards.value[index];
  const copy = {
    ...original,
    id: `storyboard_${Date.now()}_copy`,
    sequenceNumber: original.sequenceNumber + 1,
  };

  // 插入到原分镜后面，并重新排序序号
  const list = [...storyboards.value];
  list.splice(index + 1, 0, copy);
  list.forEach((s, i) => {
    s.sequenceNumber = i + 1;
  });
  storyboards.value = list;
  message.success("复制分镜成功");
  saveStoryboards();
}

// 处理分镜模式变更（标准/快速/锁定）
async function handleModeChange(storyboardId: string, mode: string) {
  const index = storyboards.value.findIndex((s) => s.id === storyboardId);
  if (index !== -1) {
    // BUG 修复：保存前先让所有输入框失去焦点，触发 blur 事件
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName !== "BODY"
    ) {
      activeElement.blur();
      await nextTick();
    }

    // BUG 修复：使用 toRaw 获取原始数据，避免展开响应式代理时丢失 images 等字段
    storyboards.value[index] = {
      ...toRaw(storyboards.value[index]),
      mode: mode as "standard" | "quick" | "locked",
    };
    await doSaveStoryboards();
  }
}

// 处理单个分镜的图像模型变更（立即保存，不走防抖）
async function handleImageModelChange(storyboardId: string, modelId: string) {
  const index = storyboards.value.findIndex((s) => s.id === storyboardId);
  if (index !== -1) {
    // BUG 修复：保存前先让所有输入框失去焦点，触发 blur 事件
    // 典型场景：用户修改角色描述后直接点击模型选择器，描述的 blur 事件未触发
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName !== "BODY"
    ) {
      activeElement.blur();
      // 等待 blur 事件处理完成（Vue 响应式更新）
      await nextTick();
    }

    // BUG 修复：使用 toRaw 获取原始数据
    storyboards.value[index] = {
      ...toRaw(storyboards.value[index]),
      imageModelId: modelId,
    };
    await doSaveStoryboards();
  }
}

// 处理单个分镜的视频模型变更（立即保存，不走防抖）
async function handleVideoModelChange(storyboardId: string, modelId: string) {
  const index = storyboards.value.findIndex((s) => s.id === storyboardId);
  if (index !== -1) {
    // BUG 修复：保存前先让所有输入框失去焦点，触发 blur 事件
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName !== "BODY"
    ) {
      activeElement.blur();
      await nextTick();
    }

    // BUG 修复：使用 toRaw 获取原始数据
    storyboards.value[index] = {
      ...toRaw(storyboards.value[index]),
      videoModelId: modelId,
    };
    await doSaveStoryboards();
  }
}

// 处理单个分镜的对口型模型变更（立即保存，不走防抖）
async function handleLipSyncModelChange(storyboardId: string, modelId: string) {
  const index = storyboards.value.findIndex((s) => s.id === storyboardId);
  if (index !== -1) {
    // BUG 修复：保存前先让所有输入框失去焦点，触发 blur 事件
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement.tagName !== "BODY"
    ) {
      activeElement.blur();
      await nextTick();
    }

    // BUG 修复：使用 toRaw 获取原始数据
    storyboards.value[index] = {
      ...toRaw(storyboards.value[index]),
      lipSyncModelId: modelId,
    };
    await doSaveStoryboards();
  }
}

// BUG-08：生成分镜图片
async function handleGenerateImage(storyboardId: string, modelId: string) {
  if (!props.projectId || !props.scriptId) return;
  try {
    await scriptEditStore.generateStoryboardImage(storyboardId, { modelId });
  } catch (error) {
    message.error("生成图片失败，请稍后重试");
    console.error("生成分镜图片失败:", error);
  }
}

// 辅助函数：获取资源的 main 图片 URL
// Phase 4: ref 中无 name 字段，但运行时可能有 images（图片生成后追加）
type WithImages = {
  images?: Array<{ type: string; url?: string }>;
};
function getAssetImageUrl(asset: WithImages | undefined): string | undefined {
  return asset?.images?.find((img) => img.type === "main")?.url;
}

// 执行视频生成（单图参考模式）：使用分镜主图
async function doGenerateVideoSingle(storyboardId: string) {
  const sb = storyboards.value.find((s) => s.id === storyboardId);
  const modelId = sb?.videoModelId || selectedVideoModel.value || undefined;
  const mainImg = sb?.images?.find((img) => img.type === "main");
  const imageUrl = mainImg?.url;
  if (!imageUrl) {
    message.error("该分镜尚未生成图片，请先生成分镜图片再生成视频");
    return;
  }
  try {
    await scriptEditStore.generateStoryboardVideo(storyboardId, {
      modelId,
      imageUrl,
    });
    message.success("视频生成任务已提交");
  } catch (error) {
    message.error("视频生成失败，请稍后重试");
    console.error("生成分镜视频失败:", error);
    // 更新分镜视频生成状态为失败
    const idx = storyboards.value.findIndex((s) => s.id === storyboardId);
    if (idx !== -1) {
      // BUG 修复：使用 toRaw 获取原始数据
      storyboards.value[idx] = {
        ...toRaw(storyboards.value[idx]),
        videoGeneration: {
          prompt: storyboards.value[idx].videoGeneration?.prompt || "",
          status: "failed",
          videoUrl: undefined,
          taskId: undefined,
        },
      };
    }
  }
}

// 执行视频生成（多图参考模式）：收集所有素材图 + 用户上传的视频参考图
async function doGenerateVideoMulti(storyboardId: string) {
  const sb = storyboards.value.find((s) => s.id === storyboardId);
  const modelId = sb?.videoModelId || selectedVideoModel.value || undefined;

  // 收集素材图片 URL（角色/场景/道具）
  const imageUrls: string[] = [];

  // Bug 修复：同时支持 id 和 characterId 查找
  (sb?.characterIds || []).forEach((id) => {
    const char = scriptEditStore.steps.characters.items.find(
      (c) => c.id === id || c.characterId === id,
    );
    const url = getAssetImageUrl(char as WithImages);
    if (url) imageUrls.push(url);
  });

  if (sb?.sceneId) {
    // Bug 修复：同时支持 id 和 sceneId 查找
    const scene = scriptEditStore.steps.scenes.items.find(
      (s) => s.id === sb.sceneId || s.sceneId === sb.sceneId,
    );
    const url = getAssetImageUrl(scene as WithImages);
    if (url) imageUrls.push(url);
  }

  // Bug 修复：同时支持 id 和 propId 查找
  (sb?.propIds || []).forEach((id) => {
    const prop = scriptEditStore.steps.props.items.find(
      (p) => p.id === id || p.propId === id
    );
    const url = getAssetImageUrl(prop as WithImages);
    if (url) imageUrls.push(url);
  });

  // 收集用户上传的视频参考图（type=video_reference）
  const videoRefImages = (sb?.images || [])
    .filter((img) => img.type === "video_reference")
    .map((img) => img.url)
    .filter(Boolean) as string[];
  imageUrls.push(...videoRefImages);

  if (imageUrls.length === 0) {
    message.error(
      "未找到任何可用的参考图片，请确保角色/场景/道具已生成图片，或上传视频参考图",
    );
    return;
  }

  try {
    await scriptEditStore.generateStoryboardVideo(storyboardId, {
      modelId,
      imageUrls,
    });
    message.success("视频生成任务已提交");
  } catch (error) {
    message.error("视频生成失败，请稍后重试");
    console.error("生成分镜视频失败:", error);
    // 更新分镜视频生成状态为失败
    const idx = storyboards.value.findIndex((s) => s.id === storyboardId);
    if (idx !== -1) {
      // BUG 修复：使用 toRaw 获取原始数据
      storyboards.value[idx] = {
        ...toRaw(storyboards.value[idx]),
        videoGeneration: {
          prompt: storyboards.value[idx].videoGeneration?.prompt || "",
          status: "failed",
          videoUrl: undefined,
          taskId: undefined,
        },
      };
    }
  }
}

// BUG-06：生成分镜视频（含资源图片检查，按参考模式区分）
async function handleGenerateVideo(storyboardId: string) {
  if (!props.projectId || !props.scriptId) return;

  const sb = storyboards.value.find((s) => s.id === storyboardId);
  if (!sb) return;

  const referenceMode =
    (sb as { referenceMode?: "single_reference" | "multi_reference" })
      .referenceMode ?? "multi_reference";

  // 收集缺少图片的资源名称（用于错误提示）
  const missingImages: string[] = [];

  // Bug 修复：同时支持 id 和 characterId 查找
  (sb.characterIds || []).forEach((id) => {
    const char = scriptEditStore.steps.characters.items.find(
      (c) => c.id === id || c.characterId === id,
    );
    if (char && !getAssetImageUrl(char as WithImages)) {
      // Phase 4：从 resolvedAssets 获取 name，fallback 到 char.name
      const charName = scriptEditStore.getResolvedCharacterById(char.characterId)?.name
        ?? (char as { name?: string }).name;
      missingImages.push(`角色「${charName || id.slice(0, 8)}」`);
    }
  });

  if (sb.sceneId) {
    // Bug 修复：同时支持 id 和 sceneId 查找
    const scene = scriptEditStore.steps.scenes.items.find(
      (s) => s.id === sb.sceneId || s.sceneId === sb.sceneId,
    );
    if (scene && !getAssetImageUrl(scene as WithImages)) {
      // Phase 4：从 resolvedAssets 获取 name，fallback 到 scene.name
      const sceneName = scriptEditStore.getResolvedSceneById(scene.sceneId)?.name
        ?? (scene as { name?: string }).name;
      missingImages.push(`场景「${sceneName || sb.sceneId.slice(0, 8)}」`);
    }
  }

  // Bug 修复：同时支持 id 和 propId 查找
  (sb.propIds || []).forEach((id) => {
    const prop = scriptEditStore.steps.props.items.find(
      (p) => p.id === id || p.propId === id
    );
    if (prop && !getAssetImageUrl(prop as WithImages)) {
      // Phase 4：从 resolvedAssets 获取 name，fallback 到 prop.name
      const propName = scriptEditStore.getResolvedPropById(prop.propId)?.name
        ?? (prop as { name?: string }).name;
      missingImages.push(`道具「${propName || id.slice(0, 8)}」`);
    }
  });

  if (referenceMode === "single_reference") {
    // 单图参考模式：必须有分镜主图
    const hasStoryboardImage = sb.images?.some((img) => img.type === "main");
    if (!hasStoryboardImage) {
      message.error(
        "单图参考模式需要先生成分镜图片，请先生成分镜图片再生成视频",
      );
      return;
    }
    // 资源图片检查（用于生成时参考，但不强制）
    if (missingImages.length > 0) {
      message.warning(
        `以下资源尚未生成图片，可能影响生成效果：${missingImages.join("。")}`,
      );
    }
    await doGenerateVideoSingle(storyboardId);
  } else {
    // 多图参考模式（multi_reference）：所有素材图片必须已生成
    if (missingImages.length > 0) {
      message.error(
        `多图参考模式需要所有素材图片，以下资源尚未生成：${missingImages.join("。")}`,
      );
      return;
    }
    await doGenerateVideoMulti(storyboardId);
  }
}

// BUG-07：AI生成分镜对话
async function handleGenerateDialogue(storyboardId: string) {
  if (!props.projectId || !props.scriptId) return;
  try {
    await scriptEditStore.generateStoryboardDialogue(storyboardId);
    message.success("对话生成成功");
    // 生成完成后立即保存（对白已写入 store，需要持久化到后端）
    await doSaveStoryboards();
  } catch (error) {
    message.error("对话生成失败，请稍后重试");
    console.error("生成分镜对话失败:", error);
  }
}

// 上传分镜参考图
async function handleUploadReference(storyboardId: string, file: File) {
  try {
    await scriptEditStore.uploadShotGroupReferenceImage(storyboardId, file);
    message.success("参考图上传成功");
  } catch (error) {
    message.error("参考图上传失败，请稍后重试");
    console.error("上传分镜参考图失败:", error);
  }
}

// 删除分镜参考图
async function handleDeleteReference(storyboardId: string, imageId: string) {
  try {
    await scriptEditStore.deleteShotGroupImage(storyboardId, imageId);
    message.success("参考图已删除");
  } catch (error) {
    message.error("删除参考图失败，请稍后重试");
    console.error("删除分镜参考图失败:", error);
  }
}

// 上传视频参考图
async function handleUploadVideoReference(storyboardId: string, file: File) {
  try {
    await scriptEditStore.uploadShotGroupVideoReferenceImage(storyboardId, file);
    message.success("视频参考图上传成功");
  } catch (error) {
    message.error("视频参考图上传失败，请稍后重试");
    console.error("上传分镜视频参考图失败:", error);
  }
}

// 删除视频参考图
async function handleDeleteVideoReference(
  storyboardId: string,
  imageId: string,
) {
  try {
    await scriptEditStore.deleteShotGroupImage(storyboardId, imageId);
    message.success("视频参考图已删除");
  } catch (error) {
    message.error("删除视频参考图失败，请稍后重试");
    console.error("删除分镜视频参考图失败:", error);
  }
}

// 上传分镜主图
async function handleUploadMainImage(storyboardId: string, file: File) {
  try {
    await scriptEditStore.uploadShotGroupMainImage(storyboardId, file);
    message.success("分镜图上传成功");
  } catch (error) {
    message.error("分镜图上传失败，请稍后重试");
    console.error("上传分镜主图失败:", error);
  }
}

// 音频生成状态
const audioGeneratingId = ref<string | null>(null);

// 生成对话音频
async function handleGenerateAudio(storyboardId: string, dialogueId: string, voiceId?: string) {
  if (!props.projectId || !props.scriptId) {
    return;
  }

  audioGeneratingId.value = dialogueId;

  try {
    await scriptEditStore.generateDialogueAudio(storyboardId, dialogueId, { voiceId });
    message.success("音频生成成功");

    // 后端已自动计算并同步 shotGroup.duration 到 store
    // 前端只需在 video_only / audio_reference 模式下检查是否超出模型最大时长并提示
    const storyboard = storyboards.value.find((s) => s.id === storyboardId);
    if (storyboard) {
      const videoMode = storyboard.videoMode || 'lip_sync';
      if (videoMode === 'video_only' || videoMode === 'audio_reference') {
        // 检查视频模型支持的最大时长
        const videoModelId = storyboard.videoModelId || selectedVideoModel.value;
        const params = scriptModelsStore.getModelDefaultParams(videoModelId || '');
        const durationList = (params.duration ?? params.durations ?? []) as number[];
        const maxDuration = durationList.length > 0 ? Math.max(...durationList) : 10;

        // 超出限制时仅警告，不自动截断，由用户自行调整
        if (storyboard.duration > maxDuration) {
          message.warning(
            `当前分镜音频总时长 ${storyboard.duration} 秒超出视频模型最大时长 ${maxDuration} 秒，建议删减对话或选择支持更长时长的模型`,
          );
        }

        // Store 已替换整个 items 数组，StoryboardStep 的 watch 会自动触发 debounce save
        // 无需手动调用 doSaveStoryboards()，避免重复 PUT
      }
    }
  } catch (error) {
    message.error("音频生成失败，请稍后重试");
    console.error("生成对话音频失败:", error);
  } finally {
    audioGeneratingId.value = null;
  }
}

// 删除对话音频
async function handleDeleteAudio(storyboardId: string, dialogueId: string) {
  if (!props.projectId || !props.scriptId) return;

  try {
    await scriptEditStore.deleteDialogueAudio(storyboardId, dialogueId);
    message.success("音频已删除");

    // Store 的 deleteDialogueAudio 已替换整个 items 数组
    // StoryboardStep 的 watch 会自动触发 debounce save，无需手动调用
  } catch (error) {
    message.error("删除音频失败，请稍后重试");
    console.error("删除对话音频失败:", error);
  }
}

// shotGroups 新增：打开角色框选面板
// 弹窗状态
const showRegionPanel = ref(false);
const currentShotGroupId = ref<string | null>(null);

// 手动框选弹窗状态
const showManualRegionModal = ref(false);
const manualSelectCharacterId = ref<string | null>(null);
const manualSelectCharacterName = ref<string>("");
// Bug-1 修复：存储初始框选区域
const manualSelectInitialRegion = ref<{ x: number; y: number; width: number; height: number } | undefined>(undefined);

// 获取当前分镜组数据
const currentShotGroup = computed(() => {
  if (!currentShotGroupId.value) return null;
  return storyboards.value.find((s) => s.id === currentShotGroupId.value);
});

// 获取当前分镜组的主图 URL
const currentMainImageUrl = computed(() => {
  if (!currentShotGroup.value) return undefined;
  const mainImg = currentShotGroup.value.images?.find((img) => img.type === "main");
  return mainImg?.url;
});

// 获取当前分镜组的出镜角色信息
// Bug 修复：同时支持 id 和 characterId 查找，解决素材显示 ID 问题
const currentCharacters = computed(() => {
  if (!currentShotGroup.value?.characterIds) return [];
  return currentShotGroup.value.characterIds
    .map((charId) => {
      // 修复：同时支持 id（前端临时ID）和 characterId（数据库UUID）查找
      const char = scriptEditStore.steps.characters.items.find(
        (c) => c.id === charId || c.characterId === charId
      );
      const charFromMap = scriptEditStore.characterMap.get(charId);
      // Phase 4: images 是运行时追加字段，需要类型断言
      const charRuntime = char as { images?: Array<{ type: string; url?: string }> };
      const charFromMapRuntime = charFromMap as { images?: Array<{ type: string; url?: string }> };
      // 从 images 中获取头像 URL
      const avatarUrl = charRuntime?.images?.find((img: { type: string }) => img.type === "main")?.url ||
        charFromMapRuntime?.images?.find((img: { type: string }) => img.type === "main")?.url;
      // Phase 4：从 resolvedAssets 获取 name（characterId 是素材库 UUID）
      const resolvedName = char?.characterId
        ? scriptEditStore.getResolvedCharacterById(char.characterId)?.name
        : undefined;
      return {
        id: charId,
        name: resolvedName || (charFromMap as { name?: string })?.name || `角色(${charId.slice(0, 8)}...)`,
        avatarUrl,
      };
    })
    .filter((c) => c.name);
});

// 获取当前分镜组的角色框选配置
const currentCharacterRegions = computed(() => {
  if (!currentShotGroup.value) return {};
  const regions = (currentShotGroup.value as unknown as { characterRegions?: Record<string, unknown> }).characterRegions;
  return (regions || {}) as import("@pixaura/shared-types").CharacterRegions;
});

// 当前分镜组的检测状态
const currentDetectionStatus = computed(() => {
  if (!currentShotGroup.value) return "pending";
  return (currentShotGroup.value as unknown as { detectionStatus?: "pending" | "processing" | "completed" | "failed" }).detectionStatus || "pending";
});

// 当前分镜组检测到的主体（使用 region 字段）
const currentDetectedSubjects = computed(() => {
  if (!currentShotGroup.value) return undefined;
  const subjects = (currentShotGroup.value as unknown as { detectedSubjects?: Array<{
    index: number;
    region: { x: number; y: number; width: number; height: number };
    area?: number;
  }> }).detectedSubjects;
  return subjects as import("@pixaura/shared-types").DetectedSubject[] | undefined;
});

// 是否正在检测
const isDetecting = ref(false);

// 分镜视频生成状态映射（shotId -> boolean）
const shotGeneratingMap = ref<Record<string, boolean>>({});
// 分镜视频生成进度映射（shotId -> number）
const shotProgressMap = ref<Record<string, number>>({});

// 监听 shots 状态变化，清除已完成/失败的生成状态
watch(
  () => storyboards.value.map((s) => s.shots).flat(),
  (allShots) => {
    if (!allShots) return;
    allShots.forEach((shot) => {
      if (!shot) return;
      // 当状态变为 completed 或 failed 时，清除 shotGeneratingMap
      if (
        (shot.status === "completed" || shot.status === "failed") &&
        shotGeneratingMap.value[shot.id]
      ) {
        delete shotGeneratingMap.value[shot.id];
      }
    });
  },
  { deep: true },
);

// 监听自动弹出框选面板信号
watch(
  () => scriptEditStore.autoOpenRegionPanelSignal,
  (signal) => {
    if (!signal) return;

    // 打开面板
    handleOpenRegionPanel(signal.shotGroupId);

    // 清除信号（避免重复触发）
    scriptEditStore.autoOpenRegionPanelSignal = null;
  },
);

function handleOpenRegionPanel(shotGroupId: string) {
  currentShotGroupId.value = shotGroupId;
  showRegionPanel.value = true;
}

// 处理弹窗关闭：记录用户主动关闭状态
function handleRegionPanelClose() {
  if (currentShotGroupId.value) {
    scriptEditStore.markRegionPanelUserClosed(currentShotGroupId.value);
  }
}

// 处理主体检测
async function handleStartDetection(shotGroupId: string) {
  if (!props.projectId || !props.scriptId) return;

  // 清除用户关闭标记（重新检测时重置状态）
  scriptEditStore.clearRegionPanelUserClosed(shotGroupId);

  // 立即更新状态为 processing，确保 loading 状态立即显示
  const idx = storyboards.value.findIndex((s) => s.id === shotGroupId);
  if (idx !== -1) {
    storyboards.value[idx] = {
      ...toRaw(storyboards.value[idx]),
      detectionStatus: "processing",
    } as StoryboardRef;
  }

  isDetecting.value = true;
  try {
    const response = await scriptApi.detectSubjects(props.projectId, props.scriptId, shotGroupId);
    const result = response.data;
    message.success("主体检测已启动");

    // 更新本地状态
    if (idx !== -1) {
      storyboards.value[idx] = {
        ...toRaw(storyboards.value[idx]),
        detectionStatus: result.status,
        detectedSubjects: result.detectedSubjects,
      } as StoryboardRef;
    }

    // 保存到后端
    await doSaveStoryboards();
  } catch (error) {
    // 解析后端返回的错误信息，提供更明确的解决方案提示
    const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (error as Error).message;

    // 更新本地状态为失败
    if (idx !== -1) {
      storyboards.value[idx] = {
        ...toRaw(storyboards.value[idx]),
        detectionStatus: "failed",
      } as StoryboardRef;
    }

    // 检测特定错误关键词，提示用户启动 ngrok
    if (errorMessage.includes('ngrok') || errorMessage.includes('公网')) {
      message.error("本地模式需要启动 ngrok 才能使用主体检测功能。请在终端运行: ngrok http 3000");
    } else {
      message.error(`主体检测失败: ${errorMessage}`);
    }
    console.error("主体检测失败:", error);
  } finally {
    isDetecting.value = false;
  }
}

// 处理生成对口型视频（添加 options 参数）
// options 包含前端已处理的 croppedImageUrl 和 audioUrl
async function handleGenerateShotVideo(
  shotGroupId: string,
  shotId: string,
  characterId: string,
  options?: { croppedImageUrl?: string; audioUrl?: string }
) {
  if (!props.projectId || !props.scriptId) return;

  // 检查 characterId
  if (!characterId) {
    message.error("角色ID缺失，请检查对话数据");
    return;
  }

  // 设置生成状态
  shotGeneratingMap.value[shotId] = true;
  shotProgressMap.value[shotId] = 0;

  try {
    // 获取当前分镜组的 lipSyncModelId
    const shotGroup = storyboards.value.find((s) => s.id === shotGroupId);
    const modelId = shotGroup?.lipSyncModelId || selectedLipSyncModel.value;

    await scriptApi.generateLipSyncVideo(
      props.projectId,
      props.scriptId,
      shotGroupId,
      shotId,
      {
        modelId,
        characterId,
        // 传递前端已处理的 URL（如果存在）
        croppedImageUrl: options?.croppedImageUrl,
        audioUrl: options?.audioUrl,
      },
    );
    message.success("对口型视频生成任务已提交");

    // 更新本地状态
    const sbIdx = storyboards.value.findIndex((s) => s.id === shotGroupId);
    if (sbIdx !== -1) {
      const shots = (storyboards.value[sbIdx] as unknown as { shots?: Array<{ id: string; status: string }> }).shots || [];
      const shotIdx = shots.findIndex((sh) => sh.id === shotId);
      if (shotIdx !== -1) {
        shots[shotIdx].status = "processing";
      }
    }

    // TODO: 订阅 WebSocket 事件获取进度更新
  } catch (error) {
    message.error("对口型视频生成失败，请稍后重试");
    console.error("对口型视频生成失败:", error);
    // 清除生成状态
    shotGeneratingMap.value[shotId] = false;
  }
}

// 处理弹窗中的主体检测触发
function handlePanelTriggerDetection(shotGroupId: string) {
  handleStartDetection(shotGroupId);
}

// 处理弹窗中的角色框选配置更新
async function handlePanelUpdateRegion(shotGroupId: string, characterId: string, config: import("@pixaura/shared-types").CharacterRegionConfig) {
  // Bug 修复：使用传入的 shotGroupId 参数，而不是依赖 currentShotGroupId
  if (!shotGroupId) {
    console.warn("[handlePanelUpdateRegion] shotGroupId 为空");
    return;
  }

  const idx = storyboards.value.findIndex((s) => s.id === shotGroupId);
  if (idx !== -1) {
    const currentRegions = (storyboards.value[idx] as unknown as { characterRegions?: import("@pixaura/shared-types").CharacterRegions }).characterRegions || {};
    const updatedRegions: import("@pixaura/shared-types").CharacterRegions = {
      ...currentRegions,
      [characterId]: config,
    };

    // Bug-9: 同步更新所有对话中对应角色的角色框选配置
    const currentDialogues = storyboards.value[idx].dialogues || [];
    const updatedDialogues = currentDialogues.map(dialogue => {
      // 只更新有对应角色的对话
      if (dialogue.characterId === characterId) {
        return {
          ...dialogue,
          characterRegions: {
            ...(dialogue.characterRegions || {}),
            [characterId]: config,
          },
        };
      }
      return dialogue;
    });

    storyboards.value[idx] = {
      ...toRaw(storyboards.value[idx]),
      characterRegions: updatedRegions,
      dialogues: updatedDialogues,
    } as StoryboardRef;

    // 保存到后端
    try {
      await scriptApi.updateCharacterRegions(
        props.projectId,
        props.scriptId,
        shotGroupId,
        { regions: updatedRegions },
      );
    } catch (error) {
      message.error("更新框选配置失败");
      console.error("更新框选配置失败:", error);
    }
  }
}

// 处理弹窗中的手动框选
// Bug-2 修复：添加 shotGroupId 参数，不再依赖 currentShotGroupId
// Bug-1 修复：获取角色现有的框选配置作为初始值
function handlePanelOpenManualSelect(shotGroupId: string, characterId: string) {
  // 从 storyboards 中查找对应分镜组的主图
  const shotGroup = storyboards.value.find((s) => s.id === shotGroupId);
  if (!shotGroup) {
    message.warning("未找到对应的分镜组");
    return;
  }

  const mainImg = shotGroup.images?.find((img) => img.type === "main");
  if (!mainImg?.url) {
    message.warning("当前分镜没有主图，无法进行手动框选");
    return;
  }

  // 设置当前操作的 shotGroupId 和 characterId
  currentShotGroupId.value = shotGroupId;
  manualSelectCharacterId.value = characterId;

  // 获取角色名称
  const character = currentCharacters.value.find((c) => c.id === characterId);
  manualSelectCharacterName.value = character?.name || "角色";

  // Bug-1 修复：获取角色现有的框选配置作为初始值
  const characterRegions = (shotGroup as unknown as { characterRegions?: import("@pixaura/shared-types").CharacterRegions }).characterRegions;
  const existingConfig = characterRegions?.[characterId];
  if (existingConfig?.useManual && existingConfig.manualRegion) {
    manualSelectInitialRegion.value = existingConfig.manualRegion;
  } else {
    manualSelectInitialRegion.value = undefined;
  }

  showManualRegionModal.value = true;
}

// 处理手动框选确认 - 只存储坐标
async function handleManualRegionConfirm(
  region: { x: number; y: number; width: number; height: number },
  _maskDataUrl: string, // 保留参数以兼容，但不再使用
) {
  if (!currentShotGroupId.value || !manualSelectCharacterId.value) return;

  // 只上传坐标，后端根据坐标处理
  try {
    const response = await scriptApi.uploadManualRegion(
      props.projectId,
      props.scriptId,
      currentShotGroupId.value,
      {
        characterId: manualSelectCharacterId.value,
        region,
      },
    );

    // Bug 修复：直接更新本地 store，避免二次调用 API 导致数据不一致
    // uploadManualRegion API 已经将数据保存到数据库，只需更新本地状态
    // 注意：API 响应拦截器已经解包响应，response 直接是 { shotGroupId, characterId, region }
    const typedResponse = response as unknown as { shotGroupId: string; characterId: string; region: { x: number; y: number; width: number; height: number } };
    const idx = storyboards.value.findIndex((s) => s.id === currentShotGroupId.value);
    if (idx !== -1) {
      const currentRegions = (storyboards.value[idx] as unknown as { characterRegions?: import("@pixaura/shared-types").CharacterRegions }).characterRegions || {};
      const updatedRegions: import("@pixaura/shared-types").CharacterRegions = {
        ...currentRegions,
        [manualSelectCharacterId.value]: {
          useManual: true,
          manualRegion: typedResponse.region,
        },
      };

      storyboards.value[idx] = {
        ...toRaw(storyboards.value[idx]),
        characterRegions: updatedRegions,
      } as StoryboardRef;
    }

    message.success("手动框选已保存");
  } catch (error) {
    message.error("保存框选配置失败");
    console.error("保存框选配置失败:", error);
  }

  showManualRegionModal.value = false;
}

// 角色颜色数组（用于区分不同角色的框选区域）
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
function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

// 获取角色框选区域用于显示
function getCharacterRegionForDisplay(characterId: string): { x: number; y: number; width: number; height: number } | undefined {
  if (!currentShotGroup.value) return undefined;
  const regions = (currentShotGroup.value as unknown as { characterRegions?: import("@pixaura/shared-types").CharacterRegions }).characterRegions;
  const config = regions?.[characterId];
  if (!config) return undefined;

  if (config.useManual && config.manualRegion) {
    return config.manualRegion;
  }
  if (config.detectedIndex && currentDetectedSubjects.value) {
    const subject = currentDetectedSubjects.value.find(s => s.index === config.detectedIndex);
    if (subject?.region) {
      return subject.region;
    }
  }
  return undefined;
}

// 检查角色是否使用手动框选
function isUsingManualForDisplay(characterId: string): boolean {
  if (!currentShotGroup.value) return false;
  const regions = (currentShotGroup.value as unknown as { characterRegions?: import("@pixaura/shared-types").CharacterRegions }).characterRegions;
  return regions?.[characterId]?.useManual || false;
}
</script>

<template>
  <workflow-step
    step-id="storyboards"
    title="分镜生成"
    :step-number="5"
    :description="stepDescription"
    :status="stepStatus"
    :progress="parseProgress"
    :show-progress-bar="true"
    :action-buttons="actionButtons"
    show-model-selector
    @action="handleAction"
  >
    <template #modelSelector>
      <div class="model-config-row">
        <!-- 图像生成模型 -->
        <n-tooltip
          :disabled="hasImageModels || isLoadingModels"
          placement="top"
        >
          <template #trigger>
            <div
              class="model-block"
              title="图像生成模型"
            >
              <div class="model-block-icon blue">
                <n-icon size="14">
                  <Image />
                </n-icon>
              </div>
              <n-select
                v-model:value="selectedImageModel"
                :options="imageModelOptions"
                placeholder="图像生成"
                size="tiny"
                :consistent-menu-width="false"
                :disabled="isLoadingModels || !hasImageModels"
                :loading="isLoadingModels"
                :render-label="renderModelOptionWithPrice"
              />
            </div>
          </template>
          暂无可用的图像生成模型，请联系管理员配置
        </n-tooltip>

        <!-- 视频生成模型 -->
        <n-tooltip
          :disabled="hasVideoModels || isLoadingModels"
          placement="top"
        >
          <template #trigger>
            <div
              class="model-block"
              title="视频生成模型"
            >
              <div class="model-block-icon green">
                <n-icon size="14">
                  <Videocam />
                </n-icon>
              </div>
              <n-select
                v-model:value="selectedVideoModel"
                :options="videoModelOptions"
                placeholder="视频生成"
                size="tiny"
                :consistent-menu-width="false"
                :disabled="isLoadingModels || !hasVideoModels"
                :loading="isLoadingModels"
                :render-label="renderModelOptionWithPrice"
              />
            </div>
          </template>
          暂无可用的视频生成模型，请联系管理员配置
        </n-tooltip>

        <!-- 对口型模型 -->
        <n-tooltip
          :disabled="hasLipSyncModels || isLoadingModels"
          placement="top"
        >
          <template #trigger>
            <div
              class="model-block"
              title="对口型模型"
            >
              <div class="model-block-icon orange">
                <n-icon size="14">
                  <Mic />
                </n-icon>
              </div>
              <n-select
                v-model:value="selectedLipSyncModel"
                :options="lipSyncModelOptions"
                placeholder="对口型"
                size="tiny"
                :consistent-menu-width="false"
                :disabled="isLoadingModels || !hasLipSyncModels"
                :loading="isLoadingModels"
                :render-label="renderModelOptionWithPrice"
              />
            </div>
          </template>
          暂无可用的对口型模型，请联系管理员配置
        </n-tooltip>
      </div>
    </template>

    <div class="storyboard-step-content">
      <!-- 分镜列表 -->
      <div
        v-if="hasStoryboards"
        class="storyboard-list-container"
      >
        <div class="storyboard-cards">
          <storyboard-card
            v-for="(element, index) in storyboards"
            :key="element.id"
            :data="element"
            :index="index"
            :character-options="characterOptions"
            :scene-options="sceneOptions"
            :prop-options="propOptions"
            :image-model-options="imageModelOptions"
            :video-model-options="videoModelOptions"
            :lip-sync-model-options="lipSyncModelOptions"
            :default-image-model-id="selectedImageModel"
            :default-video-model-id="selectedVideoModel"
            :default-lip-sync-model-id="selectedLipSyncModel"
            :project-id="projectId"
            :script-id="scriptId"
            :image-generating="stepState.imageGeneratingIds.has(element.id)"
            :image-generation-progress="
              stepState.imageGenerationProgress[element.id] ?? 0
            "
            :image-generation-error="
              stepState.imageGenerationErrors[element.id] ?? ''
            "
            :dialogue-generating="
              stepState.dialogueGeneratingIds.has(element.id)
            "
            :audio-generating="audioGeneratingId"
            :video-generating="
              element.videoGeneration?.status === 'pending' ||
                element.videoGeneration?.status === 'processing'
            "
            :video-generation-progress="(element as any).videoGeneration?.progress ?? 0"
            :aspect-ratio="storyboardAspectRatio"
            :voices="ttsStore.voices"
            :voices-loading="ttsStore.voicesLoading"
            :character-voice-map="characterVoiceMap"
            :narration-voice-id="narrationVoiceId"
            :narration-voice-name="narrationVoiceName"
            :shots="(element as any).shots"
            :detection-status="(element as any).detectionStatus"
            :detection-error="(element as any).detectionError"
            :character-regions="(element as any).characterRegions"
            :shot-generating-map="shotGeneratingMap"
            :shot-progress-map="shotProgressMap"
            @update="handleUpdateStoryboard"
            @mode-change="handleModeChange"
            @delete="handleDeleteStoryboard"
            @duplicate="handleDuplicateStoryboard"
            @move="handleMoveStoryboard"
            @dialogue-update="handleDialogueUpdate"
            @image-model-change="handleImageModelChange"
            @video-model-change="handleVideoModelChange"
            @lip-sync-model-change="handleLipSyncModelChange"
            @generate-image="handleGenerateImage"
            @generate-video="handleGenerateVideo"
            @generate-dialogue="handleGenerateDialogue"
            @upload-reference="handleUploadReference"
            @delete-reference="handleDeleteReference"
            @upload-video-reference="handleUploadVideoReference"
            @delete-video-reference="handleDeleteVideoReference"
            @upload-main-image="handleUploadMainImage"
            @generate-audio="handleGenerateAudio"
            @delete-audio="handleDeleteAudio"
            @open-region-panel="handleOpenRegionPanel"
            @start-detection="handleStartDetection"
            @update-region="handlePanelUpdateRegion"
            @open-manual-select="handlePanelOpenManualSelect"
            @generate-shot-video="handleGenerateShotVideo"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <n-empty
        v-else
        :description="emptyStateDescription"
        class="empty-state"
      >
        <template #icon>
          <n-icon
            size="48"
            color="#ccc"
          >
            <Film />
          </n-icon>
        </template>
      </n-empty>

      <!-- 添加按钮 -->
      <div class="add-button-wrapper">
        <n-button
          dashed
          size="large"
          style="width: 100%"
          @click="handleAddStoryboard"
        >
          <template #icon>
            <n-icon><Add /></n-icon>
          </template>
          添加分镜
        </n-button>
      </div>
    </div>
  </workflow-step>

  <!-- 角色框选面板弹窗 - 内嵌布局，显示在图片右侧 -->
  <n-modal
    v-model:show="showRegionPanel"
    preset="card"
    title="角色框选"
    style="width: 900px; max-width: 95vw"
    :bordered="false"
    :mask-closable="true"
    @after-leave="handleRegionPanelClose"
  >
    <div
      v-if="currentShotGroupId"
      class="region-panel-layout"
    >
      <!-- 左侧：图片预览 -->
      <div class="region-panel-left">
        <div
          class="region-panel-image-wrapper"
          :style="{ aspectRatio: storyboardAspectRatio }"
        >
          <n-image
            v-if="currentMainImageUrl"
            :src="currentMainImageUrl"
            alt="分镜主图"
            object-fit="cover"
            class="region-panel-image"
          />
          <div
            v-else
            class="region-panel-no-image"
          >
            <n-empty description="暂无分镜主图" />
          </div>
          <!-- 框选区域显示 -->
          <template v-if="currentMainImageUrl">
            <RegionOverlay
              v-for="subject in currentDetectedSubjects"
              :key="subject.index"
              :region="subject.region"
              :is-manual="false"
              :label="`主体 ${subject.index}`"
              :show-label="true"
            />
            <!-- 显示已配置的角色框选区域 -->
            <template v-for="(char, index) in currentCharacters" :key="char.id">
              <RegionOverlay
                v-if="getCharacterRegionForDisplay(char.id)"
                :region="getCharacterRegionForDisplay(char.id)!"
                :is-manual="isUsingManualForDisplay(char.id)"
                :label="char.name"
                :show-label="true"
                :color="getCharacterColor(index)"
              />
            </template>
          </template>
        </div>
      </div>

      <!-- 右侧：角色配置面板 -->
      <div class="region-panel-right">
        <CharacterRegionPanel
          :shot-group-id="currentShotGroupId"
          :main-image-url="currentMainImageUrl"
          :aspect-ratio="storyboardAspectRatio"
          :characters="currentCharacters"
          :detected-subjects="currentDetectedSubjects"
          :character-regions="currentCharacterRegions"
          :detection-status="currentDetectionStatus"
          :is-detecting="isDetecting"
          :is-readonly="false"
          compact-mode
          @trigger-detection="handlePanelTriggerDetection"
          @update-region="handlePanelUpdateRegion"
          @open-manual-select="handlePanelOpenManualSelect"
        />
      </div>
    </div>
  </n-modal>

  <!-- 手动框选弹窗 -->
  <manual-region-modal
    v-if="currentMainImageUrl"
    :show="showManualRegionModal"
    :image-url="currentMainImageUrl"
    :initial-region="manualSelectInitialRegion"
    :character-name="manualSelectCharacterName"
    :aspect-ratio="storyboardAspectRatio"
    @update:show="showManualRegionModal = $event"
    @confirm="handleManualRegionConfirm"
  />
</template>

<style scoped lang="scss">
.storyboard-step-content {
  padding: 8px 0;
}

.storyboard-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  padding: 40px 0;
}

.add-button-wrapper {
  margin-top: 16px;
}

// 模型配置行 - 卡片式布局
.model-config-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .model-block {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    transition: all 0.2s ease;

    &:hover {
      border-color: #d0d0d0;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .model-block-icon {
      font-size: 14px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;

      &.blue {
        background: #e6f4ff;
      }

      &.green {
        background: #e6ffed;
      }

      &.orange {
        background: #fff7e6;
      }
    }

    :deep(.n-base-selection) {
      min-width: 85px;
      border: none !important;
      background: transparent !important;

      .n-base-selection__border {
        display: none;
      }

      &:hover {
        background: transparent !important;
      }

      .n-base-selection-label,
      .n-base-selection-input {
        display: flex;
        align-items: center;
        white-space: nowrap !important;
      }

      .n-base-selection-label > .n-space {
        flex-wrap: nowrap !important;
      }
    }
  }

  .section-divider {
    width: 1px;
    height: 28px;
    background: #d0d0d0;
    margin: 0 4px;
  }
}

// 角色框选面板弹窗布局
.region-panel-layout {
  display: flex;
  gap: 20px;
  min-height: 400px;
}

.region-panel-left {
  flex: 0 0 400px;
  display: flex;
  flex-direction: column;
}

.region-panel-image-wrapper {
  position: relative;
  width: 100%;
  max-height: 500px;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
}

.region-panel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.region-panel-no-image {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.region-panel-right {
  flex: 1;
  min-width: 0;
}
</style>

/**
 * 核心状态管理
 * 提供基础 state 定义和初始化方法
 */
import type { Ref } from "vue";
import { ref, computed } from "vue";
import type {
  ScriptDetailDto,
  CharacterRefWithImages,
  SceneRefWithImages,
  PropRefWithImages,
  CharacterDetailDto,
  SceneDetailDto,
  PropDetailDto,
} from "@pixaura/shared-types";
import type {
  ScriptStepState,
  AssetStepState,
  StoryboardStepState,
  AudioStepState,
  ExportStepState,
  TaskSubscription,
  CreationSettings,
  StepStatusType,
  ScriptEditV2State,
} from "../types";

/**
 * 创建初始状态
 */
export function createInitialState(): ScriptEditV2State {
  return {
    script: null,
    projectId: "",
    scriptId: "",

    steps: {
      script: createScriptStepState(),
      characters: createAssetStepState<CharacterRefWithImages>(),
      scenes: createAssetStepState<SceneRefWithImages>(),
      props: createAssetStepState<PropRefWithImages>(),
      storyboards: createStoryboardStepState(),
      audio: createAudioStepState(),
      export: createExportStepState(),
    },

    // 素材库完整数据映射（初始为空 Map）
    resolvedAssets: {
      characters: new Map<string, CharacterDetailDto>(),
      scenes: new Map<string, SceneDetailDto>(),
      props: new Map<string, PropDetailDto>(),
    },

    loading: false,
    currentStepId: "script",
    activeTasks: new Map(),
    creationSettings: {
      resolution: "9:16",
      genre: "drama",
    },
  };
}

/**
 * 创建剧本步骤初始状态
 */
export function createScriptStepState(): ScriptStepState {
  return {
    status: "pending",
    content: "",
    modelId: "",
    isEditing: false,
    hasUnsavedChanges: false,
    parseTaskId: undefined,
    parseProgress: 0,
    parseMessage: "",
    // 新增字段默认值
    acts: [],
    summary: "",
    dialogues: [],
  };
}

/**
 * 创建资产步骤初始状态
 */
export function createAssetStepState<T>(): AssetStepState<T> {
  return {
    status: "pending",
    items: [],
    modelId: "",
    selectedIds: [],
    scrollPosition: 0,
    imageGeneratingIds: new Set<string>(),
    imageGenerationProgress: {},
    imageGenerationErrors: {},
  };
}

/**
 * 创建分镜步骤初始状态
 */
export function createStoryboardStepState(): StoryboardStepState {
  return {
    status: "pending",
    items: [],
    modelId: "",
    isReordering: false,
    expandedItemIds: [],
    imageGeneratingIds: new Set<string>(),
    imageGenerationProgress: {},
    imageGenerationErrors: {},
    dialogueGeneratingIds: new Set<string>(),
    // 新增字段默认值
    defaultImageModelId: undefined,
    defaultVideoModelId: undefined,
    defaultLipSyncModelId: undefined,
    // 分镜解析状态（独立于资源解析）
    storyboardParseStatus: "pending",
  };
}

/**
 * 创建配乐步骤初始状态
 */
export function createAudioStepState(): AudioStepState {
  return {
    status: "pending",
    soundEffects: [],
    modelId: "",
  };
}

/**
 * 创建导出步骤初始状态
 */
export function createExportStepState(): ExportStepState {
  return {
    status: "pending",
    format: "mp4",
    quality: "1080p",
  };
}

/**
 * Store 核心 refs 容器
 */
export interface CoreStoreRefs {
  // 核心数据
  script: Ref<ScriptDetailDto | null>;
  projectId: Ref<string>;
  scriptId: Ref<string>;

  // 步骤状态
  steps: Ref<ScriptEditV2State["steps"]>;

  // 素材库完整数据映射
  resolvedAssets: Ref<ScriptEditV2State["resolvedAssets"]>;

  // UI 状态
  loading: Ref<boolean>;
  currentStepId: Ref<string>;
  activeTasks: Ref<Map<string, TaskSubscription>>;
  creationSettings: Ref<CreationSettings>;

  // WebSocket 相关
  wsListenersInitialized: Ref<boolean>;
  taskUpdateTokens: Ref<Map<string, string>>;

  // 快照备份（用于回滚）
  snapshot: Ref<ScriptEditV2State["steps"] | null>;

  // 资产 Map（用于快速 ID -> 名称查找）
  // Phase 4: Map 存储的是 CharacterRefWithImages 等（包含完整数据）
  characterMap: Ref<Map<string, CharacterRefWithImages>>;
  sceneMap: Ref<Map<string, SceneRefWithImages>>;
  propMap: Ref<Map<string, PropRefWithImages>>;
}

/**
 * 创建核心 refs
 */
export function createCoreRefs(): CoreStoreRefs {
  const initialState = createInitialState();

  return {
    script: ref(initialState.script),
    projectId: ref(initialState.projectId),
    scriptId: ref(initialState.scriptId),
    steps: ref(initialState.steps),
    resolvedAssets: ref(initialState.resolvedAssets),
    loading: ref(initialState.loading),
    currentStepId: ref(initialState.currentStepId),
    activeTasks: ref(initialState.activeTasks),
    creationSettings: ref(initialState.creationSettings),
    wsListenersInitialized: ref(false),
    taskUpdateTokens: ref(new Map()),
    // 快照备份
    snapshot: ref<ScriptEditV2State["steps"] | null>(null),
    // 资产 Map（用于快速 ID -> 名称查找）
    // Phase 4: Map 存储的是 CharacterRefWithImages 等（包含完整数据）
    characterMap: ref(new Map<string, CharacterRefWithImages>()),
    sceneMap: ref(new Map<string, SceneRefWithImages>()),
    propMap: ref(new Map<string, PropRefWithImages>()),
  };
}

/**
 * 创建核心 getters
 */
export function createCoreGetters(refs: CoreStoreRefs) {
  const { steps, loading, script } = refs;

  // 使用 loading 和 script 避免 unused variable 警告
  void loading;
  void script;

  const isLoading = computed(() => loading.value);

  const canEdit = computed(() => {
    return (
      script.value?.status === "editing" || script.value?.status === "draft"
    );
  });

  const isGenerating = computed(() => {
    return Object.values(steps.value).some(
      (step) => step.status === "processing",
    );
  });

  const completedStepsCount = computed(() => {
    return Object.values(steps.value).filter(
      (step) => step.status === "completed",
    ).length;
  });

  const totalStepsCount = computed(() => 7);

  const overallProgress = computed(() => {
    return Math.round(
      (completedStepsCount.value / totalStepsCount.value) * 100,
    );
  });

  return {
    isLoading,
    canEdit,
    isGenerating,
    completedStepsCount,
    totalStepsCount,
    overallProgress,
  };
}

/**
 * 创建核心 actions
 */
export function createCoreActions(refs: CoreStoreRefs) {
  const {
    projectId,
    scriptId,
    currentStepId,
    creationSettings,
    activeTasks,
    steps,
    snapshot,
  } = refs;

  /**
   * 设置项目ID和剧本ID
   */
  function setIds(pId: string, sId: string) {
    projectId.value = pId;
    scriptId.value = sId;
  }

  /**
   * 设置当前步骤
   */
  function setCurrentStep(stepId: string) {
    currentStepId.value = stepId;
  }

  /**
   * 更新创作设置
   */
  function updateCreationSettings(settings: Partial<CreationSettings>) {
    creationSettings.value = {
      ...creationSettings.value,
      ...settings,
    };
  }

  /**
   * 更新步骤状态
   */
  function updateStepStatus(
    stepId: string,
    status: StepStatusType,
    updates?: Partial<Record<string, unknown>>,
  ) {
    const stepKey = stepId as keyof typeof steps.value;
    const step = steps.value[stepKey];

    if (step) {
      step.status = status;
      if (updates) {
        Object.assign(step, updates);
      }
    }
  }

  /**
   * 创建快照备份（用于回滚）
   * 深拷贝当前 steps 状态，返回快照 ID
   */
  function createSnapshot(): string {
    // 深拷贝 steps 数据（使用 JSON 序列化确保完全独立）
    const snapshotData = JSON.parse(JSON.stringify(steps.value));
    snapshot.value = snapshotData;
    console.log("[createSnapshot] 快照已创建");
    return "snapshot";
  }

  /**
   * 从快照恢复数据（回滚）
   * 如果存在快照，则恢复 steps 状态
   */
  function restoreSnapshot(): boolean {
    if (!snapshot.value) {
      console.warn("[restoreSnapshot] 没有可恢复的快照");
      return false;
    }
    steps.value = JSON.parse(JSON.stringify(snapshot.value));
    console.log("[restoreSnapshot] 已从快照恢复");
    return true;
  }

  /**
   * 清除快照
   */
  function clearSnapshot(): void {
    snapshot.value = null;
  }

  /**
   * 重置 Store 状态
   */
  function resetState() {
    console.log("[resetState] 被调用，调用栈:");
    console.trace();
    projectId.value = "";
    scriptId.value = "";
    steps.value = createInitialState().steps;
    currentStepId.value = "script";
    creationSettings.value = {
      resolution: "9:16",
      genre: "drama",
    };

    // 取消所有任务订阅
    activeTasks.value.forEach((sub) => sub.unsubscribe());
    activeTasks.value.clear();

    // 清除快照
    snapshot.value = null;
  }

  return {
    setIds,
    setCurrentStep,
    updateCreationSettings,
    updateStepStatus,
    resetState,
    // 快照相关
    createSnapshot,
    restoreSnapshot,
    clearSnapshot,
  };
}

// ============================================================
// 保存请求串行队列（防并发覆盖）
// ============================================================
/**
 * 同 key 的保存请求串行执行 + 防抖合并：
 * - 多次入队同 key 时，只保留最后一次 builder（前面的被丢弃）
 * - 真正执行顺序由队列保证，避免后发请求基于陈旧状态覆盖前发的写入
 *
 * 用法：
 * ```ts
 * await enqueueUpdate(`script:${scriptId.value}`, () =>
 *   scriptApi.updateScript(projectId, scriptId, { content }),
 * );
 * ```
 *
 * 注意：调用方仍负责 createSnapshot/restoreSnapshot 等失败回滚逻辑，
 * 队列只保证执行顺序，不感知业务回滚语义。
 */
const updateQueues = new Map<string, Promise<unknown>>();
const pendingBuilders = new Map<string, () => Promise<unknown>>();

export function enqueueUpdate<T>(
  key: string,
  builder: () => Promise<T>,
): Promise<T | undefined> {
  // 同 key 后入队覆盖：只保留最后一次 builder
  pendingBuilders.set(key, builder as () => Promise<unknown>);

  const prev = updateQueues.get(key) ?? Promise.resolve();
  const next = prev.then(async () => {
    const fn = pendingBuilders.get(key);
    if (!fn) return undefined;
    pendingBuilders.delete(key);
    return await fn();
  });

  // 即使本次 builder 抛异常，也不能让队列断掉：catch 后继续保留链
  updateQueues.set(
    key,
    next.catch(() => undefined),
  );

  return next as Promise<T | undefined>;
}

/**
 * 仅供测试或重置场景使用：清空指定 key 的队列与待执行 builder。
 * 业务代码请勿调用。
 */
export function _resetUpdateQueue(key?: string): void {
  if (key === undefined) {
    updateQueues.clear();
    pendingBuilders.clear();
  } else {
    updateQueues.delete(key);
    pendingBuilders.delete(key);
  }
}

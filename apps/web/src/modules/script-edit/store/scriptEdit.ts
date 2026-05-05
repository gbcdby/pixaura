/**
 * 剧本编辑 Store
 *
 * 重构要点：
 * 1. 单一数据源：steps.value.*.items 是唯一编辑状态
 * 2. 模块化：资产/分镜/WebSocket 逻辑拆分到独立模块
 * 3. 清晰的 CRUD 接口
 */
import { defineStore } from "pinia";
import { ref, toRaw } from "vue";
import { scriptApi } from "@/modules/script/api";
import { characterApi } from "@/modules/character/api";
import { sceneApi } from "@/modules/scene/api";
import { propApi } from "@/modules/prop/api";
import type {
  ScriptDetailDto,
  CharacterRef,
  SceneRef,
  PropRef,
  CharacterRefWithImages,
  SceneRefWithImages,
  PropRefWithImages,
  AITaskDto,
  ScriptContent,
  ShotGroup,
  Shot,
  CharacterDetailDto,
  SceneDetailDto,
  PropDetailDto,
  ResolvedAssetResponse,
  AssetImage,
  BgmTrack,
  UpdateCharacterDto,
  UpdateSceneDto,
  UpdatePropDto,
} from "@pixaura/shared-types";
import { WsEventNames, ScriptContentSchema, DetectedSubject } from "@pixaura/shared-types";

// 导入类型
import type {
  StepStatusType,
  AssetStepState,
  TaskSubscription,
  DialogueItem,
  StoryboardRef,
  AssetStepKey,
  AssetType,
} from "./types";

// 导入模块
import {
  createCoreRefs,
  createCoreGetters,
  createCoreActions,
  createWsTaskManager,
  enqueueUpdate,
} from "./modules";

// 导入 composables
import {
  generateAssetImage as _generateAssetImage,
  batchGenerateAssetImages as _batchGenerateAssetImages,
  checkAndApplyDedup as _checkAndApplyDedup,
  updateAssetStepStatusFromImages as _updateAssetStepStatusFromImages,
  reactiveSetDelete,
  reactiveSetClear,
} from "../composables/useAssetGeneration";

import {
  generateStoryboardImage as _generateStoryboardImage,
  generateStoryboardVideo as _generateStoryboardVideo,
  generateStoryboardDialogue as _generateStoryboardDialogue,
  generateAllStoryboards as _generateAllStoryboards,
  generateStoryboardsFromScenes as _generateStoryboardsFromScenes,
} from "../composables/useStoryboard";

// 重新导出类型（保持向后兼容）
export type {
  StepStatusType,
  ScriptStepState,
  AssetStepState,
  StoryboardStepState,
  AudioStepState,
  ExportStepState,
  TaskSubscription,
  CreationSettings,
  ScriptEditV2State,
  DialogueItem,
  StoryboardRef,
  StoryboardImage,
  ReferenceMode,
  VideoMode,
  VideoGenerationInfo,
  SoundEffect,
  ExportFormatType,
  ExportQualityType,
  ResolutionType,
  FilmGenreType,
} from "./types";

// 重新导出常量（保持向后兼容）
export { RESOLUTION_OPTIONS, FILM_GENRE_OPTIONS } from "./constants";

/**
 * Phase 4: 图片转换函数
 * 将 CharacterDetailDto/SceneDetailDto/PropDetailDto 的复杂图片结构
 * 转换为简化的 AssetImage[] 数组格式
 */

// CharacterDetailDto.images 结构转换
function convertCharacterImagesToAssetImages(
  images: CharacterDetailDto["images"] | undefined,
): AssetImage[] {
  if (!images) return [];

  const result: AssetImage[] = [];

  // 添加主要视角图片
  if (images.frontView) {
    result.push({
      id: images.frontView.id,
      url: images.frontView.url,
      thumbnailUrl: images.frontView.thumbnailUrl ?? undefined,
      type: "main",
      createdAt: images.frontView.createdAt,
    });
  }
  if (images.sideView) {
    result.push({
      id: images.sideView.id,
      url: images.sideView.url,
      thumbnailUrl: images.sideView.thumbnailUrl ?? undefined,
      type: "angle",
      angleIndex: 1,
      createdAt: images.sideView.createdAt,
    });
  }
  if (images.backView) {
    result.push({
      id: images.backView.id,
      url: images.backView.url,
      thumbnailUrl: images.backView.thumbnailUrl ?? undefined,
      type: "angle",
      angleIndex: 2,
      createdAt: images.backView.createdAt,
    });
  }
  if (images.angleView) {
    result.push({
      id: images.angleView.id,
      url: images.angleView.url,
      thumbnailUrl: images.angleView.thumbnailUrl ?? undefined,
      type: "angle",
      angleIndex: 3,
      createdAt: images.angleView.createdAt,
    });
  }

  // 添加额外图片
  for (const img of images.additional || []) {
    result.push({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl ?? undefined,
      type: "reference",
      createdAt: img.createdAt,
    });
  }

  return result;
}

// SceneDetailDto.images 结构转换
function convertSceneImagesToAssetImages(
  images: SceneDetailDto["images"] | undefined,
): AssetImage[] {
  if (!images) return [];

  const result: AssetImage[] = [];

  // 添加全景图
  if (images.panorama) {
    result.push({
      id: images.panorama.id,
      url: images.panorama.url,
      thumbnailUrl: images.panorama.thumbnailUrl ?? undefined,
      type: "main",
      createdAt: images.panorama.createdAt,
    });
  }
  // 添加广角图作为备用主图
  if (images.wideShot && !images.panorama) {
    result.push({
      id: images.wideShot.id,
      url: images.wideShot.url,
      thumbnailUrl: images.wideShot.thumbnailUrl ?? undefined,
      type: "main",
      createdAt: images.wideShot.createdAt,
    });
  }

  // 添加细节镜头（素材库 detail 类型对应用户上传的参考图）
  for (const img of images.detailShots || []) {
    result.push({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl ?? undefined,
      type: "reference",
      createdAt: img.createdAt,
    });
  }

  // 添加参考图（additional 类型）
  for (const img of images.additional || []) {
    result.push({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl ?? undefined,
      type: "reference",
      createdAt: img.createdAt,
    });
  }

  return result;
}

// PropDetailDto.images 结构转换
function convertPropImagesToAssetImages(
  images: PropDetailDto["images"] | undefined,
): AssetImage[] {
  if (!images) return [];

  const result: AssetImage[] = [];

  // 添加主要视角图片
  if (images.frontView) {
    result.push({
      id: images.frontView.id,
      url: images.frontView.url,
      thumbnailUrl: images.frontView.thumbnailUrl ?? undefined,
      type: "main",
      createdAt: images.frontView.createdAt,
    });
  }
  if (images.sideView) {
    result.push({
      id: images.sideView.id,
      url: images.sideView.url,
      thumbnailUrl: images.sideView.thumbnailUrl ?? undefined,
      type: "angle",
      angleIndex: 1,
      createdAt: images.sideView.createdAt,
    });
  }
  if (images.topView) {
    result.push({
      id: images.topView.id,
      url: images.topView.url,
      thumbnailUrl: images.topView.thumbnailUrl ?? undefined,
      type: "angle",
      angleIndex: 2,
      createdAt: images.topView.createdAt,
    });
  }

  // 添加额外图片
  for (const img of images.additional || []) {
    result.push({
      id: img.id,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl ?? undefined,
      type: "reference",
      createdAt: img.createdAt,
    });
  }

  return result;
}

/**
 * 辅助函数：null 转换为 undefined
 */
function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/**
 * 规范化 videoMode（将废弃的旧值转换为新值）
 * - video_first → lip_sync
 * - audio_driven → audio_reference
 */
function normalizeVideoMode(
  mode: string | undefined,
): "audio_reference" | "lip_sync" | "video_only" | undefined {
  // 旧值映射
  if (mode === "video_first") return "lip_sync";
  if (mode === "audio_driven") return "audio_reference";
  // 新值直接返回
  if (
    mode === "audio_reference" ||
    mode === "lip_sync" ||
    mode === "video_only"
  ) {
    return mode;
  }
  // 未设置时返回 undefined，由调用方根据对话情况动态判断
  return undefined;
}

/**
 * 确保每个 dialogue 都有对应的 shot（兼容历史不完整数据）
 * @param shotGroupId 分镜组 ID
 * @param dialogues 对话列表
 * @param existingShots 已存在的 shots
 * @returns 完整的 shots 数组
 */
function ensureShotsForDialogues(
  shotGroupId: string,
  dialogues: Array<{ id: string; isVoiceover?: boolean }>,
  existingShots: Shot[],
): Shot[] {
  // 使用 dialogueId 作为匹配键
  const existingShotMap = new Map<string, Shot>();
  for (const shot of existingShots) {
    if (shot.dialogueId) {
      existingShotMap.set(shot.dialogueId, shot);
    }
  }

  // 为每个 dialogue 创建或保留对应的 shot
  return dialogues.map((d, index) => {
    const existingShot = existingShotMap.get(d.id);
    if (existingShot) {
      return existingShot;
    }
    // 创建缺失的 shot
    return {
      id: `${shotGroupId}_shot_${index}`,
      dialogueId: d.id,
      videoMode: d.isVoiceover ? "video_only" : "audio_reference",
      status: "pending",
      duration: 3,
    };
  });
}

export const useScriptEditStore = defineStore("scriptEdit", () => {
  // ==================== 核心状态 ====================
  const coreRefs = createCoreRefs();
  const {
    script,
    projectId,
    scriptId,
    steps,
    loading,
    currentStepId,
    activeTasks,
    creationSettings,
    // wsListenersInitialized 由 wsManager 内部使用
    taskUpdateTokens,
    // 资产 Map（用于快速 ID -> 名称查找）
    characterMap,
    sceneMap,
    propMap,
    // 素材库完整数据映射
    resolvedAssets,
  } = coreRefs;

  // ==================== 自动弹出框选面板状态 ====================
  // 用户主动关闭面板标记（用于避免检测完成后再次自动弹出）
  const userClosedRegionPanel = ref<Record<string, boolean>>({});
  // 自动弹出面板信号（供 UI 层监听）
  const autoOpenRegionPanelSignal = ref<{ shotGroupId: string; timestamp: number } | null>(null);

  // 记录用户主动关闭面板
  function markRegionPanelUserClosed(shotGroupId: string) {
    userClosedRegionPanel.value[shotGroupId] = true;
  }

  // 清除用户关闭标记（用于重新检测时）
  function clearRegionPanelUserClosed(shotGroupId: string) {
    delete userClosedRegionPanel.value[shotGroupId];
  }

  // 自动弹出面板事件发射
  function emitAutoOpenRegionPanel(shotGroupId: string) {
    autoOpenRegionPanelSignal.value = {
      shotGroupId,
      timestamp: Date.now(),
    };
  }

  // Store 引用（用于传递给 composables）
  const storeRefs = {
    projectId,
    scriptId,
    steps,
    script,
    creationSettings,
    // 新增：传递统一的 content 构建函数
    buildContentForSave,
  };

  // ==================== 核心模块 ====================
  const coreGetters = createCoreGetters(coreRefs);
  const coreActions = createCoreActions(coreRefs);
  const wsManager = createWsTaskManager(coreRefs);

  // ==================== 解构导出 ====================
  const {
    isLoading,
    canEdit,
    isGenerating,
    completedStepsCount,
    totalStepsCount,
    overallProgress,
  } = coreGetters;
  const {
    setIds,
    setCurrentStep,
    updateCreationSettings,
    updateStepStatus,
    resetState,
    createSnapshot,
    restoreSnapshot,
    clearSnapshot,
  } = coreActions;
  const { subscribeToTask, initGlobalWsListeners, wsStore } = wsManager;

  // ==================== 监听 WebSocket 重连 ====================
  wsManager.watchReconnection(() => {
    // 重连后重新订阅资产图片/视频进度事件
    subscribeToAssetImageProgress();
    subscribeToAssetVideoProgress();
    subscribeToStoryboardGenerateProgress();
    // 重新订阅资产 CRUD 事件
    subscribeToAssetCrudEvents();
    // 重新订阅分镜组相关事件
    initShotGroupEventSubscriptions();
  });

  // ==================== 数据加载 ====================

  /**
   * 加载剧本详情
   */
  async function loadScript(pId?: string, sId?: string) {
    const pid = pId || projectId.value;
    const sid = sId || scriptId.value;

    if (!pid || !sid) {
      throw new Error("项目ID或剧本ID未设置");
    }

    projectId.value = pid;
    scriptId.value = sid;

    loading.value = true;
    try {
      // 并行获取剧本数据和素材库完整数据
      // 模型配置由 scriptModelsStore.loadModels() 统一获取，避免重复请求
      const [response, resolvedAssetsResponse] = await Promise.all([
        scriptApi.getScript(pid, sid),
        scriptApi.getResolvedAssets(pid, sid),
      ]);
      const scriptData =
        (response as unknown as { data?: ScriptDetailDto }).data ||
        (response as unknown as ScriptDetailDto);
      script.value = scriptData;

      // 处理 resolvedAssets 数据：转换为 Map 存储
      const resolvedData =
        (resolvedAssetsResponse as unknown as { data?: ResolvedAssetResponse }).data ||
        (resolvedAssetsResponse as unknown as ResolvedAssetResponse);

      // 清空现有 Map 并填充新数据
      resolvedAssets.value.characters.clear();
      resolvedAssets.value.scenes.clear();
      resolvedAssets.value.props.clear();

      // 将 resolvedAssets 数据存入 Map（key 为 characterId/sceneId/propId）
      // asset 是 Record<string, unknown>，需要双重转换
      for (const item of resolvedData.characters) {
        if (item.ref.characterId && item.asset) {
          resolvedAssets.value.characters.set(
            item.ref.characterId,
            item.asset as unknown as CharacterDetailDto,
          );
        }
      }
      for (const item of resolvedData.scenes) {
        if (item.ref.sceneId && item.asset) {
          resolvedAssets.value.scenes.set(
            item.ref.sceneId,
            item.asset as unknown as SceneDetailDto,
          );
        }
      }
      for (const item of resolvedData.props) {
        if (item.ref.propId && item.asset) {
          resolvedAssets.value.props.set(
            item.ref.propId,
            item.asset as unknown as PropDetailDto,
          );
        }
      }

      console.log(
        `[loadScript] resolvedAssets loaded: characters=${resolvedAssets.value.characters.size}, scenes=${resolvedAssets.value.scenes.size}, props=${resolvedAssets.value.props.size}`,
      );

      // 检查是否有进行中的任务
      const hasGeneratingTasks =
        activeTasks.value.size > 0 ||
        Object.values(steps.value).some(
          (step) =>
            "imageGeneratingIds" in step &&
            (step.imageGeneratingIds as Set<string>).size > 0,
        );

      console.log(
        `[loadScript] hasGeneratingTasks: ${hasGeneratingTasks}, activeTasks: ${activeTasks.value.size}`,
      );

      if (hasGeneratingTasks) {
        console.warn(
          "[loadScript] 检测到有进行中的生成任务，跳过刷新以避免覆盖数据",
        );
      } else {
        console.log(
          `[loadScript] 调用 initializeStepsFromScript, 当前 storyboardParseStatus: ${steps.value.storyboards.storyboardParseStatus}`,
        );
        // modelConfigMap 由 scriptModelsStore.loadModels() 统一获取
        // initializeStepsFromScript 会从 content.settings 回退恢复 modelId
        initializeStepsFromScript(scriptData);
        console.log(
          `[loadScript] initializeStepsFromScript 完成, 新的 storyboardParseStatus: ${steps.value.storyboards.storyboardParseStatus}`,
        );
        // 立即构建资产 Map，确保在 Vue 组件渲染前完成
        _buildAssetMaps();
      }

      // 如果剧本正在生成中，检查是否有活跃任务并订阅
      if (scriptData.status === "ai_generating" && scriptData.aiTaskId) {
        console.log(
          `[ScriptEditV2] 剧本正在生成中，订阅任务: ${scriptData.aiTaskId}`,
        );
        steps.value.script.status = "processing";
        steps.value.script.currentTaskId = scriptData.aiTaskId;
        subscribeToTask(scriptData.aiTaskId, "script");
      }

      // 检查解析任务状态
      await checkParseTaskStatus();

      // 初始化全局 WebSocket 监听器（会先等待 WebSocket 连接）
      await initGlobalWsListeners({
        onLoadScript: async () => {
          await loadScript();
        },
        onUpdateAssetsFromParseResult: updateAssetsFromParseResult,
      });

      // 在 WebSocket 连接建立后再订阅各类进度
      subscribeToAssetImageProgress();
      subscribeToAssetVideoProgress();
      subscribeToStoryboardGenerateProgress();

      // 订阅资产 CRUD 事件（分段解析实时推送）
      subscribeToAssetCrudEvents();

      // 订阅分镜组相关事件（重构后新增）
      initShotGroupEventSubscriptions();

      // 检查是否有正在进行的分镜解析任务，如果有则订阅
      if (
        steps.value.storyboards.storyboardParseStatus === "processing" &&
        steps.value.storyboards.currentTaskId
      ) {
        console.log(
          `[loadScript] 检测到进行中的分镜解析任务，订阅: ${steps.value.storyboards.currentTaskId}`,
        );
        subscribeToStoryboardParseTask(steps.value.storyboards.currentTaskId);
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 刷新素材库 resolvedAssets 并重新初始化步骤
   * Phase 4：图片仅存在素材库表中，上传/删除后需刷新以同步最新数据
   * 不触发 loading 状态，避免 UI 闪烁
   */
  async function refreshResolvedAssets(): Promise<void> {
    const pid = projectId.value;
    const sid = scriptId.value;
    if (!pid || !sid || !script.value) return;

    try {
      const resolvedAssetsResponse = await scriptApi.getResolvedAssets(pid, sid);
      const resolvedData =
        (resolvedAssetsResponse as unknown as { data?: ResolvedAssetResponse }).data ||
        (resolvedAssetsResponse as unknown as ResolvedAssetResponse);

      // 更新 Map
      resolvedAssets.value.characters.clear();
      resolvedAssets.value.scenes.clear();
      resolvedAssets.value.props.clear();

      for (const item of resolvedData.characters) {
        if (item.ref.characterId && item.asset) {
          resolvedAssets.value.characters.set(
            item.ref.characterId,
            item.asset as unknown as CharacterDetailDto,
          );
        }
      }
      for (const item of resolvedData.scenes) {
        if (item.ref.sceneId && item.asset) {
          resolvedAssets.value.scenes.set(
            item.ref.sceneId,
            item.asset as unknown as SceneDetailDto,
          );
        }
      }
      for (const item of resolvedData.props) {
        if (item.ref.propId && item.asset) {
          resolvedAssets.value.props.set(
            item.ref.propId,
            item.asset as unknown as PropDetailDto,
          );
        }
      }

      // 从当前 steps 构建 modelConfigMap，保留用户已选择的模型
      const modelConfigMap = new Map<string, string>();
      if (steps.value.characters.modelId)
        modelConfigMap.set("characters", steps.value.characters.modelId);
      if (steps.value.scenes.modelId)
        modelConfigMap.set("scenes", steps.value.scenes.modelId);
      if (steps.value.props.modelId)
        modelConfigMap.set("props", steps.value.props.modelId);
      if (steps.value.script.modelId)
        modelConfigMap.set("script", steps.value.script.modelId);

      // 重新初始化步骤（resolvedAssets 新数据 + content 引用数据）
      // skipStoryboards: true —— refreshResolvedAssets 只刷新资产数据，分镜数据不应被重新初始化
      // 避免 shotGroups 数组引用变化触发 StoryboardStep watch 导致不必要的 PUT /shot-groups
      initializeStepsFromScript(script.value, modelConfigMap, { skipStoryboards: true });

      console.log("[refreshResolvedAssets] 素材库数据已刷新");
    } catch (error) {
      console.error("[refreshResolvedAssets] 刷新失败:", error);
    }
  }

  /**
   * 从剧本数据初始化步骤状态
   * @param scriptData 剧本数据
   * @param modelConfigMap 从 /models API 获取的模型配置映射（优先级最高）
   */
  function initializeStepsFromScript(
    scriptData: ScriptDetailDto,
    modelConfigMap?: Map<string, string>,
    options?: { skipStoryboards?: boolean },
  ) {
    // 初始化剧本描述
    // Bug 修复：只有当新数据有内容，且当前没有未保存的变更时才更新
    // 避免用空值覆盖用户正在编辑的内容，或 WebSocket 已推送的内容
    if (scriptData.description) {
      // 如果当前有未保存的变更，且新内容和当前内容相同，跳过更新
      if (steps.value.script.hasUnsavedChanges) {
        // 用户正在编辑，不覆盖
        console.log("[initializeStepsFromScript] 跳过描述更新：有未保存的变更");
      } else {
        steps.value.script.content = scriptData.description;
        steps.value.script.hasUnsavedChanges = false;
      }
      if (scriptData.status !== "ai_generating") {
        steps.value.script.status = "completed";
      }
    }

    const content = scriptData.content as Record<string, unknown> | undefined;
    if (!content) return;

    // 初始化分镜组设置到 steps.value.storyboards
    const shotGroupSettings = content.shotGroupSettings as
      | Record<string, string>
      | undefined;
    if (shotGroupSettings) {
      steps.value.storyboards.defaultImageModelId =
        shotGroupSettings.defaultImageModelId;
      steps.value.storyboards.defaultVideoModelId =
        shotGroupSettings.defaultVideoModelId;
      steps.value.storyboards.defaultLipSyncModelId =
        shotGroupSettings.defaultLipSyncModelId;
    }

    // 初始化步骤级别的模型配置
    // 优先级：modelConfigMap（来自 /models API） > content.settings > 默认值
    if (modelConfigMap?.has("characters")) {
      steps.value.characters.modelId = modelConfigMap.get("characters") || "";
    } else {
      const characterSettings = content.characterSettings as
        | Record<string, string>
        | undefined;
      if (characterSettings?.modelId) {
        steps.value.characters.modelId = characterSettings.modelId;
      }
    }

    if (modelConfigMap?.has("scenes")) {
      steps.value.scenes.modelId = modelConfigMap.get("scenes") || "";
    } else {
      const sceneSettings = content.sceneSettings as
        | Record<string, string>
        | undefined;
      if (sceneSettings?.modelId) {
        steps.value.scenes.modelId = sceneSettings.modelId;
      }
    }

    if (modelConfigMap?.has("props")) {
      steps.value.props.modelId = modelConfigMap.get("props") || "";
    } else {
      const propSettings = content.propSettings as
        | Record<string, string>
        | undefined;
      if (propSettings?.modelId) {
        steps.value.props.modelId = propSettings.modelId;
      }
    }

    // 初始化 script 步骤的 modelId
    if (modelConfigMap?.has("script")) {
      steps.value.script.modelId = modelConfigMap.get("script") || "";
    } else {
      const scriptSettings = content?.scriptSettings as
        | Record<string, string>
        | undefined;
      if (scriptSettings?.modelId) {
        steps.value.script.modelId = scriptSettings.modelId;
      }
    }

    // 初始化创作设置（分辨率、类型）
    if (content.resolution) {
      creationSettings.value.resolution =
        content.resolution as typeof creationSettings.value.resolution;
    }
    if (content.genre) {
      creationSettings.value.genre =
        content.genre as typeof creationSettings.value.genre;
    }

    // 辅助：合并运行时状态
    // Bug 修复：只保留明确的运行时状态字段，避免旧数据覆盖新数据
    // 运行时状态包括：生成进度、展开状态、任务 ID 等前端临时状态
    const RUNTIME_STATE_FIELDS = [
      // 分镜运行时状态
      'isExpanded',
      'imageGenerationProgress',
      'imageGenerationError',
      'imageGenerating',
      'videoGenerating',
      // 保留 videoGeneration 中的 taskId（正在进行的生成任务）
      // 但其他字段由新数据决定
    ];

    function _mergeRuntimeState<T extends { id: string }>(
      newItems: T[],
      existingItems: Array<T & Record<string, unknown>>,
    ): T[] {
      const runtimeStateMap = new Map<string, Partial<T>>();
      for (const item of existingItems) {
        const { id, ...rest } = item as Record<string, unknown>;
        // 只保留运行时状态字段
        const filteredRuntimeState: Partial<T> = {};
        for (const field of RUNTIME_STATE_FIELDS) {
          if (rest[field] !== undefined) {
            (filteredRuntimeState as Record<string, unknown>)[field] = rest[field];
          }
        }
        // 特殊处理 videoGeneration：保留 taskId（进行中的任务）
        if (rest.videoGeneration && typeof rest.videoGeneration === 'object') {
          const vg = rest.videoGeneration as Record<string, unknown>;
          if (vg.taskId && vg.status === 'processing') {
            (filteredRuntimeState as Record<string, unknown>).videoGeneration = {
              taskId: vg.taskId,
              status: vg.status,
            };
          }
        }
        runtimeStateMap.set(id as string, filteredRuntimeState);
      }
      return newItems.map((item) => {
        const runtimeState = runtimeStateMap.get(item.id);
        // 新数据优先，runtimeState 仅补充 UI 临时状态
        return runtimeState ? ({ ...runtimeState, ...item } as T) : item;
      });
    }

    /**
     * 从旧数据对象中提取运行时状态字段
     * 避免旧数据（如 images）覆盖新数据
     */
    function extractRuntimeState(
      item: Record<string, unknown> | undefined,
    ): Record<string, unknown> {
      if (!item) return {};
      const result: Record<string, unknown> = {};
      for (const field of RUNTIME_STATE_FIELDS) {
        if (item[field] !== undefined) {
          result[field] = item[field];
        }
      }
      if (item.videoGeneration && typeof item.videoGeneration === 'object') {
        const vg = item.videoGeneration as Record<string, unknown>;
        if (vg.taskId && vg.status === 'processing') {
          result.videoGeneration = { taskId: vg.taskId, status: vg.status };
        }
      }
      return result;
    }

    // 初始化角色 - 合并 CharacterRef + resolvedAssets 创建 CharacterRefWithImages
    // Phase 4: content.characters 是 CharacterRef[]（只有 id + characterId + 剧本特定信息）
    // 需要从 resolvedAssets 获取 name、description、images 等完整数据
    const characters = (content.characters as CharacterRef[] | string[]) || [];
    const isCharactersObjectArray =
      characters.length > 0 && typeof characters[0] === "object";
    if (isCharactersObjectArray) {
      // 合并 ref + resolvedAssets 数据
      const mergedCharacters: CharacterRefWithImages[] = (
        characters as CharacterRef[]
      ).map((ref) => {
        // 从 resolvedAssets 获取完整资产数据
        const asset = ref.characterId
          ? resolvedAssets.value.characters.get(ref.characterId)
          : undefined;

        // 获取运行时状态（图片生成进度等）
        const runtimeState = steps.value.characters.items.find(
          (item) => item.id === ref.id,
        ) as unknown as Record<string, unknown> | undefined;

        // 构建合并后的数据
        const merged: CharacterRefWithImages = {
          id: ref.id,
          characterId: ref.characterId,
          // 从 resolvedAssets 获取（null 转换为 undefined）
          name: asset?.name || "",
          description: asset?.description ?? "",
          personality: nullToUndefined(asset?.personality),
          age: nullToUndefined(asset?.age),
          gender: nullToUndefined(asset?.gender) as string | undefined,
          // 图片转换：CharacterDetailDto.images → AssetImage[]
          images: convertCharacterImagesToAssetImages(asset?.images),
          // CharacterDetailDto 没有 mainImageId，使用运行时状态或 frontView
          mainImageId: nullToUndefined(runtimeState?.mainImageId as string | null) ||
            asset?.images?.frontView?.id,
          assetId: asset?.id,
          // 从 ref 获取（剧本特定信息）
          importance: ref.importance,
          assetStatus: ref.assetStatus,
          importedAsset: ref.importedAsset,
          creationPlan: ref.creationPlan,
          voiceId: ref.voiceId,
          voiceInstructions: ref.voiceInstructions,
          // 运行时状态（图片生成后添加的）
          generationConfig: runtimeState?.generationConfig as
            | CharacterRefWithImages["generationConfig"]
            | undefined,
        };

        // 运行时状态优先（如图片生成后添加的 images/mainImageId）
        return runtimeState
          ? { ...merged, ...extractRuntimeState(runtimeState) } as CharacterRefWithImages
          : merged;
      });

      steps.value.characters.items = mergedCharacters;
      updateAssetStepStatus("characters", mergedCharacters);
    }

    // 初始化场景 - 合并 SceneRef + resolvedAssets 创建 SceneRefWithImages
    // Phase 4: content.scenes 是 SceneRef[]（只有 id + sceneId + 剧本特定信息）
    // 需要从 resolvedAssets 获取 name、description、images 等完整数据
    const scenes = (content.scenes as SceneRef[] | string[]) || [];
    const isScenesObjectArray =
      scenes.length > 0 && typeof scenes[0] === "object";
    if (isScenesObjectArray) {
      // 合并 ref + resolvedAssets 数据
      const mergedScenes: SceneRefWithImages[] = (scenes as SceneRef[]).map(
        (ref) => {
          // 从 resolvedAssets 获取完整资产数据
          const asset = ref.sceneId
            ? resolvedAssets.value.scenes.get(ref.sceneId)
            : undefined;

          // 获取运行时状态
          const runtimeState = steps.value.scenes.items.find(
            (item) => item.id === ref.id,
          ) as unknown as Record<string, unknown> | undefined;

          // 构建合并后的数据
          const merged: SceneRefWithImages = {
            id: ref.id,
            sceneId: ref.sceneId,
            // 从 resolvedAssets 获取（null 转换为 undefined）
            name: asset?.name || "",
            description: nullToUndefined(asset?.description),
            // 图片转换：SceneDetailDto.images → AssetImage[]
            images: convertSceneImagesToAssetImages(asset?.images),
            // SceneDetailDto 没有 mainImageId，使用运行时状态或 panorama
            mainImageId: nullToUndefined(runtimeState?.mainImageId as string | null) ||
              asset?.images?.panorama?.id,
            assetId: asset?.id,
            // 从 ref 获取（剧本特定信息）
            assetStatus: ref.assetStatus,
            importedAsset: ref.importedAsset,
            creationPlan: ref.creationPlan,
            dialogues: ref.dialogues,
            // 运行时状态
            generationConfig: runtimeState?.generationConfig as
              | SceneRefWithImages["generationConfig"]
              | undefined,
          };

          return runtimeState
            ? { ...merged, ...extractRuntimeState(runtimeState) } as SceneRefWithImages
            : merged;
        },
      );

      steps.value.scenes.items = mergedScenes;
      updateAssetStepStatus("scenes", mergedScenes);
    }

    // 初始化道具 - 合并 PropRef + resolvedAssets 创建 PropRefWithImages
    // Phase 4: content.props 是 PropRef[]（只有 id + propId + 剧本特定信息）
    // 需要从 resolvedAssets 获取 name、description、images 等完整数据
    const props = (content.props as PropRef[] | string[]) || [];
    const isPropsObjectArray = props.length > 0 && typeof props[0] === "object";
    if (isPropsObjectArray) {
      // 合并 ref + resolvedAssets 数据
      const mergedProps: PropRefWithImages[] = (props as PropRef[]).map(
        (ref) => {
          // 从 resolvedAssets 获取完整资产数据
          const asset = ref.propId
            ? resolvedAssets.value.props.get(ref.propId)
            : undefined;

          // 获取运行时状态
          const runtimeState = steps.value.props.items.find(
            (item) => item.id === ref.id,
          ) as unknown as Record<string, unknown> | undefined;

          // 构建合并后的数据
          const merged: PropRefWithImages = {
            id: ref.id,
            propId: ref.propId,
            // 从 resolvedAssets 获取（null 转换为 undefined）
            name: asset?.name || "",
            description: nullToUndefined(asset?.description),
            // 图片转换：PropDetailDto.images → AssetImage[]
            images: convertPropImagesToAssetImages(asset?.images),
            // PropDetailDto 没有 mainImageId，使用运行时状态或 frontView
            mainImageId: nullToUndefined(runtimeState?.mainImageId as string | null) ||
              asset?.images?.frontView?.id,
            assetId: asset?.id,
            // 从 ref 获取（剧本特定信息）
            assetStatus: ref.assetStatus,
            importedAsset: ref.importedAsset,
            creationPlan: ref.creationPlan,
            // 运行时状态
            generationConfig: runtimeState?.generationConfig as
              | PropRefWithImages["generationConfig"]
              | undefined,
          };

          return runtimeState
            ? { ...merged, ...extractRuntimeState(runtimeState) } as PropRefWithImages
            : merged;
        },
      );

      steps.value.props.items = mergedProps;
      updateAssetStepStatus("props", mergedProps);
    }

    // 初始化分镜（只从 shotGroups 读取）
    // 防级联：refreshResolvedAssets 等场景下跳过，避免无数据变化时替换数组引用触发 StoryboardStep watch 保存
    if (!options?.skipStoryboards) {
      let storyboards: StoryboardRef[];

      // 从 shotGroups 读取分镜数据
    const shotGroups = (content.shotGroups as Array<ShotGroup & {
      // 后端可能存储的字段（不在 shared-types 中定义）
      mainImageKey?: string;
    }>) || [];

    // Bug 1 调试：打印原始 shotGroups 数据
    console.log("[initializeStepsFromScript] content.shotGroups:", content.shotGroups);
    console.log("[initializeStepsFromScript] shotGroups 数量:", shotGroups.length);
    if (shotGroups.length > 0) {
      console.log("[initializeStepsFromScript] 第一个 shotGroup:", JSON.stringify(shotGroups[0], null, 2));
    }

    if (shotGroups.length > 0) {
      // 将 ShotGroup 转换为 StoryboardRef 格式（组件兼容层）
      storyboards = shotGroups.map((sg) => {
        const firstShot = sg.shots?.[0];

        // 检查 shotGroup.mainImageKey
        const shotGroupExtra = sg as unknown as { mainImageKey?: string };
        let images: Array<{
          id: string;
          url: string;
          type: "main" | "angle" | "reference" | "video_reference";
          thumbnailUrl?: string;
          angleIndex?: number;
          createdAt: string;
        }> = [];

        // 首先从 shotGroup.images 加载（如果有）
        if (Array.isArray(sg.images) && sg.images.length > 0) {
          images = sg.images.map((img) => ({
            id: img.id,
            url: img.url,
            type: img.type,
            thumbnailUrl: img.thumbnailUrl,
            angleIndex: img.angleIndex,
            createdAt: img.createdAt,
          }));
        }

        // 如果 mainImageKey 存在且 images 中没有主图，则添加主图
        if (shotGroupExtra.mainImageKey && !images.find((img) => img.type === "main")) {
          const mainImageKey = shotGroupExtra.mainImageKey;
          // mainImageKey 可能是以下格式：
          // 1. 完整 URL: https://...
          // 2. 相对路径: /static/image/...
          // 3. OSS key: image/...
          const imageUrl = mainImageKey!.startsWith("http") ||
            mainImageKey!.startsWith("/static/")
            ? mainImageKey!
            : `/static/${mainImageKey!}`;
          images.push({
            id: sg.mainImageId ?? `img_${sg.id}`,
            url: imageUrl,
            type: "main" as const,
            createdAt: sg.createdAt || new Date().toISOString(),
          });
          console.log(
            `[initializeStepsFromScript] 从 mainImageKey 生成图片 URL: shotGroupId=${sg.id}, mainImageKey=${mainImageKey}, url=${imageUrl}`,
          );
        }

        // 调试日志：检查图片 URL 是否为空
        const mainImg = images.find((img) => img.type === "main");
        if (mainImg && !mainImg.url) {
          console.warn(
            `[initializeStepsFromScript] 分镜图片 URL 为空: shotGroupId=${sg.id}, imageId=${mainImg.id}`,
          );
        }

        return {
          id: sg.id,
          sequenceNumber: sg.sequenceNumber,
          title: sg.title,
          description: sg.description,
          characterIds: sg.characterIds || [],
          sceneId: sg.sceneId,
          propIds: sg.propIds || [],
          duration: sg.duration || 3,
          status: "pending" as const,
          // Bug 修复：使用后端加载的 mode，而非硬编码
          mode: ((sg as unknown as { mode?: string }).mode || "standard") as "standard" | "quick" | "locked",
          referenceMode: sg.referenceMode || "multi_reference",
          // Bug 修复：使用 shotGroup.videoMode，而不是 firstShot.videoMode
          // shotGroup.videoMode 是用户选择的视频生成模式，firstShot.videoMode 是每个 shot 的具体模式
          // 若后端未设置，按对话情况动态判断：有对话 → audio_reference，无对话/旁白 → video_only
          videoMode: normalizeVideoMode(sg.videoMode) ?? ((sg.dialogues ?? []).some((d) => !d.isVoiceover) ? "audio_reference" : "video_only"),
          dialogues: (sg.dialogues || []).map((d) => ({
            id: d.id,
            characterId: d.characterId,
            characterName: d.characterName,
            text: d.text,
            emotion: d.emotion,
            isVoiceover: d.isVoiceover || false,
            actions: d.actions,
            audioUrl: d.audioUrl,
            audioDuration: d.audioDuration,
            audioStatus: d.audioStatus,
            audioTaskId: d.audioTaskId,
            voiceId: d.voiceId,
            instructions: d.instructions,
            // Bug-2 修复：对话独立的角色框选配置
            characterRegions: d.characterRegions,
          })),
          images,
          mainImageId: sg.mainImageId,
          // 视频生成状态：优先使用新字段 shotGroup.video，兼容旧字段 videoGeneration
          // video_only / audio_reference 模式：视频存在 shotGroup.video
          // lip_sync 模式：视频存在 shots 数组（不在此字段）
          video: sg.video,
          videoGeneration: sg.video?.url
            ? {
                status: sg.video.status,
                videoUrl: sg.video.url,
                taskId: sg.video.taskId,
              }
            : (firstShot?.videoUrl // 兼容旧数据：从 firstShot 读取
              ? {
                  status: firstShot.status,
                  videoUrl: firstShot.videoUrl,
                  taskId: firstShot.taskId,
                }
              : undefined),
          imageModelId: sg.imageModelId,
          videoModelId: sg.videoModelId,
          lipSyncModelId: sg.lipSyncModelId,
          createdAt: sg.createdAt,
          updatedAt: sg.updatedAt,
          // shotGroups 新增字段
          // Bug 修复：确保每个 dialogue 都有对应的 shot（兼容历史不完整数据）
          shots: ensureShotsForDialogues(sg.id, sg.dialogues || [], sg.shots || []),
          characterRegions: sg.characterRegions || {},
          detectionStatus: sg.detectionStatus || "pending",
          detectionError: sg.detectionError,
          detectedSubjects: sg.detectedSubjects,
        } as unknown as StoryboardRef;

        // Bug 1 调试：打印每个 shotGroup 的 characterRegions
        console.log(`[initializeStepsFromScript] shotGroup ${sg.id} characterRegions:`, sg.characterRegions);
      });
      console.log(
        `[initializeStepsFromScript] 从 shotGroups 初始化 ${storyboards.length} 个分镜`,
      );
      // Bug 1 调试：打印转换后的 storyboards 中的 characterRegions
      console.log("[initializeStepsFromScript] 转换后的 storyboards[0].characterRegions:", storyboards[0]?.characterRegions);
    } else {
      // 没有分镜数据
      storyboards = [];
    }

    if (storyboards.length > 0) {
      // 清除无效的视频生成状态
      storyboards = storyboards.map((sb) => {
        if (
          sb.videoGeneration &&
          (sb.videoGeneration.status === "pending" ||
            sb.videoGeneration.status === "processing") &&
          !sb.videoGeneration.taskId
        ) {
          return { ...sb, videoGeneration: undefined };
        }
        return sb;
      });

      const mergedStoryboards = _mergeRuntimeState(
        storyboards,
        steps.value.storyboards.items as Array<
          StoryboardRef & Record<string, unknown>
        >,
      );

      // 补充 mode 默认值，并转换 dialogues.instructions 为对象格式（兼容旧数据）
      steps.value.storyboards.items = mergedStoryboards.map((s) => ({
        ...s,
        mode: s.mode ?? ("standard" as const),
        // 转换 dialogues.instructions 为对象格式
        dialogues: (s.dialogues || []).map((d) => {
          let instructions = d.instructions;
          // 如果 instructions 是字符串，转换为对象格式
          if (typeof instructions === "string") {
            instructions = { content: instructions };
          }
          return {
            ...d,
            instructions,
          };
        }),
      }));

      // 更新分镜状态
      const allHaveVideos = steps.value.storyboards.items.every(
        (s) =>
          s.videoGeneration?.videoUrl &&
          s.videoGeneration?.status === "completed",
      );
      steps.value.storyboards.status = allHaveVideos
        ? "completed"
        : "processing";
    }
    } // end if (!options?.skipStoryboards)

    // 恢复分镜解析状态（从 script.metadata 读取）
    // 后端 Worker 将状态存储在 metadata 中，而不是 steps 字段
    const metadata = scriptData.metadata as {
      storyboardParseStatus?: string;
      storyboardParseError?: string;
      storyboardParseTaskId?: string;
      storyboardParseProgress?: number;
      storyboardParseBatchInfo?: {
        currentBatch: number;
        totalBatches: number;
        completedShots: number;
        estimatedTotalShots?: number;
      };
    } | undefined;

    console.log(
      `[initializeStepsFromScript] metadata: ${JSON.stringify(metadata)}`,
    );
    console.log(
      `[initializeStepsFromScript] 当前 storyboardParseStatus: ${steps.value.storyboards.storyboardParseStatus}`,
    );

    // Bug 修复：如果当前状态已经是 "completed"（WebSocket 刚设置的），则不覆盖
    // 避免 WebSocket completed 后调用 loadScript 时被旧 metadata 覆盖
    const currentParseStatus = steps.value.storyboards.storyboardParseStatus;
    if (currentParseStatus === "completed") {
      console.log(
        `[initializeStepsFromScript] 当前状态已为 completed，跳过 metadata 恢复以保护 WebSocket 设置的状态`,
      );
    } else if (metadata?.storyboardParseStatus) {
      steps.value.storyboards.storyboardParseStatus =
        metadata.storyboardParseStatus as "pending" | "processing" | "completed" | "failed";
      console.log(
        `[initializeStepsFromScript] 从 metadata 恢复分镜解析状态: ${metadata.storyboardParseStatus}`,
      );
      // 如果正在解析中，需要订阅任务
      if (
        metadata.storyboardParseStatus === "processing" &&
        metadata.storyboardParseTaskId
      ) {
        steps.value.storyboards.currentTaskId = metadata.storyboardParseTaskId;
        // 从 metadata 恢复进度和分批信息
        steps.value.storyboards.progress =
          (metadata.storyboardParseProgress as number) || 0;
        steps.value.storyboards.parseBatchInfo = metadata
          .storyboardParseBatchInfo as
          | {
              currentBatch: number;
              totalBatches: number;
              completedShots: number;
              estimatedTotalShots?: number;
            }
          | undefined;
        console.log(
          `[initializeStepsFromScript] 检测到进行中的分镜解析任务: ${metadata.storyboardParseTaskId}, 恢复进度: ${steps.value.storyboards.progress}`,
        );
      }
    } else {
      console.log(
        `[initializeStepsFromScript] metadata 中没有 storyboardParseStatus，保持当前状态`,
      );
    }
    // 移除自动从场景生成分镜的逻辑
    // 分镜应该由用户手动点击"解析分镜"按钮触发
    // 原代码会在没有分镜数据但有场景数据时自动创建分镜，这违反了设计要求
  }

  /**
   * 更新资产步骤状态
   */
  function updateAssetStepStatus(
    stepKey: "characters" | "scenes" | "props",
    items: unknown[],
  ) {
    const allHaveImages = items.every(
      (c) => ((c as Record<string, unknown>).images as unknown[])?.length > 0,
    );
    const someHaveImages = items.some(
      (c) => ((c as Record<string, unknown>).images as unknown[])?.length > 0,
    );
    if (allHaveImages) {
      steps.value[stepKey].status = "completed";
    } else if (someHaveImages) {
      steps.value[stepKey].status = "processing";
    }
  }

  // ==================== 资产 Map 管理 ====================

  /**
   * 从 steps.value 中的资产数据构建 Map
   * 用于快速 ID -> 名称查找
   * 同时支持前端 ID（id）和数据库 UUID（characterId/sceneId/propId）
   */
  function _buildAssetMaps() {
    // 构建角色 Map（同时支持 id 和 characterId 查找）
    // Phase 4: Map 存储 CharacterRefWithImages
    const newCharacterMap = new Map<string, CharacterRefWithImages>();
    for (const char of steps.value.characters.items) {
      // 用前端 id 作为主 key
      newCharacterMap.set(char.id, char);
      // 同时用 characterId（数据库 UUID）作为备用 key
      if (char.characterId) {
        newCharacterMap.set(char.characterId, char);
      }
    }
    characterMap.value = newCharacterMap;

    // 构建场景 Map（同时支持 id 和 sceneId 查找）
    // Phase 4: Map 存储 SceneRefWithImages
    const newSceneMap = new Map<string, SceneRefWithImages>();
    for (const scene of steps.value.scenes.items) {
      newSceneMap.set(scene.id, scene);
      if (scene.sceneId) {
        newSceneMap.set(scene.sceneId, scene);
      }
    }
    sceneMap.value = newSceneMap;

    // 构建道具 Map（同时支持 id 和 propId 查找）
    // Phase 4: Map 存储 PropRefWithImages
    const newPropMap = new Map<string, PropRefWithImages>();
    for (const prop of steps.value.props.items) {
      newPropMap.set(prop.id, prop);
      if (prop.propId) {
        newPropMap.set(prop.propId, prop);
      }
    }
    propMap.value = newPropMap;

    console.log(
      "[_buildAssetMaps] 资产 Map 已构建:",
      "角色:",
      characterMap.value.size,
      "场景:",
      sceneMap.value.size,
      "道具:",
      propMap.value.size,
    );
  }

  /**
   * 根据角色 ID 获取角色名称
   * 用于分镜卡片、剧本角色列表等显示
   * Phase 4: ref 无 name，使用 resolvedAssets 获取
   */
  function getCharacterNameById(id: string): string {
    // 先从 characterMap 找 characterId
    const char = characterMap.value.get(id);
    if (char?.characterId) {
      const resolved = getResolvedCharacterById(char.characterId);
      return resolved?.name || id;
    }
    // 如果传入的就是 characterId（素材库 UUID）
    const resolved = getResolvedCharacterById(id);
    return resolved?.name || id;
  }

  /**
   * 根据场景 ID 获取场景名称
   * Phase 4: ref 无 name，使用 resolvedAssets 获取
   */
  function getSceneNameById(id: string): string {
    const scene = sceneMap.value.get(id);
    if (scene?.sceneId) {
      const resolved = getResolvedSceneById(scene.sceneId);
      return resolved?.name || id;
    }
    const resolved = getResolvedSceneById(id);
    return resolved?.name || id;
  }

  /**
   * 根据道具 ID 获取道具名称
   * Phase 4: ref 无 name，使用 resolvedAssets 获取
   */
  function getPropNameById(id: string): string {
    const prop = propMap.value.get(id);
    if (prop?.propId) {
      const resolved = getResolvedPropById(prop.propId);
      return resolved?.name || id;
    }
    const resolved = getResolvedPropById(id);
    return resolved?.name || id;
  }

  // ==================== ResolvedAssets 辅助方法 ====================

  /**
   * 根据 characterId 获取素材库完整角色数据
   * @param characterId 素材库角色 ID（对应 CharacterRef.characterId）
   * @returns CharacterDetailDto 或 undefined（未关联素材库时）
   */
  function getResolvedCharacterById(characterId: string): CharacterDetailDto | undefined {
    return resolvedAssets.value.characters.get(characterId);
  }

  /**
   * 根据 sceneId 获取素材库完整场景数据
   * @param sceneId 素材库场景 ID（对应 SceneRef.sceneId）
   * @returns SceneDetailDto 或 undefined（未关联素材库时）
   */
  function getResolvedSceneById(sceneId: string): SceneDetailDto | undefined {
    return resolvedAssets.value.scenes.get(sceneId);
  }

  /**
   * 根据 propId 获取素材库完整道具数据
   * @param propId 素材库道具 ID（对应 PropRef.propId）
   * @returns PropDetailDto 或 undefined（未关联素材库时）
   */
  function getResolvedPropById(propId: string): PropDetailDto | undefined {
    return resolvedAssets.value.props.get(propId);
  }

  /**
   * 批量获取角色名称列表
   * @param ids 角色 ID 数组
   * @returns 名称数组（过滤无效 ID）
   * Phase 4: ref 无 name，使用 resolvedAssets
   */
  function getCharacterNamesByIds(ids: string[]): string[] {
    return ids
      .map((id) => {
        const char = characterMap.value.get(id);
        if (char?.characterId) {
          return getResolvedCharacterById(char.characterId)?.name ?? char.name;
        }
        return getResolvedCharacterById(id)?.name ?? char?.name;
      })
      .filter((name): name is string => !!name);
  }

  /**
   * 批量获取道具名称列表
   * Phase 4: ref 无 name，使用 resolvedAssets
   */
  function getPropNamesByIds(ids: string[]): string[] {
    return ids
      .map((id) => {
        const prop = propMap.value.get(id);
        if (prop?.propId) {
          return getResolvedPropById(prop.propId)?.name ?? prop.name;
        }
        return getResolvedPropById(id)?.name ?? prop?.name;
      })
      .filter((name): name is string => !!name);
  }

  /**
   * 更新单个角色到 Map（WebSocket 精准更新）
   * 同时支持 id 和 characterId 两种 key
   * Phase 4: 将 CharacterRef 转换为 CharacterRefWithImages
   */
  function _updateCharacterInMap(character: CharacterRef) {
    // Phase 4: 从 resolvedAssets 获取完整数据，合成 CharacterRefWithImages
    const asset = character.characterId
      ? resolvedAssets.value.characters.get(character.characterId)
      : undefined;

    // 解析结果/WebSocket 推送可能自带 name/description 等字段
    const rawChar = character as unknown as Record<string, unknown>;

    // 合成 WithImages 类型（优先使用传入对象自身数据，fallback 到 resolvedAssets）
    const characterWithImages: CharacterRefWithImages = {
      id: character.id,
      characterId: character.characterId,
      name: (rawChar.name as string) || asset?.name || "",
      description: (rawChar.description as string) ?? nullToUndefined(asset?.description) ?? "",
      personality: (rawChar.personality as string | undefined) ?? nullToUndefined(asset?.personality),
      age: (rawChar.age as string | undefined) ?? nullToUndefined(asset?.age),
      gender: ((rawChar.gender as string | undefined) ?? nullToUndefined(asset?.gender)) as string | undefined,
      images: convertCharacterImagesToAssetImages(asset?.images),
      mainImageId: asset?.images?.frontView?.id,
      assetId: asset?.id,
      importance: character.importance,
      assetStatus: character.assetStatus,
      importedAsset: character.importedAsset,
      creationPlan: character.creationPlan,
      voiceId: character.voiceId,
      voiceInstructions: character.voiceInstructions,
    };

    // Phase 4: Map 存储 CharacterRefWithImages
    characterMap.value.set(character.id, characterWithImages);
    if (character.characterId) {
      characterMap.value.set(character.characterId, characterWithImages);
    }

    // 同时更新 steps.value 中的对应项
    const idx = steps.value.characters.items.findIndex(
      (c) => c.id === character.id,
    );
    if (idx !== -1) {
      // 保留运行时状态（如图片生成进度）
      const existingItem = steps.value.characters.items[idx];
      steps.value.characters.items[idx] = {
        ...characterWithImages,
        images: existingItem.images || characterWithImages.images,
        mainImageId: existingItem.mainImageId || characterWithImages.mainImageId,
        generationConfig: existingItem.generationConfig,
      };
    } else {
      // 新增角色
      steps.value.characters.items.push(characterWithImages);
    }
  }

  /**
   * 更新单个场景到 Map（WebSocket 精准更新）
   * 同时支持 id 和 sceneId 两种 key
   * Phase 4: 将 SceneRef 转换为 SceneRefWithImages
   */
  function _updateSceneInMap(scene: SceneRef) {
    // Phase 4: 从 resolvedAssets 获取完整数据，合成 SceneRefWithImages
    const asset = scene.sceneId
      ? resolvedAssets.value.scenes.get(scene.sceneId)
      : undefined;

    // 解析结果/WebSocket 推送可能自带 name/description 等字段
    const rawScene = scene as unknown as Record<string, unknown>;

    // 合成 WithImages 类型（优先使用传入对象自身数据，fallback 到 resolvedAssets）
    const sceneWithImages: SceneRefWithImages = {
      id: scene.id,
      sceneId: scene.sceneId,
      name: (rawScene.name as string) || asset?.name || "",
      description: (rawScene.description as string | undefined) ?? nullToUndefined(asset?.description),
      images: convertSceneImagesToAssetImages(asset?.images),
      mainImageId: asset?.images?.panorama?.id,
      assetId: asset?.id,
      assetStatus: scene.assetStatus,
      importedAsset: scene.importedAsset,
      creationPlan: scene.creationPlan,
      dialogues: scene.dialogues,
    };

    // Phase 4: Map 存储 SceneRefWithImages
    sceneMap.value.set(scene.id, sceneWithImages);
    if (scene.sceneId) {
      sceneMap.value.set(scene.sceneId, sceneWithImages);
    }

    const idx = steps.value.scenes.items.findIndex((s) => s.id === scene.id);
    if (idx !== -1) {
      // 保留运行时状态
      const existingItem = steps.value.scenes.items[idx];
      steps.value.scenes.items[idx] = {
        ...sceneWithImages,
        images: existingItem.images || sceneWithImages.images,
        mainImageId: existingItem.mainImageId || sceneWithImages.mainImageId,
        generationConfig: existingItem.generationConfig,
      };
    } else {
      steps.value.scenes.items.push(sceneWithImages);
    }
  }

  /**
   * 更新单个道具到 Map（WebSocket 精准更新）
   * 同时支持 id 和 propId 两种 key
   * Phase 4: 将 PropRef 转换为 PropRefWithImages
   */
  function _updatePropInMap(prop: PropRef) {
    // Phase 4: 从 resolvedAssets 获取完整数据，合成 PropRefWithImages
    const asset = prop.propId
      ? resolvedAssets.value.props.get(prop.propId)
      : undefined;

    // 解析结果/WebSocket 推送可能自带 name/description 等字段
    const rawProp = prop as unknown as Record<string, unknown>;

    // 合成 WithImages 类型（优先使用传入对象自身数据，fallback 到 resolvedAssets）
    const propWithImages: PropRefWithImages = {
      id: prop.id,
      propId: prop.propId,
      name: (rawProp.name as string) || asset?.name || "",
      description: (rawProp.description as string | undefined) ?? nullToUndefined(asset?.description),
      images: convertPropImagesToAssetImages(asset?.images),
      mainImageId: asset?.images?.frontView?.id,
      assetId: asset?.id,
      assetStatus: prop.assetStatus,
      importedAsset: prop.importedAsset,
      creationPlan: prop.creationPlan,
    };

    // Phase 4: Map 存储 PropRefWithImages
    propMap.value.set(prop.id, propWithImages);
    if (prop.propId) {
      propMap.value.set(prop.propId, propWithImages);
    }

    const idx = steps.value.props.items.findIndex((p) => p.id === prop.id);
    if (idx !== -1) {
      // 保留运行时状态
      const existingItem = steps.value.props.items[idx];
      steps.value.props.items[idx] = {
        ...propWithImages,
        images: existingItem.images || propWithImages.images,
        mainImageId: existingItem.mainImageId || propWithImages.mainImageId,
        generationConfig: existingItem.generationConfig,
      };
    } else {
      steps.value.props.items.push(propWithImages);
    }
  }

  /**
   * 从 Map 和 steps 中删除角色
   * 同时删除 id 和 characterId 两种 key
   */
  function _removeCharacterFromMap(id: string) {
    // 先获取角色对象，以便删除 characterId key
    const char = characterMap.value.get(id);
    if (char?.characterId) {
      characterMap.value.delete(char.characterId);
    }
    characterMap.value.delete(id);
    steps.value.characters.items = steps.value.characters.items.filter(
      (c) => c.id !== id,
    );
  }

  /**
   * 从 Map 和 steps 中删除场景
   * 同时删除 id 和 sceneId 两种 key
   */
  function _removeSceneFromMap(id: string) {
    const scene = sceneMap.value.get(id);
    if (scene?.sceneId) {
      sceneMap.value.delete(scene.sceneId);
    }
    sceneMap.value.delete(id);
    steps.value.scenes.items = steps.value.scenes.items.filter(
      (s) => s.id !== id,
    );
  }

  /**
   * 从 Map 和 steps 中删除道具
   * 同时删除 id 和 propId 两种 key
   */
  function _removePropFromMap(id: string) {
    const prop = propMap.value.get(id);
    if (prop?.propId) {
      propMap.value.delete(prop.propId);
    }
    propMap.value.delete(id);
    steps.value.props.items = steps.value.props.items.filter(
      (p) => p.id !== id,
    );
  }

  // ==================== 数据保存 ====================

  /**
   * 构建用于保存的完整 content 对象
   * 单一事实来源：steps.value.*.items
   *
   * 可通过 overrides 参数覆盖特定字段（如分镜数据由组件单独处理）
   *
   * Phase 4: 只保存 shotGroups，不再保存 storyboards
   */
  function buildContentForSave(overrides?: {
    shotGroups?: StoryboardRef[];
    shotGroupSettings?: ScriptContent["shotGroupSettings"];
  }): ScriptContent {
    const shotGroupsData =
      overrides?.shotGroups || steps.value.storyboards.items || [];

    // 辅助函数：转换 instructions 为对象格式（兼容旧数据）
    function normalizeInstructions(
      instructions: unknown,
    ): { templateId?: string; content: string } | undefined {
      if (!instructions) return undefined;
      // 已经是对象格式
      if (typeof instructions === "object")
        return instructions as { templateId?: string; content: string };
      // 字符串格式转换为对象
      if (typeof instructions === "string") {
        return { content: instructions };
      }
      return undefined;
    }

    // 辅助函数：规范化分镜数据，确保必填字段有默认值
    function normalizeShotGroup(sb: StoryboardRef) {
      return {
        ...sb,
        // 必填字段：description 默认为空字符串
        description: sb.description ?? "",
        // sequenceNumber 默认为 0（如果不存在）
        sequenceNumber: sb.sequenceNumber ?? 0,
        // 规范化 videoMode（使用顶层辅助函数）
        videoMode: normalizeVideoMode(sb.videoMode),
        // 规范化 dialogues.instructions 格式
        dialogues: (sb.dialogues || []).map((d) => ({
          ...d,
          instructions: normalizeInstructions(d.instructions),
        })),
        // Bug 修复：确保 characterRegions 字段被正确保留
        characterRegions: sb.characterRegions || {},
      };
    }

    // 规范化分镜数据
    const normalizedShotGroups = shotGroupsData.map(normalizeShotGroup);

    // 将 StoryboardRef 转换为 ShotGroup 格式
    const shotGroupsForSave = normalizedShotGroups.map((sb) => ({
      id: sb.id,
      sequenceNumber: sb.sequenceNumber,
      title: sb.title,
      description: sb.description,
      mainImageId: sb.mainImageId,
      mainImageVersion: 0,
      // Bug 修复：添加 images 字段保存参考图
      images: sb.images || [],
      detectionStatus: ((sb as unknown as { detectionStatus?: string }).detectionStatus || "pending") as "pending" | "failed" | "completed" | "processing",
      // Bug 修复：使用规范化后的 characterRegions 字段
      characterRegions: sb.characterRegions || {},
      // Bug 修复：添加 detectedSubjects 字段保存检测到的主体
      detectedSubjects: (sb as unknown as { detectedSubjects?: DetectedSubject[] }).detectedSubjects,
      characterIds: sb.characterIds || [],
      sceneId: sb.sceneId,
      propIds: sb.propIds || [],
      dialogues: (sb.dialogues || []).map((d) => ({
        id: d.id,
        characterId: d.characterId,
        characterName: d.characterName,
        text: d.text,
        emotion: d.emotion,
        isVoiceover: d.isVoiceover || false,
        actions: d.actions,
        audioUrl: d.audioUrl,
        audioDuration: d.audioDuration,
        audioStatus: d.audioStatus,
        audioTaskId: d.audioTaskId,
        voiceId: d.voiceId,
        instructions: normalizeInstructions(d.instructions),
        // Bug-2 修复：对话独立的角色框选配置
        characterRegions: d.characterRegions,
      })),
      // Bug 修复：保留原有 shots 数据（videoUrl、status 等），只补充缺失的 shot
      // 使用 ensureShotsForDialogues 函数处理，避免覆盖已生成的视频数据
      shots: ensureShotsForDialogues(sb.id, sb.dialogues || [], sb.shots || []),
      // 新增：分镜组级别视频字段（video_only / audio_reference 模式）
      video: sb.video,
      referenceMode: sb.referenceMode || "multi_reference",
      // 视频生成模式：未设置时按对话情况动态判断
      videoMode: sb.videoMode ?? ((sb.dialogues ?? []).some((d) => !d.isVoiceover) ? "audio_reference" : "video_only"),
      // Bug 修复：分镜时长字段（秒）
      duration: sb.duration || 3,
      imageModelId: sb.imageModelId,
      videoModelId: sb.videoModelId,
      lipSyncModelId: sb.lipSyncModelId,
      // Bug 修复：分镜模式字段
      mode: sb.mode || "standard",
      createdAt: sb.createdAt,
      updatedAt: sb.updatedAt,
    }));

    // 辅助函数：规范化角色数据，确保必填字段有默认值
    function normalizeCharacter(char: CharacterRef): CharacterRef {
      return {
        ...char,
        // 必填字段：importance 默认为 minor
        importance: char.importance || ("minor" as const),
      };
    }

    const content: ScriptContent = {
      // Phase 4: 只保存 shotGroups
      shotGroups: shotGroupsForSave,
      // shotGroupSettings：优先使用 overrides，其次使用 steps 中的配置
      shotGroupSettings: overrides?.shotGroupSettings ?? {
        defaultImageModelId: steps.value.storyboards.defaultImageModelId,
        defaultVideoModelId: steps.value.storyboards.defaultVideoModelId,
        defaultLipSyncModelId: steps.value.storyboards.defaultLipSyncModelId,
      },
      // 资产数据（规范化后）
      characters: steps.value.characters.items.map(
        normalizeCharacter,
      ) as CharacterRef[],
      scenes: steps.value.scenes.items as SceneRef[],
      props: steps.value.props.items as PropRef[],
      // 步骤级别的模型配置
      characterSettings: {
        modelId: steps.value.characters.modelId || undefined,
      },
      sceneSettings: {
        modelId: steps.value.scenes.modelId || undefined,
      },
      propSettings: {
        modelId: steps.value.props.modelId || undefined,
      },
      // 剧本步骤的模型配置（用于剧本解析）
      scriptSettings: {
        modelId: steps.value.script.modelId || undefined,
      },
      // 创作设置
      resolution: creationSettings.value.resolution,
      genre: creationSettings.value.genre,
      // 旁白音色
      narrationVoiceId: (script.value?.content as Record<string, unknown>)
        ?.narrationVoiceId as string | undefined,
      // BGM 配乐轨道
      bgmTracks:
        ((script.value?.content as Record<string, unknown>)
          ?.bgmTracks as BgmTrack[]) || [],
    };

    // Zod 校验 content 字段类型
    const parseResult = ScriptContentSchema.safeParse(content);
    if (!parseResult.success) {
      console.error("Content 校验失败:", parseResult.error.format());
      throw new Error(
        `剧本内容格式错误: ${parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }

    return parseResult.data;
  }

  // ==================== shotGroups 兼容层 ====================
  // Phase 1-3: 支持 storyboards → shotGroups 渐进迁移
  // 组件继续使用 storyboards 命名，数据结构逐步迁移到 shotGroups

  /**
   * 获取所有分镜组数据
   * Phase 1: 优先返回 shotGroups，向后兼容 storyboards
   * @returns 分镜组数组（使用 StoryboardRef 类型保持组件兼容）
   */
  function getShotGroups(): StoryboardRef[] {
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    // 优先使用 shotGroups
    const shotGroups = content?.shotGroups as ShotGroup[] | undefined;
    if (shotGroups && shotGroups.length > 0) {
      // 将 ShotGroup 转换为 StoryboardRef 格式（组件兼容层）
      return shotGroups.map(convertShotGroupToStoryboardRef);
    }
    // 向后兼容：返回 storyboards
    return steps.value.storyboards.items;
  }

  /**
   * 根据ID获取分镜组
   * @param id 分镜组ID
   * @returns 分镜组数据或undefined
   */
  function getShotGroupById(id: string): StoryboardRef | undefined {
    const shotGroups = getShotGroups();
    return shotGroups.find((sg) => sg.id === id);
  }

  /**
   * 更新分镜组数据
   * Phase 2: 同时更新 shotGroups 和 storyboards（双写）
   * @param id 分镜组ID
   * @param data 要更新的数据
   */
  function updateShotGroupData(id: string, data: Partial<StoryboardRef>): void {
    // 更新 steps.value.storyboards（当前数据源）
    const idx = steps.value.storyboards.items.findIndex((sg) => sg.id === id);
    if (idx !== -1) {
      steps.value.storyboards.items[idx] = {
        ...toRaw(steps.value.storyboards.items[idx]),
        ...data,
      };
    }

    // 更新 script.value.content.shotGroups（如果存在）
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    if (content?.shotGroups) {
      const shotGroups = content.shotGroups as ShotGroup[];
      const sgIdx = shotGroups.findIndex((sg) => sg.id === id);
      if (sgIdx !== -1) {
        // 合并更新到 ShotGroup 结构
        shotGroups[sgIdx] = {
          ...shotGroups[sgIdx],
          ...convertStoryboardRefToShotGroupPatch(data),
        };
      }
    }
  }

  /**
   * 添加分镜组
   * @param data 分镜组数据
   */
  function addShotGroup(data: StoryboardRef): void {
    steps.value.storyboards.items.push(data);

    // 同步到 shotGroups（如果存在）
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    if (content?.shotGroups) {
      const shotGroups = content.shotGroups as ShotGroup[];
      shotGroups.push(convertStoryboardRefToShotGroup(data));
    }
  }

  /**
   * 删除分镜组
   * @param id 分镜组ID
   */
  function deleteShotGroup(id: string): void {
    steps.value.storyboards.items = steps.value.storyboards.items.filter(
      (sg) => sg.id !== id,
    );

    // 同步删除 shotGroups（如果存在）
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    if (content?.shotGroups) {
      content.shotGroups = (content.shotGroups as ShotGroup[]).filter(
        (sg) => sg.id !== id,
      );
    }
  }

  /**
   * 获取分镜组内的所有分镜（Shot）
   * Phase 3: 支持分镜组内的分镜列表操作
   * @param shotGroupId 分镜组ID
   * @returns Shot数组
   */
  function getShots(shotGroupId: string): Shot[] {
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    const shotGroups = content?.shotGroups as ShotGroup[] | undefined;
    if (shotGroups) {
      const shotGroup = shotGroups.find((sg) => sg.id === shotGroupId);
      return shotGroup?.shots || [];
    }
    // 向后兼容：从 StoryboardRef 提取单镜头信息
    const storyboard = getShotGroupById(shotGroupId);
    if (storyboard) {
      return [
        {
          id: `${shotGroupId}_shot_0`,
          dialogueId: storyboard.dialogues?.[0]?.id || "",
          // Shot 类型已简化，移除 videoMode 和 duration 字段
          status: storyboard.videoGeneration?.status || "pending",
          videoUrl: storyboard.videoGeneration?.videoUrl,
          taskId: storyboard.videoGeneration?.taskId,
        },
      ];
    }
    return [];
  }

  /**
   * 更新分镜组内的单个分镜
   * @param shotGroupId 分镜组ID
   * @param shotId 分镜ID
   * @param data 要更新的数据
   */
  function updateShotData(
    shotGroupId: string,
    shotId: string,
    data: Partial<Shot>,
  ): void {
    const content = script.value?.content as
      | Record<string, unknown>
      | undefined;
    if (content?.shotGroups) {
      const shotGroups = content.shotGroups as ShotGroup[];
      const sgIdx = shotGroups.findIndex((sg) => sg.id === shotGroupId);
      if (sgIdx !== -1) {
        const shotIdx = shotGroups[sgIdx].shots.findIndex(
          (s) => s.id === shotId,
        );
        if (shotIdx !== -1) {
          shotGroups[sgIdx].shots[shotIdx] = {
            ...shotGroups[sgIdx].shots[shotIdx],
            ...data,
          };
        }
      }
    }

    // 向后兼容：更新 StoryboardRef 的 videoGeneration
    const storyboard = getShotGroupById(shotGroupId);
    if (storyboard) {
      updateShotGroupData(shotGroupId, {
        videoGeneration: {
          prompt: storyboard.videoGeneration?.prompt,
          status:
            data.status || storyboard.videoGeneration?.status || "pending",
          videoUrl: data.videoUrl || undefined,
          taskId: data.taskId || undefined,
        },
      });
    }
  }

  // ==================== 类型转换辅助函数 ====================

  /**
   * 将 ShotGroup 转换为 StoryboardRef（组件兼容层）
   */
  function convertShotGroupToStoryboardRef(sg: ShotGroup): StoryboardRef {
    // 合并所有 shot 的视频信息到第一个 shot
    const firstShot = sg.shots?.[0];
    return {
      id: sg.id,
      sequenceNumber: sg.sequenceNumber,
      title: sg.title,
      description: sg.description,
      characterIds: sg.characterIds || [],
      sceneId: sg.sceneId,
      propIds: sg.propIds || [],
      duration: sg.duration || 3,
      status: "pending",
      mode: "standard",
      referenceMode: sg.referenceMode,
      // Shot 类型已简化，videoMode 使用 shotGroup 的 videoMode
      // 未设置时按对话情况动态判断
      videoMode: normalizeVideoMode(sg.videoMode) ?? ((sg.dialogues ?? []).some((d) => !d.isVoiceover) ? "audio_reference" : "video_only"),
      dialogues:
        sg.dialogues?.map((d) => ({
          id: d.id,
          characterId: d.characterId,
          characterName: d.characterName,
          text: d.text,
          emotion: d.emotion,
          isVoiceover: d.isVoiceover || false,
          actions: d.actions,
          audioUrl: d.audioUrl,
          audioDuration: d.audioDuration,
          audioStatus: d.audioStatus,
          audioTaskId: d.audioTaskId,
          voiceId: d.voiceId,
          instructions: d.instructions,
        })) || [],
      images: sg.mainImageId
        ? [
            {
              id: sg.mainImageId,
              url: "", // URL 需要从其他地方获取
              type: "main",
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      mainImageId: sg.mainImageId,
      videoGeneration: firstShot?.videoUrl
        ? {
            status: firstShot.status,
            videoUrl: firstShot.videoUrl,
            taskId: firstShot.taskId || undefined,
          }
        : undefined,
      imageModelId: sg.imageModelId,
      videoModelId: sg.videoModelId,
      lipSyncModelId: sg.lipSyncModelId,
      createdAt: sg.createdAt,
      updatedAt: sg.updatedAt,
    };
  }

  /**
   * 将 StoryboardRef 转换为 ShotGroup（数据层）
   */
  function convertStoryboardRefToShotGroup(sb: StoryboardRef): ShotGroup {
    return {
      id: sb.id,
      sequenceNumber: sb.sequenceNumber,
      title: sb.title,
      description: sb.description,
      mainImageId: sb.mainImageId,
      mainImageVersion: 0,
      detectionStatus: "pending",
      characterIds: sb.characterIds || [],
      sceneId: sb.sceneId,
      propIds: sb.propIds || [],
      // ShotGroup 必需字段
      duration: sb.duration || 3,
      characterRegions: sb.characterRegions || {},
      dialogues:
        sb.dialogues?.map((d) => ({
          id: d.id,
          characterId: d.characterId,
          characterName: d.characterName,
          text: d.text,
          emotion: d.emotion,
          isVoiceover: d.isVoiceover || false,
          actions: d.actions,
          audioUrl: d.audioUrl,
          audioDuration: d.audioDuration,
          audioStatus: d.audioStatus,
          audioTaskId: d.audioTaskId,
          voiceId: d.voiceId,
          instructions: d.instructions,
        })) || [],
      // Bug 修复：为每个 dialogue 创建对应的 shot（Shot 类型已简化）
      shots:
        sb.dialogues?.map((d, index) => ({
          id: `${sb.id}_shot_${index}`,
          dialogueId: d.id,
          status: "pending",
        })) || [],
      referenceMode: sb.referenceMode || "multi_reference",
      imageModelId: sb.imageModelId,
      videoModelId: sb.videoModelId,
      lipSyncModelId: sb.lipSyncModelId,
      createdAt: sb.createdAt,
      updatedAt: sb.updatedAt,
    } as ShotGroup;
  }

  /**
   * 将 StoryboardRef 部分字段转换为 ShotGroup 更新补丁
   */
  function convertStoryboardRefToShotGroupPatch(
    data: Partial<StoryboardRef>,
  ): Partial<ShotGroup> {
    const patch: Partial<ShotGroup> = {};

    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.mainImageId !== undefined) patch.mainImageId = data.mainImageId;
    if (data.characterIds !== undefined) patch.characterIds = data.characterIds;
    if (data.sceneId !== undefined) patch.sceneId = data.sceneId;
    if (data.propIds !== undefined) patch.propIds = data.propIds;
    if (data.referenceMode !== undefined)
      patch.referenceMode = data.referenceMode;
    if (data.imageModelId !== undefined) patch.imageModelId = data.imageModelId;
    if (data.videoModelId !== undefined) patch.videoModelId = data.videoModelId;
    if (data.lipSyncModelId !== undefined)
      patch.lipSyncModelId = data.lipSyncModelId;
    if (data.dialogues !== undefined) {
      patch.dialogues = data.dialogues.map((d) => ({
        id: d.id,
        characterId: d.characterId,
        characterName: d.characterName,
        text: d.text,
        emotion: d.emotion,
        isVoiceover: d.isVoiceover || false,
        actions: d.actions,
        audioUrl: d.audioUrl,
        audioDuration: d.audioDuration,
        audioStatus: d.audioStatus,
        audioTaskId: d.audioTaskId,
        voiceId: d.voiceId,
        instructions: d.instructions,
      }));
    }
    if (data.duration !== undefined || data.videoGeneration !== undefined) {
      patch.shots = [
        {
          id: "",
          dialogueId: "",
          // Shot 类型已简化，移除 videoMode 和 duration
          status: data.videoGeneration?.status || "pending",
          videoUrl: data.videoGeneration?.videoUrl,
          taskId: data.videoGeneration?.taskId,
        },
      ];
    }

    return patch;
  }

  /**
   * 更新剧本描述
   * 使用专门的端点，支持更长的描述内容（10-5000字符）
   */
  async function updateScriptDescription(content: string) {
    if (!projectId.value || !scriptId.value) return;

    steps.value.script.hasUnsavedChanges = true;
    steps.value.script.content = content;

    try {
      // Bug 修复：使用专门的 updateScriptDescription 端点
      // 该端点支持 10-5000 字符，而通用 updateScript 端点的 description 只支持最大 1000 字符
      await scriptApi.updateScriptDescription(
        projectId.value,
        scriptId.value,
        content,
        true, // autoSave
      );
      steps.value.script.hasUnsavedChanges = false;
      return true;
    } catch (error) {
      console.error("保存剧本描述失败:", error);
      throw error;
    }
  }

  // ==================== 资产操作 ====================

  /**
   * 更新资产引用
   */
  async function updateAssetRef(
    assetType: AssetType,
    assetId: string,
    data: Partial<CharacterRef | SceneRef | PropRef>,
  ) {
    if (!projectId.value || !scriptId.value) return;

    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";
    const step = steps.value[stepKey] as AssetStepState<
      CharacterRef | SceneRef | PropRef
    >;
    const idx = step.items.findIndex((item) => item.id === assetId);
    if (idx === -1) return;

    // 保存快照用于回滚
    createSnapshot();

    // 乐观更新：直接更新 steps.value（单一数据源）
    step.items[idx] = { ...toRaw(step.items[idx]), ...data };

    try {
      await enqueueUpdate(`script:${scriptId.value}`, () => {
        if (assetType === "character") {
          return scriptApi.updateCharacters(
            projectId.value,
            scriptId.value,
            step.items as CharacterRef[],
          );
        } else if (assetType === "scene") {
          return scriptApi.updateScenes(
            projectId.value,
            scriptId.value,
            step.items as SceneRef[],
          );
        } else {
          return scriptApi.updateProps(
            projectId.value,
            scriptId.value,
            step.items as PropRef[],
          );
        }
      });
      // 成功后清除快照
      clearSnapshot();
    } catch (error) {
      console.error("保存资产信息失败:", error);
      // 回滚到快照状态
      restoreSnapshot();
      throw error;
    }
  }

  /**
   * 删除资产
   */
  async function deleteAsset(
    assetType: AssetType,
    refId: string,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";
    const step = steps.value[stepKey] as AssetStepState<
      CharacterRef | SceneRef | PropRef
    >;

    const idx = step.items.findIndex((item) => item.id === refId);
    if (idx === -1) return;
    const removed = step.items.splice(idx, 1)[0];

    try {
      await enqueueUpdate(`script:${scriptId.value}`, () => {
        if (assetType === "character") {
          return scriptApi.updateCharacters(
            projectId.value,
            scriptId.value,
            step.items as CharacterRef[],
          );
        } else if (assetType === "scene") {
          return scriptApi.updateScenes(
            projectId.value,
            scriptId.value,
            step.items as SceneRef[],
          );
        } else {
          return scriptApi.updateProps(
            projectId.value,
            scriptId.value,
            step.items as PropRef[],
          );
        }
      });
      // 删除成功后更新步骤状态
      updateAssetStepStatus(stepKey, step.items);
    } catch (error) {
      step.items.splice(idx, 0, removed);
      console.error("[ScriptEditV2] 删除资产失败:", error);
      throw error;
    }
  }

  /**
   * 创建资产并关联到剧本
   * 用于"新建资产"功能：先创建资产到项目资产库，再关联引用到剧本
   * @param assetType 资产类型（character/scene/prop）
   * @param data 资产数据（名称、描述、性别、年龄等）
   * @returns 创建结果（refId、assetId、name、assetStatus）
   */
  async function createAndLinkAsset(
    assetType: AssetType,
    data: { name: string; description?: string; gender?: string; age?: string },
  ): Promise<{ refId: string; assetId: string; name: string; assetStatus: string }> {
    if (!projectId.value || !scriptId.value) {
      throw new Error("项目ID或剧本ID未设置");
    }

    const response = await scriptApi.createAndLinkAsset(
      projectId.value,
      scriptId.value,
      {
        assetType,
        name: data.name,
        description: data.description,
        gender: data.gender,
        age: data.age,
      },
    );

    const result = response as unknown as {
      refId: string;
      assetId: string;
      name: string;
      assetStatus: string;
    };

    // 根据资产类型更新 steps.items
    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";

    // 创建新的引用对象并添加到列表
    let newRef: CharacterRef | SceneRef | PropRef;
    if (assetType === "character") {
      newRef = {
        id: result.refId,
        characterId: result.assetId,
        name: result.name,
        description: data.description || "",
        importance: "minor",
        assetStatus: result.assetStatus as "imported" | "will_create" | "none",
        gender: data.gender,
        age: data.age,
      } as CharacterRef;
      // Phase 4: Map 存储 CharacterRefWithImages
      const newRefWithImages: CharacterRefWithImages = {
        ...newRef as CharacterRef,
        name: result.name || "",
        description: data.description || "",
        images: [],
      };
      characterMap.value.set(result.refId, newRefWithImages);
      characterMap.value.set(result.assetId, newRefWithImages);
    } else if (assetType === "scene") {
      newRef = {
        id: result.refId,
        sceneId: result.assetId,
        name: result.name,
        description: data.description || "",
        assetStatus: result.assetStatus as "imported" | "will_create" | "none",
      } as SceneRef;
      // Phase 4: Map 存储 SceneRefWithImages
      const newRefWithImages: SceneRefWithImages = {
        ...newRef as SceneRef,
        name: result.name || "",
        images: [],
      };
      sceneMap.value.set(result.refId, newRefWithImages);
      sceneMap.value.set(result.assetId, newRefWithImages);
    } else {
      newRef = {
        id: result.refId,
        propId: result.assetId,
        name: result.name,
        description: data.description || "",
        assetStatus: result.assetStatus as "imported" | "will_create" | "none",
      } as PropRef;
      // Phase 4: Map 存储 PropRefWithImages
      const newRefWithImages: PropRefWithImages = {
        ...newRef as PropRef,
        name: result.name || "",
        images: [],
      };
      propMap.value.set(result.refId, newRefWithImages);
      propMap.value.set(result.assetId, newRefWithImages);
    }

    const step = steps.value[stepKey] as AssetStepState<
      CharacterRefWithImages | SceneRefWithImages | PropRefWithImages
    >;
    // Phase 4: 根据类型推入对应的 WithImages 类型
    if (assetType === "character") {
      step.items.push({
        ...newRef as CharacterRef,
        name: result.name || "",
        description: data.description || "",
        images: [],
      } as CharacterRefWithImages);
    } else if (assetType === "scene") {
      step.items.push({
        ...newRef as SceneRef,
        name: result.name || "",
        images: [],
      } as SceneRefWithImages);
    } else {
      step.items.push({
        ...newRef as PropRef,
        name: result.name || "",
        images: [],
      } as PropRefWithImages);
    }
    updateAssetStepStatus(stepKey, step.items);

    return result;
  }

  /**
   * 批量关联已有资产到剧本
   * 用于"从项目导入"功能：从项目资产库选择已有资产，批量关联引用到剧本
   * @param assetType 资产类型（character/scene/prop）
   * @param assetIds 要关联的资产ID列表
   * @returns 关联结果（成功关联的 refs，跳过的 skipped）
   */
  async function linkExistingAssets(
    assetType: AssetType,
    assetIds: string[],
  ): Promise<{
    refs: Array<{ refId: string; assetId: string; name: string; assetStatus: string }>;
    skipped: Array<{ assetId: string; name: string; reason: string }>;
  }> {
    if (!projectId.value || !scriptId.value) {
      throw new Error("项目ID或剧本ID未设置");
    }

    const response = await scriptApi.linkExistingAssets(
      projectId.value,
      scriptId.value,
      {
        assetType,
        assetIds,
      },
    );

    const result = response as unknown as {
      refs: Array<{
        refId: string;
        assetId: string;
        name: string;
        assetStatus: string;
      }>;
      skipped: Array<{ assetId: string; name: string; reason: string }>;
    };

    // 根据资产类型更新 steps.items
    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";

    const step = steps.value[stepKey] as AssetStepState<
      CharacterRefWithImages | SceneRefWithImages | PropRefWithImages
    >;

    // 添加成功关联的引用到列表
    // Phase 4: 使用 WithImages 类型
    for (const refItem of result.refs) {
      if (assetType === "character") {
        const newRef: CharacterRefWithImages = {
          id: refItem.refId,
          characterId: refItem.assetId,
          name: refItem.name || "",
          description: "",
          importance: "minor",
          assetStatus: refItem.assetStatus as "imported" | "will_create" | "none",
          images: [],
        };
        characterMap.value.set(refItem.refId, newRef);
        characterMap.value.set(refItem.assetId, newRef);
        step.items.push(newRef);
      } else if (assetType === "scene") {
        const newRef: SceneRefWithImages = {
          id: refItem.refId,
          sceneId: refItem.assetId,
          name: refItem.name || "",
          description: "",
          assetStatus: refItem.assetStatus as "imported" | "will_create" | "none",
          images: [],
        };
        sceneMap.value.set(refItem.refId, newRef);
        sceneMap.value.set(refItem.assetId, newRef);
        step.items.push(newRef);
      }
    }

    updateAssetStepStatus(stepKey, step.items);

    return result;
  }

  // ==================== 剧本生成 ====================

  /**
   * 开始剧本生成
   */
  async function startScriptGeneration(modelId: string) {
    if (!projectId.value || !scriptId.value) return;

    steps.value.script.status = "processing";
    steps.value.script.modelId = modelId;
    steps.value.script.progress = 0;

    try {
      const response = await scriptApi.generateScript(projectId.value, {
        idea: steps.value.script.content,
      });

      const taskId = (response as { task?: AITaskDto })?.task?.id;
      if (taskId) {
        steps.value.script.currentTaskId = taskId;
        subscribeToTask(taskId, "script");
      }

      return response;
    } catch (error) {
      steps.value.script.status = "failed";
      throw error;
    }
  }

  /**
   * 重新生成剧本
   */
  async function regenerateScript() {
    const modelId = steps.value.script.modelId;
    if (!modelId) {
      throw new Error("未选择模型");
    }
    return startScriptGeneration(modelId);
  }

  // ==================== 模型切换 ====================

  /**
   * 切换资产步骤的模型
   */
  function switchAssetStepModel(
    stepKey: "characters" | "scenes" | "props",
    modelId: string,
  ) {
    const step = steps.value[stepKey];
    if (!step) return;

    for (const refId of step.imageGeneratingIds) {
      delete step.imageGenerationProgress[refId];
      delete step.imageGenerationErrors[refId];
    }
    step.imageGeneratingIds = reactiveSetClear();
    step.imageGenerationProgress = {};
    step.imageGenerationErrors = {};
    step.modelId = modelId;
  }

  /**
   * 更新资产模型 ID
   */
  function updateAssetModelId(assetType: AssetType, newModelId: string) {
    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";
    const step = steps.value[stepKey];
    step.imageGeneratingIds = reactiveSetClear();
    step.imageGenerationProgress = {};
    step.imageGenerationErrors = {};
    step.modelId = newModelId;
  }

  /**
   * 更新分镜模型 ID
   */
  function updateStoryboardModelId(newModelId: string) {
    steps.value.storyboards.modelId = newModelId;
  }

  // ==================== 任务管理 ====================

  /**
   * 取消当前生成任务
   */
  async function cancelCurrentGeneration(stepId: string) {
    const stepKey = stepId as keyof typeof steps.value;
    const step = steps.value[stepKey];

    if (!step || !("currentTaskId" in step) || !step.currentTaskId) {
      return;
    }

    const taskId = step.currentTaskId;

    try {
      await scriptApi.cancelAITask(projectId.value, scriptId.value, taskId);

      const subscription = activeTasks.value.get(taskId);
      if (subscription) {
        subscription.unsubscribe();
      }

      step.status = "pending";
      step.currentTaskId = undefined;
      if ("progress" in step) {
        step.progress = 0;
      }

      if ("imageGeneratingIds" in step) {
        const assetStep = step as (typeof steps.value)["characters"];
        for (const refId of assetStep.imageGeneratingIds) {
          delete assetStep.imageGenerationProgress[refId];
          delete assetStep.imageGenerationErrors[refId];
        }
        assetStep.imageGeneratingIds = reactiveSetClear();
      }

      taskUpdateTokens.value.delete(taskId);
    } catch (error) {
      console.error("取消任务失败:", error);
      throw error;
    }
  }

  // ==================== 解析任务 ====================

  /**
   * 检查解析任务状态
   */
  async function checkParseTaskStatus() {
    if (!projectId.value || !scriptId.value) return;

    try {
      const response = await scriptApi.getParseTaskStatus(
        projectId.value,
        scriptId.value,
      );
      const data = response as unknown as {
        hasTask: boolean;
        taskId?: string;
        status?: string;
        progress?: number;
        result?: {
          characters?: CharacterRef[];
          scenes?: SceneRef[];
          props?: PropRef[];
          dialogues?: DialogueItem[];
          storyboards?: StoryboardRef[];
        };
        error?: string;
      };

      if (!data?.hasTask) return;

      if (data.status === "completed" && data.result) {
        updateAssetsFromParseResult(data.result, false);
        return;
      }

      if (
        data.taskId &&
        (data.status === "pending" || data.status === "processing")
      ) {
        steps.value.script.status = "parsing";
        steps.value.script.parseTaskId = data.taskId;
        steps.value.script.parseProgress = data.progress || 0;
        subscribeToParseTask(data.taskId);
      }
    } catch (error) {
      console.error("检查解析任务状态失败:", error);
    }
  }

  /**
   * 解析剧本资源
   * @param force 是否强制重新解析（会清理已有素材）
   */
  async function parseScriptResources(force: boolean = false) {
    if (!projectId.value || !scriptId.value) {
      throw new Error("项目ID或剧本ID未设置");
    }

    if (steps.value.script.status === "parsing") {
      return;
    }

    // 强制重新解析时，立即清空旧数据，让用户看到空白状态等待新数据
    if (force) {
      console.log("[parseScriptResources] 强制重新解析，清空旧资产数据...");
      // 清空资产数据
      steps.value.characters.items = [];
      steps.value.scenes.items = [];
      steps.value.props.items = [];
      // 清空分镜数据
      steps.value.storyboards.items = [];
      // 设置步骤状态为 pending（等待新数据）
      steps.value.characters.status = "pending";
      steps.value.scenes.status = "pending";
      steps.value.props.status = "pending";
      steps.value.storyboards.status = "pending";
    }

    steps.value.script.status = "parsing";
    steps.value.script.parseProgress = 0;
    steps.value.script.parseMessage = force
      ? "正在清理素材并重新解析..."
      : "正在启动解析任务...";

    try {
      const response = await scriptApi.parseScriptResources(
        projectId.value,
        scriptId.value,
        force,
      );
      const data = response as unknown as {
        taskId: string;
        status: string;
        message: string;
      };

      if (!data) {
        throw new Error("解析任务创建失败");
      }

      if (data.status === "completed") {
        steps.value.script.status = "completed";
        return response;
      }

      if (!data.taskId) {
        throw new Error("解析任务创建失败");
      }

      steps.value.script.parseTaskId = data.taskId;
      subscribeToParseTask(data.taskId);

      return response;
    } catch (error) {
      steps.value.script.status = "completed";
      throw error;
    }
  }

  /**
   * 清空分镜数据
   * 用于重新解析前立即清空前端显示的分镜数据
   */
  function clearStoryboards() {
    console.log("[clearStoryboards] 清空分镜数据");
    steps.value.storyboards.items = [];
    steps.value.storyboards.status = "pending";
    steps.value.storyboards.storyboardParseStatus = undefined;
  }

  /**
   * 解析分镜数据（独立于资源解析）
   * 需要已有角色或场景数据作为前置条件
   * @param force 是否强制重新解析
   * @param pId 可选的项目ID（未提供时使用 store 内部值）
   * @param sId 可选的剧本ID（未提供时使用 store 内部值）
   */
  async function parseStoryboards(
    force: boolean = false,
    pId?: string,
    sId?: string,
  ) {
    // 优先使用传入参数，否则使用 store 内部值
    const effectiveProjectId = pId || projectId.value;
    const effectiveScriptId = sId || scriptId.value;

    console.log(
      `[parseStoryboards] projectId: ${effectiveProjectId}, scriptId: ${effectiveScriptId}`,
    );
    if (!effectiveProjectId || !effectiveScriptId) {
      console.error(
        `[parseStoryboards] ID 缺失! projectId: "${effectiveProjectId}", scriptId: "${effectiveScriptId}"`,
      );
      throw new Error("项目ID或剧本ID未设置");
    }

    // 检查前置条件：必须有角色或场景数据
    if (
      steps.value.characters.items.length === 0 &&
      steps.value.scenes.items.length === 0
    ) {
      throw new Error("请先解析资源");
    }

    // 如果正在解析，不重复提交
    if (steps.value.storyboards.storyboardParseStatus === "processing") {
      console.log("[parseStoryboards] 分镜解析任务正在进行中...");
      return;
    }

    // 设置解析状态
    steps.value.storyboards.storyboardParseStatus = "processing";

    try {
      const response = await scriptApi.parseStoryboards(
        effectiveProjectId,
        effectiveScriptId,
        force,
      );
      const data = response as unknown as {
        taskId: string;
        status: string;
        message?: string;
      };

      if (!data) {
        throw new Error("分镜解析任务创建失败");
      }

      if (data.status === "completed") {
        steps.value.storyboards.storyboardParseStatus = "completed";
        return response;
      }

      if (!data.taskId) {
        throw new Error("分镜解析任务创建失败");
      }

      // 订阅分镜解析进度
      subscribeToStoryboardParseTask(data.taskId);

      return response;
    } catch (error) {
      steps.value.storyboards.storyboardParseStatus = "failed";
      throw error;
    }
  }

  /**
   * 订阅分镜解析任务进度
   * 纯 WebSocket 实现
   */
  function subscribeToStoryboardParseTask(taskId: string) {
    const ws = wsStore.socket;

    const subscription: TaskSubscription = {
      taskId,
      stepId: "storyboard-parse",
      unsubscribe: () => {
        if (ws?.connected) {
          ws.emit("unsubscribe_script_task", { taskId });
        }
        activeTasks.value.delete(taskId);
      },
    };

    activeTasks.value.set(taskId, subscription);

    if (ws?.connected) {
      ws.emit("subscribe_script_task", { taskId, type: "storyboard-parse" });
    } else {
      console.warn(
        "[subscribeToStoryboardParseTask] WebSocket 未连接，等待连接后自动订阅",
      );
    }
  }

  /**
   * 订阅解析任务进度
   * 纯 WebSocket 实现，无 HTTP 轮询
   */
  function subscribeToParseTask(taskId: string) {
    const ws = wsStore.socket;

    const subscription: TaskSubscription = {
      taskId,
      stepId: "parse",
      unsubscribe: () => {
        if (ws?.connected) {
          ws.emit("unsubscribe_script_task", { taskId });
        }
        activeTasks.value.delete(taskId);
      },
    };

    activeTasks.value.set(taskId, subscription);

    if (ws?.connected) {
      ws.emit("subscribe_script_task", { taskId, type: "parse" });
    } else {
      // WebSocket 未连接时，通过 wsTask 管理器的 processPendingSubscriptions 处理
      console.warn(
        "[subscribeToParseTask] WebSocket 未连接，等待连接后自动订阅",
      );
    }
  }

  /**
   * 从解析结果更新资产数据
   */
  function updateAssetsFromParseResult(
    data: {
      characters?: CharacterRef[];
      scenes?: SceneRef[];
      props?: PropRef[];
      dialogues?: DialogueItem[];
      storyboards?: StoryboardRef[];
    },
    regenerateStoryboards = true,
  ) {
    console.log(`[updateAssetsFromParseResult] 更新资产数据:`, {
      characters: data.characters?.length || 0,
      scenes: data.scenes?.length || 0,
      props: data.props?.length || 0,
      dialogues: data.dialogues?.length || 0,
      storyboards: data.storyboards?.length || 0,
      regenerateStoryboards,
    });

    // 注意：dialogues 已移除，不再同步到 content

    // 更新角色
    // 注意：解析结果可能是旧数据，不应该覆盖 store 中已有的用户修改
    // 只有在 store 为空时才用解析结果初始化
    if (data.characters?.length && steps.value.characters.items.length === 0) {
      // Phase 4: 将 CharacterRef 转换为 CharacterRefWithImages
      // 解析结果自身包含 name/description，优先使用；fallback 到 resolvedAssets
      const mergedChars: CharacterRefWithImages[] = data.characters.map((newItem) => {
        const asset = newItem.characterId
          ? resolvedAssets.value.characters.get(newItem.characterId)
          : undefined;
        return {
          ...newItem,
          name: (newItem as unknown as Record<string, unknown>).name as string || asset?.name || "",
          description: ((newItem as unknown as Record<string, unknown>).description as string | undefined) ?? asset?.description ?? "",
          personality: ((newItem as unknown as Record<string, unknown>).personality as string | undefined) ?? asset?.personality,
          age: ((newItem as unknown as Record<string, unknown>).age as string | undefined) ?? asset?.age,
          gender: ((newItem as unknown as Record<string, unknown>).gender as string | undefined) ?? asset?.gender,
          images: convertCharacterImagesToAssetImages(asset?.images),
          mainImageId: asset?.images?.frontView?.id,
        } as CharacterRefWithImages;
      });
      steps.value.characters.items = mergedChars;
      updateAssetStepStatus("characters", mergedChars);

      if (script.value?.content) {
        (script.value.content as Record<string, unknown>).characters =
          mergedChars;
      }
    }

    // 更新场景
    // 注意：解析结果可能是旧数据，不应该覆盖 store 中已有的用户修改
    // 只有在 store 为空时才用解析结果初始化
    if (data.scenes?.length && steps.value.scenes.items.length === 0) {
      // Phase 4: 将 SceneRef 转换为 SceneRefWithImages
      // 解析结果自身包含 name/description，优先使用；fallback 到 resolvedAssets
      const mergedScenes: SceneRefWithImages[] = data.scenes.map((newItem) => {
        const asset = newItem.sceneId
          ? resolvedAssets.value.scenes.get(newItem.sceneId)
          : undefined;
        return {
          ...newItem,
          name: (newItem as unknown as Record<string, unknown>).name as string || asset?.name || "",
          description: ((newItem as unknown as Record<string, unknown>).description as string | undefined) ?? nullToUndefined(asset?.description),
          images: convertSceneImagesToAssetImages(asset?.images),
          mainImageId: asset?.images?.panorama?.id,
        } as SceneRefWithImages;
      });
      steps.value.scenes.items = mergedScenes;
      updateAssetStepStatus("scenes", mergedScenes);

      if (script.value?.content) {
        (script.value.content as Record<string, unknown>).scenes = mergedScenes;
      }
    }

    // 更新道具
    // 注意：解析结果可能是旧数据，不应该覆盖 store 中已有的用户修改
    // 只有在 store 为空时才用解析结果初始化
    if (data.props?.length && steps.value.props.items.length === 0) {
      // Phase 4: 将 PropRef 转换为 PropRefWithImages
      // 解析结果自身包含 name/description，优先使用；fallback 到 resolvedAssets
      const mergedProps: PropRefWithImages[] = data.props.map((newItem) => {
        const asset = newItem.propId
          ? resolvedAssets.value.props.get(newItem.propId)
          : undefined;
        return {
          ...newItem,
          name: (newItem as unknown as Record<string, unknown>).name as string || asset?.name || "",
          description: ((newItem as unknown as Record<string, unknown>).description as string | undefined) ?? nullToUndefined(asset?.description),
          images: convertPropImagesToAssetImages(asset?.images),
          mainImageId: asset?.images?.frontView?.id,
        } as PropRefWithImages;
      });
      steps.value.props.items = mergedProps;
      updateAssetStepStatus("props", mergedProps);

      if (script.value?.content) {
        (script.value.content as Record<string, unknown>).props = mergedProps;
      }
    }

    // 更新分镜
    // 注意：解析结果可能是旧数据，不应该覆盖 store 中已有的用户修改
    // 只有在 store 为空时才用解析结果初始化（与角色/场景/道具逻辑一致）
    if (
      data.storyboards?.length &&
      steps.value.storyboards.items.length === 0
    ) {
      steps.value.storyboards.items = data.storyboards as StoryboardRef[];
      steps.value.storyboards.status = "processing";

      console.log(
        `[updateAssetsFromParseResult] 更新分镜数据:`,
        data.storyboards.length,
        "个分镜",
      );
    }
    // 移除自动从场景生成分镜的逻辑
    // 分镜应该由用户手动点击"解析分镜"按钮触发
    // 原代码会在资源解析完成后自动从场景创建分镜，这违反了设计要求

    // 构建/更新资产 Map
    _buildAssetMaps();
  }

  // ==================== 资产选择 ====================

  /**
   * 选择/取消选择资产
   */
  function toggleAssetSelection(stepId: AssetStepKey, assetId: string) {
    const step = steps.value[stepId];
    const index = step.selectedIds.indexOf(assetId);

    if (index === -1) {
      step.selectedIds.push(assetId);
    } else {
      step.selectedIds.splice(index, 1);
    }
  }

  /**
   * 全选/取消全选资产
   */
  function toggleAllAssets(
    stepId: AssetStepKey,
    allIds: string[],
    selected: boolean,
  ) {
    const step = steps.value[stepId];
    step.selectedIds = selected ? [...allIds] : [];
  }

  // ==================== WebSocket 订阅 ====================

  /**
   * 订阅资产图片生成进度
   */
  function subscribeToAssetImageProgress() {
    const ws = wsStore.socket;
    console.log(
      "[subscribeToAssetImageProgress] ws exists:",
      !!ws,
      "connected:",
      ws?.connected,
    );

    // 如果 WebSocket 未连接，依赖 initGlobalWsListeners 中的 ensureWebSocketConnected
    // 在连接成功后通过 watchReconnection 重新调用此函数
    if (!ws) {
      console.warn(
        "[subscribeToAssetImageProgress] WebSocket 未连接，等待连接后自动注册监听器",
      );
      return;
    }

    // 记录是否是重新注册
    const wasRegistered = ws.hasListeners("asset:image-progress");
    console.log("[subscribeToAssetImageProgress] 监听器已注册:", wasRegistered);

    // 移除旧的监听器（避免重复）
    ws.off("asset:image-progress");

    // 注册监听器（即使 WebSocket 未完全连接，socket.io 也会在连接后生效）
    ws.on(
      "asset:image-progress",
      (data: {
        scriptId: string;
        refId: string;
        taskId: string;
        status: "pending" | "processing" | "completed" | "failed";
        progress: number;
        result?: { imageId: string; url: string; thumbnailUrl: string };
        error?:
          | string
          | { code?: string; message?: string; recoverable?: boolean };
      }) => {
        console.log(
          "[asset:image-progress] 收到图片进度事件:",
          JSON.stringify(data),
        );
        console.log(
          "[asset:image-progress] 当前 scriptId:",
          scriptId.value,
          "事件 scriptId:",
          data.scriptId,
        );

        if (data.scriptId !== scriptId.value) {
          console.log("[asset:image-progress] scriptId 不匹配，忽略");
          return;
        }

        const stepKey = _findAssetStepByRefId(data.refId);
        console.log(
          "[asset:image-progress] stepKey:",
          stepKey,
          "refId:",
          data.refId,
        );
        if (!stepKey) {
          console.warn(
            "[asset:image-progress] 未找到对应的 stepKey, refId:",
            data.refId,
          );
          // 打印当前所有资产 ID 帮助调试
          console.log(
            "[asset:image-progress] 当前角色 IDs:",
            steps.value.characters.items.map((c) => c.id),
          );
          console.log(
            "[asset:image-progress] 当前场景 IDs:",
            steps.value.scenes.items.map((s) => s.id),
          );
          console.log(
            "[asset:image-progress] 当前道具 IDs:",
            steps.value.props.items.map((p) => p.id),
          );
          console.log(
            "[asset:image-progress] 当前分镜 IDs:",
            steps.value.storyboards.items.map((sb) => sb.id),
          );
          return;
        }

        const step = steps.value[stepKey];
        console.log(
          "[asset:image-progress] status:",
          data.status,
          "progress:",
          data.progress,
        );

        if (data.status === "pending" || data.status === "processing") {
          step.imageGenerationProgress[data.refId] = data.progress || 0;
          console.log(
            "[asset:image-progress] 更新进度:",
            data.refId,
            data.progress,
          );
        } else if (data.status === "completed" && data.result) {
          console.log(
            "[asset:image-progress] 图片生成完成，URL:",
            data.result.url,
          );
          console.log(
            "[asset:image-progress] imageId:",
            data.result.imageId,
            "thumbnailUrl:",
            data.result.thumbnailUrl,
          );
          const newImage = {
            id: data.result.imageId,
            url: data.result.url,
            thumbnailUrl: data.result.thumbnailUrl,
            type: "main" as const,
            createdAt: new Date().toISOString(),
          };

          if (stepKey === "storyboards") {
            console.log(
              "[asset:image-progress] 更新分镜图片, refId:",
              data.refId,
            );
            const idx = steps.value.storyboards.items.findIndex(
              (sb) => sb.id === data.refId,
            );
            console.log("[asset:image-progress] 分镜索引:", idx);
            if (idx !== -1) {
              const rawItem = toRaw(steps.value.storyboards.items[idx]);
              const existingImgs = rawItem.images || [];
              const keepRefImgs = existingImgs.filter(
                (img) =>
                  img.type === "reference" || img.type === "video_reference",
              );
              console.log(
                "[asset:image-progress] 保留参考图数量:",
                keepRefImgs.length,
              );
              steps.value.storyboards.items[idx] = {
                ...rawItem,
                images: [...keepRefImgs, newImage],
                mainImageId: newImage.id,
                // Bug-5 修复：重新生成图片时清除框选数据
                // 因为新图片中人物位置可能变化，旧的框选配置不再有效
                characterRegions: {},
                detectedSubjects: [],
                detectionStatus: "pending",
                // 任务 2: 同时清除对话中的 characterRegions
                dialogues: (rawItem.dialogues || []).map((d) => {
                  // 复制对话数据，但删除 characterRegions
                  const { characterRegions: _, ...rest } = d as DialogueItem;
                  return rest as DialogueItem;
                }),
              };
              console.log(
                "[asset:image-progress] 分镜图片更新完成, 图片数量:",
                steps.value.storyboards.items[idx].images?.length,
              );
            }
          } else {
            console.log(
              "[asset:image-progress] 更新资产图片, stepKey:",
              stepKey,
              "refId:",
              data.refId,
            );
            const assetStep = step as (typeof steps.value)["characters"];
            const idx = assetStep.items.findIndex(
              (item) => item.id === data.refId,
            );
            console.log("[asset:image-progress] 资产索引:", idx);
            if (idx !== -1) {
              const rawItem = toRaw(assetStep.items[idx]) as unknown as Record<
                string,
                unknown
              >;
              const existingImgs =
                (rawItem.images as Array<{ type?: string }>) || [];
              const keepRefImgs = existingImgs.filter(
                (img) => img.type === "reference",
              );
              const mergedImages = [...keepRefImgs, newImage];
              console.log(
                "[asset:image-progress] 合并后图片数量:",
                mergedImages.length,
                "保留参考图:",
                keepRefImgs.length,
              );
              assetStep.items[idx] = {
                ...rawItem,
                images: mergedImages,
                assetStatus: "imported",
              } as unknown as CharacterRefWithImages;
              console.log("[asset:image-progress] 资产图片更新完成");
            } else {
              console.warn(
                "[asset:image-progress] 未找到资产, refId:",
                data.refId,
              );
            }
          }

          step.imageGeneratingIds = reactiveSetDelete(
            step.imageGeneratingIds,
            data.refId,
          );
          delete step.imageGenerationProgress[data.refId];
          console.log("[asset:image-progress] 清理生成状态完成");
        } else if (data.status === "failed") {
          console.error(
            "[asset:image-progress] 图片生成失败, refId:",
            data.refId,
            "error:",
            data.error,
          );
          step.imageGeneratingIds = reactiveSetDelete(
            step.imageGeneratingIds,
            data.refId,
          );
          delete step.imageGenerationProgress[data.refId];
          const errorObj = data.error;
          const errMsg =
            typeof errorObj === "object" && errorObj !== null
              ? errorObj.message || "图片生成失败，请重试"
              : errorObj || "图片生成失败，请重试";
          step.imageGenerationErrors[data.refId] = errMsg;
        }
      },
    );
  }

  /**
   * 订阅资产视频生成进度
   */
  function subscribeToAssetVideoProgress() {
    const ws = wsStore.socket;
    if (!ws) return;

    ws.off("asset:video-progress");
    ws.on(
      "asset:video-progress",
      (data: {
        scriptId: string;
        storyboardId: string;
        taskId: string;
        status: "pending" | "processing" | "completed" | "failed";
        progress?: number;
        result?: { videoUrl: string };
        error?: { code: string; message: string; recoverable: boolean };
      }) => {
        if (data.scriptId !== scriptId.value) return;

        const idx = steps.value.storyboards.items.findIndex(
          (sb) => sb.id === data.storyboardId,
        );
        if (idx === -1) return;

        const current = toRaw(steps.value.storyboards.items[idx]);
        if (data.status === "pending" || data.status === "processing") {
          steps.value.storyboards.items[idx] = {
            ...current,
            // 更新新架构字段 video（VideoEditor 优先使用此字段）
            video: {
              ...current.video,
              status: data.status,
              taskId: data.taskId,
              url: current.video?.url,
            },
            // 同时更新旧架构字段 videoGeneration（向后兼容）
            videoGeneration: {
              ...current.videoGeneration,
              status: data.status,
              taskId: data.taskId,
              progress: data.progress,
            },
          };
        } else if (data.status === "completed" && data.result) {
          steps.value.storyboards.items[idx] = {
            ...current,
            // 更新新架构字段 video
            video: {
              status: "completed",
              url: data.result.videoUrl,
              taskId: data.taskId,
            },
            // 同时更新旧架构字段 videoGeneration
            videoGeneration: {
              ...current.videoGeneration,
              status: "completed",
              videoUrl: data.result.videoUrl,
              taskId: data.taskId,
              progress: 100,
            },
          };
        } else if (data.status === "failed") {
          steps.value.storyboards.items[idx] = {
            ...current,
            // 更新新架构字段 video
            video: {
              ...current.video,
              status: "failed",
              taskId: data.taskId,
            },
            // 同时更新旧架构字段 videoGeneration
            videoGeneration: {
              ...current.videoGeneration,
              status: "failed",
              taskId: data.taskId,
            },
          };
        }
      },
    );
  }

  /**
   * 订阅分镜批量生成进度
   */
  function subscribeToStoryboardGenerateProgress() {
    const ws = wsStore.socket;
    if (!ws) return;

    ws.off("storyboard:generate-progress");
    ws.on(
      "storyboard:generate-progress",
      (data: { scriptId: string; progress: number; currentScene?: string }) => {
        if (data.scriptId !== scriptId.value) return;
        steps.value.storyboards.status = "processing";
      },
    );

    ws.off("storyboard:generate-done");
    ws.on(
      "storyboard:generate-done",
      (data: {
        scriptId: string;
        storyboards: Array<Record<string, unknown>>;
      }) => {
        if (data.scriptId !== scriptId.value) return;

        const rawStoryboards = data.storyboards || [];
        const chars = steps.value.characters.items;
        // Phase 4: ref 无 name，使用 resolvedAssets 构建名称映射
        const charNameToId = new Map(chars.map((c) => {
          const name = c.characterId
            ? getResolvedCharacterById(c.characterId)?.name
            : undefined;
          return [name || c.id.slice(0, 8), c.id];
        }));

        const mapped = rawStoryboards.map((sb) => {
          // 判断是否有非旁白对话
          const dialogues = (sb.dialogues as Array<Record<string, unknown>>) || [];
          const hasDialogue = dialogues.some((d) => !(d.isVoiceover as boolean));

          // 根据对话情况动态设置默认值
          const defaultReferenceMode = "multi_reference";
          const defaultVideoMode = hasDialogue ? "audio_reference" : "video_only";

          return {
            id: sb.id as string,
            sequenceNumber: sb.sequenceNumber as number,
            title: sb.title as string | undefined,
            description: (sb.description as string) || "",
            characterIds: (sb.characterIds as string[]) || [],
            sceneId: sb.sceneId as string | undefined,
            propIds: (sb.propIds as string[]) || [],
            duration: (sb.duration as number) || 3,
            status: "pending" as StepStatusType,
            mode: (sb.mode as "standard" | "quick" | "locked") || "standard",
            referenceMode:
              (sb.referenceMode as "multi_reference" | "single_reference") ||
              defaultReferenceMode,
            videoMode:
              (sb.videoMode as "audio_reference" | "lip_sync" | "video_only") ||
              defaultVideoMode,
            dialogues: dialogues.map((d) => ({
              id: d.id as string,
              characterId:
                (d.characterId as string) ||
                charNameToId.get(d.characterName as string),
              characterName: (d.characterName as string) || "",
              text: d.text as string,
              emotion: d.emotion as string | undefined,
              isVoiceover: (d.isVoiceover as boolean) || false,
            })),
            shotType: sb.shotType as string | undefined,
            cameraAngle: sb.cameraAngle as string | undefined,
            cameraMovement: sb.cameraMovement as string | undefined,
          };
        });

        const existingStoryboards = steps.value.storyboards.items;
        const mergedMapped = mapped.map((newSb) => {
          const existing = existingStoryboards.find(
            (old) => old.id === newSb.id,
          );
          if (existing) {
            return {
              ...newSb,
              images: existing.images || [],
              referenceImages: existing.referenceImages || [],
              videoGeneration: existing.videoGeneration,
            };
          }
          return newSb;
        });

        steps.value.storyboards.items = mergedMapped;
        steps.value.storyboards.status = "processing";
        steps.value.storyboards.currentTaskId = undefined;
      },
    );

    ws.off("storyboard:generate-failed");
    ws.on(
      "storyboard:generate-failed",
      (data: { scriptId: string; error?: string }) => {
        if (data.scriptId !== scriptId.value) return;
        steps.value.storyboards.status = "failed";
        steps.value.storyboards.currentTaskId = undefined;
      },
    );
  }

  /**
   * 订阅资产 CRUD 事件（用于分段解析实时推送）
   * 监听角色/场景/道具/分镜的创建、更新、删除事件
   */
  function subscribeToAssetCrudEvents() {
    const ws = wsStore.socket;
    if (!ws) {
      console.warn("[subscribeToAssetCrudEvents] WebSocket 未连接");
      return;
    }

    // ========== 角色事件 ==========

    // 移除旧的监听器
    ws.off(WsEventNames.ASSET_CHARACTER_UPDATE);
    ws.off(WsEventNames.ASSET_CHARACTER_DELETE);

    // 监听角色更新事件
    ws.on(
      WsEventNames.ASSET_CHARACTER_UPDATE,
      (data: {
        scriptId: string;
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        importance?: "protagonist" | "supporting" | "minor";
        gender?: "male" | "female" | "other" | "unknown";
        age?: string;
        personality?: string;
        createdAt: string;
      }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log(
          "[asset:character-update] 收到角色更新:",
          data.refId,
          data.name,
        );

        // 构建完整的 CharacterRef 对象（Phase 4: 运行时包含 images/mainImageId）
        const existingChar = characterMap.value.get(data.refId);
        const character: CharacterRef = {
          id: data.refId,
          characterId: data.assetId || existingChar?.characterId, // 优先使用后端推送的 assetId
          importance: data.importance || "minor",
          assetStatus: existingChar?.assetStatus || "none",
          // 运行时追加字段（图片生成后）
          images: (existingChar as unknown as Record<string, unknown>)?.images as Array<{ type: string; url?: string }> | undefined,
          mainImageId: (existingChar as unknown as Record<string, unknown>)?.mainImageId as string | undefined,
          // 解析结果/WebSocket 推送自带 name/description 等字段
          name: data.name,
          description: data.description,
          age: data.age,
          personality: data.personality,
          gender: data.gender,
        } as unknown as CharacterRef;

        _updateCharacterInMap(character);
      },
    );

    // 监听角色删除事件
    ws.on(
      WsEventNames.ASSET_CHARACTER_DELETE,
      (data: { scriptId: string; refId: string }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log("[asset:character-delete] 收到角色删除:", data.refId);
        _removeCharacterFromMap(data.refId);
      },
    );

    // ========== 场景事件 ==========

    ws.off(WsEventNames.ASSET_SCENE_UPDATE);
    ws.off(WsEventNames.ASSET_SCENE_DELETE);

    ws.on(
      WsEventNames.ASSET_SCENE_UPDATE,
      (data: {
        scriptId: string;
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        setting?: {
          timeOfDay?: "morning" | "afternoon" | "evening" | "night" | "unknown";
          weather?:
            | "clear"
            | "cloudy"
            | "rainy"
            | "snowy"
            | "foggy"
            | "unknown";
        };
        createdAt: string;
      }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log(
          "[asset:scene-update] 收到场景更新:",
          data.refId,
          data.name,
        );

        const existingScene = sceneMap.value.get(data.refId);
        const scene: SceneRef = {
          id: data.refId,
          sceneId: data.assetId || existingScene?.sceneId, // 优先使用后端推送的 assetId
          assetStatus: existingScene?.assetStatus || "none",
          dialogues: existingScene?.dialogues,
          // 运行时追加字段
          images: (existingScene as unknown as Record<string, unknown>)?.images as Array<{ type: string; url?: string }> | undefined,
          mainImageId: (existingScene as unknown as Record<string, unknown>)?.mainImageId as string | undefined,
          // 解析结果/WebSocket 推送自带 name/description 等字段
          name: data.name,
          description: data.description,
        } as unknown as SceneRef;

        _updateSceneInMap(scene);
      },
    );

    ws.on(
      WsEventNames.ASSET_SCENE_DELETE,
      (data: { scriptId: string; refId: string }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log("[asset:scene-delete] 收到场景删除:", data.refId);
        _removeSceneFromMap(data.refId);
      },
    );

    // ========== 道具事件 ==========

    ws.off(WsEventNames.ASSET_PROP_UPDATE);
    ws.off(WsEventNames.ASSET_PROP_DELETE);

    ws.on(
      WsEventNames.ASSET_PROP_UPDATE,
      (data: {
        scriptId: string;
        refId: string;
        assetId?: string;
        name: string;
        description?: string;
        category?: "props" | "costume" | "makeup" | "equipment";
        createdAt: string;
      }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log("[asset:prop-update] 收到道具更新:", data.refId, data.name);

        const existingProp = propMap.value.get(data.refId);
        const prop: PropRef = {
          id: data.refId,
          propId: data.assetId || existingProp?.propId, // 优先使用后端推送的 assetId
          assetStatus: existingProp?.assetStatus || "none",
          // 运行时追加字段
          images: (existingProp as unknown as Record<string, unknown>)?.images as Array<{ type: string; url?: string }> | undefined,
          mainImageId: (existingProp as unknown as Record<string, unknown>)?.mainImageId as string | undefined,
          // 解析结果/WebSocket 推送自带 name/description/category 等字段
          name: data.name,
          description: data.description,
          category: data.category,
        } as unknown as PropRef;

        _updatePropInMap(prop);
      },
    );

    ws.on(
      WsEventNames.ASSET_PROP_DELETE,
      (data: { scriptId: string; refId: string }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log("[asset:prop-delete] 收到道具删除:", data.refId);
        _removePropFromMap(data.refId);
      },
    );

    // ========== 分镜事件 ==========

    ws.off(WsEventNames.ASSET_STORYBOARD_UPDATE);
    ws.off(WsEventNames.ASSET_STORYBOARD_DELETE);

    ws.on(
      WsEventNames.ASSET_STORYBOARD_UPDATE,
      (data: {
        scriptId: string;
        storyboardId: string;
        sequenceNumber: number;
        sceneId?: string;
        characterIds: string[];
        propIds: string[];
        dialogues: Array<{
          id: string;
          characterId?: string;
          characterName: string;
          text: string;
          emotion?: string;
          isVoiceover?: boolean;
          actions?: string[];
        }>;
        description: string;
        shotType?: string;
        cameraAngle?: string;
        duration?: number;
        createdAt: string;
      }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log(
          "[asset:storyboard-update] 收到分镜更新:",
          data.storyboardId,
        );

        // 查找现有分镜
        const idx = steps.value.storyboards.items.findIndex(
          (sb) => sb.id === data.storyboardId,
        );

        const existingStoryboard =
          idx !== -1 ? steps.value.storyboards.items[idx] : null;

        // 将 sceneId 转换为数据库 UUID（WebSocket 推送的是前端格式 ID）
        let sceneId = data.sceneId;
        if (sceneId) {
          const scene = sceneMap.value.get(sceneId);
          if (scene?.sceneId) {
            sceneId = scene.sceneId; // 使用数据库 UUID
          }
        }

        // 将 propIds 转换为数据库 UUID（WebSocket 推送的是前端格式 ID）
        const propIds = (data.propIds || []).map((propId: string) => {
          const prop = propMap.value.get(propId);
          return prop?.propId || propId; // 优先使用数据库 UUID
        });

        const storyboard: StoryboardRef = {
          id: data.storyboardId,
          sequenceNumber: data.sequenceNumber,
          description: data.description,
          characterIds: data.characterIds,
          sceneId,
          propIds,
          dialogues: data.dialogues.map((d) => ({
            id: d.id,
            characterId: d.characterId,
            characterName: d.characterName,
            text: d.text,
            emotion: d.emotion,
            actions: d.actions || [], // 修复：保留 actions 字段
            isVoiceover: d.isVoiceover || false,
          })),
          shotType: data.shotType,
          cameraAngle: data.cameraAngle,
          duration: data.duration || 3,
          status: "pending",
          mode: existingStoryboard?.mode || "standard",
          referenceMode: existingStoryboard?.referenceMode || "multi_reference",
          // 未设置时按对话情况动态判断：有对话 → audio_reference，无对话/旁白 → video_only
          videoMode: existingStoryboard?.videoMode ?? (data.dialogues.some((d: { isVoiceover?: boolean }) => !d.isVoiceover) ? "audio_reference" : "video_only"),
          images: existingStoryboard?.images || [],
          mainImageId: existingStoryboard?.mainImageId,
          videoGeneration: existingStoryboard?.videoGeneration,
          createdAt: data.createdAt,
          updatedAt: new Date().toISOString(),
        };

        if (idx !== -1) {
          steps.value.storyboards.items[idx] = storyboard;
        } else {
          // 新增分镜，按 sequenceNumber 排序插入
          steps.value.storyboards.items.push(storyboard);
          steps.value.storyboards.items.sort(
            (a, b) => a.sequenceNumber - b.sequenceNumber,
          );
        }
      },
    );

    ws.on(
      WsEventNames.ASSET_STORYBOARD_DELETE,
      (data: { scriptId: string; storyboardId: string }) => {
        if (data.scriptId !== scriptId.value) return;

        console.log(
          "[asset:storyboard-delete] 收到分镜删除:",
          data.storyboardId,
        );
        steps.value.storyboards.items = steps.value.storyboards.items.filter(
          (sb) => sb.id !== data.storyboardId,
        );
      },
    );

    console.log("[subscribeToAssetCrudEvents] 资产 CRUD 事件监听器已注册");
  }

  // ==================== 分镜组 WebSocket 事件（重构后新增）====================

  /**
   * 订阅分镜组主体检测完成事件
   */
  function subscribeToShotGroupSubjectsDetected() {
    const ws = wsStore.socket;
    if (!ws) {
      console.warn("[subscribeToShotGroupSubjectsDetected] WebSocket 未连接");
      return;
    }

    // 移除旧的监听器
    ws.off("shotGroup:subjects-detected");

    // 注册监听器
    ws.on(
      "shotGroup:subjects-detected",
      (data: {
        shotGroupId: string;
        detectionStatus: "pending" | "processing" | "completed" | "failed";
        detectedSubjects?: Array<{
          index: number;
          region: {
            x: number;
            y: number;
            width: number;
            height: number;
          };
          maskKey?: string;
          previewKey?: string;
          area?: number;
        }>;
        detectionError?: string;
        mainImageVersion?: number;
      }) => {
        console.log("[shotGroup:subjects-detected] 收到主体检测结果:", data);
        console.log("[shotGroup:subjects-detected] detectedSubjects 详细数据:", data.detectedSubjects);

        // 查找对应的分镜组并更新状态
        const shotGroup = steps.value.storyboards.items.find(
          (sb) => sb.id === data.shotGroupId,
        );
        if (shotGroup) {
          // 更新检测状态（使用 any 暂时绕过类型检查，后续迁移到 ShotGroup 类型）
          (shotGroup as unknown as Record<string, unknown>).detectionStatus =
            data.detectionStatus;
          (shotGroup as unknown as Record<string, unknown>).detectedSubjects =
            data.detectedSubjects;
          (shotGroup as unknown as Record<string, unknown>).detectionError =
            data.detectionError;
          (shotGroup as unknown as Record<string, unknown>).mainImageVersion =
            data.mainImageVersion;

          // 新增：检测完成后判断是否需要自动弹出确认面板
          if (data.detectionStatus === "completed") {
            // 判断是否需要自动弹出
            const hasSubjects = data.detectedSubjects && data.detectedSubjects.length > 0;
            const hasCharacters = (shotGroup as unknown as { characterIds?: string[] }).characterIds &&
              ((shotGroup as unknown as { characterIds?: string[] }).characterIds?.length || 0) > 0;
            const notUserClosed = !userClosedRegionPanel.value[data.shotGroupId];

            if (hasSubjects && hasCharacters && notUserClosed) {
              console.log("[shotGroup:subjects-detected] 满足自动弹出条件，发射信号");
              emitAutoOpenRegionPanel(data.shotGroupId);
            } else if (!hasSubjects) {
              // 无主体时仅记录日志，UI 层可显示提示
              console.log("[shotGroup:subjects-detected] 未检测到主体，不弹出面板");
            }
          }
        }
      },
    );

    console.log(
      "[subscribeToShotGroupSubjectsDetected] 分镜组主体检测事件监听器已注册",
    );
  }

  /**
   * 订阅分镜视频生成进度事件
   */
  function subscribeToShotVideoProgress() {
    const ws = wsStore.socket;
    if (!ws) {
      console.warn("[subscribeToShotVideoProgress] WebSocket 未连接");
      return;
    }

    // 移除旧的监听器
    ws.off("shot:video-progress");

    // 注册监听器
    ws.on(
      "shot:video-progress",
      (data: {
        shotGroupId: string;
        shotId: string;
        status: "pending" | "processing" | "completed" | "failed";
        progress: number;
        videoUrl?: string;
        error?: string;
      }) => {
        console.log("[shot:video-progress] 收到分镜视频进度:", data);

        // 查找对应的分镜组
        const shotGroup = steps.value.storyboards.items.find(
          (sb) => sb.id === data.shotGroupId,
        );
        if (!shotGroup) {
          console.warn(
            `[shot:video-progress] 未找到分镜组: ${data.shotGroupId}`,
          );
          return;
        }

        // 查找对应的 shot
        const shots = shotGroup.shots || [];
        const shotIndex = shots.findIndex((s) => s.id === data.shotId);
        if (shotIndex === -1) {
          console.warn(`[shot:video-progress] 未找到 shot: ${data.shotId}`);
          return;
        }

        // 更新 shot 数据
        const shot = shots[shotIndex];
        const updatedShot = {
          ...shot,
          status: data.status,
          progress: data.progress,
          videoUrl: data.videoUrl || shot.videoUrl,
          error: data.error,
        };

        // 创建新的 shots 数组
        const newShots = [...shots];
        newShots[shotIndex] = updatedShot;

        // 更新整个 shotGroup 对象以触发深层响应式更新
        // 这确保了 MediaBlock 组件中的 computed 能正确追踪变化
        const shotGroupIndex = steps.value.storyboards.items.findIndex(
          (sb) => sb.id === data.shotGroupId,
        );
        if (shotGroupIndex !== -1) {
          steps.value.storyboards.items[shotGroupIndex] = {
            ...shotGroup,
            shots: newShots,
          };
        }

        console.log(
          `[shot:video-progress] 更新 shot ${data.shotId} 状态: ${data.status}, 进度: ${data.progress}%, 已完成视频数: ${newShots.filter(s => s.status === 'completed' && s.videoUrl).length}`,
        );
      },
    );

    console.log("[subscribeToShotVideoProgress] 分镜视频进度事件监听器已注册");
  }

  /**
   * 初始化分镜组相关事件订阅
   */
  function initShotGroupEventSubscriptions() {
    subscribeToShotGroupSubjectsDetected();
    subscribeToShotVideoProgress();
  }

  /**
   * 根据 refId 查找资产步骤
   */
  function _findAssetStepByRefId(
    refId: string,
  ): AssetStepKey | "storyboards" | null {
    if (steps.value.characters.items.some((c) => c.id === refId))
      return "characters";
    if (steps.value.scenes.items.some((s) => s.id === refId)) return "scenes";
    if (steps.value.props.items.some((p) => p.id === refId)) return "props";
    if (steps.value.storyboards.items.some((sb) => sb.id === refId))
      return "storyboards";
    return null;
  }

  // ==================== 图片/视频操作 ====================

  /**
   * 删除资产图片
   * Phase 4：不再读写 content 中的 images，删除后刷新 resolvedAssets 同步最新数据
   */
  async function deleteAssetImage(
    refId: string,
    imageId: string,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    await scriptApi.deleteAssetImage(
      projectId.value,
      scriptId.value,
      refId,
      imageId,
    );
    await refreshResolvedAssets();
  }

  /**
   * 上传参考图
   * Phase 4：不再写入 content.images，上传后刷新 resolvedAssets 同步最新数据
   */
  async function uploadReferenceImage(
    refId: string,
    file: File,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    await scriptApi.uploadAssetReferenceImageFile(
      projectId.value,
      scriptId.value,
      refId,
      file,
    );
    await refreshResolvedAssets();
  }

  /**
   * 上传视频参考图
   * Phase 4：不再写入 content.images，上传后刷新 resolvedAssets 同步最新数据
   */
  async function uploadVideoReferenceImage(
    refId: string,
    file: File,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    await scriptApi.uploadAssetVideoReferenceImageFile(
      projectId.value,
      scriptId.value,
      refId,
      file,
    );
    await refreshResolvedAssets();
  }

  /**
   * 上传主图
   * Phase 4：不再写入 content.images，上传后刷新 resolvedAssets 同步最新数据
   */
  async function uploadMainImage(refId: string, file: File): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    await scriptApi.uploadAssetImageFile(
      projectId.value,
      scriptId.value,
      refId,
      file,
      "main",
    );
    await refreshResolvedAssets();
  }

  // ==================== 分镜组图片上传/删除 ====================

  /**
   * 上传分镜组参考图
   * 直接更新本地 store 中的 images 数组，上传后同步到后端
   */
  async function uploadShotGroupReferenceImage(
    shotGroupId: string,
    file: File,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    const response = await scriptApi.uploadShotGroupImageFile(
      projectId.value,
      scriptId.value,
      shotGroupId,
      file,
      "reference",
    );

    // 更新本地 store 中的 images 数组
    const index = steps.value.storyboards.items.findIndex(
      (sb) => sb.id === shotGroupId,
    );
    if (index !== -1) {
      const existing = steps.value.storyboards.items[index];
      const existingImages = existing.images || [];
      const newImage = {
        id: response.data.id,
        url: response.data.url,
        type: "reference" as const,
        createdAt: response.data.createdAt,
      };
      const updated = {
        ...existing,
        images: [...existingImages, newImage],
      };
      steps.value.storyboards.items.splice(index, 1, updated);
    }
  }

  /**
   * 上传分镜组视频参考图
   */
  async function uploadShotGroupVideoReferenceImage(
    shotGroupId: string,
    file: File,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    const response = await scriptApi.uploadShotGroupImageFile(
      projectId.value,
      scriptId.value,
      shotGroupId,
      file,
      "video_reference",
    );

    const index = steps.value.storyboards.items.findIndex(
      (sb) => sb.id === shotGroupId,
    );
    if (index !== -1) {
      const existing = steps.value.storyboards.items[index];
      const existingImages = existing.images || [];
      const newImage = {
        id: response.data.id,
        url: response.data.url,
        type: "video_reference" as const,
        createdAt: response.data.createdAt,
      };
      const updated = {
        ...existing,
        images: [...existingImages, newImage],
      };
      steps.value.storyboards.items.splice(index, 1, updated);
    }
  }

  /**
   * 上传分镜组主图
   */
  async function uploadShotGroupMainImage(
    shotGroupId: string,
    file: File,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    const response = await scriptApi.uploadShotGroupImageFile(
      projectId.value,
      scriptId.value,
      shotGroupId,
      file,
      "main",
    );

    const index = steps.value.storyboards.items.findIndex(
      (sb) => sb.id === shotGroupId,
    );
    if (index !== -1) {
      const existing = steps.value.storyboards.items[index];
      const existingImages = existing.images || [];
      // 移除已有的 main 图片
      const filteredImages = existingImages.filter((img) => img.type !== "main");
      const newImage = {
        id: response.data.id,
        url: response.data.url,
        type: "main" as const,
        createdAt: response.data.createdAt,
      };
      const updated = {
        ...existing,
        images: [...filteredImages, newImage],
        mainImageId: response.data.id,
        mainImageKey: response.data.url,
      };
      steps.value.storyboards.items.splice(index, 1, updated);
    }
  }

  /**
   * 删除分镜组图片
   */
  async function deleteShotGroupImage(
    shotGroupId: string,
    imageId: string,
  ): Promise<void> {
    if (!projectId.value || !scriptId.value) return;

    await scriptApi.deleteShotGroupImage(
      projectId.value,
      scriptId.value,
      shotGroupId,
      imageId,
    );

    // 更新本地 store 中的 images 数组
    const index = steps.value.storyboards.items.findIndex(
      (sb) => sb.id === shotGroupId,
    );
    if (index !== -1) {
      const existing = steps.value.storyboards.items[index];
      const existingImages = existing.images || [];
      const imageToDelete = existingImages.find((img) => img.id === imageId);
      const newImages = existingImages.filter((img) => img.id !== imageId);
      const updates: Partial<typeof existing> = {
        images: newImages,
      };
      // 如果删除的是 main 图片，同步清除 mainImageId 和 mainImageKey
      if (imageToDelete?.type === "main") {
        updates.mainImageId = undefined;
        updates.mainImageKey = undefined;
      }
      const updated = {
        ...existing,
        ...updates,
      };
      steps.value.storyboards.items.splice(index, 1, updated);
    }
  }

  // ==================== 基础信息更新（素材库 API）====================

  /**
   * 更新资产基础信息
   * Phase 4：name/description/gender/age 等基础字段存储在独立资产表中
   * 不再通过 updateScript content 保存，改为直接调用素材库 API
   */
  async function updateAssetBaseInfo(
    assetType: AssetType,
    assetId: string,
    data: Record<string, string | undefined>,
  ): Promise<void> {
    if (!assetId) {
      throw new Error("资产ID未设置");
    }

    try {
      if (assetType === "character") {
        const dto: UpdateCharacterDto = {};
        if (data.name !== undefined) dto.name = data.name;
        if (data.description !== undefined) dto.description = data.description;
        if (data.gender !== undefined) dto.gender = data.gender as "male" | "female" | "other" | "unknown";
        if (data.age !== undefined) dto.age = data.age;
        await characterApi.updateCharacter(assetId, dto);
      } else if (assetType === "scene") {
        const dto: UpdateSceneDto = {};
        if (data.name !== undefined) dto.name = data.name;
        if (data.description !== undefined) dto.description = data.description;
        await sceneApi.updateScene(assetId, dto);
      } else if (assetType === "prop") {
        const dto: UpdatePropDto = {};
        if (data.name !== undefined) dto.name = data.name;
        if (data.description !== undefined) dto.description = data.description;
        await propApi.updateProp(assetId, dto);
      }

      // 刷新 resolvedAssets 同步最新数据到 UI
      await refreshResolvedAssets();
    } catch (error) {
      console.error(`更新${assetType}基础信息失败:`, error);
      throw error;
    }
  }

  // ==================== Composable 包装 ====================

  /**
   * 生成资产图片
   */
  async function generateAssetImage(
    refId: string,
    assetType: AssetType,
    options?: {
      modelId?: string;
      customPrompt?: string;
      negativePrompt?: string;
    },
  ): Promise<void> {
    return _generateAssetImage(
      storeRefs,
      subscribeToAssetImageProgress,
      subscribeToTask,
      refId,
      assetType,
      options,
    );
  }

  /**
   * 批量生成资产图片
   */
  async function batchGenerateAssetImages(
    assetType: AssetType,
    options?: { modelId?: string; negativePrompt?: string },
  ): Promise<void> {
    return _batchGenerateAssetImages(
      storeRefs,
      subscribeToAssetImageProgress,
      subscribeToTask,
      assetType,
      options,
    );
  }

  /**
   * 批量查重刷新
   */
  async function checkAndApplyDedup(): Promise<void> {
    return _checkAndApplyDedup(projectId.value, scriptId.value, loadScript);
  }

  /**
   * 根据图片状态更新资产步骤状态
   */
  function updateAssetStepStatusFromImages(
    stepId: AssetStepKey,
    imagesMap: Record<string, { length: number }>,
  ) {
    return _updateAssetStepStatusFromImages(steps.value, stepId, imagesMap);
  }

  /**
   * 生成分镜图片
   */
  async function generateStoryboardImage(
    storyboardId: string,
    options?: { modelId?: string },
  ): Promise<void> {
    return _generateStoryboardImage(
      storeRefs,
      subscribeToAssetImageProgress,
      subscribeToTask,
      storyboardId,
      options,
    );
  }

  /**
   * 生成分镜视频
   */
  async function generateStoryboardVideo(
    storyboardId: string,
    options?: { modelId?: string; imageUrl?: string; imageUrls?: string[] },
  ): Promise<void> {
    return _generateStoryboardVideo(
      storeRefs,
      subscribeToAssetVideoProgress,
      subscribeToTask,
      storyboardId,
      options,
    );
  }

  /**
   * 生成分镜对话
   */
  async function generateStoryboardDialogue(
    storyboardId: string,
    options?: { modelId?: string },
  ): Promise<void> {
    return _generateStoryboardDialogue(storeRefs, storyboardId, options);
  }

  /**
   * 生成对话音频
   */
  async function generateDialogueAudio(
    storyboardId: string,
    dialogueId: string,
    options?: { voiceId?: string; speed?: number },
  ): Promise<void> {
    // Bug #2 调试：打印函数调用
    console.log("[store generateDialogueAudio] 被调用", { storyboardId, dialogueId, options });

    const { projectId, scriptId, steps } = storeRefs;
    const pid = projectId.value;
    const sid = scriptId.value;

    console.log("[store generateDialogueAudio] pid:", pid, "sid:", sid);

    if (!pid || !sid) {
      throw new Error("projectId 或 scriptId 未设置");
    }

    // 设置音频生成状态
    const storyboard = steps.value.storyboards.items.find(
      (s) => s.id === storyboardId,
    );
    console.log("[store generateDialogueAudio] 找到 storyboard:", !!storyboard);

    if (storyboard) {
      const dialogue = storyboard.dialogues?.find((d) => d.id === dialogueId);
      console.log("[store generateDialogueAudio] 找到 dialogue:", !!dialogue);
      if (dialogue) {
        dialogue.audioStatus = "processing";
        console.log("[store generateDialogueAudio] 设置 audioStatus = processing");
      }
    }

    try {
      // 从 dialogue 中读取 instructions 并传递给 API
      const dialogue = storyboard?.dialogues?.find((d) => d.id === dialogueId);
      const requestOptions = {
        ...options,
        instructions: dialogue?.instructions,
      };

      console.log("[store generateDialogueAudio] 调用 API, requestOptions:", requestOptions);
      const response = await scriptApi.generateDialogueAudio(
        pid,
        sid,
        storyboardId,
        dialogueId,
        requestOptions,
      );

      console.log("[store generateDialogueAudio] API 响应:", response);

      // Bug #2 修复：API 响应嵌套在 data 里，需要正确解包
      // 响应结构: {success: true, data: {dialogueId, audioUrl, duration, status}}
      const responseData = (response as { data?: unknown }).data || response;
      const result = responseData as {
        dialogueId: string;
        audioUrl: string;
        duration: number;
        status: "completed";
        shotGroupDuration: number;
      };

      console.log("[store generateDialogueAudio] 解包后 result:", result);

      // 更新对话音频信息
      const sbIdx = steps.value.storyboards.items.findIndex(
        (s) => s.id === storyboardId,
      );
      console.log("[store generateDialogueAudio] sbIdx:", sbIdx);
      if (sbIdx === -1) return;

      const sb = steps.value.storyboards.items[sbIdx];
      // Bug #2 修复：找到 dialogue 在 storyboard.dialogues 数组中的索引
      const dialogueIdx = sb.dialogues?.findIndex((d) => d.id === dialogueId);
      console.log("[store generateDialogueAudio] dialogueIdx:", dialogueIdx);
      if (dialogueIdx !== undefined && dialogueIdx !== -1 && sb.dialogues) {
        // 创建新的对话数组
        const updatedDialogues = [...sb.dialogues];
        updatedDialogues[dialogueIdx] = {
          ...sb.dialogues[dialogueIdx],
          audioUrl: result.audioUrl,
          audioDuration: result.duration,
          audioStatus: "completed" as const,
        };
        console.log("[store generateDialogueAudio] updatedDialogue:", updatedDialogues[dialogueIdx]);
        // Bug #2 关键修复：创建新的 storyboard 对象
        const updatedStoryboard = {
          ...sb,
          dialogues: updatedDialogues,
          duration: result.shotGroupDuration,
        };
        // Bug #2 关键修复：创建整个 items 数组的新副本，确保 Vue 检测到变化
        const newItems = [...steps.value.storyboards.items];
        newItems[sbIdx] = updatedStoryboard;
        // Bug #2 关键修复：直接替换整个 items 数组
        steps.value.storyboards.items = newItems;
        console.log("[store generateDialogueAudio] 替换 items 数组完成");

        // 同步到 script.content.shotGroups（持久化数据源）
        const content = script.value?.content as Record<string, unknown> | undefined;
        if (content?.shotGroups) {
          const shotGroups = content.shotGroups as Array<Record<string, unknown>>;
          const sgIdx = shotGroups.findIndex((sg) => sg.id === storyboardId);
          if (sgIdx !== -1) {
            shotGroups[sgIdx] = { ...shotGroups[sgIdx], duration: result.shotGroupDuration };
          }
        }
      }
    } catch (error) {
      // 更新状态为 failed
      const sbIdx = steps.value.storyboards.items.findIndex(
        (s) => s.id === storyboardId,
      );
      if (sbIdx !== -1) {
        const sb = steps.value.storyboards.items[sbIdx];
        const dialogueIdx = sb.dialogues?.findIndex((d) => d.id === dialogueId);
        if (dialogueIdx !== undefined && dialogueIdx !== -1 && sb.dialogues) {
          const updatedDialogues = [...sb.dialogues];
          updatedDialogues[dialogueIdx] = {
            ...sb.dialogues[dialogueIdx],
            audioStatus: "failed" as const,
          };
          const updatedStoryboard = {
            ...sb,
            dialogues: updatedDialogues,
          };
          // Bug #2 关键修复：直接替换整个 items 数组
          const newItems = [...steps.value.storyboards.items];
          newItems[sbIdx] = updatedStoryboard;
          steps.value.storyboards.items = newItems;
        }
      }
      throw error;
    }
  }

  /**
   * 删除对话音频
   */
  async function deleteDialogueAudio(
    storyboardId: string,
    dialogueId: string,
  ): Promise<void> {
    const { projectId, scriptId, steps } = storeRefs;
    const pid = projectId.value;
    const sid = scriptId.value;

    if (!pid || !sid) {
      throw new Error("projectId 或 scriptId 未设置");
    }

    const response = await scriptApi.deleteDialogueAudio(pid, sid, storyboardId, dialogueId);

    // 解包后端返回的 shotGroupDuration
    const responseData = (response as unknown as { data?: { shotGroupDuration: number } }).data;
    const shotGroupDuration = responseData?.shotGroupDuration;

    // 清除对话音频信息：创建新数组确保 Vue 响应式追踪
    const sbIdx = steps.value.storyboards.items.findIndex(
      (s) => s.id === storyboardId,
    );
    if (sbIdx !== -1) {
      const sb = steps.value.storyboards.items[sbIdx];
      const dialogueIdx = sb.dialogues?.findIndex((d) => d.id === dialogueId);
      if (dialogueIdx !== undefined && dialogueIdx !== -1 && sb.dialogues) {
        const updatedDialogues = [...sb.dialogues];
        updatedDialogues[dialogueIdx] = {
          ...sb.dialogues[dialogueIdx],
          audioUrl: undefined,
          audioDuration: undefined,
          audioStatus: undefined,
        };
        const updatedStoryboard = {
          ...sb,
          dialogues: updatedDialogues,
          duration: typeof shotGroupDuration === "number" ? shotGroupDuration : sb.duration,
        };
        const newItems = [...steps.value.storyboards.items];
        newItems[sbIdx] = updatedStoryboard;
        steps.value.storyboards.items = newItems;

        // 同步到 script.content.shotGroups（持久化数据源）
        const content = script.value?.content as Record<string, unknown> | undefined;
        if (content?.shotGroups) {
          const shotGroups = content.shotGroups as Array<Record<string, unknown>>;
          const sgIdx = shotGroups.findIndex((sg) => sg.id === storyboardId);
          if (sgIdx !== -1) {
            shotGroups[sgIdx] = { ...shotGroups[sgIdx], duration: updatedStoryboard.duration };
          }
        }
      }
    }
  }

  /**
   * 批量生成分镜所有对话音频
   */
  async function generateStoryboardAudio(
    storyboardId: string,
    options?: { voiceId?: string; speed?: number },
  ): Promise<void> {
    const { projectId, scriptId, steps } = storeRefs;
    const pid = projectId.value;
    const sid = scriptId.value;

    if (!pid || !sid) {
      throw new Error("projectId 或 scriptId 未设置");
    }

    const response = await scriptApi.generateStoryboardAudio(
      pid,
      sid,
      storyboardId,
      options,
    );

    // API 响应已通过拦截器解包
    // 后端返回结构: {success: true, data: {total, results}} 或直接返回数据
    const responseData = response as unknown as {
      success?: boolean;
      data?: {
        total: number;
        results: Array<{
          dialogueId: string;
          audioUrl: string;
          duration: number;
          status: "completed";
          shotGroupDuration: number;
        }>;
      };
      total?: number;
      results?: Array<{
        dialogueId: string;
        audioUrl: string;
        duration: number;
        status: "completed";
        shotGroupDuration: number;
      }>;
    };
    const result = responseData.data || responseData;

    // 更新所有对话音频信息
    const storyboard = steps.value.storyboards.items.find(
      (s) => s.id === storyboardId,
    );
    if (storyboard && storyboard.dialogues && result.results) {
      for (const audioResult of result.results) {
        const dialogue = storyboard.dialogues.find(
          (d) => d.id === audioResult.dialogueId,
        );
        if (dialogue) {
          dialogue.audioUrl = audioResult.audioUrl;
          dialogue.audioDuration = audioResult.duration;
          dialogue.audioStatus = "completed";
        }
      }
      // 同步后端计算的 shotGroupDuration（所有结果中的值相同）
      const shotGroupDuration = result.results[0]?.shotGroupDuration;
      if (typeof shotGroupDuration === "number") {
        storyboard.duration = shotGroupDuration;
      }
    }
  }

  /**
   * 一键生成所有分镜
   */
  async function generateAllStoryboards(modelId?: string) {
    return _generateAllStoryboards(storeRefs, subscribeToTask, modelId);
  }

  /**
   * 根据场景生成基础分镜
   */
  function generateStoryboardsFromScenes(
    scenes: SceneRef[],
    characters: CharacterRef[],
  ) {
    return _generateStoryboardsFromScenes(steps.value, scenes, characters);
  }

  /**
   * 添加 BGM 轨道
   */
  async function addBgmTrack(bgmTrack: {
    id: string;
    url: string;
    duration: number;
    style?: string;
    mode: "overall" | "individual";
    source?: "ai" | "user";
    targetShotGroupId?: string;
    timelineStart: number;
    volume: number;
    muted: boolean;
    modelId?: string;
    createdAt: string;
  }) {
    if (!script.value || !projectId.value || !scriptId.value) return;

    // 保存到后端（使用专用 BGM API）
    try {
      const result = await scriptApi.addBgm(projectId.value, scriptId.value, bgmTrack);
      // 添加到本地状态
      const content = script.value.content as Record<string, unknown> | undefined;
      const currentBgmTracks = (content?.bgmTracks as any[]) || [];
      script.value.content = {
        ...script.value.content,
        bgmTracks: [...currentBgmTracks, result],
      };
    } catch (error) {
      console.error("[addBgmTrack] 保存 BGM 失败:", error);
      throw error;
    }
  }

  /**
   * 删除 BGM 轨道
   */
  async function removeBgmTrack(bgmId: string) {
    if (!script.value || !projectId.value || !scriptId.value) return;

    try {
      await scriptApi.removeBgm(projectId.value, scriptId.value, bgmId);
      // 从本地状态移除
      const content = script.value.content as Record<string, unknown> | undefined;
      const currentBgmTracks = (content?.bgmTracks as any[]) || [];
      script.value.content = {
        ...script.value.content,
        bgmTracks: currentBgmTracks.filter((t: any) => t.id !== bgmId),
      };
    } catch (error) {
      console.error("[removeBgmTrack] 删除 BGM 失败:", error);
      throw error;
    }
  }

  /**
   * 更新 BGM 轨道
   */
  async function updateBgmTrack(
    bgmId: string,
    updates: Partial<{
      url: string;
      duration: number;
      style: string;
      mode: "overall" | "individual";
      targetShotGroupId: string;
      timelineStart: number;
      volume: number;
      muted: boolean;
    }>,
  ) {
    if (!script.value || !projectId.value || !scriptId.value) return;

    try {
      const result = await scriptApi.updateBgm(projectId.value, scriptId.value, bgmId, updates);
      // 更新本地状态
      const content = script.value.content as Record<string, unknown> | undefined;
      const currentBgmTracks = (content?.bgmTracks as any[]) || [];
      script.value.content = {
        ...script.value.content,
        bgmTracks: currentBgmTracks.map((t: any) => (t.id === bgmId ? result : t)),
      };
    } catch (error) {
      console.error("[updateBgmTrack] 更新 BGM 失败:", error);
      throw error;
    }
  }

  /**
   * 加载 BGM 轨道列表
   */
  async function loadBgmTracks() {
    if (!projectId.value || !scriptId.value) return;

    try {
      const result = await scriptApi.getBgmTracks(projectId.value, scriptId.value);
      if (script.value) {
        script.value.content = {
          ...script.value.content,
          bgmTracks: result.data.bgmTracks.map((t: Record<string, unknown>): BgmTrack => ({
            ...(t as unknown as Omit<BgmTrack, "source">),
            source: (t.source as "ai" | "user" | undefined) || "ai",
          })),
        };
      }
    } catch (error) {
      console.error("[loadBgmTracks] 加载 BGM 失败:", error);
    }
  }

  // ==================== 导出 ====================

  return {
    // State
    script,
    projectId,
    scriptId,
    steps,
    loading,
    currentStepId,
    activeTasks,
    creationSettings,

    // 资产 Map（用于快速 ID -> 名称查找）
    characterMap,
    sceneMap,
    propMap,
    // 素材库完整数据映射
    resolvedAssets,

    // Getters
    isLoading,
    canEdit,
    isGenerating,
    completedStepsCount,
    totalStepsCount,
    overallProgress,

    // Actions
    setIds,
    loadScript,
    initializeStepsFromScript,
    updateScriptDescription,
    updateAssetRef,
    startScriptGeneration,
    regenerateScript,
    subscribeToTask,
    cancelCurrentGeneration,
    setCurrentStep,
    updateStepStatus,
    toggleAssetSelection,
    toggleAllAssets,
    updateCreationSettings,
    resetState,
    parseScriptResources,
    parseStoryboards,
    clearStoryboards,
    checkParseTaskStatus,
    subscribeToParseTask,
    updateAssetsFromParseResult,
    generateStoryboardsFromScenes,
    updateAssetStepStatusFromImages,

    // 模型切换
    updateAssetModelId,
    updateStoryboardModelId,
    switchAssetStepModel,

    // 资产管理
    deleteAsset,
    createAndLinkAsset,
    linkExistingAssets,

    // 资产名称查询辅助函数
    getCharacterNameById,
    getSceneNameById,
    getPropNameById,
    getCharacterNamesByIds,
    getPropNamesByIds,

    // 素材库完整数据查询辅助函数
    getResolvedCharacterById,
    getResolvedSceneById,
    getResolvedPropById,

    // 分镜视频/对话/批量生成
    generateStoryboardVideo,
    generateStoryboardDialogue,
    generateAllStoryboards,
    subscribeToStoryboardGenerateProgress,

    // 对话音频生成
    generateDialogueAudio,
    deleteDialogueAudio,
    generateStoryboardAudio,

    // 基础信息更新（素材库 API）
    updateAssetBaseInfo,

    // 资产图片生成
    generateAssetImage,
    generateStoryboardImage,
    batchGenerateAssetImages,
    checkAndApplyDedup,
    subscribeToAssetImageProgress,
    subscribeToAssetVideoProgress,
    uploadReferenceImage,
    uploadVideoReferenceImage,
    uploadMainImage,
    deleteAssetImage,

    // 分镜组图片上传/删除
    uploadShotGroupReferenceImage,
    uploadShotGroupVideoReferenceImage,
    uploadShotGroupMainImage,
    deleteShotGroupImage,

    // 分镜组 WebSocket 事件（重构后新增）
    subscribeToShotGroupSubjectsDetected,
    subscribeToShotVideoProgress,
    initShotGroupEventSubscriptions,

    // 数据保存
    buildContentForSave,

    // shotGroups 兼容层（storyboards → shotGroups 渐进迁移）
    getShotGroups,
    getShotGroupById,
    updateShotGroupData,
    addShotGroup,
    deleteShotGroup,
    getShots,
    updateShotData,

    // BGM 轨道管理
    addBgmTrack,
    removeBgmTrack,
    updateBgmTrack,
    loadBgmTracks,

    // 快照备份/回滚
    createSnapshot,
    restoreSnapshot,
    clearSnapshot,

    // 自动弹出框选面板相关
    autoOpenRegionPanelSignal,
    markRegionPanelUserClosed,
    clearRegionPanelUserClosed,
  };
});

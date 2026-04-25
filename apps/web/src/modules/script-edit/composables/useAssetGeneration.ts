import { scriptApi } from "@/modules/script/api";
import type {
  AssetType,
  AssetStepKey,
  StoryboardRef,
  DialogueItem,
} from "../store/types";
import type { ScriptEditV2State, ResolutionType } from "../store/types";
import type { ScriptContent } from "@pixaura/shared-types";

/**
 * 从 Set 中删除元素并触发 Vue 响应式更新
 * Vue 3 对 Set 的 delete 操作响应式追踪不稳定，使用重新赋值更可靠
 */
export function reactiveSetDelete(set: Set<string>, id: string): Set<string> {
  const newSet = new Set(set);
  newSet.delete(id);
  return newSet;
}

/**
 * 向 Set 中添加元素并触发 Vue 响应式更新
 * Vue 3 对 Set 的 add 操作响应式追踪不稳定，使用重新赋值更可靠
 */
export function reactiveSetAdd(set: Set<string>, id: string): Set<string> {
  if (set.has(id)) return set;
  return new Set([...set, id]);
}

/**
 * 清空 Set 并触发 Vue 响应式更新
 */
export function reactiveSetClear(): Set<string> {
  return new Set();
}

// 本地状态引用类型（从 store 传入）
interface StoreRefs {
  projectId: { value: string };
  scriptId: { value: string };
  steps: { value: ScriptEditV2State["steps"] };
  script: { value: ScriptEditV2State["script"] };
  creationSettings: { value: { resolution: ResolutionType } };
  // 新增：统一的 content 构建函数
  buildContentForSave: (overrides?: {
    shotGroups?: StoryboardRef[];
    shotGroupSettings?: ScriptContent["shotGroupSettings"];
    dialogues?: DialogueItem[];
  }) => ScriptContent;
}

/**
 * 根据分辨率类型获取图片比例（用于场景图片生成）
 * 直接透传比例字符串，所有层级不做像素转换
 */
export function getResolutionSize(resolution: string): {
  aspectRatio: string;
} {
  return { aspectRatio: resolution || "1:1" };
}

/**
 * F1-1: 触发单个资产图片生成
 */
export async function generateAssetImage(
  storeRefs: StoreRefs,
  subscribeToAssetImageProgress: () => void,
  subscribeToTask: (taskId: string, stepId: string) => void,
  refId: string,
  assetType: AssetType,
  options?: {
    modelId?: string;
    customPrompt?: string;
    negativePrompt?: string;
  },
): Promise<void> {
  const { projectId, scriptId, steps, buildContentForSave, creationSettings } =
    storeRefs;

  if (!projectId.value || !scriptId.value) return;

  const stepKey: AssetStepKey =
    assetType === "character"
      ? "characters"
      : assetType === "scene"
        ? "scenes"
        : "props";
  const step = steps.value[stepKey];

  // 标记为生成中，清除上次错误
  // 使用辅助函数确保 Vue 响应式更新
  step.imageGeneratingIds = reactiveSetAdd(step.imageGeneratingIds, refId);
  step.imageGenerationProgress[refId] = 0;
  delete step.imageGenerationErrors[refId];

  // 使用 Store 中的数据直接保存（单一数据源）
  // Worker 会通过 WebSocket 通知前端更新图片
  try {
    const content = buildContentForSave();

    await scriptApi.updateScript(projectId.value, scriptId.value, {
      content:
        content as unknown as import("@pixaura/shared-types").UpdateScriptDto["content"],
    });
  } catch (e) {
    console.error("[generateAssetImage] 持久化资产数据失败:", e);
  }

  // 场景图片使用剧本分辨率对应的比例，角色和道具不传
  const sizeParams =
    assetType === "scene"
      ? getResolutionSize(creationSettings.value.resolution)
      : {};

  try {
    const response = await scriptApi.generateAssetImage(
      projectId.value,
      scriptId.value,
      refId,
      {
        ...options,
        ...sizeParams,
      },
    );

    // 从 API 响应中获取 taskId 并订阅任务
    const taskId = (response as unknown as { taskId?: string })?.taskId;
    if (taskId) {
      subscribeToTask(taskId, stepKey);
    }

    // 确保订阅了 WebSocket（纯 WebSocket 实现）
    subscribeToAssetImageProgress();
  } catch (error) {
    step.imageGeneratingIds = reactiveSetDelete(step.imageGeneratingIds, refId);
    delete step.imageGenerationProgress[refId];
    // 提取 API 返回的错误消息
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const errMsg =
      err.response?.data?.message || err.message || "图片生成失败，请重试";
    step.imageGenerationErrors[refId] = errMsg;
    throw error;
  }
}

/**
 * F1-2: 批量触发资产图片生成
 */
export async function batchGenerateAssetImages(
  storeRefs: StoreRefs,
  subscribeToAssetImageProgress: () => void,
  subscribeToTask: (taskId: string, stepId: string) => void,
  assetType: AssetType,
  options?: {
    modelId?: string;
    negativePrompt?: string;
  },
): Promise<void> {
  const { projectId, scriptId, steps, creationSettings } = storeRefs;

  if (!projectId.value || !scriptId.value) return;

  // 场景图片使用剧本分辨率对应的比例
  const sizeParams =
    assetType === "scene"
      ? getResolutionSize(creationSettings.value.resolution)
      : {};

  const result = await scriptApi.batchGenerateAssetImages(
    projectId.value,
    scriptId.value,
    {
      assetType,
      ...options,
      ...sizeParams,
    },
  );

  // 调试：打印 API 返回结果
  console.log("[batchGenerateAssetImages] API 返回结果:", result);

  const taskResult = result as unknown as {
    tasks: Array<{ refId: string; taskId: string; status: string }>;
    skipped: Array<{ refId: string; reason: string }>;
  };

  // 确保订阅了 WebSocket
  subscribeToAssetImageProgress();

  // 对每个已启动的任务标记生成中并订阅任务
  if (taskResult.tasks && taskResult.tasks.length > 0) {
    const stepKey: AssetStepKey =
      assetType === "character"
        ? "characters"
        : assetType === "scene"
          ? "scenes"
          : "props";
    const step = steps.value[stepKey];

    console.log(
      "[batchGenerateAssetImages] 当前 imageGeneratingIds:",
      Array.from(step.imageGeneratingIds),
    );

    // 收集所有需要标记为生成中的 refId 并订阅任务
    for (const task of taskResult.tasks) {
      step.imageGeneratingIds = reactiveSetAdd(
        step.imageGeneratingIds,
        task.refId,
      );
      step.imageGenerationProgress[task.refId] = 0;
      // 订阅任务以接收 WebSocket 进度推送
      subscribeToTask(task.taskId, stepKey);
      console.log(
        "[batchGenerateAssetImages] 添加生成中 refId:",
        task.refId,
        "taskId:",
        task.taskId,
      );
    }

    console.log(
      "[batchGenerateAssetImages] 更新后 imageGeneratingIds:",
      Array.from(step.imageGeneratingIds),
    );
  } else {
    console.warn("[batchGenerateAssetImages] 没有启动任何任务");
  }

  // 如果有跳过的资产，也打印出来
  if (taskResult.skipped && taskResult.skipped.length > 0) {
    console.log("[batchGenerateAssetImages] 跳过的资产:", taskResult.skipped);
  }
}

/**
 * F1-3: 批量查重刷新（对所有 will_create 资产重新查重）
 */
export async function checkAndApplyDedup(
  projectId: string,
  scriptId: string,
  loadScript: () => Promise<unknown>,
): Promise<void> {
  if (!projectId || !scriptId) return;

  try {
    await scriptApi.batchDedupCheck(projectId, scriptId);
    // 查重完成后刷新剧本数据以获取最新 assetStatus
    await loadScript();
  } catch (error) {
    console.error("[ScriptEditV2] 批量查重失败:", error);
    throw error;
  }
}

/**
 * 根据图片状态更新资产步骤状态
 * 当所有资产都有图片时，步骤状态设为 completed
 */
export function updateAssetStepStatusFromImages(
  steps: ScriptEditV2State["steps"],
  stepId: AssetStepKey,
  imagesMap: Record<string, { length: number }>,
) {
  const step = steps[stepId];
  if (!step || step.items.length === 0) return;

  // 检查是否所有资产都有图片
  const allHasImages = step.items.every((item) => {
    const itemImages = imagesMap[item.id];
    return itemImages && itemImages.length > 0;
  });

  // 检查是否有部分资产有图片（用于判断是否在生成中）
  const someHasImages = step.items.some((item) => {
    const itemImages = imagesMap[item.id];
    return itemImages && itemImages.length > 0;
  });

  // 更新步骤状态
  if (allHasImages) {
    step.status = "completed";
  } else if (someHasImages && step.status !== "processing") {
    // 部分有图片，但不在生成中，保持 pending
    step.status = "pending";
  }

  console.log(`[updateAssetStepStatusFromImages] ${stepId} 状态更新:`, {
    status: step.status,
    total: step.items.length,
    allHasImages,
    someHasImages,
  });
}

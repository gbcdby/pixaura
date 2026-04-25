import { toRaw } from "vue";
import { scriptApi } from "@/modules/script/api";
import type {
  ScriptEditV2State,
  StoryboardRef,
  StepStatusType,
  DialogueItem,
} from "../store/types";
import type { ScriptContent } from "@pixaura/shared-types";
import { reactiveSetAdd, reactiveSetDelete } from "./useAssetGeneration";

// 本地状态引用类型（从 store 传入）
interface StoreRefs {
  projectId: { value: string };
  scriptId: { value: string };
  steps: { value: ScriptEditV2State["steps"] };
  script: { value: ScriptEditV2State["script"] };
  // 新增：统一的 content 构建函数
  buildContentForSave: (overrides?: {
    shotGroups?: StoryboardRef[];
    shotGroupSettings?: ScriptContent["shotGroupSettings"];
    dialogues?: DialogueItem[];
  }) => ScriptContent;
}

// 订阅任务类型
interface SubscribeToTaskFn {
  (taskId: string, stepId: string): void;
}

/**
 * 分镜 AI 图片生成
 * 复用 generateAssetImage API（后端 worker 已支持 storyboard ID）
 */
export async function generateStoryboardImage(
  storeRefs: StoreRefs,
  subscribeToAssetImageProgress: () => void,
  subscribeToTask: SubscribeToTaskFn,
  storyboardId: string,
  options?: { modelId?: string },
): Promise<void> {
  const { projectId, scriptId, steps, buildContentForSave } = storeRefs;

  if (!projectId.value || !scriptId.value) return;

  const step = steps.value.storyboards;

  // 标记为生成中，清除上次错误
  step.imageGeneratingIds = reactiveSetAdd(
    step.imageGeneratingIds,
    storyboardId,
  );
  step.imageGenerationProgress[storyboardId] = 0;
  delete step.imageGenerationErrors[storyboardId];

  // 使用 Store 中的数据直接保存（单一数据源）
  // Worker 会通过 WebSocket 通知前端更新图片
  try {
    // 直接使用 buildContentForSave 构建完整 content
    const content = buildContentForSave();

    await scriptApi.updateScript(projectId.value, scriptId.value, {
      content:
        content as unknown as import("@pixaura/shared-types").UpdateScriptDto["content"],
    });
  } catch (e) {
    console.error("[generateStoryboardImage] 持久化资产数据失败:", e);
  }

  try {
    const response = await scriptApi.generateAssetImage(
      projectId.value,
      scriptId.value,
      storyboardId,
      { modelId: options?.modelId },
    );

    // 注册任务订阅，确保能收到 WebSocket 进度推送
    // axios 拦截器已解包 data.data，response 直接是 { taskId, ... }
    const imageTaskId = (response as unknown as { taskId?: string })?.taskId;
    if (imageTaskId) {
      subscribeToTask(imageTaskId, "storyboards");
    }

    // 确保订阅了 WebSocket 图片进度事件（纯 WebSocket 实现）
    subscribeToAssetImageProgress();
  } catch (error) {
    step.imageGeneratingIds = reactiveSetDelete(
      step.imageGeneratingIds,
      storyboardId,
    );
    delete step.imageGenerationProgress[storyboardId];
    // 提取 API 返回的错误消息
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    const errMsg =
      err.response?.data?.message || err.message || "图片生成失败，请重试";
    step.imageGenerationErrors[storyboardId] = errMsg;
    throw error;
  }
}

/**
 * BUG-06: 触发分镜视频生成（异步，后端通过 WebSocket 推送进度）
 * 后端自动从数据库构建参考图 URL 列表
 */
export async function generateStoryboardVideo(
  storeRefs: StoreRefs,
  subscribeToAssetVideoProgress: () => void,
  subscribeToTask: SubscribeToTaskFn,
  storyboardId: string,
  options?: { modelId?: string; imageUrl?: string; imageUrls?: string[] },
): Promise<void> {
  const { projectId, scriptId, steps } = storeRefs;

  if (!projectId.value || !scriptId.value) return;

  // 乐观更新：将分镜的视频生成状态标记为 pending
  const idx = steps.value.storyboards.items.findIndex(
    (s) => s.id === storyboardId,
  );
  if (idx !== -1) {
    // BUG 修复：使用 toRaw 获取原始数据，避免展开响应式代理时丢失 images 等字段
    steps.value.storyboards.items[idx] = {
      ...toRaw(steps.value.storyboards.items[idx]),
      videoGeneration: {
        prompt: "",
        status: "pending",
      },
    };
  }

  // 确保订阅了视频进度 WS 事件
  subscribeToAssetVideoProgress();

  try {
    const result = await scriptApi.generateStoryboardVideo(
      projectId.value,
      scriptId.value,
      storyboardId,
      options,
    );
    // 注册 WebSocket 任务订阅，确保后端能推送进度通知
    // 注意：axios 拦截器已自动解包 data.data，result 直接是 { taskId, ... }
    const videoTaskId = (result as unknown as { taskId?: string })?.taskId;
    if (videoTaskId) {
      // 将 taskId 写入 storyboard，方便 handleTaskFailed 定位并更新状态
      if (idx !== -1) {
        // BUG 修复：使用 toRaw 获取原始数据
        const item = toRaw(steps.value.storyboards.items[idx]);
        steps.value.storyboards.items[idx] = {
          ...item,
          videoGeneration: {
            ...item.videoGeneration,
            status: "pending",
            taskId: videoTaskId,
          },
        };
      }
      subscribeToTask(videoTaskId, "storyboards");
    }
  } catch (error) {
    // 回滚乐观更新
    if (idx !== -1) {
      // BUG 修复：使用 toRaw 获取原始数据
      const item = toRaw(steps.value.storyboards.items[idx]);
      steps.value.storyboards.items[idx] = {
        ...item,
        videoGeneration: undefined,
      };
    }
    console.error("[ScriptEditV2] 分镜视频生成失败:", error);
    throw error;
  }
}

/**
 * BUG-07: AI 生成分镜对话台词（同步直接返回，写回 store）
 */
export async function generateStoryboardDialogue(
  storeRefs: StoreRefs,
  storyboardId: string,
  options?: { modelId?: string },
): Promise<void> {
  const { projectId, scriptId, steps } = storeRefs;

  if (!projectId.value || !scriptId.value) return;

  // 标记生成中
  steps.value.storyboards.dialogueGeneratingIds.add(storyboardId);
  try {
    const result = (await scriptApi.generateStoryboardDialogue(
      projectId.value,
      scriptId.value,
      storyboardId,
      options,
    )) as unknown as {
      storyboardId: string;
      dialogues: Array<{
        id: string;
        characterId?: string;
        characterName: string;
        text: string;
        emotion?: string;
        isVoiceover?: boolean;
      }>;
    };

    // 将 AI 生成的对白写回 store
    const idx = steps.value.storyboards.items.findIndex(
      (s) => s.id === storyboardId,
    );
    if (idx !== -1 && result.dialogues?.length) {
      const mapped: DialogueItem[] = result.dialogues.map((d) => ({
        id: d.id,
        characterId: d.characterId,
        characterName: d.characterName,
        text: d.text,
        emotion: d.emotion,
        isVoiceover: d.isVoiceover ?? false,
      }));
      // BUG 修复：使用 toRaw 获取原始数据，避免展开响应式代理时丢失 images 等字段
      steps.value.storyboards.items[idx] = {
        ...toRaw(steps.value.storyboards.items[idx]),
        dialogues: mapped,
      };
    }
  } finally {
    steps.value.storyboards.dialogueGeneratingIds.delete(storyboardId);
  }
}

/**
 * 一键 AI 生成所有分镜（异步队列，通过 WebSocket 推送进度）
 */
export async function generateAllStoryboards(
  storeRefs: StoreRefs,
  subscribeToTask: SubscribeToTaskFn,
  modelId?: string,
) {
  const { projectId, scriptId, steps } = storeRefs;

  if (!projectId.value || !scriptId.value) return;

  try {
    steps.value.storyboards.status = "processing";
    const result = (await scriptApi.generateAllStoryboards(
      projectId.value,
      scriptId.value,
      modelId ? { modelId } : {},
    )) as unknown as {
      taskId: string;
      status: string;
      estimatedTime: number;
    };
    steps.value.storyboards.currentTaskId = result.taskId;
    // 订阅 WS 任务进度，确保后端 worker 广播能被收到
    subscribeToTask(result.taskId, "storyboards");
    return result;
  } catch (error) {
    steps.value.storyboards.status = "failed";
    throw error;
  }
}

/**
 * 根据场景自动生成基础分镜
 * scenes 参数包含 dialogues 字段（每个场景的对话列表，含 actions）
 */
export function generateStoryboardsFromScenes(
  steps: ScriptEditV2State["steps"],
  scenes: Array<{
    id: string;
    sceneId?: string; // 资源库 ID
    name?: string;
    description?: string;
    dialogues?: Array<{
      id?: string;
      characterName: string;
      text: string;
      emotion?: string;
      actions?: string[];
      isVoiceover?: boolean;
    }>;
  }>,
  characters: Array<{
    id: string;
    characterId?: string;
    name?: string;
    importance?: string;
  }>,
  _dialogues: DialogueItem[] = [], // 已废弃，保留参数兼容性
) {
  // 获取主要角色ID（用于分镜关联）
  // 优先使用资源库 ID（characterId），否则使用引用 ID
  const mainCharacterIds = characters
    .filter(
      (c) => c.importance === "protagonist" || c.importance === "supporting",
    )
    .slice(0, 3)
    .map((c) => c.characterId || c.id);

  // 获取步骤级别的模型配置作为默认值
  const stepModelId = steps.storyboards.modelId;

  // 为每个场景生成基础分镜
  const storyboards: StoryboardRef[] = scenes.map((scene, index) => {
    // 从场景的 dialogues 字段获取对白（包含 actions）
    const sceneDialogues: DialogueItem[] = (scene.dialogues || []).map((d) => ({
      id:
        d.id ||
        `dialogue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      characterId:
        characters.find((c) => c.name === d.characterName)?.characterId ||
        characters.find((c) => c.name === d.characterName)?.id,
      characterName: d.characterName,
      text: d.text,
      emotion: d.emotion,
      actions: d.actions || [], // 保留 actions 字段
      isVoiceover: d.isVoiceover || false,
    }));

    const sceneName = scene.name || `场景 ${index + 1}`;
    return {
      id: `storyboard_${Date.now()}_${index}`,
      sequenceNumber: index + 1,
      title: sceneName,
      description: scene.description || `${sceneName}的场景描述`,
      characterIds: mainCharacterIds,
      sceneId: scene.sceneId || scene.id, // 优先使用资源库 ID
      propIds: [],
      duration: 3,
      status: "pending" as StepStatusType,
      mode: "standard" as const,
      referenceMode: "multi_reference" as const,
      videoMode: "audio_reference" as const,
      // 继承步骤级别的模型选择
      imageModelId: stepModelId || undefined,
      dialogues: sceneDialogues,
    };
  });

  steps.storyboards.items = storyboards;
  // 新生成的分镜还没有视频，状态应为 processing（黄色）
  steps.storyboards.status = "processing";

  console.log(
    `[generateStoryboardsFromScenes] 生成分镜:`,
    storyboards.length,
    "场景总数:",
    scenes.length,
  );
}

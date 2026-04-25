/**
 * WebSocket 任务管理模块
 * 处理任务订阅、进度更新、完成/失败回调
 *
 * 改造版本：
 * - 使用 registerHandler 注册事件（统一事件分发机制）
 * - 使用 subscribeScriptTask 管理订阅（带持久化，重连自动恢复）
 * - 移除直接 socket.on 监听
 * - 添加 cleanupListeners 方法
 */
import { watch } from "vue";
import { useWebSocketStore } from "@/stores/websocket";
import { WsEventNames } from "@pixaura/shared-types";
import type {
  ScriptGenerateProgressWsData,
  ScriptGenerateDoneWsData,
  ScriptGenerateFailedWsData,
  ScriptParseProgressWsData,
  StoryboardParseProgressWsData,
  CharacterRef,
  SceneRef,
  PropRef,
} from "@pixaura/shared-types";
import type { TaskSubscription, StepStatusType, DialogueItem } from "../types";
import type { CoreStoreRefs } from "./core";

/**
 * 创建 WebSocket 任务管理器
 */
export function createWsTaskManager(refs: CoreStoreRefs) {
  const {
    steps,
    activeTasks,
    taskUpdateTokens,
    wsListenersInitialized,
    scriptId,
  } = refs;
  const wsStore = useWebSocketStore();

  // 存储取消注册函数
  const unregisterFunctions: (() => void)[] = [];

  /**
   * 订阅任务进度
   * 使用 subscribeScriptTask 管理订阅（带持久化，重连自动恢复）
   */
  function subscribeToTask(taskId: string, stepId: string) {
    console.log(
      `[subscribeToTask] taskId: ${taskId}, stepId: ${stepId}, scriptId: ${scriptId.value}`,
    );

    // 取消已存在的订阅
    const existingSubscription = activeTasks.value.get(taskId);
    if (existingSubscription) {
      existingSubscription.unsubscribe();
    }

    // 生成唯一更新 Token
    const updateToken = `${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    taskUpdateTokens.value.set(taskId, updateToken);

    // 使用 Store 的 subscribeScriptTask 方法（带持久化）
    const currentScriptId = scriptId.value;
    const unsubscribeScriptTask = wsStore.subscribeScriptTask(
      taskId,
      currentScriptId,
      stepId === "script" ? "parse" : "generate",
    );

    // 存储订阅信息
    const subscription: TaskSubscription = {
      taskId,
      stepId,
      unsubscribe: () => {
        unsubscribeScriptTask();
        activeTasks.value.delete(taskId);
        taskUpdateTokens.value.delete(taskId);
      },
    };

    activeTasks.value.set(taskId, subscription);
  }

  /**
   * 处理任务进度
   */
  function handleTaskProgress(
    taskId: string,
    data: { progress: number; stage?: string },
  ) {
    const subscription = activeTasks.value.get(taskId);
    if (!subscription) return;

    const stepKey = subscription.stepId as keyof typeof steps.value;
    const step = steps.value[stepKey];

    if (step && "progress" in step) {
      step.progress = data.progress;
    }
  }

  /**
   * 处理任务完成
   */
  function handleTaskCompleted(
    taskId: string,
    data: { result?: { title?: string; description?: string } },
  ) {
    const subscription = activeTasks.value.get(taskId);
    if (!subscription) {
      console.log(`[handleTaskCompleted] 任务 ${taskId} 已不存在，跳过处理`);
      return;
    }

    const currentToken = taskUpdateTokens.value.get(taskId);
    if (!currentToken) {
      console.log(
        `[handleTaskCompleted] 任务 ${taskId} 无有效 token，跳过处理`,
      );
      return;
    }

    const stepKey = subscription.stepId as keyof typeof steps.value;
    const step = steps.value[stepKey];

    if (step) {
      step.status = "completed" as StepStatusType;
      if ("progress" in step) {
        step.progress = 100;
      }
      if ("currentTaskId" in step) {
        step.currentTaskId = undefined;
      }
    }

    if (subscription.stepId === "script") {
      if (data.result?.description) {
        steps.value.script.content = data.result.description;
      }
      steps.value.script.hasUnsavedChanges = false;
    }

    subscription.unsubscribe();
  }

  /**
   * 处理任务失败
   */
  function handleTaskFailed(taskId: string, data: { error?: string }) {
    const subscription = activeTasks.value.get(taskId);
    if (!subscription) {
      console.log(`[handleTaskFailed] 任务 ${taskId} 已不存在，跳过处理`);
      return;
    }

    const currentToken = taskUpdateTokens.value.get(taskId);
    if (!currentToken) {
      console.log(`[handleTaskFailed] 任务 ${taskId} 无有效 token，跳过处理`);
      return;
    }

    const stepKey = subscription.stepId as keyof typeof steps.value;
    const step = steps.value[stepKey];

    if (step) {
      step.status = "failed" as StepStatusType;
      if ("currentTaskId" in step) {
        step.currentTaskId = undefined;
      }
    }

    console.error(`任务 ${taskId} 失败:`, data.error);
    subscription.unsubscribe();
  }

  /**
   * 初始化全局 WebSocket 监听器
   * 使用 registerHandler 机制（统一事件分发）
   */
  function initGlobalWsListeners(handlers: {
    onLoadScript: () => Promise<void>;
    onUpdateAssetsFromParseResult: (
      data: {
        characters?: CharacterRef[];
        scenes?: SceneRef[];
        props?: PropRef[];
        dialogues?: DialogueItem[];
      },
      regenerate?: boolean,
    ) => void;
  }) {
    if (wsListenersInitialized.value) {
      console.log("[initGlobalWsListeners] 已初始化，跳过");
      return;
    }

    console.log("[initGlobalWsListeners] 使用 registerHandler 注册事件");

    // 剧本生成进度
    unregisterFunctions.push(
      wsStore.registerHandler(
        WsEventNames.SCRIPT_GENERATE_PROGRESS,
        (data: unknown) => {
          const progressData = data as ScriptGenerateProgressWsData;
          const subscription = activeTasks.value.get(progressData.taskId);
          if (!subscription) return;

          if (progressData.status === "completed") {
            // 修复：传递 result 数据，确保描述内容正确更新
            handleTaskCompleted(progressData.taskId, {
              result: progressData.result || {},
            });
          } else if (progressData.status === "failed") {
            handleTaskFailed(progressData.taskId, { error: "生成失败" });
          } else {
            handleTaskProgress(progressData.taskId, {
              progress: progressData.progress || 0,
              stage: progressData.status,
            });
          }
        },
      ),
    );

    // 剧本生成完成
    unregisterFunctions.push(
      wsStore.registerHandler(
        WsEventNames.SCRIPT_GENERATE_DONE,
        (data: unknown) => {
          const doneData = data as ScriptGenerateDoneWsData;
          handleTaskCompleted(doneData.taskId, { result: doneData.result });
          // 完成后重新加载剧本
          handlers.onLoadScript();
        },
      ),
    );

    // 剧本生成失败
    unregisterFunctions.push(
      wsStore.registerHandler(
        WsEventNames.SCRIPT_GENERATE_FAILED,
        (data: unknown) => {
          const failedData = data as ScriptGenerateFailedWsData;
          handleTaskFailed(failedData.taskId, {
            error: failedData.error?.message || "生成失败",
          });
        },
      ),
    );

    // 剧本解析进度
    unregisterFunctions.push(
      wsStore.registerHandler(
        WsEventNames.SCRIPT_PARSE_PROGRESS,
        (data: unknown) => {
          const parseData = data as ScriptParseProgressWsData;
          const subscription = activeTasks.value.get(parseData.taskId);
          if (!subscription) return;

          if (parseData.status === "completed" && parseData.result) {
            // 类型转换：ScriptParseProgressWsData.result 的类型为 unknown[]
            // 需要断言为具体类型
            const result = {
              characters: parseData.result.characters as
                | CharacterRef[]
                | undefined,
              scenes: parseData.result.scenes as SceneRef[] | undefined,
              props: parseData.result.props as PropRef[] | undefined,
              dialogues: parseData.result.dialogues as
                | DialogueItem[]
                | undefined,
            };
            handlers.onUpdateAssetsFromParseResult(result);
            steps.value.script.status = "completed";
            steps.value.script.parseProgress = 100;
            steps.value.script.parseMessage = "解析完成";
            subscription.unsubscribe();
            // 解析完成后刷新数据，同步 resolvedAssets
            handlers.onLoadScript().catch((err) => {
              console.error("[SCRIPT_PARSE_PROGRESS] 刷新数据失败:", err);
            });
          } else if (parseData.status === "failed") {
            steps.value.script.status = "completed";
            steps.value.script.parseMessage =
              parseData.error?.message || "解析失败";
            subscription.unsubscribe();
          } else {
            steps.value.script.parseProgress = parseData.progress || 0;
            steps.value.script.parseMessage =
              parseData.message || "正在解析...";
          }
        },
      ),
    );

    // 分镜解析进度
    // 注意：直接使用字符串常量，避免 shared-types 构建问题导致 undefined
    unregisterFunctions.push(
      wsStore.registerHandler(
        "storyboard:parse-progress",
        (data: unknown) => {
          const parseData = data as StoryboardParseProgressWsData;

          // 检查是否是当前剧本的事件（更健壮的检查）
          if (parseData.scriptId !== scriptId.value) {
            console.log(
              `[STORYBOARD_PARSE_PROGRESS] 忽略其他剧本的事件: ${parseData.scriptId}`,
            );
            return;
          }

          // 检查任务订阅（可选，用于跟踪任务状态）
          const subscription = activeTasks.value.get(parseData.taskId);

          // 修复：当进度达到 100 时也视为完成，更新按钮状态
          const isCompleted =
            parseData.status === "completed" || parseData.progress === 100;

          if (isCompleted) {
            // 分镜解析完成，更新状态
            console.log(
              `[STORYBOARD_PARSE_PROGRESS] 收到 completed (status=${parseData.status}, progress=${parseData.progress})，当前 storyboardParseStatus: ${steps.value.storyboards.storyboardParseStatus}`,
            );
            steps.value.storyboards.storyboardParseStatus = "completed";
            steps.value.storyboards.progress = 100;
            console.log(
              `[STORYBOARD_PARSE_PROGRESS] 设置为 completed，新状态: ${steps.value.storyboards.storyboardParseStatus}`,
            );
            if (subscription) {
              subscription.unsubscribe();
            }
            // 完成后重新加载剧本以获取分镜数据
            console.log(`[STORYBOARD_PARSE_PROGRESS] 调用 onLoadScript()`);
            handlers.onLoadScript().catch((err) => {
              console.error("[STORYBOARD_PARSE_PROGRESS] 刷新数据失败:", err);
            });
          } else if (parseData.status === "failed") {
            steps.value.storyboards.storyboardParseStatus = "failed";
            console.error("分镜解析失败:", parseData.error?.message);
            if (subscription) {
              subscription.unsubscribe();
            }
          } else {
            // 更新进度
            steps.value.storyboards.storyboardParseStatus = "processing";
            steps.value.storyboards.progress = parseData.progress || 0;
          }
        },
      ),
    );

    wsListenersInitialized.value = true;
    console.log("[initGlobalWsListeners] 事件注册完成");
  }

  /**
   * 清理监听器（页面离开时调用）
   */
  function cleanupListeners() {
    console.log("[cleanupListeners] 清理所有事件监听器");
    unregisterFunctions.forEach((fn) => fn());
    unregisterFunctions.length = 0;
    wsListenersInitialized.value = false;

    // 清理所有任务订阅
    activeTasks.value.forEach((subscription) => {
      subscription.unsubscribe();
    });
    activeTasks.value.clear();
    taskUpdateTokens.value.clear();
  }

  /**
   * 监听 WebSocket 重连
   * 注意：全局化后，WebSocket 重连会自动重新订阅脚本任务
   * 但需要重新注册资产相关的事件处理器
   * @param onReconnect WebSocket 重连后的回调（用于重新注册事件监听器）
   */
  function watchReconnection(onReconnect?: () => void) {
    watch(
      () => wsStore.isConnected,
      (isConnected) => {
        if (isConnected) {
          console.log("[ScriptEdit] WebSocket 连接成功");

          // 调用重连回调（重新注册 asset:image-progress 等事件监听器）
          if (onReconnect) {
            console.log("[ScriptEdit] 执行重连回调，重新注册事件监听器");
            onReconnect();
          }

          // 脚本任务订阅已由 wsStore 自动恢复（subscribeScriptTask 带持久化）
          // 无需手动重新订阅
        }
      },
    );
  }

  return {
    subscribeToTask,
    handleTaskProgress,
    handleTaskCompleted,
    handleTaskFailed,
    initGlobalWsListeners,
    cleanupListeners,
    watchReconnection,
    wsStore,
  };
}

export type WsTaskManager = ReturnType<typeof createWsTaskManager>;

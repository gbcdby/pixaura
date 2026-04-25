/**
 * 音频生成 Store
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  CreateTTSTaskDto,
  CreateLipSyncTaskDto,
  CreateBGMTaskDto,
  CreateAmbienceTaskDto,
  CreateMixingTaskDto,
  AudioGenTaskDetailDto,
  AudioGenTaskStatus,
  AudioGenProgress,
} from "@pixaura/shared-types";
import { audioGenerationApi } from "@/api/audioGeneration";

export const useAudioGenerationStore = defineStore("audioGeneration", () => {
  // ==================== State ====================
  // 任务列表
  const taskList = ref<AudioGenTaskDetailDto[]>([]);
  const taskListLoading = ref(false);
  const taskListPagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  // 当前任务
  const currentTask = ref<AudioGenTaskDetailDto | null>(null);
  const currentTaskLoading = ref(false);

  // 生成中任务（用于全局进度展示）
  const activeTasks = ref<AudioGenTaskDetailDto[]>([]);

  // TTS 状态
  const ttsLoading = ref(false);
  const ttsProgress = ref<AudioGenProgress | null>(null);

  // 对口型状态
  const lipSyncLoading = ref(false);
  const lipSyncProgress = ref<AudioGenProgress | null>(null);

  // BGM 状态
  const bgmLoading = ref(false);
  const bgmResults = ref<AudioGenTaskDetailDto[]>([]);

  // 混音状态
  const mixingLoading = ref(false);
  const mixingProgress = ref<AudioGenProgress | null>(null);

  // ==================== Getters ====================
  const hasMoreTasks = computed(() => {
    return (
      taskListPagination.value.page * taskListPagination.value.pageSize <
      taskListPagination.value.total
    );
  });

  const isTaskProcessing = (taskId: string) => {
    const task = activeTasks.value.find((t) => t.id === taskId);
    return task && ["pending", "queued", "processing"].includes(task.status);
  };

  const getTaskById = (taskId: string) => {
    return taskList.value.find((t) => t.id === taskId) || currentTask.value;
  };

  const hasActiveTasks = computed(() => activeTasks.value.length > 0);

  // ==================== Actions ====================
  /**
   * 获取任务列表
   */
  async function fetchTaskList(
    projectId: string,
    params?: {
      type?: string;
      status?: AudioGenTaskStatus;
      page?: number;
      limit?: number;
    },
  ) {
    taskListLoading.value = true;
    try {
      const response = await audioGenerationApi.getTaskList({
        projectId,
        type: params?.type,
        status: params?.status,
        limit: params?.limit,
        offset: ((params?.page || 1) - 1) * (params?.limit || 20),
      });
      taskList.value = response.tasks;
      taskListPagination.value = {
        page: params?.page || 1,
        pageSize: params?.limit || 20,
        total: response.total,
      };
      return response;
    } finally {
      taskListLoading.value = false;
    }
  }

  /**
   * 刷新任务列表（保持当前分页）
   */
  async function refreshTaskList(projectId: string) {
    return fetchTaskList(projectId, {
      page: taskListPagination.value.page,
      limit: taskListPagination.value.pageSize,
    });
  }

  /**
   * 获取任务详情
   */
  async function fetchTaskDetail(taskId: string) {
    currentTaskLoading.value = true;
    try {
      const task = await audioGenerationApi.getTaskDetail(taskId);
      currentTask.value = task;
      return task;
    } finally {
      currentTaskLoading.value = false;
    }
  }

  /**
   * 创建 TTS 任务
   */
  async function createTTS(
    projectId: string,
    dto: Omit<CreateTTSTaskDto, "projectId">,
  ) {
    ttsLoading.value = true;
    try {
      const result = await audioGenerationApi.createTTS({
        ...dto,
        projectId,
      });
      if (result.status === "pending" || result.status === "queued") {
        const newTask: AudioGenTaskDetailDto = {
          id: result.taskId,
          projectId,
          type: "tts",
          status: result.status,
          config: { ttsConfig: dto.config },
          progress: {
            percentage: 0,
            currentStep: "pending",
          },
          cost: {
            estimatedCost: result.estimatedCost,
            actualCost: 0,
            currency: "CNY",
          },
          createdAt: new Date().toISOString(),
        };
        activeTasks.value.push(newTask);
      }
      return result;
    } finally {
      ttsLoading.value = false;
    }
  }

  /**
   * 创建对口型任务
   */
  async function createLipSync(
    projectId: string,
    dto: Omit<CreateLipSyncTaskDto, "projectId">,
  ) {
    lipSyncLoading.value = true;
    try {
      const result = await audioGenerationApi.createLipSync({
        ...dto,
        projectId,
      });
      if (result.status === "pending" || result.status === "queued") {
        const newTask: AudioGenTaskDetailDto = {
          id: result.taskId,
          projectId,
          type: "lip_sync",
          status: result.status,
          config: { lipSyncConfig: dto.config },
          progress: {
            percentage: 0,
            currentStep: "pending",
          },
          cost: {
            estimatedCost: result.estimatedCost,
            actualCost: 0,
            currency: "CNY",
          },
          createdAt: new Date().toISOString(),
        };
        activeTasks.value.push(newTask);
      }
      return result;
    } finally {
      lipSyncLoading.value = false;
    }
  }

  /**
   * 创建 BGM 任务
   */
  async function createBGM(
    projectId: string,
    dto: Omit<CreateBGMTaskDto, "projectId">,
  ) {
    bgmLoading.value = true;
    try {
      const result = await audioGenerationApi.createBGM({
        ...dto,
        projectId,
      });
      if (result.status === "pending" || result.status === "queued") {
        const newTask: AudioGenTaskDetailDto = {
          id: result.taskId,
          projectId,
          type: "bgm",
          status: result.status,
          config: { bgmConfig: dto.config },
          progress: {
            percentage: 0,
            currentStep: "pending",
          },
          cost: {
            estimatedCost: result.estimatedCost,
            actualCost: 0,
            currency: "CNY",
          },
          createdAt: new Date().toISOString(),
        };
        bgmResults.value.push(newTask);
        activeTasks.value.push(newTask);
      }
      return result;
    } finally {
      bgmLoading.value = false;
    }
  }

  /**
   * 创建环境音任务
   */
  async function createAmbience(
    projectId: string,
    dto: Omit<CreateAmbienceTaskDto, "projectId">,
  ) {
    try {
      const result = await audioGenerationApi.createAmbience({
        ...dto,
        projectId,
      });
      if (result.status === "pending" || result.status === "queued") {
        const newTask: AudioGenTaskDetailDto = {
          id: result.taskId,
          projectId,
          type: "ambience",
          status: result.status,
          config: { ambienceConfig: dto.config },
          progress: {
            percentage: 0,
            currentStep: "pending",
          },
          cost: {
            estimatedCost: result.estimatedCost,
            actualCost: 0,
            currency: "CNY",
          },
          createdAt: new Date().toISOString(),
        };
        activeTasks.value.push(newTask);
      }
      return result;
    } finally {
      // 环境音没有专门的 loading 状态
    }
  }

  /**
   * 创建混音任务
   */
  async function createMixing(
    projectId: string,
    dto: Omit<CreateMixingTaskDto, "projectId">,
  ) {
    mixingLoading.value = true;
    try {
      const result = await audioGenerationApi.createMixing({
        ...dto,
        projectId,
      });
      if (result.status === "pending" || result.status === "queued") {
        const newTask: AudioGenTaskDetailDto = {
          id: result.taskId,
          projectId,
          type: "mixing",
          status: result.status,
          config: { mixingConfig: dto.config },
          progress: {
            percentage: 0,
            currentStep: "pending",
          },
          cost: {
            estimatedCost: result.estimatedCost,
            actualCost: 0,
            currency: "CNY",
          },
          createdAt: new Date().toISOString(),
        };
        activeTasks.value.push(newTask);
      }
      return result;
    } finally {
      mixingLoading.value = false;
    }
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId: string) {
    const result = await audioGenerationApi.cancelTask(taskId);
    const index = activeTasks.value.findIndex((t) => t.id === taskId);
    if (index > -1) {
      activeTasks.value[index].status = "cancelled";
    }
    return result;
  }

  /**
   * 删除任务
   */
  async function deleteTask(taskId: string) {
    await audioGenerationApi.deleteTask(taskId);
    taskList.value = taskList.value.filter((t) => t.id !== taskId);
    if (currentTask.value?.id === taskId) {
      currentTask.value = null;
    }
    activeTasks.value = activeTasks.value.filter((t) => t.id !== taskId);
  }

  /**
   * 更新任务进度（WebSocket 回调用）
   */
  function updateTaskProgress(taskId: string, progress: AudioGenProgress) {
    const task = activeTasks.value.find((t) => t.id === taskId);
    if (task) {
      task.progress = progress;
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.progress = progress;
    }
  }

  /**
   * 完成任务（WebSocket 回调用）
   */
  function completeTask(
    taskId: string,
    outputs: AudioGenTaskDetailDto["outputs"],
  ) {
    const index = activeTasks.value.findIndex((t) => t.id === taskId);
    if (index > -1) {
      activeTasks.value[index].status = "completed";
      activeTasks.value[index].outputs = outputs;
    }
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = "completed";
      currentTask.value.outputs = outputs;
    }
  }

  /**
   * 清除已完成的任务
   */
  function clearCompletedTasks() {
    activeTasks.value = activeTasks.value.filter((t) =>
      ["pending", "queued", "processing"].includes(t.status),
    );
  }

  return {
    // State
    taskList,
    taskListLoading,
    taskListPagination,
    currentTask,
    currentTaskLoading,
    activeTasks,
    ttsLoading,
    ttsProgress,
    lipSyncLoading,
    lipSyncProgress,
    bgmLoading,
    bgmResults,
    mixingLoading,
    mixingProgress,
    // Getters
    hasMoreTasks,
    isTaskProcessing,
    getTaskById,
    hasActiveTasks,
    // Actions
    fetchTaskList,
    refreshTaskList,
    fetchTaskDetail,
    createTTS,
    createLipSync,
    createBGM,
    createAmbience,
    createMixing,
    cancelTask,
    deleteTask,
    updateTaskProgress,
    completeTask,
    clearCompletedTasks,
  };
});

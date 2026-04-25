/**
 * 图片生成 Store
 */
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  CreateImageGenerationTaskDto,
  CreateBatchImageGenDto,
  RegenerateImageDto,
  ImageGenTaskDetailDto,
  ImageGenResultDto,
  ImageGenTaskStatus,
} from "@pixaura/shared-types";
import { imageGenerationApi } from "@/api/imageGenerationApi";

export const useImageGenerationStore = defineStore("imageGeneration", () => {
  // ==================== State ====================
  // 任务列表
  const taskList = ref<ImageGenTaskDetailDto[]>([]);
  const taskListLoading = ref(false);
  const taskListPagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  // 当前任务
  const currentTask = ref<ImageGenTaskDetailDto | null>(null);
  const currentTaskLoading = ref(false);

  // 生成中任务（用于全局进度展示）
  const activeTasks = ref<ImageGenTaskDetailDto[]>([]);

  // ==================== Getters ====================
  const hasMoreTasks = computed(() => {
    return (
      taskListPagination.value.page * taskListPagination.value.pageSize <
      taskListPagination.value.total
    );
  });

  const isTaskProcessing = (taskId: string) => {
    const task = activeTasks.value.find((t) => t.id === taskId);
    return task && ["pending", "queued", "generating"].includes(task.status);
  };

  const getTaskById = (taskId: string) => {
    return taskList.value.find((t) => t.id === taskId) || currentTask.value;
  };

  // ==================== Actions ====================
  /**
   * 获取任务列表
   */
  async function fetchTaskList(
    projectId: string,
    params?: {
      status?: ImageGenTaskStatus;
      page?: number;
      limit?: number;
    },
  ) {
    taskListLoading.value = true;
    try {
      const response = await imageGenerationApi.getTaskList({
        projectId,
        status: params?.status,
        page: params?.page,
        limit: params?.limit,
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
      const task = await imageGenerationApi.getTaskDetail(taskId);
      currentTask.value = task;
      return task;
    } finally {
      currentTaskLoading.value = false;
    }
  }

  /**
   * 统一创建图像生成任务（文生图/图生图合并）
   * 当 dto.config.referenceImageUrl 存在时，使用图生图逻辑
   * 当 dto.config.referenceImageUrl 不存在时，使用文生图逻辑
   */
  async function createImageGeneration(
    projectId: string,
    dto: CreateImageGenerationTaskDto,
  ) {
    const result = await imageGenerationApi.createImageGeneration(dto);
    // 添加到活跃任务列表
    if (result.status === "pending" || result.status === "queued") {
      const isImageToImage = !!dto.config.referenceImageUrl;
      const newTask: ImageGenTaskDetailDto = {
        id: result.taskId,
        projectId,
        type: isImageToImage ? "image_to_image" : "text_to_image",
        sceneType: dto.sceneType,
        status: result.status,
        config: {
          modelId: dto.config.modelId,
          [isImageToImage ? "imageConfig" : "textConfig"]: dto.config as never,
        },
        progress: {
          total: 1,
          completed: 0,
          failed: 0,
          currentStep: "pending",
          percentage: 0,
        },
        cost: {
          estimatedCost: result.estimatedCost,
          actualCost: 0,
          currency: "CNY",
        },
        createdAt: new Date().toISOString(),
        results: [],
      };
      activeTasks.value.push(newTask);
    }
    return result;
  }

  /**
   * @deprecated 使用 createImageGeneration 替代
   * 创建文生图任务
   */
  async function createTextToImage(
    projectId: string,
    dto: CreateImageGenerationTaskDto,
  ) {
    return createImageGeneration(projectId, dto);
  }

  /**
   * @deprecated 使用 createImageGeneration 替代
   * 创建图生图任务
   */
  async function createImageToImage(
    projectId: string,
    dto: CreateImageGenerationTaskDto,
  ) {
    return createImageGeneration(projectId, dto);
  }

  /**
   * 创建批量生成任务
   */
  async function createBatchGeneration(
    projectId: string,
    dto: CreateBatchImageGenDto,
  ) {
    const result = await imageGenerationApi.createBatch(dto);
    if (result.status === "pending" || result.status === "queued") {
      const newTask: ImageGenTaskDetailDto = {
        id: result.taskId,
        projectId,
        type: "batch_generation",
        sceneType: dto.sceneType,
        status: result.status,
        config: dto.config as never,
        progress: {
          total: result.batchCount,
          completed: 0,
          failed: 0,
          currentStep: "pending",
          percentage: 0,
        },
        cost: {
          estimatedCost: result.estimatedCost,
          actualCost: 0,
          currency: "CNY",
        },
        createdAt: new Date().toISOString(),
        results: [],
      };
      activeTasks.value.push(newTask);
    }
    return result;
  }

  /**
   * 取消任务
   */
  async function cancelTask(taskId: string) {
    const result = await imageGenerationApi.cancelTask(taskId);
    // 从活跃任务列表中移除
    const index = activeTasks.value.findIndex((t) => t.id === taskId);
    if (index > -1) {
      activeTasks.value[index].status = "cancelled" as ImageGenTaskStatus;
    }
    // 更新当前任务
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = "cancelled" as ImageGenTaskStatus;
    }
    return result;
  }

  /**
   * 删除任务
   */
  async function deleteTask(taskId: string) {
    const result = await imageGenerationApi.deleteTask(taskId);
    // 从列表中移除
    taskList.value = taskList.value.filter((t) => t.id !== taskId);
    // 从活跃任务中移除
    activeTasks.value = activeTasks.value.filter((t) => t.id !== taskId);
    // 清除当前任务
    if (currentTask.value?.id === taskId) {
      currentTask.value = null;
    }
    return result;
  }

  /**
   * 重新生成图片
   */
  async function regenerateImage(resultId: string, dto: RegenerateImageDto) {
    const result = await imageGenerationApi.regenerateImage(resultId, dto);
    return result;
  }

  /**
   * 处理进度更新（WebSocket 回调）
   */
  function handleProgressUpdate(data: {
    taskId: string;
    status: ImageGenTaskStatus;
    progress: ImageGenTaskDetailDto["progress"];
    currentResult?: ImageGenResultDto;
  }) {
    // 更新活跃任务
    const task = activeTasks.value.find((t) => t.id === data.taskId);
    if (task) {
      task.status = data.status;
      task.progress = data.progress;
    }
    // 更新当前任务
    if (currentTask.value?.id === data.taskId) {
      currentTask.value.status = data.status;
      currentTask.value.progress = data.progress;
      if (data.currentResult) {
        const index = currentTask.value.results?.findIndex(
          (r) => r.id === data.currentResult!.id,
        );
        if (index !== undefined && index > -1) {
          currentTask.value.results![index] = data.currentResult;
        } else if (currentTask.value.results) {
          currentTask.value.results.push(data.currentResult);
        }
      }
    }
  }

  /**
   * 处理任务完成（WebSocket 回调）
   */
  function handleTaskCompleted(data: {
    taskId: string;
    status: ImageGenTaskStatus;
    summary: { success: number; failed: number };
  }) {
    // 更新活跃任务
    const task = activeTasks.value.find((t) => t.id === data.taskId);
    if (task) {
      task.status = data.status;
      task.progress.completed = data.summary.success;
      task.progress.failed = data.summary.failed;
      task.progress.percentage = 100;
      task.progress.currentStep = "completed";
    }
    // 更新当前任务
    if (currentTask.value?.id === data.taskId) {
      currentTask.value.status = data.status;
      currentTask.value.progress.completed = data.summary.success;
      currentTask.value.progress.failed = data.summary.failed;
      currentTask.value.progress.percentage = 100;
      currentTask.value.progress.currentStep = "completed";
    }
    // 从活跃任务列表中移除（延迟 3 秒后）
    setTimeout(() => {
      activeTasks.value = activeTasks.value.filter((t) => t.id !== data.taskId);
    }, 3000);
  }

  /**
   * 清除当前任务
   */
  function clearCurrentTask() {
    currentTask.value = null;
  }

  return {
    // State
    taskList,
    taskListLoading,
    taskListPagination,
    currentTask,
    currentTaskLoading,
    activeTasks,
    // Getters
    hasMoreTasks,
    isTaskProcessing,
    getTaskById,
    // Actions
    fetchTaskList,
    refreshTaskList,
    fetchTaskDetail,
    createImageGeneration,
    createTextToImage,
    createImageToImage,
    createBatchGeneration,
    cancelTask,
    deleteTask,
    regenerateImage,
    handleProgressUpdate,
    handleTaskCompleted,
    clearCurrentTask,
  };
});

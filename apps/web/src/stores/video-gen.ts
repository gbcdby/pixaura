import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { videoGenApi } from "@/api/video-gen";
import type {
  VideoGenTaskDetailDto,
  CreateVideoGenTaskDto,
  RetryVideoGenTaskDto,
  VideoMode,
  ReferenceMode,
  VideoResolution,
  VideoGenTaskStatus,
} from "@pixaura/shared-types";

export const useVideoGenStore = defineStore("videoGen", () => {
  // State
  const tasks = ref<VideoGenTaskDetailDto[]>([]);
  const currentTask = ref<VideoGenTaskDetailDto | null>(null);
  const loading = ref(false);
  const taskLoading = ref(false);
  const submitting = ref(false);
  const batchLoading = ref(false);

  // 生成配置
  const generationConfig = ref<{
    referenceMode: ReferenceMode;
    videoMode: VideoMode;
    modelId?: string;
    outputConfig: {
      resolution: VideoResolution;
      aspectRatio: "16:9" | "9:16" | "1:1";
    };
  }>({
    referenceMode: "multi_reference",
    videoMode: "audio_reference",
    outputConfig: {
      resolution: "720p",
      aspectRatio: "9:16",
    },
  });

  // Getters
  const activeTasks = computed(() => {
    return tasks.value.filter(
      (t) =>
        t.status === "pending" ||
        t.status === "queued" ||
        t.status === "generating",
    );
  });

  const completedTasks = computed(() => {
    return tasks.value.filter((t) => t.status === "completed");
  });

  const failedTasks = computed(() => {
    return tasks.value.filter((t) => t.status === "failed");
  });

  const isGenerating = computed(() => {
    return (
      currentTask.value?.status === "pending" ||
      currentTask.value?.status === "queued" ||
      currentTask.value?.status === "generating"
    );
  });

  const hasGeneratedVideo = computed(() => {
    return (
      currentTask.value?.status === "completed" &&
      currentTask.value?.outputs?.some((o) => o.type === "video")
    );
  });

  // Actions
  async function fetchTaskDetail(taskId: string) {
    taskLoading.value = true;
    try {
      const res = await videoGenApi.getTaskDetail(taskId);
      currentTask.value = res;
      return res;
    } finally {
      taskLoading.value = false;
    }
  }

  async function fetchActiveTasks(projectId: string) {
    loading.value = true;
    try {
      const res = await videoGenApi.getActiveTasks(projectId);
      tasks.value = res;
      return res;
    } finally {
      loading.value = false;
    }
  }

  async function createTask(
    projectId: string,
    shotId: string,
    config?: Partial<typeof generationConfig.value>,
  ) {
    submitting.value = true;
    try {
      const finalConfig = {
        ...generationConfig.value,
        ...config,
        outputConfig: {
          ...generationConfig.value.outputConfig,
          ...config?.outputConfig,
        },
      };

      const res = await videoGenApi.createTask(projectId, {
        projectId,
        shotId,
        config: finalConfig as CreateVideoGenTaskDto["config"],
        notifyWs: true,
      });

      // 自动获取任务详情
      await fetchTaskDetail(res.taskId);
      return res;
    } finally {
      submitting.value = false;
    }
  }

  async function createBatchTasks(
    projectId: string,
    shotIds: string[],
    commonConfig?: Partial<typeof generationConfig.value>,
  ) {
    batchLoading.value = true;
    try {
      const shots = shotIds.map((shotId) => ({
        shotId,
        config: {
          ...generationConfig.value,
          ...commonConfig,
          outputConfig: {
            ...generationConfig.value.outputConfig,
            ...commonConfig?.outputConfig,
          },
        } as CreateVideoGenTaskDto["config"],
      }));

      const res = await videoGenApi.createBatchTasks(projectId, {
        projectId,
        shots,
        commonConfig,
        notifyWs: true,
      });

      return res;
    } finally {
      batchLoading.value = false;
    }
  }

  async function cancelTask(taskId: string) {
    const res = await videoGenApi.cancelTask(taskId);
    if (currentTask.value?.id === taskId) {
      currentTask.value.status = res.status as VideoGenTaskStatus;
    }
    return res;
  }

  async function retryTask(
    taskId: string,
    overrideConfig?: RetryVideoGenTaskDto["overrideConfig"],
  ) {
    submitting.value = true;
    try {
      const res = await videoGenApi.retryTask(taskId, { overrideConfig });
      if (currentTask.value?.id === taskId) {
        currentTask.value.status = res.status;
      }
      return res;
    } finally {
      submitting.value = false;
    }
  }

  function setGenerationConfig(config: Partial<typeof generationConfig.value>) {
    generationConfig.value = {
      ...generationConfig.value,
      ...config,
      outputConfig: {
        ...generationConfig.value.outputConfig,
        ...config.outputConfig,
      },
    };
  }

  function resetGenerationConfig() {
    generationConfig.value = {
      referenceMode: "multi_reference",
      videoMode: "audio_reference",
      outputConfig: {
        resolution: "720p",
        aspectRatio: "9:16",
      },
    };
  }

  // WebSocket 处理
  function handleProgressUpdate(data: {
    taskId: string;
    status: VideoGenTaskStatus;
    progress: VideoGenTaskDetailDto["progress"];
  }) {
    if (currentTask.value?.id === data.taskId) {
      currentTask.value.status = data.status;
      currentTask.value.progress = data.progress;
    }

    const task = tasks.value.find((t) => t.id === data.taskId);
    if (task) {
      task.status = data.status;
      task.progress = data.progress;
    }
  }

  function handleTaskCompleted(data: {
    taskId: string;
    status: "completed" | "failed";
    outputs?: {
      videoUrl?: string;
      audioUrl?: string;
      duration: number;
    };
    cost: { actualCost: number };
  }) {
    if (currentTask.value?.id === data.taskId) {
      currentTask.value.status = data.status;
      if (data.outputs && currentTask.value.outputs) {
        // 更新输出信息
      }
      if (data.cost) {
        currentTask.value.cost.actualCost = data.cost.actualCost;
      }
    }

    const task = tasks.value.find((t) => t.id === data.taskId);
    if (task) {
      task.status = data.status;
      if (data.cost) {
        task.cost.actualCost = data.cost.actualCost;
      }
    }
  }

  function clearCurrentTask() {
    currentTask.value = null;
  }

  return {
    // State
    tasks,
    currentTask,
    loading,
    taskLoading,
    submitting,
    batchLoading,
    generationConfig,

    // Getters
    activeTasks,
    completedTasks,
    failedTasks,
    isGenerating,
    hasGeneratedVideo,

    // Actions
    fetchTaskDetail,
    fetchActiveTasks,
    createTask,
    createBatchTasks,
    cancelTask,
    retryTask,
    setGenerationConfig,
    resetGenerationConfig,
    handleProgressUpdate,
    handleTaskCompleted,
    clearCurrentTask,
  };
});

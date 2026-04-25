<template>
  <n-card
    title="生成任务列表"
    class="task-list-card"
  >
    <!-- 连接状态栏 -->
    <template #header-extra>
      <ConnectionStatus
        show-text
        tooltip-placement="left"
      />
    </template>

    <n-data-table
      :columns="columns"
      :data="tasksWithProgress"
      :loading="loading"
      :pagination="pagination"
      size="small"
    />
  </n-card>
</template>

<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { NButton, NTag, NSpace, NProgress, NDataTable } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import type {
  VideoGenTaskDetailDto,
  VideoGenTaskStatus,
} from "@pixaura/shared-types";
import {
  useWebSocketStore,
  type GenerationProgressData,
} from "@/stores/websocket";
import ConnectionStatus from "@/components/ConnectionStatus.vue";

const props = defineProps<{
  tasks: VideoGenTaskDetailDto[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  view: [taskId: string];
  cancel: [taskId: string];
  retry: [taskId: string];
}>();

const wsStore = useWebSocketStore();

// 活跃任务的进度缓存
const taskProgressCache = ref<
  Map<
    string,
    {
      percentage: number;
      currentStep: string;
      status: string;
    }
  >
>(new Map());

// 监听任务列表变化，为活跃任务订阅 WebSocket
watch(
  () => props.tasks,
  (newTasks, oldTasks) => {
    const oldTaskIds = new Set(oldTasks?.map((t) => t.id) || []);

    // 为新的活跃任务创建订阅
    newTasks.forEach((task) => {
      if (
        ["pending", "queued", "generating"].includes(task.status) &&
        !oldTaskIds.has(task.id)
      ) {
        // 订阅任务
        if (!wsStore.isConnected) {
          wsStore.connect().catch(console.error);
        }
        wsStore.subscribe(task.id, {
          onProgress: (data: GenerationProgressData) => {
            taskProgressCache.value.set(task.id, {
              percentage: data.progress,
              currentStep: data.currentStep,
              status: data.status,
            });
          },
          onComplete: () => {
            taskProgressCache.value.set(task.id, {
              percentage: 100,
              currentStep: "completed",
              status: "completed",
            });
            // 完成后取消订阅
            wsStore.unsubscribe(task.id);
          },
          onFailed: () => {
            taskProgressCache.value.set(task.id, {
              percentage: taskProgressCache.value.get(task.id)?.percentage || 0,
              currentStep: "failed",
              status: "failed",
            });
            wsStore.unsubscribe(task.id);
          },
        });
      }
    });

    // 清理已不在列表中的任务订阅
    oldTasks?.forEach((oldTask) => {
      if (!newTasks.find((t) => t.id === oldTask.id)) {
        wsStore.unsubscribe(oldTask.id);
        taskProgressCache.value.delete(oldTask.id);
      }
    });
  },
  { immediate: true, deep: true },
);

// 合并任务数据和 WebSocket 进度
const tasksWithProgress = computed(() => {
  return props.tasks.map((task) => {
    const progressData = taskProgressCache.value.get(task.id);
    if (progressData) {
      return {
        ...task,
        // 优先使用 WebSocket 推送的进度
        progress: {
          ...task.progress,
          percentage: progressData.percentage ?? task.progress?.percentage ?? 0,
          currentStep: progressData.currentStep || task.progress?.currentStep,
        },
        // 如果 WebSocket 推送了完成/失败状态，更新状态
        status: (progressData.status === "completed"
          ? "completed"
          : progressData.status === "failed"
            ? "failed"
            : task.status) as VideoGenTaskStatus,
      };
    }
    return task;
  });
});

const statusMap: Record<
  VideoGenTaskStatus,
  {
    label: string;
    type: "default" | "primary" | "success" | "warning" | "error";
  }
> = {
  pending: { label: "等待中", type: "default" },
  queued: { label: "队列中", type: "primary" },
  generating: { label: "生成中", type: "warning" },
  completed: { label: "已完成", type: "success" },
  failed: { label: "失败", type: "error" },
  cancelled: { label: "已取消", type: "default" },
};

const columns = computed<DataTableColumns<VideoGenTaskDetailDto>>(() => [
  {
    title: "分镜ID",
    key: "shotId",
    width: 120,
    ellipsis: true,
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      const status = statusMap[row.status];
      return h(
        NTag,
        { type: status.type, size: "small" },
        { default: () => status.label },
      );
    },
  },
  {
    title: "进度",
    key: "progress",
    width: 200,
    render(row) {
      const percentage = row.progress?.percentage || 0;
      const currentStep = row.progress?.currentStep || "等待中";

      // 活跃任务显示进度条
      if (["pending", "queued", "generating"].includes(row.status)) {
        return h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px" } },
          [
            h(NProgress, {
              type: "line",
              percentage: Math.min(percentage, 100),
              height: 8,
              showIndicator: false,
              status: row.status === "failed" ? "error" : "default",
              processing: ["pending", "queued", "generating"].includes(
                row.status,
              ),
            }),
            h(
              "span",
              { style: { fontSize: "12px", minWidth: "40px" } },
              `${percentage}%`,
            ),
          ],
        );
      }

      // 已完成或失败任务显示简单文本
      return h(
        "span",
        { style: { fontSize: "12px", color: "#666" } },
        currentStep,
      );
    },
  },
  {
    title: "当前步骤",
    key: "currentStep",
    width: 150,
    render(row) {
      const stepMap: Record<string, string> = {
        pending: "等待中",
        queued: "排队中",
        preparing: "准备中",
        generating: "生成中",
        post_processing: "后处理",
        uploading: "上传中",
        completed: "已完成",
        failed: "失败",
        cancelled: "已取消",
      };
      const step = row.progress?.currentStep || row.status;
      return stepMap[step] || step;
    },
  },
  {
    title: "预估成本",
    key: "cost",
    width: 100,
    render(row) {
      return `${row.cost.estimatedCost} 积分`;
    },
  },
  {
    title: "创建时间",
    key: "createdAt",
    width: 180,
    render(row) {
      return new Date(row.createdAt).toLocaleString();
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 200,
    render(row) {
      const canCancel = ["pending", "queued", "generating"].includes(
        row.status,
      );
      const canRetry = ["failed", "cancelled"].includes(row.status);

      return h(
        NSpace,
        { size: "small" },
        {
          default: () =>
            [
              h(
                NButton,
                {
                  size: "small",
                  onClick: () => emit("view", row.id),
                },
                { default: () => "查看" },
              ),
              canCancel &&
                h(
                  NButton,
                  {
                    size: "small",
                    onClick: () => emit("cancel", row.id),
                  },
                  { default: () => "取消" },
                ),
              canRetry &&
                h(
                  NButton,
                  {
                    size: "small",
                    type: "primary",
                    onClick: () => emit("retry", row.id),
                  },
                  { default: () => "重试" },
                ),
            ].filter(Boolean),
        },
      );
    },
  },
]);

const pagination = {
  pageSize: 10,
};
</script>

<style scoped>
.task-list-card {
  margin-top: 16px;
}
</style>

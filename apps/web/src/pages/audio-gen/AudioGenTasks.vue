<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NPageHeader,
  NSpace,
  NTabs,
  NTabPane,
  NCard,
  NDataTable,
  NTag,
  NButton,
  NProgress,
  NEmpty,
  useMessage,
  useDialog,
  type DataTableColumns,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import type {
  AudioGenTaskDetailDto,
  AudioGenTaskStatus,
} from "@pixaura/shared-types";
import {
  AUDIO_GEN_STATUS_DESCRIPTIONS,
  AUDIO_GEN_TYPE_DESCRIPTIONS,
} from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const audioStore = useAudioGenerationStore();

const { taskList, taskListLoading } = storeToRefs(audioStore);

const projectId = computed(() => route.params.id as string);
const activeTab = ref<"active" | "completed" | "failed">("active");

// 根据状态筛选任务
const filteredTasks = computed(() => {
  if (activeTab.value === "active") {
    return taskList.value.filter((t) =>
      ["pending", "queued", "processing"].includes(t.status),
    );
  } else if (activeTab.value === "completed") {
    return taskList.value.filter((t) => t.status === "completed");
  } else {
    return taskList.value.filter((t) =>
      ["failed", "cancelled"].includes(t.status),
    );
  }
});

// 表格列定义
const columns = computed<DataTableColumns<AudioGenTaskDetailDto>>(() => [
  {
    title: "任务ID",
    key: "id",
    width: 120,
    ellipsis: true,
    render(row) {
      return row.id.slice(0, 8) + "...";
    },
  },
  {
    title: "类型",
    key: "type",
    width: 100,
    render(row) {
      const typeDesc = AUDIO_GEN_TYPE_DESCRIPTIONS[row.type] || {
        label: row.type,
      };
      return h(NTag, { size: "small" }, { default: () => typeDesc.label });
    },
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      const statusDesc = AUDIO_GEN_STATUS_DESCRIPTIONS[
        row.status as AudioGenTaskStatus
      ] || {
        label: row.status,
        color: "default",
      };
      return h(
        NTag,
        { type: statusDesc.color as any, size: "small" },
        { default: () => statusDesc.label },
      );
    },
  },
  {
    title: "进度",
    key: "progress",
    width: 150,
    render(row) {
      if (["pending", "queued", "processing"].includes(row.status)) {
        return h(NProgress, {
          percentage: row.progress.percentage,
          processing: row.status === "processing",
          showIndicator: true,
        });
      }
      return "-";
    },
  },
  {
    title: "配置信息",
    key: "config",
    width: 200,
    ellipsis: true,
    render(row) {
      if (row.config.ttsConfig) {
        return row.config.ttsConfig.text.slice(0, 30) + "...";
      }
      if (row.config.mixingConfig) {
        return `混音轨道: ${row.config.mixingConfig.tracks.length}`;
      }
      if (row.config.bgmConfig) {
        return `BGM时长: ${row.config.bgmConfig.duration}s`;
      }
      return "-";
    },
  },
  {
    title: "预估成本",
    key: "cost",
    width: 100,
    render(row) {
      return `${row.cost.estimatedCost} ${row.cost.currency}`;
    },
  },
  {
    title: "创建时间",
    key: "createdAt",
    width: 170,
    render(row) {
      return new Date(row.createdAt).toLocaleString();
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 200,
    fixed: "right",
    render(row) {
      const canCancel = ["pending", "queued", "processing"].includes(
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
                  onClick: () => handleView(row),
                },
                { default: () => "查看" },
              ),
              canCancel &&
                h(
                  NButton,
                  {
                    size: "small",
                    type: "warning",
                    onClick: () => handleCancel(row.id),
                  },
                  { default: () => "取消" },
                ),
              canRetry &&
                h(
                  NButton,
                  {
                    size: "small",
                    type: "primary",
                    onClick: () => handleRetry(row),
                  },
                  { default: () => "重试" },
                ),
              h(
                NButton,
                {
                  size: "small",
                  type: "error",
                  text: true,
                  onClick: () => handleDelete(row.id),
                },
                { default: () => "删除" },
              ),
            ].filter(Boolean),
        },
      );
    },
  },
]);

async function fetchTasks() {
  if (!projectId.value) return;
  await audioStore.fetchTaskList(projectId.value, {
    page: 1,
    limit: 20,
  });
}

function handleView(task: AudioGenTaskDetailDto) {
  dialog.info({
    title: "任务详情",
    content: () =>
      h(
        NSpace,
        { vertical: true, size: "small" },
        {
          default: () => [
            h("div", `任务ID: ${task.id}`),
            h(
              "div",
              `类型: ${AUDIO_GEN_TYPE_DESCRIPTIONS[task.type]?.label || task.type}`,
            ),
            h(
              "div",
              `状态: ${AUDIO_GEN_STATUS_DESCRIPTIONS[task.status as AudioGenTaskStatus]?.label || task.status}`,
            ),
            h("div", `进度: ${task.progress.percentage}%`),
            h("div", `当前步骤: ${task.progress.currentStep || "-"}`),
            h(
              "div",
              `预估成本: ${task.cost.estimatedCost} ${task.cost.currency}`,
            ),
            task.error &&
              h(
                "div",
                { style: "color: #d03050" },
                `错误: ${task.error.message}`,
              ),
          ],
        },
      ),
    positiveText: "确定",
  });
}

async function handleCancel(taskId: string) {
  dialog.warning({
    title: "确认取消",
    content: "确定要取消该任务吗？",
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await audioStore.cancelTask(taskId);
        message.success("任务已取消");
        fetchTasks();
      } catch (error: any) {
        message.error(error.message || "取消失败");
      }
    },
  });
}

async function handleRetry(task: AudioGenTaskDetailDto) {
  try {
    // 根据任务类型重新创建任务
    if (task.config.ttsConfig) {
      await audioStore.createTTS(projectId.value, {
        config: task.config.ttsConfig,
        notifyWs: true,
      });
    } else if (task.config.mixingConfig) {
      await audioStore.createMixing(projectId.value, {
        config: task.config.mixingConfig,
        notifyWs: true,
      });
    } else if (task.config.bgmConfig) {
      await audioStore.createBGM(projectId.value, {
        config: task.config.bgmConfig,
        notifyWs: true,
      });
    } else if (task.config.ambienceConfig) {
      await audioStore.createAmbience(projectId.value, {
        config: task.config.ambienceConfig,
        notifyWs: true,
      });
    }
    message.success("任务已重新提交");
    fetchTasks();
  } catch (error: any) {
    message.error(error.message || "重试失败");
  }
}

async function handleDelete(taskId: string) {
  dialog.error({
    title: "确认删除",
    content: "删除后无法恢复，确定要删除该任务吗？",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await audioStore.deleteTask(taskId);
        message.success("任务已删除");
        fetchTasks();
      } catch (error: any) {
        message.error(error.message || "删除失败");
      }
    },
  });
}

function handleBack() {
  router.push(`/projects/${projectId.value}/storyboards`);
}

onMounted(() => {
  fetchTasks();
});
</script>

<template>
  <div class="audio-gen-tasks-page">
    <NPageHeader
      title="音频生成任务"
      subtitle="管理音频生成任务，包括TTS、BGM、混音等"
      @back="handleBack"
    />

    <NCard class="content-card">
      <NTabs
        v-model:value="activeTab"
        type="line"
      >
        <NTabPane
          name="active"
          tab="进行中"
        >
          <NDataTable
            :columns="columns"
            :data="filteredTasks"
            :loading="taskListLoading"
            :pagination="{ pageSize: 10 }"
            size="small"
            striped
          />
          <NEmpty
            v-if="filteredTasks.length === 0 && !taskListLoading"
            description="暂无进行中的任务"
          />
        </NTabPane>

        <NTabPane
          name="completed"
          tab="已完成"
        >
          <NDataTable
            :columns="columns"
            :data="filteredTasks"
            :loading="taskListLoading"
            :pagination="{ pageSize: 10 }"
            size="small"
            striped
          />
          <NEmpty
            v-if="filteredTasks.length === 0 && !taskListLoading"
            description="暂无已完成的任务"
          />
        </NTabPane>

        <NTabPane
          name="failed"
          tab="失败"
        >
          <NDataTable
            :columns="columns"
            :data="filteredTasks"
            :loading="taskListLoading"
            :pagination="{ pageSize: 10 }"
            size="small"
            striped
          />
          <NEmpty
            v-if="filteredTasks.length === 0 && !taskListLoading"
            description="暂无失败的任务"
          />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>

<style scoped>
.audio-gen-tasks-page {
  padding: 24px;
}

.content-card {
  margin-top: 24px;
}
</style>

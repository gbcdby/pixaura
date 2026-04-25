<template>
  <div class="video-gen-tasks-page">
    <n-page-header
      title="视频生成任务"
      subtitle="管理视频生成任务"
      @back="handleBack"
    />

    <n-card class="content-card">
      <n-tabs
        v-model:value="activeTab"
        type="line"
      >
        <n-tab-pane
          name="active"
          tab="进行中"
        >
          <VideoGenTaskList
            :tasks="activeTasks"
            :loading="loading"
            @view="handleView"
            @cancel="handleCancel"
            @retry="handleRetry"
          />
        </n-tab-pane>

        <n-tab-pane
          name="completed"
          tab="已完成"
        >
          <VideoGenTaskList
            :tasks="completedTasks"
            :loading="loading"
            @view="handleView"
          />
        </n-tab-pane>

        <n-tab-pane
          name="failed"
          tab="失败"
        >
          <VideoGenTaskList
            :tasks="failedTasks"
            :loading="loading"
            @view="handleView"
            @retry="handleRetry"
          />
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useVideoGenStore } from "@/stores/video-gen";
import { VideoGenTaskList } from "@/modules/video-gen/components";
import { useMessage, useDialog } from "naive-ui";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();

const store = useVideoGenStore();
const { activeTasks, completedTasks, failedTasks, loading } =
  storeToRefs(store);

const projectId = route.params.id as string;
const activeTab = ref("active");

onMounted(() => {
  store.fetchActiveTasks(projectId);
});

function handleBack() {
  router.push(`/projects/${projectId}/storyboards`);
}

function handleView(taskId: string) {
  dialog.info({
    title: "任务详情",
    content: `查看任务 ${taskId}`,
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
        await store.cancelTask(taskId);
        message.success("任务已取消");
        store.fetchActiveTasks(projectId);
      } catch (error: any) {
        message.error(error.message || "取消失败");
      }
    },
  });
}

async function handleRetry(taskId: string) {
  try {
    await store.retryTask(taskId);
    message.success("任务已重新提交");
    store.fetchActiveTasks(projectId);
  } catch (error: any) {
    message.error(error.message || "重试失败");
  }
}
</script>

<style scoped>
.video-gen-tasks-page {
  padding: 24px;
}

.content-card {
  margin-top: 24px;
}
</style>

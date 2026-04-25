<template>
  <div class="image-gen-list-page">
    <PageHeader
      title="图片生成"
      :breadcrumb="breadcrumb"
    >
      <template #action>
        <n-button
          type="primary"
          @click="handleCreate"
        >
          <template #icon>
            <n-icon :component="Plus" />
          </template>
          新建生成任务
        </n-button>
      </template>
    </PageHeader>

    <div class="page-content">
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <n-select
          v-model:value="filter.status"
          :options="statusOptions"
          placeholder="状态"
          clearable
          style="width: 150px"
        />
        <n-select
          v-model:value="filter.sceneType"
          :options="sceneTypeOptions"
          placeholder="场景类型"
          clearable
          style="width: 150px"
        />
      </div>

      <!-- 任务列表 -->
      <n-spin :show="imageGenStore.taskListLoading">
        <div
          v-if="filteredTaskList.length > 0"
          class="task-grid"
        >
          <ImageGenerationCard
            v-for="task in filteredTaskList"
            :key="task.id"
            :task="task"
            @click="goToDetail"
          />
        </div>
        <n-empty
          v-else
          description="暂无生成任务"
        />
      </n-spin>

      <!-- 分页 -->
      <n-pagination
        v-if="imageGenStore.taskListPagination.total > 0"
        v-model:page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :item-count="imageGenStore.taskListPagination.total"
        @update:page="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NIcon, NSelect, NSpin, NEmpty, NPagination } from "naive-ui";
import { Plus } from "lucide-vue-next";
import PageHeader from "@/components/PageHeader.vue";
import ImageGenerationCard from "../components/ImageGenerationCard.vue";
import { useImageGenerationStore } from "@/stores/imageGeneration";
import type { ImageGenTaskStatus } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const imageGenStore = useImageGenerationStore();

const projectId = computed(() => route.params.id as string);

const breadcrumb = [{ name: "项目", path: "/projects" }, { name: "图片生成" }];

const statusOptions = [
  { label: "待处理", value: "pending" },
  { label: "排队中", value: "queued" },
  { label: "生成中", value: "generating" },
  { label: "已完成", value: "completed" },
  { label: "部分失败", value: "partial_failed" },
  { label: "失败", value: "failed" },
  { label: "已取消", value: "cancelled" },
];

const sceneTypeOptions = [
  { label: "角色视图", value: "character_views" },
  { label: "场景视图", value: "scene_views" },
  { label: "道具视图", value: "prop_views" },
  { label: "分镜参考", value: "storyboard_reference" },
];

const filter = ref({
  status: undefined as ImageGenTaskStatus | undefined,
  sceneType: undefined as string | undefined,
});

const pagination = ref({
  page: 1,
  pageSize: 20,
});

// 过滤后的任务列表
const filteredTaskList = computed(() => {
  return imageGenStore.taskList.filter((task) => {
    if (filter.value.status && task.status !== filter.value.status)
      return false;
    if (filter.value.sceneType && task.sceneType !== filter.value.sceneType)
      return false;
    return true;
  });
});

// 获取任务列表
async function fetchTasks() {
  await imageGenStore.fetchTaskList(projectId.value, {
    page: pagination.value.page,
    limit: pagination.value.pageSize,
  });
}

function handleCreate() {
  router.push({
    name: "ImageGeneration",
    params: { id: projectId.value },
  });
}

function goToDetail(taskId: string) {
  router.push({
    name: "ImageGenDetail",
    params: { projectId: projectId.value, taskId },
  });
}

function handlePageChange(page: number) {
  pagination.value.page = page;
  fetchTasks();
}

// 监听过滤器变化
watch(
  () => filter.value,
  () => {
    pagination.value.page = 1;
    fetchTasks();
  },
  { deep: true },
);

onMounted(() => {
  fetchTasks();
});
</script>

<style scoped lang="scss">
.image-gen-list-page {
  padding: 24px;
}

.page-content {
  margin-top: 24px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.task-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
</style>

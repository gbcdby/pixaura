<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NCard,
  NTable,
  NTag,
  NButton,
  NSpace,
  NPagination,
  NSelect,
  useMessage,
  useDialog,
} from "naive-ui";
import { useAIStore } from "@/stores/ai";
import type { AITaskType, AITaskStatus } from "@/api/ai";

const message = useMessage();
const dialog = useDialog();
const aiStore = useAIStore();

// 加载状态
// 任务列表
const tasks = computed(() => aiStore.tasks);

// 分页
const pagination = computed(() => aiStore.pagination);

// 筛选条件
const filterType = ref<AITaskType | undefined>(undefined);
const filterStatus = ref<AITaskStatus | undefined>(undefined);

// 任务类型选项
const typeOptions = [
  { label: "全部类型", value: "" },
  { label: "剧本生成", value: "script:generate" },
  { label: "剧本续写", value: "script:continue" },
  { label: "剧本改写", value: "script:rewrite" },
  { label: "角色生成", value: "character:generate" },
  { label: "场景生成", value: "scene:generate" },
  { label: "分镜生成", value: "storyboard:generate" },
];

// 状态选项
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "排队中", value: "pending" },
  { label: "处理中", value: "processing" },
  { label: "流式输出", value: "streaming" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
  { label: "已取消", value: "cancelled" },
];

// 加载任务列表
const loadTasks = async () => {
  await aiStore.fetchTaskList({
    type: filterType.value,
    status: filterStatus.value,
    page: pagination.value.page,
    pageSize: pagination.value.pageSize,
  });
};

// 获取状态标签类型
const getStatusType = (status: AITaskStatus) => {
  const typeMap: Record<
    AITaskStatus,
    "default" | "success" | "error" | "warning" | "info"
  > = {
    pending: "info",
    processing: "info",
    streaming: "info",
    completed: "success",
    failed: "error",
    cancelled: "warning",
    timeout: "error",
  };
  return typeMap[status] || "default";
};

// 获取状态文本
const getStatusText = (status: AITaskStatus) => {
  const textMap: Record<AITaskStatus, string> = {
    pending: "排队中",
    processing: "处理中",
    streaming: "生成中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
    timeout: "超时",
  };
  return textMap[status] || status;
};

// 获取任务类型文本
const getTypeText = (type: AITaskType) => {
  const textMap: Record<AITaskType, string> = {
    "script:generate": "剧本生成",
    "script:continue": "剧本续写",
    "script:rewrite": "剧本改写",
    "script:expand": "剧本扩写",
    "script:condense": "剧本缩写",
    "script:parse": "剧本解析",
    "character:generate": "角色生成",
    "scene:generate": "场景生成",
    "storyboard:generate": "分镜生成",
    "video:generate": "视频生成",
    "audio:generate": "音频生成",
    "music:generate": "音乐生成",
  };
  return textMap[type] || type;
};

// 取消任务
const handleCancel = (_taskId: string) => {
  dialog.warning({
    title: "确认取消",
    content: "确定要取消这个任务吗？",
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await aiStore.cancelTask(_taskId);
        message.success("任务已取消");
      } catch (error) {
        message.error("取消失败");
      }
    },
  });
};

// 重试任务
const handleRetry = async (taskId: string) => {
  try {
    await aiStore.retryTask(taskId);
    message.success("任务已重试");
    loadTasks();
  } catch (error) {
    message.error("重试失败");
  }
};

// 查看结果
const handleViewResult = (_taskId: string) => {
  // TODO: 实现查看结果功能
  message.info("查看结果功能开发中");
};

onMounted(() => {
  loadTasks();
});
</script>

<template>
  <div class="ai-task-list-page">
    <NLayout class="main-layout">
      <!-- 顶部栏 -->
      <NLayoutHeader
        class="header"
        bordered
      >
        <div class="header-content">
          <h1 class="page-title">
            AI 任务管理
          </h1>
        </div>
      </NLayoutHeader>

      <!-- 内容区 -->
      <NLayoutContent class="content">
        <NCard>
          <!-- 筛选栏 -->
          <NSpace
            class="filter-bar"
            size="medium"
          >
            <NSelect
              v-model:value="filterType"
              :options="typeOptions"
              placeholder="任务类型"
              clearable
              style="width: 160px"
              @update:value="loadTasks"
            />
            <NSelect
              v-model:value="filterStatus"
              :options="statusOptions"
              placeholder="任务状态"
              clearable
              style="width: 160px"
              @update:value="loadTasks"
            />
            <NButton @click="loadTasks">
              刷新
            </NButton>
          </NSpace>

          <!-- 任务列表 -->
          <NTable
            :bordered="false"
            :single-line="false"
          >
            <thead>
              <tr>
                <th>任务ID</th>
                <th>类型</th>
                <th>状态</th>
                <th>模型</th>
                <th>费用</th>
                <th>提交时间</th>
                <th>完成时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in tasks"
                :key="task.taskId"
              >
                <td>{{ task.taskId }}</td>
                <td>{{ getTypeText(task.type) }}</td>
                <td>
                  <NTag :type="getStatusType(task.status)">
                    {{ getStatusText(task.status) }}
                  </NTag>
                </td>
                <td>-</td>
                <td>-</td>
                <td>{{ new Date(task.submittedAt).toLocaleString() }}</td>
                <td>
                  {{
                    task.completedAt
                      ? new Date(task.completedAt).toLocaleString()
                      : "-"
                  }}
                </td>
                <td>
                  <NSpace size="small">
                    <NButton
                      v-if="
                        ['pending', 'processing', 'streaming'].includes(
                          task.status,
                        )
                      "
                      size="small"
                      @click="handleCancel(task.taskId)"
                    >
                      取消
                    </NButton>
                    <NButton
                      v-if="task.status === 'failed'"
                      size="small"
                      type="primary"
                      @click="handleRetry(task.taskId)"
                    >
                      重试
                    </NButton>
                    <NButton
                      v-if="task.status === 'completed'"
                      size="small"
                      @click="handleViewResult(task.taskId)"
                    >
                      查看结果
                    </NButton>
                  </NSpace>
                </td>
              </tr>
            </tbody>
          </NTable>

          <!-- 分页 -->
          <div class="pagination">
            <NPagination
              :page="pagination.page"
              :page-count="pagination.totalPages"
              :page-size="pagination.pageSize"
              @update:page="
                (page) => {
                  pagination.page = page;
                  loadTasks();
                }
              "
            />
          </div>
        </NCard>
      </NLayoutContent>
    </NLayout>
  </div>
</template>

<style scoped lang="scss">
.ai-task-list-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;
}

.header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;

  .header-content {
    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
  }
}

.content {
  padding: 24px;
}

.filter-bar {
  margin-bottom: 16px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>

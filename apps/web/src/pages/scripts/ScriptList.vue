<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NCard,
  NButton,
  NSpace,
  NInput,
  NSelect,
  NTable,
  NTag,
  NPagination,
  NEmpty,
  NIcon,
  NSpin,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  Add,
  Search,
  FilmOutline,
  Sparkles,
  DocumentTextOutline,
  EyeOutline,
  TrashOutline,
} from "@vicons/ionicons5";
import { useScriptStore } from "@/modules/script/store";
import { useProjectStore } from "@/stores/project";
import type { ScriptListItemDto, ScriptStatus } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const scriptStore = useScriptStore();
const projectStore = useProjectStore();

const projectId = computed(() => route.params.id as string);

// 权限检查
const isEditor = computed(() => projectStore.isEditor);

// 搜索和筛选
const keyword = ref("");
const statusFilter = ref<ScriptStatus | undefined>(undefined);

// 状态选项
const statusOptions = [
  { label: "全部状态", value: undefined },
  { label: "草稿", value: "draft" },
  { label: "编辑中", value: "editing" },
  { label: "AI生成中", value: "ai_generating" },
  { label: "已确认", value: "confirmed" },
];

// 状态标签映射
const statusMap: Record<
  ScriptStatus,
  { text: string; type: "default" | "warning" | "info" | "success" }
> = {
  draft: { text: "草稿", type: "default" },
  editing: { text: "编辑中", type: "warning" },
  ai_generating: { text: "AI生成中", type: "info" },
  confirmed: { text: "已确认", type: "success" },
};

// 加载剧本列表
const loading = computed(() => scriptStore.loading);
const scripts = computed(() => scriptStore.scripts);
const pagination = computed(() => scriptStore.pagination);

async function loadScripts(page = 1) {
  await scriptStore.queryScripts(projectId.value, {
    keyword: keyword.value || undefined,
    status: statusFilter.value || undefined,
    page,
    pageSize: pagination.value.pageSize,
  });
}

// 搜索
function handleSearch() {
  loadScripts(1);
}

// 状态筛选变化
function handleStatusChange() {
  loadScripts(1);
}

// 分页变化
function handlePageChange(page: number) {
  loadScripts(page);
}

// 创建剧本
function handleCreate() {
  router.push(`/projects/${projectId.value}/scripts/new`);
}

// 查看剧本
function handleView(scriptId: string) {
  router.push(`/projects/${projectId.value}/scripts/${scriptId}`);
}

// 删除剧本
function handleDelete(script: ScriptListItemDto) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除剧本 "${script.title}" 吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await scriptStore.deleteScript(projectId.value, script.id);
        message.success("删除成功");
        loadScripts(pagination.value.page);
      } catch (error) {
        message.error("删除失败");
      }
    },
  });
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 获取创建方式图标
function getCreationTypeIcon(metadata: { source?: string }) {
  const source = metadata?.source || "manual";
  switch (source) {
    case "ai":
      return Sparkles;
    case "import":
      return DocumentTextOutline;
    default:
      return FilmOutline;
  }
}

// 获取创建方式文本
function getCreationTypeText(metadata: { source?: string }): string {
  const source = metadata?.source || "manual";
  switch (source) {
    case "ai":
      return "AI生成";
    case "import":
      return "导入";
    default:
      return "手动创建";
  }
}

onMounted(() => {
  loadScripts();
});
</script>

<template>
  <div class="script-list-page">
    <!-- 页面标题栏 -->
    <n-card
      :bordered="false"
      class="header-card"
    >
      <div class="header-content">
        <div class="header-title">
          <h1>剧本管理</h1>
          <p class="subtitle">
            管理项目剧本，使用AI辅助创作或导入已有剧本
          </p>
        </div>
        <n-button
          v-if="isEditor"
          type="primary"
          @click="handleCreate"
        >
          <template #icon>
            <n-icon><Add /></n-icon>
          </template>
          创建剧本
        </n-button>
      </div>
    </n-card>

    <!-- 筛选栏 -->
    <n-card
      :bordered="false"
      class="filter-card"
    >
      <n-space
        align="center"
        :size="16"
      >
        <n-input
          v-model:value="keyword"
          placeholder="搜索剧本标题"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="筛选状态"
          clearable
          style="width: 160px"
          @update:value="handleStatusChange"
        />
        <n-button @click="handleSearch">
          搜索
        </n-button>
      </n-space>
    </n-card>

    <!-- 剧本列表 -->
    <n-card
      :bordered="false"
      class="list-card"
    >
      <n-spin :show="loading">
        <!-- 空态 -->
        <n-empty
          v-if="!loading && scripts.length === 0"
          description="暂无剧本"
          class="empty-state"
        >
          <template #icon>
            <n-icon
              size="48"
              :depth="3"
            >
              <FilmOutline />
            </n-icon>
          </template>
          <template #extra>
            <n-space
              vertical
              align="center"
              :size="16"
            >
              <p class="empty-tip">
                创建你的第一个剧本，开始创作之旅
              </p>
              <n-button
                v-if="isEditor"
                type="primary"
                @click="handleCreate"
              >
                <template #icon>
                  <n-icon><Add /></n-icon>
                </template>
                创建剧本
              </n-button>
            </n-space>
          </template>
        </n-empty>

        <!-- 列表表格 -->
        <n-table
          v-else
          :bordered="false"
          :single-line="false"
          class="script-table"
        >
          <thead>
            <tr>
              <th style="width: 40%">
                剧本标题
              </th>
              <th style="width: 100px">
                状态
              </th>
              <th style="width: 120px">
                创建方式
              </th>
              <th style="width: 180px">
                更新时间
              </th>
              <th style="width: 120px">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="script in scripts"
              :key="script.id"
              class="script-row"
            >
              <td>
                <div class="script-info">
                  <n-icon
                    class="script-icon"
                    :component="getCreationTypeIcon(script.metadata)"
                  />
                  <div class="script-meta">
                    <div class="script-title">
                      {{ script.title }}
                    </div>
                    <div
                      v-if="script.description"
                      class="script-desc"
                    >
                      {{ script.description }}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <n-tag
                  :type="statusMap[script.status].type"
                  size="small"
                >
                  {{ statusMap[script.status].text }}
                </n-tag>
              </td>
              <td>
                <span class="creation-type">{{
                  getCreationTypeText(script.metadata)
                }}</span>
              </td>
              <td>
                <span class="update-time">{{
                  formatDate(script.updatedAt)
                }}</span>
              </td>
              <td>
                <n-space :size="12">
                  <!-- 查看按钮 -->
                  <n-button
                    text
                    type="primary"
                    size="small"
                    @click="handleView(script.id)"
                  >
                    <template #icon>
                      <n-icon><EyeOutline /></n-icon>
                    </template>
                    查看
                  </n-button>

                  <!-- 删除按钮（仅编辑权限可见） -->
                  <n-button
                    v-if="isEditor"
                    text
                    type="error"
                    size="small"
                    @click="handleDelete(script)"
                  >
                    <template #icon>
                      <n-icon><TrashOutline /></n-icon>
                    </template>
                    删除
                  </n-button>
                </n-space>
              </td>
            </tr>
          </tbody>
        </n-table>

        <!-- 分页 -->
        <div
          v-if="scripts.length > 0"
          class="pagination-wrapper"
        >
          <n-pagination
            :page="pagination.page"
            :page-count="pagination.totalPages"
            :page-size="pagination.pageSize"
            :item-count="pagination.total"
            show-size-picker
            :page-sizes="[10, 20, 50]"
            @update:page="handlePageChange"
          />
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.script-list-page {
  padding-bottom: 24px;
}

.header-card {
  margin-bottom: 16px;

  :deep(.n-card__content) {
    padding: 20px 24px;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header-title {
      h1 {
        font-size: 20px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0 0 4px;
      }

      .subtitle {
        font-size: 13px;
        color: #666;
        margin: 0;
      }
    }
  }
}

.filter-card {
  margin-bottom: 16px;

  :deep(.n-card__content) {
    padding: 16px 24px;
  }
}

.list-card {
  :deep(.n-card__content) {
    padding: 0;
  }
}

.empty-state {
  padding: 80px 0;

  .empty-tip {
    font-size: 14px;
    color: #999;
    margin: 0;
  }
}

.script-table {
  th {
    font-weight: 500;
    color: #666;
    background: #fafafa;
    padding: 12px 16px;
  }

  td {
    padding: 16px;
    vertical-align: middle;
  }

  .script-row {
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #f5f7fa;
    }

    .script-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;

      .script-icon {
        font-size: 20px;
        color: #1890ff;
        margin-top: 2px;
      }

      .script-meta {
        flex: 1;
        min-width: 0;

        .script-title {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .script-desc {
          font-size: 12px;
          color: #999;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 300px;
        }
      }
    }

    .creation-type {
      font-size: 13px;
      color: #666;
    }

    .update-time {
      font-size: 13px;
      color: #666;
    }
  }
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
}
</style>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  NCard,
  NButton,
  NGrid,
  NGridItem,
  NEmpty,
  NPagination,
  NTag,
  NIcon,
  NAlert,
  NTooltip,
  useDialog,
  useMessage,
} from "naive-ui";
import { ArrowBack, Refresh, Trash, Warning, Time } from "@vicons/ionicons5";
import { useProjectStore } from "@/stores/project";

const router = useRouter();
const projectStore = useProjectStore();
const dialog = useDialog();
const message = useMessage();

// 回收站数据
const trashProjects = computed(() => projectStore.trashProjects);
const pagination = computed(() => projectStore.trashPagination);
const loading = computed(() => projectStore.loading);

// 加载回收站数据
const loadTrash = async (page: number = 1) => {
  await projectStore.fetchTrashProjects(page, pagination.value.pageSize);
};

onMounted(() => {
  loadTrash();
});

// 返回项目列表
const goBack = () => {
  router.push("/projects");
};

// 恢复项目
const handleRestore = (id: string, name: string) => {
  dialog.info({
    title: "确认恢复",
    content: `确定要恢复项目 "${name}" 吗？`,
    positiveText: "恢复",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await projectStore.restoreProject(id);
        message.success("项目已恢复");
      } catch (error: any) {
        message.error(error.message || "恢复失败");
      }
    },
  });
};

// 永久删除
const handlePermanentDelete = (id: string, name: string) => {
  dialog.error({
    title: "确认永久删除",
    content: `确定要永久删除项目 "${name}" 吗？此操作不可撤销！`,
    positiveText: "永久删除",
    negativeText: "取消",
    type: "error",
    onPositiveClick: async () => {
      try {
        await projectStore.permanentDeleteProject(id);
        message.success("项目已永久删除");
      } catch (error: any) {
        message.error(error.message || "删除失败");
      }
    },
  });
};

// 分页变化
const handlePageChange = (page: number) => {
  loadTrash(page);
};

// 计算剩余天数
const getRemainingDays = (deletedAt: string) => {
  const deleted = new Date(deletedAt);
  const now = new Date();
  const diff = 30 * 24 * 60 * 60 * 1000 - (now.getTime() - deleted.getTime());
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
};

// 封面背景色
const coverColors = [
  "linear-gradient(135deg, #999 0%, #666 100%)",
  "linear-gradient(135deg, #888 0%, #555 100%)",
];

const getCoverStyle = (id: string, coverUrl?: string) => {
  if (coverUrl) {
    return { backgroundImage: `url(${coverUrl})` };
  }
  const colorIndex =
    id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    coverColors.length;
  return { background: coverColors[colorIndex], filter: "grayscale(100%)" };
};

const getProjectInitial = (name: string) => {
  const firstChar = (name || "").trim().charAt(0);
  return firstChar ? firstChar.toUpperCase() : "?";
};
</script>

<template>
  <div class="project-trash-page">
    <!-- 顶部栏 -->
    <div class="page-header">
      <n-button
        quaternary
        @click="goBack"
      >
        <template #icon>
          <n-icon><ArrowBack /></n-icon>
        </template>
        返回项目列表
      </n-button>
    </div>

    <!-- 标题区 -->
    <div class="title-section">
      <h1 class="page-title">
        回收站
      </h1>
      <p class="page-subtitle">
        已删除的项目会保留30天，之后自动永久删除
      </p>
    </div>

    <!-- 警告提示 -->
    <n-alert
      type="warning"
      :show-icon="true"
      style="margin-bottom: 24px"
    >
      <template #icon>
        <n-icon><Warning /></n-icon>
      </template>
      回收站中的项目将在30天后自动永久删除，请及时恢复需要的项目。
    </n-alert>

    <!-- 空状态 -->
    <n-empty
      v-if="!loading && trashProjects.length === 0"
      description="回收站是空的"
      class="empty-state"
    >
      <template #extra>
        <n-button @click="goBack">
          返回项目列表
        </n-button>
      </template>
    </n-empty>

    <!-- 项目列表 -->
    <n-grid
      v-else
      :cols="4"
      :x-gap="20"
      :y-gap="20"
      responsive="screen"
      item-responsive
    >
      <n-grid-item
        v-for="project in trashProjects"
        :key="project.id"
        span="2 s:2 m:1 l:1 xl:1"
      >
        <n-card
          class="trash-card"
          :bordered="false"
        >
          <!-- 封面 -->
          <div
            class="cover"
            :style="getCoverStyle(project.id, project.coverUrl || undefined)"
          >
            <!-- 无封面时的首字母降级 -->
            <div
              v-if="!project.coverUrl"
              class="cover-initial"
            >
              {{ getProjectInitial(project.name) }}
            </div>
            <div class="cover-overlay">
              <n-tag
                type="error"
                size="small"
                class="status-tag"
              >
                已删除
              </n-tag>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <div class="countdown">
                    <n-icon size="14">
                      <Time />
                    </n-icon>
                    <span>{{ getRemainingDays(project.deletedAt) }}天后清理</span>
                  </div>
                </template>
                删除时间: {{ new Date(project.deletedAt).toLocaleString() }}
              </n-tooltip>
            </div>
          </div>

          <!-- 内容 -->
          <div class="content">
            <h3 class="title">
              {{ project.name }}
            </h3>

            <!-- 操作按钮 -->
            <div class="actions">
              <n-button
                size="small"
                class="restore-btn"
                @click="handleRestore(project.id, project.name)"
              >
                <template #icon>
                  <n-icon><Refresh /></n-icon>
                </template>
                恢复
              </n-button>
              <n-button
                size="small"
                class="delete-btn"
                @click="handlePermanentDelete(project.id, project.name)"
              >
                <template #icon>
                  <n-icon><Trash /></n-icon>
                </template>
                永久删除
              </n-button>
            </div>
          </div>
        </n-card>
      </n-grid-item>
    </n-grid>

    <!-- 分页 -->
    <div
      v-if="pagination.totalPages > 1"
      class="pagination"
    >
      <n-pagination
        :page="pagination.page"
        :page-count="pagination.totalPages"
        :page-size="pagination.pageSize"
        @update:page="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-trash-page {
  min-height: calc(100vh - 56px);
  background: #f8fafc;
  padding: 0 32px 40px;
}

.page-header {
  margin-bottom: 16px;
  padding-top: 24px;

  :deep(.n-button) {
    color: #64748b;
    font-size: 14px;
    font-weight: 500;

    &:hover {
      color: #0f172a;
      background: #f1f5f9;
    }
  }
}

.title-section {
  margin-bottom: 24px;

  .page-title {
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 8px;
    letter-spacing: -0.3px;
  }

  .page-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 0;
  }
}

.empty-state {
  padding: 80px 0;

  :deep(.n-empty__description) {
    color: #94a3b8;
  }
}

.trash-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  opacity: 0.85;

  &:hover {
    opacity: 1;
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.08),
      0 10px 10px -5px rgba(0, 0, 0, 0.02);
  }

  :deep(.n-card__content) {
    padding: 0;
  }

  .cover {
    height: 128px;
    background-size: cover;
    background-position: center;
    position: relative;

    .cover-initial {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      letter-spacing: 2px;
      pointer-events: none;
      z-index: 1;
    }

    .cover-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.35) 0%,
        transparent 50%,
        rgba(0, 0, 0, 0.1) 100%
      );
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;

      .status-tag {
        background: rgba(255, 255, 255, 0.92) !important;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }

      .countdown {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 9999px;
        color: #fff;
        font-size: 11px;
        font-weight: 500;
      }
    }
  }

  .content {
    padding: 16px;

    .title {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .actions {
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      justify-content: center;
      gap: 8px;

      .restore-btn {
        background: #eff6ff;
        border: none;
        color: #2563eb;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
          background: #dbeafe;
        }
      }

      .delete-btn {
        background: #fef2f2;
        border: none;
        color: #dc2626;
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
          background: #fee2e2;
        }
      }
    }
  }
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

// 暗黑模式适配
[data-theme="dark"] {
  .project-trash-page {
    background: #0f172a;
  }

  .page-header {
    :deep(.n-button) {
      color: #94a3b8;

      &:hover {
        color: #f1f5f9;
        background: #1e293b;
      }
    }
  }

  .title-section {
    .page-title {
      color: #f1f5f9;
    }

    .page-subtitle {
      color: #64748b;
    }
  }

  .trash-card {
    background: #1e293b;
    border-color: rgba(148, 163, 184, 0.15);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

    &:hover {
      border-color: rgba(148, 163, 184, 0.25);
      box-shadow:
        0 20px 25px -5px rgba(0, 0, 0, 0.3),
        0 10px 10px -5px rgba(0, 0, 0, 0.15);
    }

    .cover {
      .cover-overlay {
        .status-tag {
          background: rgba(30, 30, 46, 0.92) !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      }
    }

    .content {
      .title {
        color: #f1f5f9;
      }

      .actions {
        border-top-color: rgba(148, 163, 184, 0.1);

        .restore-btn {
          background: rgba(37, 99, 235, 0.15);
          color: #60a5fa;

          &:hover {
            background: rgba(37, 99, 235, 0.25);
          }
        }

        .delete-btn {
          background: rgba(220, 38, 38, 0.15);
          color: #f87171;

          &:hover {
            background: rgba(220, 38, 38, 0.25);
          }
        }
      }
    }
  }
}
</style>

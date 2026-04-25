<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
const headerAvatarError = ref(false);
import { useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NButton,
  NInput,
  NSelect,
  NGrid,
  NGridItem,
  NPagination,
  NSpace,
  NTag,
  NIcon,
  NTooltip,
  NDropdown,
  useDialog,
  useMessage,
} from "naive-ui";
import {
  Add,
  Search,
  TrashOutline,
  Refresh,
  ChevronDown,
} from "@vicons/ionicons5";
import ProjectCardV2 from "@/components/project/ProjectCardV2.vue";
import CreateProjectModal from "@/components/project/CreateProjectModal.vue";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import type { SelectOption } from "naive-ui";
import type { ProjectStatus } from "@pixaura/shared-types";

const router = useRouter();
const projectStore = useProjectStore();
const authStore = useAuthStore();
const dialog = useDialog();
const message = useMessage();

// 用户菜单
const userMenuOptions = computed(() => [
  {
    label: "个人中心",
    key: "profile",
  },
  {
    label: "修改密码",
    key: "password",
  },
  {
    type: "divider",
    key: "d1",
  },
  {
    label: "退出登录",
    key: "logout",
  },
]);

const handleUserMenuSelect = (key: string) => {
  switch (key) {
    case "profile":
      router.push("/user/profile");
      break;
    case "password":
      router.push("/user/change-password");
      break;
    case "logout":
      authStore.logout();
      router.push("/login");
      break;
  }
};

// 搜索和筛选
const searchKeyword = ref("");
const statusFilter = ref<ProjectStatus | "">("");
const roleFilter = ref<"owner" | "editor" | "viewer" | "">("");

// 状态选项
const statusOptions: SelectOption[] = [
  { label: "全部状态", value: "" },
  { label: "草稿", value: "draft" },
  { label: "进行中", value: "active" },
  { label: "已完成", value: "completed" },
  { label: "已归档", value: "archived" },
];

// 角色选项
const roleOptions: SelectOption[] = [
  { label: "全部角色", value: "" },
  { label: "所有者", value: "owner" },
  { label: "编辑者", value: "editor" },
  { label: "查看者", value: "viewer" },
];

// 加载状态
const loading = computed(() => projectStore.loading);
const projects = computed(() => projectStore.projects);
const pagination = computed(() => projectStore.pagination);

// 创建项目弹窗
const showCreateModal = ref(false);

const handleCreateSuccess = (_projectId: string) => {
  loadProjects(1);
  // 可选：跳转到新项目
  // router.push(`/projects/${projectId}`);
};

// 加载项目列表
const loadProjects = async (page: number = 1) => {
  await projectStore.fetchProjects({
    page,
    pageSize: pagination.value.pageSize,
    keyword: searchKeyword.value || undefined,
    status: statusFilter.value || undefined,
    role: roleFilter.value || undefined,
  });
};

onMounted(() => {
  loadProjects();
});

// 搜索
const handleSearch = () => {
  loadProjects(1);
};

// 筛选变化
const handleFilterChange = () => {
  loadProjects(1);
};

// 分页变化
const handlePageChange = (page: number) => {
  loadProjects(page);
};

// 创建项目
const handleCreate = () => {
  showCreateModal.value = true;
};

// 删除项目
const handleDelete = (id: string) => {
  const d = dialog.warning({
    title: "确认删除",
    content: "删除后的项目将进入回收站，30天后自动永久删除。是否继续？",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      d.loading = true;
      try {
        await projectStore.deleteProject(id);
        message.success("项目已移至回收站");
        loadProjects();
      } catch (error) {
        message.error("删除失败");
      } finally {
        d.loading = false;
      }
    },
  });
};

// 归档项目
const handleArchive = (id: string) => {
  const d = dialog.warning({
    title: "确认归档",
    content: "归档后的项目可以在设置中恢复。是否继续？",
    positiveText: "归档",
    negativeText: "取消",
    onPositiveClick: async () => {
      d.loading = true;
      try {
        await projectStore.updateProject(id, { status: "archived" });
        message.success("项目已归档");
        loadProjects();
      } catch (error) {
        message.error("归档失败");
      } finally {
        d.loading = false;
      }
    },
  });
};

// 恢复项目
const handleRestore = (id: string) => {
  const d = dialog.warning({
    title: "确认恢复",
    content: "恢复后的项目将回到原来的状态。是否继续？",
    positiveText: "恢复",
    negativeText: "取消",
    onPositiveClick: async () => {
      d.loading = true;
      try {
        await projectStore.updateProject(id, { status: "draft" });
        message.success("项目已恢复");
        loadProjects();
      } catch (error) {
        message.error("恢复失败");
      } finally {
        d.loading = false;
      }
    },
  });
};
</script>

<template>
  <div class="project-list-page">
    <n-layout class="main-layout">
      <!-- 顶部栏 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <div class="header-left">
            <h1 class="page-title">
              我的项目
            </h1>
            <n-tag
              v-if="pagination.total > 0"
              type="info"
              size="small"
              class="total-tag"
            >
              共 {{ pagination.total }} 个
            </n-tag>
          </div>
          <div class="header-right">
            <n-space align="center">
              <!-- 用户下拉 -->
              <n-dropdown
                :options="userMenuOptions"
                placement="bottom-end"
                @select="handleUserMenuSelect"
              >
                <div class="user-info">
                  <div
                    v-if="authStore.user?.avatar && !headerAvatarError"
                    class="user-avatar"
                  >
                    <img
                      :src="authStore.user.avatar"
                      :alt="authStore.user.username"
                      @error="headerAvatarError = true"
                    >
                  </div>
                  <div
                    v-else
                    class="user-avatar-fallback"
                  >
                    {{ authStore.user?.username?.charAt(0).toUpperCase() || "U" }}
                  </div>
                  <span class="username">{{ authStore.user?.username }}</span>
                  <n-icon size="14">
                    <ChevronDown />
                  </n-icon>
                </div>
              </n-dropdown>
            </n-space>
          </div>
        </div>
      </n-layout-header>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-bar-inner">
          <div class="filter-bar-top">
            <!-- 搜索 -->
            <n-input
              v-model:value="searchKeyword"
              placeholder="搜索项目名称"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <n-icon size="16">
                  <Search />
                </n-icon>
              </template>
            </n-input>

            <!-- 筛选器 -->
            <div class="filters-wrapper">
              <n-select
                v-model:value="statusFilter"
                :options="statusOptions"
                placeholder="状态筛选"
                clearable
                class="filter-select"
                @update:value="handleFilterChange"
              />
              <n-select
                v-model:value="roleFilter"
                :options="roleOptions"
                placeholder="角色筛选"
                clearable
                class="filter-select"
                @update:value="handleFilterChange"
              />
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button
                    circle
                    class="refresh-btn"
                    @click="handleSearch"
                  >
                    <n-icon><Refresh /></n-icon>
                  </n-button>
                </template>
                刷新列表
              </n-tooltip>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作栏 -->
      <div class="action-bar">
        <n-button
          class="trash-btn"
          @click="$router.push('/projects/trash')"
        >
          <template #icon>
            <n-icon><TrashOutline /></n-icon>
          </template>
          回收站
        </n-button>
        <n-button
          class="create-btn"
          type="primary"
          @click="handleCreate"
        >
          <template #icon>
            <n-icon><Add /></n-icon>
          </template>
          创建项目
        </n-button>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <!-- 空状态 -->
        <div
          v-if="!loading && projects.length === 0"
          class="empty-state"
        >
          <div class="empty-icon-wrapper float-animation">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#cbd5e1"
              stroke-width="1.5"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3 class="empty-title">暂无项目</h3>
          <p class="empty-desc">创建您的第一个项目开始管理剧本</p>
          <n-button
            class="create-btn"
            type="primary"
            @click="handleCreate"
          >
            创建第一个项目
          </n-button>
        </div>

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
            v-for="project in projects"
            :key="project.id"
            span="2 s:2 m:1 l:1 xl:1"
          >
            <project-card-v2
              :project="project"
              @delete="handleDelete"
              @archive="handleArchive"
              @restore="handleRestore"
            />
          </n-grid-item>
        </n-grid>

        <!-- 分页 -->
        <div
          v-if="pagination.totalPages > 1"
          class="pagination-wrapper"
        >
          <n-pagination
            :page="pagination.page"
            :page-count="pagination.totalPages"
            :page-size="pagination.pageSize"
            show-size-picker
            :page-sizes="[12, 20, 50, 100]"
            @update:page="handlePageChange"
            @update:page-size="
              (size) => {
                pagination.pageSize = size;
                loadProjects(1);
              }
            "
          />
        </div>
      </n-layout-content>
    </n-layout>

    <!-- 创建项目弹窗 -->
    <CreateProjectModal
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
    />
  </div>
</template>

<style scoped lang="scss">
.project-list-page {
  min-height: calc(100vh - 56px);
  background: #f8fafc;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;

  &:deep(.n-layout-scroll-container) {
    overflow: visible !important;
  }

  &:deep(> .n-layout-scroll-container) {
    overflow: visible !important;
  }
}

// 顶部栏
.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 0 32px;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 40;

  :deep(.n-layout-header__border) {
    display: none;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 64px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .page-title {
        font-size: 20px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
        letter-spacing: -0.3px;
      }

      .total-tag {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #64748b;
        font-weight: 500;
      }
    }
  }
}

// 用户下拉
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  background: transparent;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .user-avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .username {
    font-size: 14px;
    font-weight: 500;
    color: #334155;
  }
}

// 筛选栏
.filter-bar {
  margin: 24px 32px 0;

  .filter-bar-inner {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .filter-bar-top {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: space-between;

    .search-input {
      flex: 1;
      min-width: 240px;
      max-width: 400px;

      :deep(.n-input-wrapper) {
        background: #f8fafc;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        transition: all 0.2s ease;

        .n-input__prefix {
          color: #94a3b8;
          margin-right: 6px;
        }

        &:hover {
          border-color: #cbd5e1;
        }

        &:focus-within {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
        }
      }
    }

    .filters-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;

      .filter-select {
        width: 130px;

        :deep(.n-base-selection) {
          background: #f8fafc;
          border-radius: 10px;
          border: 1px solid #e2e8f0;

          &:hover {
            border-color: #cbd5e1;
          }

          &.n-base-selection--focus {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.08);
          }
        }
      }

      .refresh-btn {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #64748b;
        transition: all 0.2s ease;

        &:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #475569;
        }
      }
    }
  }
}

// 操作栏
.action-bar {
  margin: 20px 32px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .trash-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;

    &:hover {
      color: #0f172a;
      background: #f1f5f9;
    }
  }

  .create-btn {
    background: #4f46e5;
    border: none;
    border-radius: 10px;
    padding: 0 20px;
    font-weight: 500;
    font-size: 14px;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(79, 70, 229, 0.2);

    &:hover {
      background: #4338ca;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

// 内容区
.content {
  padding: 28px 32px 40px;
  background: transparent;
  overflow: visible;

  :deep(.n-grid) {
    overflow: visible;
  }

  :deep(.n-grid-item) {
    overflow: visible;
  }

  // 空状态
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 0;
    text-align: center;

    .empty-icon-wrapper {
      width: 80px;
      height: 80px;
      background: #f1f5f9;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px;
    }

    .empty-desc {
      font-size: 14px;
      color: #94a3b8;
      margin: 0 0 24px;
    }

    .create-btn {
      background: #4f46e5;
      border: none;
      border-radius: 10px;
      padding: 0 24px;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.2);

      &:hover {
        background: #4338ca;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      }
    }
  }

  // 分页
  .pagination-wrapper {
    display: flex;
    justify-content: center;
    margin-top: 32px;
  }
}

// 浮动动画
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.float-animation {
  animation: float 3s ease-in-out infinite;
}

// 暗黑模式适配
[data-theme="dark"] {
  .project-list-page {
    background: #0f172a;
  }

  .header {
    background: rgba(15, 23, 42, 0.85);
    border-bottom-color: rgba(148, 163, 184, 0.15);

    .page-title {
      color: #f1f5f9;
    }
  }

  .user-info {
    &:hover {
      background: #1e293b;
    }

    .username {
      color: #e2e8f0;
    }
  }

  .filter-bar {
    .filter-bar-inner {
      background: #1e293b;
      border-color: rgba(148, 163, 184, 0.15);
    }

    .filter-bar-top {
      .search-input {
        :deep(.n-input-wrapper) {
          background: #0f172a;
          border-color: rgba(148, 163, 184, 0.15);

          &:hover {
            border-color: rgba(148, 163, 184, 0.25);
          }

          &:focus-within {
            border-color: #6366f1;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
          }
        }
      }

      .filters-wrapper {
        .filter-select {
          :deep(.n-base-selection) {
            background: #0f172a;
            border-color: rgba(148, 163, 184, 0.15);

            &:hover {
              border-color: rgba(148, 163, 184, 0.25);
            }

            &.n-base-selection--focus {
              border-color: #6366f1;
              box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
            }
          }
        }

        .refresh-btn {
          background: #0f172a;
          border-color: rgba(148, 163, 184, 0.15);
          color: #94a3b8;

          &:hover {
            background: #1e293b;
            border-color: rgba(148, 163, 184, 0.25);
            color: #e2e8f0;
          }
        }
      }
    }
  }

  .action-bar {
    .trash-btn {
      color: #94a3b8;

      &:hover {
        color: #f1f5f9;
        background: #1e293b;
      }
    }
  }

  .content {
    .empty-state {
      .empty-icon-wrapper {
        background: #1e293b;
      }

      .empty-title {
        color: #f1f5f9;
      }
    }
  }

}
</style>

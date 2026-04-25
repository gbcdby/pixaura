<script setup lang="ts">
import { computed, h, onMounted, watch, ref, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NDropdown,
  NBreadcrumb,
  NBreadcrumbItem,
  NAvatar,
  NIcon,
  NTooltip,
  NTag,
  NSpace,
} from "naive-ui";
import type { MenuOption } from "naive-ui";
import { useProjectStore } from "@/stores/project";
import { useAuthStore } from "@/stores/auth";
import {
  Settings,
  People,
  ArrowBack,
  ChevronDown,
  Film,
  DocumentText,
  Person,
  Image,
  Cube,
} from "@vicons/ionicons5";

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const authStore = useAuthStore();

const projectId = computed(() => route.params.id as string);

// 渲染图标函数
const renderIcon = (icon: any) => {
  return () => h(NIcon, null, { default: () => h(icon) });
};

// 侧边栏菜单
const menuOptions = computed<MenuOption[]>(() => [
  {
    label: "项目概览",
    key: "ProjectDetail",
    icon: renderIcon(DocumentText),
    path: `/projects/${projectId.value}`,
  },
  {
    label: "剧本管理",
    key: "ProjectScripts",
    icon: renderIcon(Film),
    path: `/projects/${projectId.value}/scripts`,
  },
  {
    label: "角色库",
    key: "ProjectCharacters",
    icon: renderIcon(Person),
    path: `/projects/${projectId.value}/characters`,
  },
  {
    label: "场景库",
    key: "ProjectScenes",
    icon: renderIcon(Image),
    path: `/projects/${projectId.value}/scenes`,
  },
  {
    label: "道具库",
    key: "ProjectProps",
    icon: renderIcon(Cube),
    path: `/projects/${projectId.value}/props`,
  },
  {
    label: "协作者",
    key: "ProjectCollaborators",
    icon: renderIcon(People),
    path: `/projects/${projectId.value}/collaborators`,
  },
  {
    label: "设置",
    key: "ProjectSettings",
    icon: renderIcon(Settings),
    path: `/projects/${projectId.value}/settings`,
  },
]);

const activeKey = computed(() => {
  const path = route.path;

  // 子级路由映射到父级菜单 - 使用路径片段匹配，不依赖 projectId
  if (path.includes("/characters")) {
    return "ProjectCharacters";
  }
  if (path.includes("/scenes")) {
    return "ProjectScenes";
  }
  if (path.includes("/props")) {
    return "ProjectProps";
  }
  if (path.includes("/scripts")) {
    return "ProjectScripts";
  }
  if (path.includes("/collaborators")) {
    return "ProjectCollaborators";
  }
  if (path.includes("/settings")) {
    return "ProjectSettings";
  }
  // 项目概览（根路径）- 匹配 /projects/:id 或 /projects/:id/
  if (/^\/projects\/[^/]+\/?$/.test(path)) {
    return "ProjectDetail";
  }

  return route.name as string;
});

// 当前项目
const currentProject = computed(() => projectStore.currentProject);

// 当前用户角色
// 状态标签类型
const statusType = computed(() => {
  const status = currentProject.value?.status;
  switch (status) {
    case "active":
      return "success";
    case "draft":
      return "warning";
    case "completed":
      return "info";
    case "archived":
      return "default";
    default:
      return "default";
  }
});

// 状态显示文本
const statusText = computed(() => {
  const status = currentProject.value?.status;
  switch (status) {
    case "active":
      return "进行中";
    case "draft":
      return "草稿";
    case "completed":
      return "已完成";
    case "archived":
      return "已归档";
    default:
      return status || "未知";
  }
});

// 加载项目详情
onMounted(() => {
  if (projectId.value) {
    loadProject();
  }
});

// 监听项目ID变化
watch(
  () => projectId.value,
  (newId) => {
    if (newId) {
      loadProject();
    }
  },
);

async function loadProject() {
  try {
    await projectStore.fetchProjectDetail(projectId.value);
  } catch (error) {
    // 项目不存在或无权限
    router.push("/projects");
  }
}

// 处理菜单点击
const handleMenuClick = (_key: string, item: MenuOption) => {
  if (item.path) {
    router.push(item.path);
  }
};

// 返回项目列表
const goBackToList = () => {
  router.push("/projects");
};

// 用户下拉菜单
const userMenuOptions = computed(() => [
  {
    label: "个人中心",
    key: "profile",
  },
  {
    label: "返回首页",
    key: "home",
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
    case "home":
      router.push("/");
      break;
    case "logout":
      authStore.logout();
      router.push("/login");
      break;
  }
};

// 面包屑
// 是否隐藏侧边栏
const hideSidebar = computed(() => route.meta.hideSidebar as boolean);

// 内容区滚动引用（用于路由切换时滚动到顶部）
const contentRef = ref<HTMLElement | null>(null);

// 路由切换时滚动到顶部
watch(
  () => route.path,
  async () => {
    await nextTick();
    requestAnimationFrame(() => {
      if (contentRef.value) {
        contentRef.value.scrollTop = 0;
      }
    });
  },
);

const breadcrumbItems = computed(() => {
  const items: Array<{ label: string; path?: string }> = [
    { label: "项目列表", path: "/projects" },
  ];

  if (currentProject.value) {
    items.push({
      label: currentProject.value.name,
      path: `/projects/${projectId.value}`,
    });

    // 根据当前路由添加子页面
    const routeName = route.name as string;
    if (routeName === "ProjectSettings") {
      items.push({ label: "设置" });
    } else if (routeName === "ProjectCollaborators") {
      items.push({ label: "协作者" });
    } else if (routeName === "ProjectScripts") {
      items.push({ label: "剧本管理" });
    } else if (routeName === "ProjectCharacters") {
      items.push({ label: "角色库" });
    } else if (routeName === "CharacterCreate") {
      items.push({
        label: "角色库",
        path: `/projects/${projectId.value}/characters`,
      });
      items.push({ label: "创建角色" });
    } else if (routeName === "ProjectScenes") {
      items.push({ label: "场景库" });
    } else if (routeName === "SceneCreate") {
      items.push({
        label: "场景库",
        path: `/projects/${projectId.value}/scenes`,
      });
      items.push({ label: "创建场景" });
    } else if (routeName === "SceneDetail") {
      items.push({
        label: "场景库",
        path: `/projects/${projectId.value}/scenes`,
      });
      items.push({ label: "场景详情" });
    } else if (routeName === "SceneEdit") {
      items.push({
        label: "场景库",
        path: `/projects/${projectId.value}/scenes`,
      });
      items.push({ label: "编辑场景" });
    } else if (routeName === "ProjectProps") {
      items.push({ label: "道具库" });
    } else if (routeName === "PropCreate") {
      items.push({
        label: "道具库",
        path: `/projects/${projectId.value}/props`,
      });
      items.push({ label: "创建道具" });
    } else if (routeName === "PropDetail") {
      items.push({
        label: "道具库",
        path: `/projects/${projectId.value}/props`,
      });
      items.push({ label: "道具详情" });
    } else if (routeName === "PropEdit") {
      items.push({
        label: "道具库",
        path: `/projects/${projectId.value}/props`,
      });
      items.push({ label: "编辑道具" });
    }
  }

  return items;
});
</script>

<template>
  <div class="project-layout">
    <n-layout
      :has-sider="!hideSidebar"
      class="main-layout"
    >
      <!-- 侧边栏 -->
      <n-layout-sider
        v-if="!hideSidebar"
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="220"
        class="sidebar"
      >
        <!-- 返回按钮区域 -->
        <div
          class="back-area"
          @click="goBackToList"
        >
          <n-button
            quaternary
            size="small"
          >
            <template #icon>
              <n-icon><ArrowBack /></n-icon>
            </template>
            <span class="back-text">返回列表</span>
          </n-button>
        </div>

        <!-- 项目信息区域 -->
        <div
          v-if="currentProject"
          class="project-info"
        >
          <n-tooltip
            :show-arrow="false"
            placement="right"
          >
            <template #trigger>
              <div class="project-name">
                {{ currentProject.name }}
              </div>
            </template>
            {{ currentProject.name }}
          </n-tooltip>
          <n-tag
            :type="statusType"
            size="small"
            class="status-tag"
          >
            {{ statusText }}
          </n-tag>
        </div>

        <!-- 菜单 -->
        <n-menu
          :collapsed-width="64"
          :collapsed-icon-size="20"
          :options="menuOptions"
          :value="activeKey"
          class="project-menu"
          @update:value="handleMenuClick"
        />
      </n-layout-sider>

      <!-- 主内容区 -->
      <n-layout class="content-layout">
        <!-- 顶部栏 -->
        <n-layout-header
          class="header"
          bordered
        >
          <div class="header-left">
            <!-- 面包屑 -->
            <n-breadcrumb>
              <n-breadcrumb-item
                v-for="(item, index) in breadcrumbItems"
                :key="index"
                :class="{ clickable: item.path }"
                @click="item.path && router.push(item.path)"
              >
                {{ item.label }}
              </n-breadcrumb-item>
            </n-breadcrumb>
          </div>

          <div class="header-right">
            <n-space
              align="center"
              :size="16"
            >
              <!-- 用户下拉 -->
              <n-dropdown
                :options="userMenuOptions"
                placement="bottom-end"
                @select="handleUserMenuSelect"
              >
                <div class="user-info">
                  <n-avatar
                    round
                    :size="32"
                    :src="authStore.user?.avatar"
                    :fallback-src="'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'"
                  />
                  <span class="username">{{ authStore.user?.username }}</span>
                  <n-icon size="14">
                    <ChevronDown />
                  </n-icon>
                </div>
              </n-dropdown>
            </n-space>
          </div>
        </n-layout-header>

        <!-- 内容区 -->
        <n-layout-content ref="contentRef" class="content">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.project-layout {
  min-height: 100vh;
  background: #fff;
}

.main-layout {
  height: 100vh;
}

// 侧边栏
.sidebar {
  background: #fff !important;
  border-right: 1px solid #e8e8e8;

  :deep(.n-layout-sider-scroll-container) {
    display: flex;
    flex-direction: column;
  }

  .back-area {
    height: 48px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;

    &:hover {
      background: #f5f5f5;
    }

    .back-text {
      font-size: 13px;
      margin-left: 4px;
    }
  }

  .project-info {
    padding: 16px;
    border-bottom: 1px solid #f0f0f0;

    .project-name {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-tag {
      font-size: 12px;
    }
  }

  .project-menu {
    flex: 1;
    padding: 8px 0;

    :deep(.n-menu-item) {
      margin: 2px 8px;
      border-radius: 6px;

      &.n-menu-item--selected {
        background: #e6f7ff !important;

        .n-menu-item-content__icon {
          color: #1890ff !important;
        }

        .n-menu-item-content-header {
          color: #1890ff !important;
          font-weight: 500;
        }
      }

      &:hover:not(.n-menu-item--selected) {
        background: #f5f5f5 !important;
      }
    }

    :deep(.n-menu-item-content) {
      padding: 0 16px;
      height: 40px;

      .n-menu-item-content__icon {
        color: #666;
      }

      .n-menu-item-content-header {
        color: #333;
        font-size: 14px;
      }
    }
  }
}

// 内容布局
.content-layout {
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

// 顶部栏
.header {
  height: 56px;
  background: #fff !important;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    :deep(.n-breadcrumb) {
      .n-breadcrumb-item {
        color: #666;
        font-size: 14px;

        &.clickable {
          cursor: pointer;
          color: #1890ff;

          &:hover {
            color: #40a9ff;
          }
        }

        &:last-child {
          color: #1a1a1a;
          font-weight: 500;
        }
      }
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.2s;

      &:hover {
        background: #f5f5f5;
      }

      .username {
        font-size: 14px;
        color: #333;
      }
    }
  }
}

// 内容区
.content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 56px);
}
</style>

<script setup lang="ts">
import { ref, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NSpace,
  NButton,
  NDropdown,
  NBreadcrumb,
  NBreadcrumbItem,
  NAvatar,
  NIcon,
  NTooltip,
  NDrawer,
  NDrawerContent,
} from "naive-ui";
import type { MenuOption } from "naive-ui";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
import {
  BarChart,
  People,
  Card,
  Settings,
  DocumentText,
  Cube,
  ChevronBack,
  ChevronForward,
  Home,
  LogOut,
  Person,
  Notifications,
  Search,
  Pulse,
  Menu,
  Megaphone,
  Mic,
  Videocam,
} from "@vicons/ionicons5";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const collapsed = ref(false);
const mobileDrawerOpen = ref(false);

// 响应式断点检测
const isMobile = computed(() => window.innerWidth < 768);
const isTablet = computed(
  () => window.innerWidth >= 768 && window.innerWidth < 1024,
);
const isDesktop = computed(() => window.innerWidth >= 1024);

// 监听窗口大小变化
const updateBreakpoint = () => {
  if (isMobile.value) {
    // 移动端：强制折叠，使用抽屉
    collapsed.value = true;
  } else if (isTablet.value) {
    // 平板端：默认折叠为图标栏
    collapsed.value = true;
  }
  // 桌面端：保持当前状态
};

// 初始化断点
updateBreakpoint();
window.addEventListener("resize", updateBreakpoint);

// 是否显示汉堡菜单按钮
const showHamburgerMenu = computed(() => !isDesktop.value);

// 侧边栏实际折叠状态（桌面端响应式，移动端强制抽屉）
const sidebarCollapsed = computed(() => {
  if (isMobile.value) return true;
  return collapsed.value;
});

const activeKey = computed(() => {
  const name = route.name as string;

  // 处理公告相关路由（列表、创建、编辑）
  if (name?.startsWith("AdminNotice")) {
    return "AdminNoticeList";
  }

  // 处理 TTS 相关路由
  if (name?.startsWith("AdminTTS")) {
    return name;
  }

  // 处理对口型相关路由
  if (name?.startsWith("AdminLipSync")) {
    return name;
  }

  return name;
});

// 切换移动端抽屉
const toggleMobileDrawer = () => {
  mobileDrawerOpen.value = !mobileDrawerOpen.value;
};

// 处理菜单点击（移动端点击后关闭抽屉）
const handleMenuClickWithClose = (_key: string, item: MenuOption) => {
  if (item.path) {
    router.push(item.path);
  }
  if (isMobile.value) {
    mobileDrawerOpen.value = false;
  }
};

// 渲染图标函数
const renderIcon = (icon: any) => {
  return () => h(NIcon, null, { default: () => h(icon) });
};

// 菜单配置
const menuOptions: MenuOption[] = [
  {
    label: "仪表盘",
    key: "AdminDashboard",
    icon: renderIcon(BarChart),
    path: "/admin/dashboard",
  },
  {
    label: "用户管理",
    key: "AdminUsers",
    icon: renderIcon(People),
    path: "/admin/users",
  },
  {
    label: "计费管理",
    key: "AdminBilling",
    icon: renderIcon(Card),
    children: [
      {
        label: "价格配置",
        key: "PricingConfig",
        path: "/admin/billing/pricing-config",
      },
      {
        label: "价格历史",
        key: "PricingHistory",
        path: "/admin/billing/pricing-history",
      },
      {
        label: "额度配置",
        key: "AdminQuotaConfig",
        path: "/admin/billing/quota-config",
      },
      {
        label: "订阅管理",
        key: "AdminSubscriptions",
        path: "/admin/billing/subscriptions",
      },
      {
        label: "流水查询",
        key: "AdminTransactions",
        path: "/admin/billing/transactions",
      },
      {
        label: "充值活动",
        key: "AdminPromotions",
        path: "/admin/billing/promotions",
      },
    ],
  },
  {
    label: "模型配置",
    key: "AdminModelConfig",
    icon: renderIcon(Cube),
    children: [
      {
        label: "供应商管理",
        key: "AdminProviders",
        path: "/admin/model-config/providers",
      },
      {
        label: "模型管理",
        key: "AdminModels",
        path: "/admin/model-config/models",
      },
      {
        label: "健康监控",
        key: "AdminHealth",
        path: "/admin/model-config/health",
      },
    ],
  },
  {
    label: "语音配置",
    key: "AdminTTS",
    icon: renderIcon(Mic),
    children: [
      {
        label: "基础配置",
        key: "AdminTtsConfig",
        path: "/admin/tts/config",
      },
      {
        label: "音色管理",
        key: "AdminTtsVoices",
        path: "/admin/tts/voices",
      },
      {
        label: "指令模板",
        key: "AdminTtsTemplates",
        path: "/admin/tts/templates",
      },
    ],
  },
  {
    label: "对口型配置",
    key: "AdminLipSync",
    icon: renderIcon(Videocam),
    children: [
      {
        label: "基础配置",
        key: "AdminLipSyncConfig",
        path: "/admin/lip-sync/config",
      },
    ],
  },
  {
    label: "系统配置",
    key: "AdminConfig",
    icon: renderIcon(Settings),
    path: "/admin/config",
  },
  {
    label: "操作日志",
    key: "AdminLogs",
    icon: renderIcon(DocumentText),
    path: "/admin/logs",
  },
  {
    label: "系统公告",
    key: "AdminNoticeList",
    icon: renderIcon(Megaphone),
    path: "/admin/notices",
  },
];

// 处理菜单点击
const handleMenuClick = (key: string, item: MenuOption) => {
  handleMenuClickWithClose(key, item);
};

// 面包屑数据
const breadcrumbItems = computed(() => {
  const items: Array<{ label: string; path?: string }> = [
    { label: "管理后台", path: "/admin/dashboard" },
  ];

  const currentMenu = findMenuByKey(menuOptions, activeKey.value);
  if (currentMenu && currentMenu.key !== "AdminDashboard") {
    // 如果有父菜单，先添加父菜单
    const parentMenu = findParentMenu(menuOptions, activeKey.value);
    if (parentMenu && parentMenu.key !== "AdminDashboard") {
      items.push({
        label: parentMenu.label as string,
        path: parentMenu.path as string,
      });
    }
    items.push({ label: currentMenu.label as string });
  }

  return items;
});

// 递归查找菜单
const findMenuByKey = (menus: MenuOption[], key: string): MenuOption | null => {
  for (const menu of menus) {
    if (menu.key === key) return menu;
    if (menu.children) {
      const found = findMenuByKey(menu.children, key);
      if (found) return found;
    }
  }
  return null;
};

// 查找父菜单
const findParentMenu = (
  menus: MenuOption[],
  key: string,
): MenuOption | null => {
  for (const menu of menus) {
    if (menu.children) {
      for (const child of menu.children) {
        if (child.key === key) return menu;
      }
      const found = findParentMenu(menu.children, key);
      if (found) return found;
    }
  }
  return null;
};

// 用户下拉菜单选项
const userDropdownOptions = [
  {
    label: "个人设置",
    key: "settings",
    icon: renderIcon(Settings),
  },
  {
    label: "返回首页",
    key: "home",
    icon: renderIcon(Home),
  },
  {
    type: "divider",
    key: "d1",
  },
  {
    label: "退出登录",
    key: "logout",
    icon: renderIcon(LogOut),
  },
];

// 处理用户下拉菜单选择
const handleUserDropdownSelect = (key: string) => {
  if (key === "settings") {
    router.push("/admin/profile");
  } else if (key === "home") {
    router.push("/");
  } else if (key === "logout") {
    authStore.logout();
    router.push("/login");
  }
};

// 返回首页
const goHome = () => {
  router.push("/");
};
</script>

<template>
  <div class="admin-layout">
    <!-- 背景层：渐变 + 浮动光球 -->
    <div class="background-layer">
      <div class="gradient-bg" />
      <div class="floating-orb orb-1" />
      <div class="floating-orb orb-2" />
      <div class="floating-orb orb-3" />
    </div>

    <!-- 毛玻璃容器层 -->
    <div class="glass-container">
      <n-layout
        has-sider
        class="main-layout"
      >
        <!-- 桌面端侧边栏 -->
        <n-layout-sider
          v-if="!isMobile"
          :collapsed="sidebarCollapsed"
          collapse-mode="width"
          :collapsed-width="64"
          :width="200"
          class="sidebar"
          bordered
        >
          <!-- Logo 区域（含折叠按钮）-->
          <div
            class="logo-area"
            @click="goHome"
          >
            <div
              class="collapse-btn-inline"
              @click.stop="collapsed = !collapsed"
            >
              <n-icon size="16">
                <ChevronBack v-if="!sidebarCollapsed" />
                <ChevronForward v-else />
              </n-icon>
            </div>
            <div class="logo-icon">
              <n-icon
                size="24"
                color="#9D8AE7"
              >
                <Pulse />
              </n-icon>
            </div>
            <span
              v-if="!sidebarCollapsed"
              class="logo-text"
            >管理后台</span>
          </div>

          <!-- 菜单 -->
          <n-menu
            :collapsed="sidebarCollapsed"
            :collapsed-width="64"
            :collapsed-icon-size="20"
            :options="menuOptions"
            :value="activeKey"
            class="admin-menu"
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
              <!-- 汉堡菜单按钮（移动端/平板端显示） -->
              <n-button
                v-if="showHamburgerMenu"
                circle
                quaternary
                class="hamburger-btn"
                @click="toggleMobileDrawer"
              >
                <n-icon size="20">
                  <Menu />
                </n-icon>
              </n-button>

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
                <!-- 搜索 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      circle
                      quaternary
                      class="header-btn"
                    >
                      <n-icon size="20">
                        <Search />
                      </n-icon>
                    </n-button>
                  </template>
                  搜索
                </n-tooltip>

                <!-- 通知 -->
                <n-tooltip trigger="hover">
                  <template #trigger>
                    <n-button
                      circle
                      quaternary
                      class="header-btn"
                    >
                      <n-icon size="20">
                        <Notifications />
                      </n-icon>
                    </n-button>
                  </template>
                  通知
                </n-tooltip>

                <!-- 用户下拉 -->
                <n-dropdown
                  :options="userDropdownOptions"
                  placement="bottom-end"
                  @select="handleUserDropdownSelect"
                >
                  <div class="user-info">
                    <n-avatar
                      round
                      :size="36"
                      :style="{
                        background:
                          'linear-gradient(135deg, #8B9AFF 0%, #B56CFF 100%)',
                      }"
                    >
                      <n-icon size="20">
                        <Person />
                      </n-icon>
                    </n-avatar>
                    <span
                      v-if="userStore.profile?.username"
                      class="username"
                    >
                      {{ userStore.profile.username }}
                    </span>
                  </div>
                </n-dropdown>
              </n-space>
            </div>
          </n-layout-header>

          <!-- 内容区 -->
          <n-layout-content class="content">
            <router-view />
          </n-layout-content>
        </n-layout>
      </n-layout>

      <!-- 移动端抽屉侧边栏 -->
      <n-drawer
        v-model:show="mobileDrawerOpen"
        :width="200"
        placement="left"
        class="mobile-drawer"
      >
        <n-drawer-content body-content-class="mobile-drawer-content">
          <!-- Logo 区域 -->
          <div
            class="mobile-logo-area"
            @click="goHome"
          >
            <div class="logo-icon">
              <n-icon
                size="24"
                color="#9D8AE7"
              >
                <Pulse />
              </n-icon>
            </div>
            <span class="logo-text">管理后台</span>
          </div>

          <!-- 菜单 -->
          <n-menu
            :options="menuOptions"
            :value="activeKey"
            class="admin-menu mobile-menu"
            @update:value="handleMenuClickWithClose"
          />
        </n-drawer-content>
      </n-drawer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.admin-layout {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  @media (max-width: 1024px) {
    padding: 0;
  }
}

// 背景层
.background-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;

  .gradient-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, #e8e4f3 0%, #f0edf7 50%, #e4edf5 100%);
  }

  .floating-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.6;
    animation: float 20s ease-in-out infinite;

    &.orb-1 {
      width: 400px;
      height: 400px;
      background: rgba(157, 138, 231, 0.25);
      top: 10%;
      left: 10%;
      animation-delay: 0s;
    }

    &.orb-2 {
      width: 300px;
      height: 300px;
      background: rgba(126, 184, 247, 0.2);
      top: 60%;
      right: 10%;
      animation-delay: -5s;
    }

    &.orb-3 {
      width: 350px;
      height: 350px;
      background: rgba(157, 138, 231, 0.15);
      bottom: 10%;
      left: 30%;
      animation-delay: -10s;
    }
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.05);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% {
    transform: translate(20px, 10px) scale(1.02);
  }
}

// 毛玻璃容器
.glass-container {
  position: relative;
  z-index: 1;
  width: 100%;
  height: calc(100vh - 32px);
  max-width: 1920px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  overflow: hidden;

  @media (max-width: 1024px) {
    height: 100vh;
    border-radius: 0;
  }
}

.main-layout {
  height: 100%;
  background: transparent;
}

// 侧边栏
.sidebar {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-right: 1px solid rgba(0, 0, 0, 0.06) !important;

  :deep(.n-layout-sider-scroll-container) {
    display: flex;
    flex-direction: column;
  }

  .logo-area {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    cursor: pointer;
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    transition: all 0.3s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.3);

      .collapse-btn-inline {
        opacity: 1;
      }
    }

    .collapse-btn-inline {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      color: #6b6690;
      transition: all 0.25s ease;
      opacity: 0.7;

      &:hover {
        background: rgba(157, 138, 231, 0.12);
        color: #9d8ae7;
      }
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(157, 138, 231, 0.15);
    }

    .logo-text {
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
      white-space: nowrap;
      flex: 1;
    }
  }

  .admin-menu {
    flex: 1;
    padding: 12px 0;
    background: transparent !important;

    :deep(.n-menu-item) {
      margin: 4px 8px;
      border-radius: 10px;

      &.n-menu-item--selected {
        background: #ffffff !important;
        box-shadow: 0 2px 8px rgba(157, 138, 231, 0.15);

        &::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: #9d8ae7;
          border-radius: 0 3px 3px 0;
        }

        .n-menu-item-content__icon {
          color: #9d8ae7 !important;
        }

        .n-menu-item-content-header {
          color: #2d2b4d !important;
          font-weight: 600;
        }
      }

      &:hover:not(.n-menu-item--selected) {
        background: rgba(255, 255, 255, 0.3) !important;
      }
    }

    :deep(.n-menu-item-content) {
      padding: 0 16px;
      height: 44px;

      .n-menu-item-content__icon {
        color: #6b6690;
      }

      .n-menu-item-content-header {
        color: #6b6690;
      }
    }
  }
}

// 内容布局
.content-layout {
  background: transparent;
  display: flex;
  flex-direction: column;
}

// 顶部栏
.header {
  height: 60px;
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .hamburger-btn {
      color: #6b6690;
      transition: all 0.25s ease;

      &:hover {
        color: #9d8ae7;
        background: rgba(157, 138, 231, 0.1);
      }
    }

    .n-breadcrumb {
      .n-breadcrumb-item {
        color: #6b6690;
        font-size: 14px;

        &.clickable {
          cursor: pointer;
          color: #9d8ae7;

          &:hover {
            color: #7b68d7;
          }
        }

        &:last-child {
          color: #2d2b4d;
          font-weight: 500;
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;

    .header-btn {
      color: #6b6690;

      &:hover {
        color: #9d8ae7;
        background: rgba(157, 138, 231, 0.1);
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 4px 8px 4px 4px;
      border-radius: 20px;
      transition: all 0.3s ease;

      &:hover {
        background: rgba(157, 138, 231, 0.1);
      }

      .username {
        font-size: 14px;
        color: #2d2b4d;
        font-weight: 500;
      }
    }
  }
}

// 内容区
.content {
  flex: 1;
  padding: 0;
  overflow: auto;
  background: #ffffff;

  :deep(> div) {
    height: 100%;
  }
}

// 响应式适配
@media (max-width: 768px) {
  .admin-layout {
    padding: 0;
  }

  .glass-container {
    border-radius: 0;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;

    &.mobile-open {
      transform: translateX(0);
    }
  }

  .header {
    padding: 0 16px;

    .username {
      display: none;
    }
  }
}

// 移动端抽屉样式
.mobile-drawer {
  :deep(.n-drawer-body-content-wrapper) {
    padding: 0 !important;
  }

  .mobile-logo-area {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    cursor: pointer;
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    background: rgba(255, 255, 255, 0.5);

    &:hover {
      background: rgba(255, 255, 255, 0.7);
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(157, 138, 231, 0.15);
    }

    .logo-text {
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  .mobile-menu {
    padding: 12px 0;
    background: transparent !important;

    :deep(.n-menu-item) {
      margin: 4px 8px;
      border-radius: 10px;

      &.n-menu-item--selected {
        background: #ffffff !important;
        box-shadow: 0 2px 8px rgba(157, 138, 231, 0.15);

        &::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background: #9d8ae7;
          border-radius: 0 3px 3px 0;
        }

        .n-menu-item-content__icon {
          color: #9d8ae7 !important;
        }

        .n-menu-item-content-header {
          color: #2d2b4d !important;
          font-weight: 600;
        }
      }

      &:hover:not(.n-menu-item--selected) {
        background: rgba(255, 255, 255, 0.3) !important;
      }
    }

    :deep(.n-menu-item-content) {
      padding: 0 16px;
      height: 44px;

      .n-menu-item-content__icon {
        color: #6b6690;
      }

      .n-menu-item-content-header {
        color: #6b6690;
      }
    }
  }
}

// 侧边栏折叠状态下 Tooltip 样式覆盖
.sidebar {
  :deep(.n-tooltip) {
    .n-tooltip-content {
      background: rgba(45, 43, 77, 0.9) !important;
      border-radius: 8px;
      padding: 6px 12px;

      .n-tooltip-body {
        color: #ffffff;
        font-size: 13px;
      }
    }
  }
}
</style>

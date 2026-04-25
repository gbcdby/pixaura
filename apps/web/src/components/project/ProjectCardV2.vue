<script setup lang="ts">
/**
 * 项目卡片组件
 * 参考 example.html 设计风格：白色卡片、简洁阴影、圆点状态指示器
 */
import { computed, h } from "vue";
import { useRouter } from "vue-router";
import { NIcon, NDropdown, NButton, NTooltip } from "naive-ui";
import type { DropdownOption } from "naive-ui";
import {
  EllipsisHorizontal,
  Settings,
  Trash,
  Archive,
  Play,
  Create,
  DocumentText,
  People,
} from "@vicons/ionicons5";
import type { ProjectStatus, CollaboratorRole } from "@pixaura/shared-types";

interface Props {
  project: {
    id: string;
    name: string;
    description?: string | null;
    coverUrl?: string | null;
    status: ProjectStatus;
    role: CollaboratorRole;
    owner: {
      id: string;
      username: string;
      avatar: string | null;
    } | null;
    scriptCount: number;
    collaboratorCount: number;
    updatedAt: string;
  };
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
});

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "archive", id: string): void;
  (e: "restore", id: string): void;
}>();

const router = useRouter();

// 封面背景色（如果没有封面图）
const coverColors = [
  "linear-gradient(135deg, #8a9bae 0%, #7d9a7b 45%, #d4d8ce 100%)",
  "linear-gradient(135deg, #8b7a91 0%, #7a5c42 45%, #c4a45a 100%)",
  "linear-gradient(135deg, #4a6680 0%, #8a9bae 45%, #e8e4df 100%)",
  "linear-gradient(135deg, #2c2420 0%, #4a4540 45%, #a89880 100%)",
  "linear-gradient(135deg, #e8e4df 0%, #c4a8a8 45%, #d8b8b0 100%)",
  "linear-gradient(135deg, #2a2825 0%, #8a4a3a 45%, #c4a860 100%)",
];

const hasCover = computed(() => !!props.project.coverUrl);

const coverStyle = computed(() => {
  if (hasCover.value) {
    return {
      backgroundImage: `url(${props.project.coverUrl})`,
    };
  }
  const colorIndex =
    props.project.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % coverColors.length;
  return {
    background: coverColors[colorIndex],
  };
});

// 项目首字母（用于无封面时的降级展示）
const projectInitial = computed(() => {
  const name = props.project.name || "";
  const firstChar = name.trim().charAt(0);
  return firstChar ? firstChar.toUpperCase() : "?";
});

// 状态配置
const statusConfig: Record<ProjectStatus, { label: string; dotColor: string; bg: string; text: string }> = {
  draft: { label: "草稿", dotColor: "#94a3b8", bg: "#f1f5f9", text: "#64748b" },
  active: { label: "进行中", dotColor: "#3b82f6", bg: "#eff6ff", text: "#2563eb" },
  completed: { label: "已完成", dotColor: "#22c55e", bg: "#f0fdf4", text: "#16a34a" },
  archived: { label: "已归档", dotColor: "#f59e0b", bg: "#fffbeb", text: "#d97706" },
};

const currentStatus = computed(() => statusConfig[props.project.status]);

// 当前用户角色文本
const roleText = computed(() => {
  switch (props.project.role) {
    case "owner":
      return "所有者";
    case "editor":
      return "编辑者";
    case "viewer":
      return "查看者";
    default:
      return "";
  }
});

// 操作菜单
const actionOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = [
    {
      label: "项目详情",
      key: "detail",
      icon: () => h(NIcon, () => h(Create)),
    },
  ];

  if (props.project.role === "owner") {
    options.push(
      {
        label: "项目设置",
        key: "settings",
        icon: () => h(NIcon, () => h(Settings)),
      },
      {
        type: "divider",
        key: "d1",
      },
    );

    if (props.project.status === "archived") {
      options.push({
        label: "恢复项目",
        key: "restore",
        icon: () => h(NIcon, () => h(Play)),
      });
    } else {
      options.push({
        label: "归档项目",
        key: "archive",
        icon: () => h(NIcon, () => h(Archive)),
      });
    }

    options.push({
      label: "删除项目",
      key: "delete",
      icon: () => h(NIcon, () => h(Trash)),
    });
  }

  return options;
});

// 处理操作
const handleAction = (key: string) => {
  switch (key) {
    case "detail":
      router.push(`/projects/${props.project.id}`);
      break;
    case "settings":
      router.push(`/projects/${props.project.id}/settings`);
      break;
    case "archive":
      emit("archive", props.project.id);
      break;
    case "restore":
      emit("restore", props.project.id);
      break;
    case "delete":
      emit("delete", props.project.id);
      break;
  }
};

// 点击卡片进入详情
const handleCardClick = () => {
  router.push(`/projects/${props.project.id}`);
};

// 格式化相对时间
const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${weeks}周前`;
  return `${months}个月前`;
};
</script>

<template>
  <div
    class="project-card-v2"
    @click="handleCardClick"
  >
    <!-- 封面区域 -->
    <div
      class="cover-section"
      :style="coverStyle"
    >
      <!-- 无封面时的首字母降级 -->
      <div
        v-if="!hasCover"
        class="cover-initial"
      >
        {{ projectInitial }}
      </div>
      <div class="cover-overlay">
        <!-- 状态 badge -->
        <span class="status-badge">
          <span
            class="status-dot"
            :style="{ backgroundColor: currentStatus.dotColor }"
          />
          <span class="status-text">{{ currentStatus.label }}</span>
        </span>

        <!-- 操作菜单 -->
        <n-dropdown
          v-if="showActions"
          :options="actionOptions"
          placement="bottom-end"
          trigger="click"
          @select="handleAction"
          @click.stop
        >
          <n-button
            circle
            size="small"
            class="action-menu-btn"
            @click.stop
          >
            <template #icon>
              <n-icon><EllipsisHorizontal /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="content-section">
      <h3
        class="title"
        :title="project.name"
      >
        {{ project.name }}
      </h3>

      <!-- 统计行 -->
      <div class="stats-row">
        <span
          class="stat-item"
          :class="{ 'is-zero': !project.scriptCount }"
        >
          <n-icon :component="DocumentText" />
          {{ project.scriptCount || 0 }} 个剧本
        </span>
        <n-tooltip trigger="hover">
          <template #trigger>
            <span class="stat-item">
              <n-icon :component="People" />
              {{ project.collaboratorCount || 0 }} 位成员
            </span>
          </template>
          项目成员数
        </n-tooltip>
      </div>

      <!-- 底部行 -->
      <div class="footer-row">
        <span class="update-time">{{ formatRelativeTime(project.updatedAt) }}</span>
        <div class="footer-right">
          <!-- 成员头像堆叠 -->
          <div
            v-if="project.owner"
            class="member-avatars"
          >
            <img
              v-if="project.owner.avatar"
              :src="project.owner.avatar"
              :alt="project.owner.username"
              class="owner-avatar-img"
              @error="(e: Event) => { const img = e.target as HTMLImageElement; const fallback = img.nextElementSibling as HTMLElement; if(fallback) fallback.style.display = 'flex'; img.style.display = 'none'; }"
            >
            <div
              class="owner-avatar-fallback"
              :style="project.owner.avatar ? { display: 'none' } : {}"
            >
              {{ project.owner.username?.charAt(0).toUpperCase() || "?" }}
            </div>
            <span
              v-if="project.collaboratorCount > 1"
              class="member-more"
            >
              +{{ project.collaboratorCount - 1 }}
            </span>
          </div>
          <span class="role-badge">{{ roleText }}</span>
        </div>
      </div>
    </div>

    <!-- hover 遮罩层 -->
    <div class="hover-overlay" />
  </div>
</template>

<style scoped lang="scss">
.project-card-v2 {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;

  &:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.08),
      0 10px 10px -5px rgba(0, 0, 0, 0.02);

    .cover-section .action-menu-btn {
      opacity: 1;
    }

    .hover-overlay {
      opacity: 1;
    }
  }

  .cover-section {
    height: 128px;
    position: relative;
    background-size: cover;
    background-position: center;

    .cover-initial {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
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

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .status-text {
          color: #334155;
        }
      }

      .action-menu-btn {
        opacity: 0;
        background: rgba(255, 255, 255, 0.85);
        border: none;
        transition: opacity 0.2s ease, background 0.2s ease;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);

        &:hover {
          background: #fff;
        }
      }
    }
  }

  .content-section {
    padding: 16px;

    .title {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;

      .stat-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #64748b;
        transition: color 0.2s ease;

        :deep(.n-icon) {
          color: #94a3b8;
          font-size: 14px;
        }

        &.is-zero {
          color: #94a3b8;
        }
      }
    }

    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .update-time {
        font-size: 12px;
        color: #94a3b8;
      }

      .footer-right {
        display: flex;
        align-items: center;
        gap: 8px;

        .member-avatars {
          display: flex;
          align-items: center;

          .owner-avatar-img {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid #fff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            object-fit: cover;
            flex-shrink: 0;
          }

          .owner-avatar-fallback {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 10px;
            font-weight: 600;
            border: 2px solid #fff;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            flex-shrink: 0;
          }

          .member-more {
            font-size: 10px;
            font-weight: 500;
            color: #64748b;
            background: #f1f5f9;
            padding: 1px 5px;
            border-radius: 9999px;
            margin-left: -6px;
            border: 2px solid #fff;
          }
        }

        .role-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: #f1f5f9;
          border-radius: 4px;
          color: #64748b;
          font-weight: 500;
        }
      }
    }
  }

  .hover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0);
    transition: background 0.3s ease;
    pointer-events: none;
    opacity: 0;
    border-radius: 12px;
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .project-card-v2 {
    background: #1e1e2e;
    border-color: rgba(148, 163, 184, 0.15);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

    &:hover {
      border-color: rgba(148, 163, 184, 0.25);
      box-shadow:
        0 20px 25px -5px rgba(0, 0, 0, 0.3),
        0 10px 10px -5px rgba(0, 0, 0, 0.15);
    }

    .cover-section {
      .cover-overlay {
        .status-badge {
          background: rgba(30, 30, 46, 0.92);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

          .status-text {
            color: #e2e8f0;
          }
        }

        .action-menu-btn {
          background: rgba(30, 30, 46, 0.85);
          color: #e2e8f0;

          &:hover {
            background: #1e1e2e;
          }
        }
      }
    }

    .content-section {
      .title {
        color: #f1f5f9;
      }

      .stats-row {
        .stat-item {
          color: #94a3b8;

          :deep(.n-icon) {
            color: #64748b;
          }

          &.is-zero {
            color: #64748b;
          }
        }
      }

      .footer-row {
        .update-time {
          color: #64748b;
        }

        .footer-right {
          .member-avatars {
            .owner-avatar-img,
            .owner-avatar-fallback {
              border-color: #1e1e2e;
            }

            .member-more {
              color: #94a3b8;
              background: #0f172a;
              border-color: #1e1e2e;
            }
          }

          .role-badge {
            background: #0f172a;
            color: #94a3b8;
          }
        }
      }
    }
  }
}
</style>

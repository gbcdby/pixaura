<script setup lang="ts">
import { computed, h } from "vue";
import { useRouter } from "vue-router";
import { NCard, NSpace, NIcon, NDropdown, NButton } from "naive-ui";
import type { DropdownOption } from "naive-ui";
import {
  EllipsisHorizontal,
  Settings,
  People,
  Trash,
  Archive,
  Play,
  Create,
} from "@vicons/ionicons5";
import ProjectStatusBadge from "./ProjectStatusBadge.vue";
import type { ProjectListItemDto } from "@pixaura/shared-types";

interface Props {
  project: ProjectListItemDto;
  showActions?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
});

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "archive", id: string): void;
  (e: "restore", id: string): void;
  (e: "permanentDelete", id: string): void;
}>();

const router = useRouter();

// 封面背景色（如果没有封面图）
const coverColors = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
];

const coverStyle = computed(() => {
  if (props.project.coverUrl) {
    return {
      backgroundImage: `url(${props.project.coverUrl})`,
    };
  }
  // 根据项目ID生成固定的颜色
  const colorIndex =
    props.project.id
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % coverColors.length;
  return {
    background: coverColors[colorIndex],
  };
});

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
        label: "协作者管理",
        key: "collaborators",
        icon: () => h(NIcon, () => h(People)),
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
    case "collaborators":
      router.push(`/projects/${props.project.id}/collaborators`);
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

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return date.toLocaleDateString();
};
</script>

<template>
  <n-card
    class="project-card"
    :bordered="false"
    hoverable
    @click="handleCardClick"
  >
    <!-- 封面 -->
    <div
      class="cover"
      :style="coverStyle"
    >
      <div class="cover-overlay">
        <project-status-badge
          :status="project.status"
          class="status-badge"
        />
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
            class="action-btn"
            @click.stop
          >
            <template #icon>
              <n-icon><EllipsisHorizontal /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>

    <!-- 内容 -->
    <div class="content">
      <h3 class="title">
        {{ project.name }}
      </h3>
      <p
        v-if="project.description"
        class="description"
      >
        {{ project.description }}
      </p>

      <!-- 协作者数量 -->
      <div
        v-if="project.collaboratorCount > 0"
        class="collaborators"
      >
        <span class="collaborator-count">
          <n-icon
            size="14"
            style="vertical-align: -0.125em; margin-right: 4px"
          ><People /></n-icon>
          {{ project.collaboratorCount }} 位成员
        </span>
      </div>

      <!-- 底部信息 -->
      <div class="footer">
        <n-space
          align="center"
          :size="8"
        >
          <span
            v-if="roleText"
            class="role-badge"
          >
            {{ roleText }}
          </span>
          <span class="update-time">
            {{ formatRelativeTime(project.updatedAt) }}
          </span>
        </n-space>
      </div>
    </div>
  </n-card>
</template>

<style scoped lang="scss">
.project-card {
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
  }

  :deep(.n-card__content) {
    padding: 0;
  }

  .cover {
    height: 200px;
    background-size: cover;
    background-position: center;
    position: relative;

    .cover-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0.3) 0%,
        transparent 50%,
        rgba(0, 0, 0, 0.1) 100%
      );
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 12px;

      .status-badge {
        background: rgba(255, 255, 255, 0.95) !important;
      }

      .action-btn {
        background: rgba(255, 255, 255, 0.9);
        opacity: 0;
        transition: opacity 0.2s;

        &:hover {
          background: #fff;
        }
      }
    }

    &:hover .action-btn {
      opacity: 1;
    }
  }

  .content {
    padding: 16px;

    .title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .description {
      font-size: 13px;
      color: #666;
      margin: 0 0 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.5;
      min-height: 39px;
    }

    .collaborators {
      margin-bottom: 12px;

      .collaborator-count {
        font-size: 12px;
        color: #999;
      }
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;

      .role-badge {
        font-size: 12px;
        padding: 2px 8px;
        background: #f5f5f5;
        border-radius: 4px;
        color: #666;
      }

      .update-time {
        font-size: 12px;
        color: #999;
      }
    }
  }
}
</style>

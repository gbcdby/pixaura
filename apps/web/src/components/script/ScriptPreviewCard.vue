<script setup lang="ts">
/**
 * 剧本预览卡片组件
 * 用于项目详情页展示最近剧本列表
 * 横向布局：左图右文
 */
import { computed } from "vue";
import { NTag, NIcon } from "naive-ui";
import { FilmOutline } from "@vicons/ionicons5";

interface Props {
  script: {
    id: string;
    name?: string;
    title?: string;
    coverUrl?: string | null;
    status?: string;
    updatedAt?: string;
    // 分镜组参考图
    shotGroupReferenceImage?: string | null;
    // 场景参考图
    sceneReferenceImage?: string | null;
    // 剧本描述
    description?: string | null;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

// 状态映射
const statusMap: Record<
  string,
  { label: string; type: "success" | "info" | "warning" | "default" }
> = {
  completed: { label: "已完成", type: "success" },
  confirmed: { label: "已确认", type: "success" },
  generating: { label: "生成中", type: "warning" },
  ai_generating: { label: "AI生成中", type: "warning" },
  draft: { label: "草稿", type: "default" },
  editing: { label: "编辑中", type: "info" },
  active: { label: "进行中", type: "info" },
};

const statusConfig = computed(() => {
  const status = props.script.status || "draft";
  return (
    statusMap[status] || {
      label: status,
      type: "default",
    }
  );
});

// 格式化相对时间
const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return "未知时间";
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

// 封面图获取优先级
const coverUrl = computed(() => {
  // 1. 直接 coverUrl
  if (props.script.coverUrl) return props.script.coverUrl;

  // 2. 分镜组参考图
  if (props.script.shotGroupReferenceImage)
    return props.script.shotGroupReferenceImage;

  // 3. 场景参考图
  if (props.script.sceneReferenceImage)
    return props.script.sceneReferenceImage;

  // 4. 无图占位
  return null;
});

const handleClick = () => {
  emit("click");
};
</script>

<template>
  <div
    class="script-preview-card"
    @click="handleClick"
  >
    <!-- 封面区域 -->
    <div class="cover">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        alt="剧本封面"
      />
      <!-- 无封面图时展示描述或占位图标 -->
      <div
        v-else-if="script.description"
        class="cover-description"
      >
        <span class="cover-text">{{ script.description }}</span>
      </div>
      <div
        v-else
        class="cover-placeholder"
      >
        <n-icon
          :component="FilmOutline"
          size="32"
        />
      </div>
    </div>

    <!-- 信息区域 -->
    <div class="info">
      <div class="name">
        {{ script.name || script.title || "未命名剧本" }}
      </div>
      <div class="meta-row">
        <n-tag
          :type="statusConfig.type"
          size="small"
          class="status-tag"
        >
          {{ statusConfig.label }}
        </n-tag>
        <span class="update-time">
          {{ formatRelativeTime(script.updatedAt) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.script-preview-card {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.6);
  }

  .cover {
    $bg: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);

    position: relative;
    width: 100%;
    padding-bottom: 100%; // 使用 padding 撑开 1:1 比例
    background: #e8e8e8;

    img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-description {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: $bg;
      color: #666;
      font-size: 12px;
      line-height: 1.5;
      text-align: center;
    }

    .cover-text {
      position: absolute;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
      padding: 12px;
      height: calc(100% - 12px);
      width: 100%;
      overflow: hidden;
    }

    .cover-placeholder {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      color: #999;
    }
  }

  .info {
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary, #1a1a1a);
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.4;
    }

    .meta-row {
      display: flex;
      align-items: center;
      justify-content: space-between; // 状态和时间分布到左右两端

      .status-tag {
        font-size: 11px;
      }

      .update-time {
        font-size: 11px;
        color: var(--color-text-tertiary, #a8a4c8);
      }
    }
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .script-preview-card {
    background: rgba(16, 16, 32, 0.5);
    border-color: #4a4a6a;

    &:hover {
      background: rgba(16, 16, 32, 0.7);
    }

    .cover {
      background: linear-gradient(135deg, #1a1030, #0f0a1a);

      .cover-description {
        background: linear-gradient(135deg, #1a1030, #0f0a1a);
        color: #8a8aaa;
      }

      .cover-placeholder {
        background: linear-gradient(135deg, #1a1030, #0f0a1a);
        color: #6a6a8a;
      }
    }

    .info {
      .name {
        color: #e0e0e0;
      }

      .meta-row .update-time {
        color: #8a8aaa;
      }
    }
  }
}
</style>
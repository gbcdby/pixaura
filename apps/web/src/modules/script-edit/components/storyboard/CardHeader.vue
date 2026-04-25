<script setup lang="ts">
import { computed, h } from "vue";
import { NButton, NIcon, NTag, NDropdown } from "naive-ui";
import {
  EllipsisHorizontal,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash,
  CheckmarkCircle,
  TimeOutline,
} from "@vicons/ionicons5";
import type { StoryboardCardProps } from "./types";
import type { DropdownMixedOption } from "naive-ui/es/dropdown/src/interface";

interface Props {
  data: StoryboardCardProps["data"];
  index: number;
  isExpanded: boolean;
  isReadonly: boolean;
  loading?: boolean;
  characterOptions?: { label: string; value: string; avatar?: string }[];
  sceneOptions?: { label: string; value: string }[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggle-expand"): void;
  (e: "delete", id: string): void;
  (e: "duplicate", id: string): void;
  (e: "move", id: string, direction: "up" | "down"): void;
}>();

// 选中的角色名称列表
const selectedCharacterNames = computed(() => {
  return (
    props.data.characterIds
      ?.map((id) => props.characterOptions?.find((c) => c.value === id)?.label)
      .filter((name): name is string => !!name) || []
  );
});

// 选中的场景名称
const selectedSceneName = computed(() => {
  return props.sceneOptions?.find((s) => s.value === props.data.sceneId)?.label;
});

// 分镜状态（completed 或 pending）
const shotStatus = computed<"completed" | "pending">(() => {
  return props.data.videoGeneration?.videoUrl ? "completed" : "pending";
});

// 状态图标
const statusIcon = computed(() => {
  return shotStatus.value === "completed" ? CheckmarkCircle : TimeOutline;
});

// 更多菜单选项
const moreOptions = computed<DropdownMixedOption[]>(() => [
  {
    label: "向上移动",
    key: "moveUp",
    disabled: props.index === 0,
    icon: () => h(NIcon, null, { default: () => h(ChevronUp) }),
  },
  {
    label: "向下移动",
    key: "moveDown",
    icon: () => h(NIcon, null, { default: () => h(ChevronDown) }),
  },
  {
    label: "复制分镜",
    key: "duplicate",
    icon: () => h(NIcon, null, { default: () => h(Copy) }),
  },
  { type: "divider", key: "d1" },
  {
    label: "删除分镜",
    key: "delete",
    icon: () => h(NIcon, null, { default: () => h(Trash) }),
  },
]);

// 处理更多菜单选择
function handleMoreSelect(key: string) {
  switch (key) {
    case "moveUp":
      emit("move", props.data.id, "up");
      break;
    case "moveDown":
      emit("move", props.data.id, "down");
      break;
    case "duplicate":
      emit("duplicate", props.data.id);
      break;
    case "delete":
      emit("delete", props.data.id);
      break;
  }
}
</script>

<template>
  <div class="card-header">
    <div class="header-left">
      <div class="sequence-number">
        {{ index + 1 }}
      </div>
      <div class="header-info">
        <span class="shot-title">{{ data.title || `分镜组${index + 1}` }}</span>
        <!-- 资源标签摘要 -->
        <div
          v-if="selectedCharacterNames.length || selectedSceneName"
          class="resource-tags"
        >
          <n-tag
            v-if="selectedSceneName"
            size="tiny"
            type="info"
          >
            {{ selectedSceneName }}
          </n-tag>
          <n-tag
            v-for="name in selectedCharacterNames.slice(0, 2)"
            :key="name"
            size="tiny"
            type="success"
          >
            {{ name }}
          </n-tag>
          <n-tag
            v-if="selectedCharacterNames.length > 2"
            size="tiny"
          >
            +{{ selectedCharacterNames.length - 2 }}
          </n-tag>
        </div>
        <span
          v-else-if="data.description"
          class="shot-preview"
        >{{ data.description.slice(0, 30) }}...</span>
      </div>
    </div>

    <div class="header-right">
      <n-tag
        :type="shotStatus === 'completed' ? 'success' : 'warning'"
        size="small"
        round
      >
        <template #icon>
          <n-icon :component="statusIcon" />
        </template>
        {{ shotStatus === "completed" ? "已完成" : "待生成" }}
      </n-tag>

      <!-- 展开/收起按钮 -->
      <n-button
        text
        size="small"
        class="toggle-btn"
        @click.stop="$emit('toggle-expand')"
      >
        <template #icon>
          <n-icon>
            <ChevronUp v-if="isExpanded" /><ChevronDown v-else />
          </n-icon>
        </template>
      </n-button>

      <n-dropdown
        :options="moreOptions"
        placement="bottom-end"
        @select="handleMoreSelect"
        @click.stop
      >
        <n-button
          text
          size="small"
          :disabled="isReadonly || loading"
          class="more-btn"
        >
          <template #icon>
            <n-icon><EllipsisHorizontal /></n-icon>
          </template>
        </n-button>
      </n-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  transition: background 0.2s ease;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sequence-number {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2080f0 0%, #4098ff 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  flex-shrink: 0;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.shot-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.shot-preview {
  font-size: 12px;
  color: #999;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;

  :deep(.n-tag) {
    font-size: 11px;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.more-btn {
  opacity: 0.5;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.toggle-btn {
  opacity: 0.5;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}
</style>

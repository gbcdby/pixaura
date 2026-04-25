<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";
import type { ProjectStatus } from "@pixaura/shared-types";

interface Props {
  status: ProjectStatus;
  size?: "small" | "medium" | "large";
}

const props = withDefaults(defineProps<Props>(), {
  size: "small",
});

// 状态类型映射
const statusTypeMap: Record<
  ProjectStatus,
  "default" | "primary" | "success" | "warning" | "info"
> = {
  draft: "warning",
  active: "success",
  completed: "info",
  archived: "default",
};

// 状态文本映射
const statusTextMap: Record<ProjectStatus, string> = {
  draft: "草稿",
  active: "进行中",
  completed: "已完成",
  archived: "已归档",
};

const tagType = computed(() => statusTypeMap[props.status] || "default");
const tagText = computed(() => statusTextMap[props.status] || props.status);
</script>

<template>
  <n-tag
    :type="tagType"
    :size="size"
    class="status-badge"
  >
    {{ tagText }}
  </n-tag>
</template>

<style scoped lang="scss">
.status-badge {
  min-width: 60px;
  text-align: center;
}
</style>

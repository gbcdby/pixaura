<template>
  <div class="workflow-step">
    <div :class="['step-circle', active ? 'active' : 'inactive']">
      {{ stepNumber }}
    </div>
    <div class="step-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  active: boolean;
  label: string;
}>();

const stepNumber = computed(() => {
  // 根据父组件中的顺序生成数字
  const labels = ["输入创意", "生成剧本", "素材拆解", "设计分镜", "导出成片"];
  const index = labels.indexOf(props.label);
  return index + 1;
});
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>
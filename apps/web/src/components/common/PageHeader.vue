<template>
  <div class="page-header">
    <div class="header-left">
      <n-button
        v-if="backPath"
        text
        @click="handleBack"
      >
        <template #icon>
          <n-icon :component="ArrowBack" />
        </template>
        返回
      </n-button>
      <h1 class="page-title">
        {{ title }}
      </h1>
    </div>
    <div
      v-if="$slots.extra"
      class="header-extra"
    >
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { NButton, NIcon } from "naive-ui";
import { ArrowBack } from "@vicons/ionicons5";

const props = defineProps<{
  title: string;
  backPath?: string;
}>();

const router = useRouter();

function handleBack() {
  if (props.backPath) {
    router.push(props.backPath);
  } else {
    router.back();
  }
}
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--divider-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }
  }

  .header-extra {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}
</style>

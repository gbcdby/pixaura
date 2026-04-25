<template>
  <div class="page-header">
    <div class="header-left">
      <!-- 面包屑 -->
      <n-breadcrumb v-if="breadcrumb?.length">
        <n-breadcrumb-item
          v-for="(item, index) in breadcrumb"
          :key="index"
        >
          <router-link
            v-if="item.path"
            :to="item.path"
          >
            {{ item.name }}
          </router-link>
          <span v-else>{{ item.name }}</span>
        </n-breadcrumb-item>
      </n-breadcrumb>

      <!-- 标题 -->
      <div class="title-section">
        <h1 class="page-title">
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="page-description"
        >
          {{ description }}
        </p>
      </div>
    </div>

    <!-- 操作区 -->
    <div
      v-if="$slots.action"
      class="header-action"
    >
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NBreadcrumb, NBreadcrumbItem } from "naive-ui";

interface BreadcrumbItem {
  name: string;
  path?: string;
}

defineProps<{
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
}>();
</script>

<style scoped lang="scss">
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
  color: var(--text-color-base);
}

.page-description {
  font-size: 14px;
  color: var(--text-color-3);
  margin: 0;
}

.header-action {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>

<script setup lang="ts">
import { NCard, NEmpty, NIcon } from "naive-ui";
import { Card } from "@vicons/ionicons5";
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <Card />
        </n-icon>
        <span>计费管理</span>
      </div>
    </div>

    <n-card
      class="placeholder-card"
      :bordered="false"
    >
      <n-empty description="计费管理功能开发中..." />
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 24px;
  min-height: 100%;
  background: #fff;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
    color: #2d2b4d;

    .title-icon {
      color: #9d8ae7;
    }
  }
}

.placeholder-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
  padding: 60px 0;
}
</style>

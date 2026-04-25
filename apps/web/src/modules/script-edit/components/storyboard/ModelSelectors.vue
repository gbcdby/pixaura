<script setup lang="ts">
import { NSelect, NTooltip, NIcon } from "naive-ui";
import { WarningOutline } from "@vicons/ionicons5";
import { renderModelOptionWithPrice, type ModelOptionWithPrice } from "@/stores/script-models";

interface Props {
  selectedImageModel: string;
  selectedVideoModel: string;
  selectedLipSyncModel: string;
  imageModelOptions: ModelOptionWithPrice[];
  videoModelOptions: ModelOptionWithPrice[];
  lipSyncModelOptions: ModelOptionWithPrice[];
  hasImageModels: boolean;
  hasVideoModels: boolean;
  hasLipSyncModels: boolean;
  isLoadingModels: boolean;
  // 图像模型是否正在生成中
  imageGenerating?: boolean;
  // 视频模型警告状态（不支持当前参考模式时显示警告）
  videoModelWarning?: boolean;
}

defineProps<Props>();

defineEmits<{
  (e: "update:image-model", value: string): void;
  (e: "update:video-model", value: string): void;
  (e: "update:lipsync-model", value: string): void;
}>();
</script>

<template>
  <div class="model-section">
    <label class="section-label">模型选择</label>
    <div class="model-selectors">
      <!-- 图像模型 -->
      <n-tooltip
        :disabled="hasImageModels || isLoadingModels"
        placement="top"
      >
        <template #trigger>
          <div class="model-item">
            <span class="model-label">图像</span>
            <n-select
              :value="selectedImageModel"
              :options="imageModelOptions"
              placeholder="选择模型"
              aria-label="图像模型"
              size="tiny"
              :consistent-menu-width="false"
              :disabled="isLoadingModels || !hasImageModels || imageGenerating"
              :loading="isLoadingModels"
              :render-label="renderModelOptionWithPrice"
              @update:value="$emit('update:image-model', $event)"
            />
          </div>
        </template>
        暂无可用的图像生成模型，请联系管理员配置
      </n-tooltip>

      <!-- 视频模型 -->
      <n-tooltip
        :disabled="hasVideoModels || isLoadingModels || !videoModelWarning"
        placement="top"
      >
        <template #trigger>
          <div
            class="model-item"
            :class="{ 'model-warning': videoModelWarning }"
          >
            <span class="model-label">视频</span>
            <n-select
              :value="selectedVideoModel"
              :options="videoModelOptions"
              placeholder="选择模型"
              aria-label="视频模型"
              size="tiny"
              :consistent-menu-width="false"
              :disabled="isLoadingModels || !hasVideoModels"
              :loading="isLoadingModels"
              :render-label="renderModelOptionWithPrice"
              @update:value="$emit('update:video-model', $event)"
            />
            <n-icon
              v-if="videoModelWarning"
              class="model-warning-icon"
              color="#f0a020"
              size="14"
            >
              <WarningOutline />
            </n-icon>
          </div>
        </template>
        <template v-if="!hasVideoModels">
          暂无可用的视频生成模型，请联系管理员配置
        </template>
        <template v-else-if="videoModelWarning">
          当前视频模型不支持「多参考生视频」模式，请选择支持多参考的视频模型或切换为「分镜图生视频」模式
        </template>
      </n-tooltip>

      <!-- 对口型模型 -->
      <n-tooltip
        :disabled="hasLipSyncModels || isLoadingModels"
        placement="top"
      >
        <template #trigger>
          <div class="model-item">
            <span class="model-label">对口型</span>
            <n-select
              :value="selectedLipSyncModel"
              :options="lipSyncModelOptions"
              placeholder="选择模型"
              aria-label="对口型模型"
              size="tiny"
              :consistent-menu-width="false"
              :disabled="isLoadingModels || !hasLipSyncModels"
              :loading="isLoadingModels"
              :render-label="renderModelOptionWithPrice"
              @update:value="$emit('update:lipsync-model', $event)"
            />
          </div>
        </template>
        暂无可用的对口型模型，请联系管理员配置
      </n-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.model-section {
  padding-top: 10px;
  margin-top: 14px;
  border-top: 1px solid #f0f0f0;

  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #666;
    margin-bottom: 8px;
  }

  .model-selectors {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .model-item {
    display: flex;
    align-items: center;
    gap: 6px;

    .model-label {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
    }

    :deep(.n-base-selection) {
      min-width: 120px;
    }

    :deep(.n-base-selection-label),
    :deep(.n-base-selection-input) {
      display: flex;
      align-items: center;
      white-space: nowrap !important;
    }

    :deep(.n-base-selection-label > .n-space) {
      flex-wrap: nowrap !important;
    }

    // 警告状态样式
    &.model-warning {
      padding: 2px;
      border-radius: 6px;
      background: rgba(240, 160, 32, 0.1);
      border: 1px solid rgba(240, 160, 32, 0.4);

      :deep(.n-base-selection) {
        border-color: rgba(240, 160, 32, 0.6) !important;
      }
    }
  }

  .model-warning-icon {
    flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

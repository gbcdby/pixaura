<template>
  <div class="output-config">
    <n-form-item label="分辨率">
      <n-radio-group
        :value="resolution"
        @update:value="$emit('update:resolution', $event)"
      >
        <n-space>
          <n-radio-button value="480p">
            480P
          </n-radio-button>
          <n-radio-button value="720p">
            720P
          </n-radio-button>
          <n-radio-button value="1080p">
            1080P
          </n-radio-button>
        </n-space>
      </n-radio-group>
    </n-form-item>

    <n-form-item label="画面比例">
      <n-radio-group
        :value="aspectRatio"
        @update:value="$emit('update:aspectRatio', $event)"
      >
        <n-space>
          <n-radio-button value="16:9">
            横屏 16:9
          </n-radio-button>
          <n-radio-button value="9:16">
            竖屏 9:16
          </n-radio-button>
          <n-radio-button value="1:1">
            方形 1:1
          </n-radio-button>
        </n-space>
      </n-radio-group>
    </n-form-item>

    <n-alert
      type="info"
      :show-icon="false"
      class="cost-hint"
    >
      <n-space
        vertical
        size="small"
      >
        <n-text depth="3">
          预估消耗
        </n-text>
        <n-text
          strong
          class="cost-value"
        >
          {{ estimatedCost }} 积分
        </n-text>
      </n-space>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import type { VideoResolution, AspectRatio } from "@pixaura/shared-types";

const props = defineProps<{
  resolution: VideoResolution;
  aspectRatio: AspectRatio;
  estimatedCost?: number;
}>();

defineEmits<{
  "update:resolution": [value: VideoResolution];
  "update:aspectRatio": [value: AspectRatio];
}>();

const estimatedCost = computed(() => {
  const costConfig: Record<VideoResolution, number> = {
    "480p": 250,
    "720p": 500,
    "1080p": 1000,
  };
  return costConfig[props.resolution] || 0;
});
</script>

<script lang="ts">
import { computed } from "vue";

export default {
  name: "OutputConfig",
};
</script>

<style scoped>
.output-config {
  padding: 16px 0;
}

.cost-hint {
  margin-top: 16px;
}

.cost-value {
  font-size: 18px;
  color: var(--n-color-primary);
}
</style>

<script setup lang="ts">
/**
 * 环形进度图组件
 * 用于展示项目整体进度等百分比数据
 */
import { computed } from "vue";

interface Props {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  size: 120,
  strokeWidth: 8,
  label: "整体进度",
});

// 圆环参数
const radius = computed(() => (props.size - props.strokeWidth) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const offset = computed(() => {
  const progress = Math.min(Math.max(props.percentage, 0), 100);
  return circumference.value - (progress / 100) * circumference.value;
});

// 渐变ID（确保唯一性）
const gradientId = computed(
  () => `progress-gradient-${Math.random().toString(36).substr(2, 9)}`,
);
</script>

<template>
  <div
    class="progress-ring"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :viewBox="`0 0 ${size} ${size}`"
      class="ring-svg"
    >
      <!-- 渐变定义 -->
      <defs>
        <linearGradient
          :id="gradientId"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop
            offset="0%"
            stop-color="#B8A5F0"
          />
          <stop
            offset="100%"
            stop-color="#9D8AE7"
          />
        </linearGradient>
      </defs>

      <!-- 背景圆环 -->
      <circle
        class="track"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="rgba(157, 138, 231, 0.15)"
        :stroke-width="strokeWidth"
      />

      <!-- 进度圆环 -->
      <circle
        class="progress"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="`url(#${gradientId})`"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>

    <!-- 中心文字 -->
    <div class="center-text">
      <div class="percentage">
        {{ Math.round(percentage) }}%
      </div>
      <div class="label">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.progress-ring {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  .ring-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);

    .progress {
      transition: stroke-dashoffset 0.5s ease;
    }
  }

  .center-text {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .percentage {
      font-size: 24px;
      font-weight: 700;
      color: var(--color-primary, #9d8ae7);
      line-height: 1.2;
    }

    .label {
      font-size: 12px;
      color: var(--color-text-secondary, #6b6690);
      margin-top: 2px;
    }
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .progress-ring {
    .ring-svg {
      .track {
        stroke: rgba(157, 78, 221, 0.2);
      }
    }

    .center-text {
      .percentage {
        color: #b8a5f0;
      }

      .label {
        color: #a8a4c8;
      }
    }
  }
}
</style>

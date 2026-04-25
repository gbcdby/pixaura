<script setup lang="ts">
import { computed } from "vue";

/**
 * RegionOverlay - 框选区域叠加组件
 * 在图片上显示框选区域的半透明遮罩和高亮边框
 * 支持蒙层模式：在框选区域外显示半透明遮罩
 */

interface Region {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** 框选区域坐标（百分比） */
  region: Region;
  /** 是否使用手动框选样式 */
  isManual?: boolean;
  /** 标签文本（如角色名称） */
  label?: string;
  /** 是否显示标签 */
  showLabel?: boolean;
  /** 自定义颜色（十六进制） */
  color?: string;
  /** 是否显示蒙层（框选区域外的遮罩） */
  showMask?: boolean;
  /** 蒙层透明度（0-1） */
  maskOpacity?: number;
}

const props = withDefaults(defineProps<Props>(), {
  isManual: false,
  showLabel: true,
  showMask: false,
  maskOpacity: 0.5,
});

// 计算区域样式
const regionStyle = computed(() => {
  return {
    left: `${props.region.x * 100}%`,
    top: `${props.region.y * 100}%`,
    width: `${props.region.width * 100}%`,
    height: `${props.region.height * 100}%`,
  };
});

// 边框颜色（手动框选用蓝色，自动检测用绿色，自定义颜色优先）
const borderColor = computed(() => {
  if (props.color) return props.color;
  return props.isManual ? "#2080f0" : "#18a058";
});

// 蒙层颜色
const maskColor = computed(() => {
  return `rgba(0, 0, 0, ${props.maskOpacity})`;
});
</script>

<template>
  <!-- 蒙层容器（覆盖整个图片） -->
  <div
    v-if="showMask"
    class="region-mask-container"
  >
    <!-- 蒙层：通过 clip-path 实现框选区域外遮罩 -->
    <div
      class="region-mask"
      :style="{
        clipPath: `polygon(
          0% 0%, 100% 0%, 100% 100%, 0% 100%,
          0% 0%,
          ${region.x * 100}% ${(region.y + region.height) * 100}%,
          ${region.x * 100}% ${region.y * 100}%,
          ${(region.x + region.width) * 100}% ${region.y * 100}%,
          ${(region.x + region.width) * 100}% ${(region.y + region.height) * 100}%,
          ${region.x * 100}% ${(region.y + region.height) * 100}%,
          0% 0%
        )`,
        backgroundColor: maskColor,
      }"
    />
  </div>

  <!-- 框选区域边框 -->
  <div
    class="region-overlay"
    :style="regionStyle"
  >
    <!-- 内部高亮边框 -->
    <div
      class="region-border"
      :style="{ borderColor: borderColor }"
    />
    <!-- 标签 -->
    <div
      v-if="showLabel && label"
      class="region-label"
      :style="{ backgroundColor: borderColor }"
    >
      {{ label }}
    </div>
    <!-- 角落标记 -->
    <div
      class="corner-marker tl"
      :style="{ borderColor: borderColor }"
    />
    <div
      class="corner-marker tr"
      :style="{ borderColor: borderColor }"
    />
    <div
      class="corner-marker bl"
      :style="{ borderColor: borderColor }"
    />
    <div
      class="corner-marker br"
      :style="{ borderColor: borderColor }"
    />
  </div>
</template>

<style scoped lang="scss">
// 蒙层容器（覆盖整个图片）
.region-mask-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

// 蒙层（框选区域外遮罩）
.region-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.region-overlay {
  position: absolute;
  pointer-events: none; // 不阻挡鼠标事件
  z-index: 10;
}

.region-border {
  position: absolute;
  inset: 0;
  border: 2px solid;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.5),
    inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}

.region-label {
  position: absolute;
  top: -20px;
  left: 0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  font-weight: 500;
}

// 角落标记
.corner-marker {
  position: absolute;
  width: 8px;
  height: 8px;
  border-style: solid;
  border-width: 0;

  &.tl {
    top: -4px;
    left: -4px;
    border-top-width: 2px;
    border-left-width: 2px;
  }

  &.tr {
    top: -4px;
    right: -4px;
    border-top-width: 2px;
    border-right-width: 2px;
  }

  &.bl {
    bottom: -4px;
    left: -4px;
    border-bottom-width: 2px;
    border-left-width: 2px;
  }

  &.br {
    bottom: -4px;
    right: -4px;
    border-bottom-width: 2px;
    border-right-width: 2px;
  }
}
</style>

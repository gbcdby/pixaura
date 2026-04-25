<script setup lang="ts">
/**
 * ManualRegionModal - 手动框选弹窗（完整模式）
 * 包装 RegionSelectModal 组件，提供 full 模式的完整功能
 * 用于分镜组角色框选配置
 */

import RegionSelectModal from "./RegionSelectModal.vue";

interface Region {
  x: number; // 百分比 0-1
  y: number;
  width: number;
  height: number;
}

interface Props {
  /** 是否显示弹窗 */
  show: boolean;
  /** 分镜主图 URL */
  imageUrl: string;
  /** 初始框选区域（用于编辑模式） */
  initialRegion?: Region;
  /** 角色名称（显示在标题中） */
  characterName?: string;
  /** 宽高比（格式如 "16/9"），用于固定框选区域比例 */
  aspectRatio?: string;
}

withDefaults(defineProps<Props>(), {
  characterName: "角色",
  aspectRatio: undefined,
});

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "confirm", region: Region, maskDataUrl: string): void;
  (e: "cancel"): void;
}>();

// 处理确认
function handleConfirm(region: Region, maskDataUrl: string) {
  emit("confirm", region, maskDataUrl);
}

// 处理取消
function handleCancel() {
  emit("cancel");
}
</script>

<template>
  <RegionSelectModal
    :show="show"
    :image-url="imageUrl"
    :initial-region="initialRegion"
    :character-name="characterName"
    :aspect-ratio="aspectRatio"
    mode="full"
    width="540px"
    :max-width="480"
    :max-height="360"
    @update:show="$emit('update:show', $event)"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>
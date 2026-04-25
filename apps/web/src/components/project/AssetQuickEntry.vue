<script setup lang="ts">
/**
 * 资产快捷入口组件
 * 用于项目详情页展示剧本、角色、场景、道具等快捷入口
 */
import { computed } from "vue";
import { NIcon } from "naive-ui";
import { DocumentText, People, Image, Cube, Settings } from "@vicons/ionicons5";

type AssetType = "scripts" | "characters" | "scenes" | "props" | "settings";

interface Props {
  type: AssetType;
  count?: number;
  showCount?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
  showCount: true,
});

const emit = defineEmits<{
  (e: "click"): void;
}>();

// 资产类型配置
const assetConfig: Record<
  AssetType,
  {
    label: string;
    icon: typeof DocumentText;
    color: string;
    bgColor: string;
  }
> = {
  scripts: {
    label: "剧本",
    icon: DocumentText,
    color: "#9D8AE7",
    bgColor: "rgba(157, 138, 231, 0.15)",
  },
  characters: {
    label: "角色",
    icon: People,
    color: "#34D399",
    bgColor: "rgba(52, 211, 153, 0.15)",
  },
  scenes: {
    label: "场景",
    icon: Image,
    color: "#60A5FA",
    bgColor: "rgba(96, 165, 250, 0.15)",
  },
  props: {
    label: "道具",
    icon: Cube,
    color: "#FBBF24",
    bgColor: "rgba(251, 191, 36, 0.15)",
  },
  settings: {
    label: "设置",
    icon: Settings,
    color: "#FB7185",
    bgColor: "rgba(251, 113, 133, 0.15)",
  },
};

const config = computed(() => assetConfig[props.type]);

const handleClick = () => {
  emit("click");
};
</script>

<template>
  <div
    class="asset-quick-entry"
    @click="handleClick"
  >
    <div
      class="icon-wrapper"
      :style="{
        backgroundColor: config.bgColor,
        color: config.color,
      }"
    >
      <n-icon
        :component="config.icon"
        :size="24"
      />
    </div>
    <div class="label">
      {{ config.label }}
    </div>
    <div
      v-if="showCount"
      class="count"
    >
      {{ count }}个
    </div>
  </div>
</template>

<style scoped lang="scss">
.asset-quick-entry {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(157, 138, 231, 0.2);
    background: rgba(255, 255, 255, 0.7);
  }

  .icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary, #1a1a1a);
    margin-bottom: 4px;
  }

  .count {
    font-size: 13px;
    color: var(--color-text-secondary, #6b6690);
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .asset-quick-entry {
    background: rgba(16, 16, 32, 0.7);
    border-color: rgba(157, 78, 221, 0.2);

    &:hover {
      border-color: rgba(157, 78, 221, 0.4);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    }

    .label {
      color: #e0e0e0;
    }

    .count {
      color: #a8a4c8;
    }
  }
}
</style>

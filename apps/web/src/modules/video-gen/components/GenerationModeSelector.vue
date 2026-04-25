<template>
  <div class="generation-mode-selector">
    <n-form-item label="参考模式">
      <n-radio-group v-model:value="referenceModeValue">
        <n-space>
          <n-radio-button value="single_reference">
            <template #icon>
              <n-icon :component="ImageOutline" />
            </template>
            单张参考图
          </n-radio-button>
          <n-radio-button value="multi_reference">
            <template #icon>
              <n-icon :component="ImagesOutline" />
            </template>
            多资产参考
          </n-radio-button>
        </n-space>
      </n-radio-group>
      <n-text
        depth="3"
        class="mode-description"
      >
        {{ referenceModeDescription }}
      </n-text>
    </n-form-item>

    <n-form-item label="生成模式">
      <n-radio-group v-model:value="videoModeValue">
        <n-space>
          <n-radio-button value="audio_reference">
            <template #icon>
              <n-icon :component="MusicalNotesOutline" />
            </template>
            音频参考
          </n-radio-button>
          <n-radio-button value="lip_sync">
            <template #icon>
              <n-icon :component="VideocamOutline" />
            </template>
            对口型
          </n-radio-button>
          <n-radio-button value="video_only">
            <template #icon>
              <n-icon :component="EyeOutline" />
            </template>
            纯视频
          </n-radio-button>
        </n-space>
      </n-radio-group>
      <n-text
        depth="3"
        class="mode-description"
      >
        {{ videoModeDescription }}
      </n-text>
    </n-form-item>

    <!-- 自动推荐提示 -->
    <n-alert
      v-if="shotTypeRecommendation"
      type="info"
      :show-icon="false"
      class="recommendation-alert"
    >
      <template #header>
        <n-space align="center">
          <n-icon :component="BulbOutline" />
          <span>智能推荐</span>
        </n-space>
      </template>
      根据分镜类型「{{ shotType }}」，推荐选择「{{
        shotTypeRecommendation.label
      }}」模式：{{ shotTypeRecommendation.description }}
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ImageOutline,
  ImagesOutline,
  MusicalNotesOutline,
  VideocamOutline,
  EyeOutline,
  BulbOutline,
} from "@vicons/ionicons5";
import type { VideoMode, ReferenceMode } from "@pixaura/shared-types";

const props = defineProps<{
  referenceMode: ReferenceMode;
  videoMode: VideoMode;
  shotType?: string;
}>();

const emit = defineEmits<{
  "update:referenceMode": [value: ReferenceMode];
  "update:videoMode": [value: VideoMode];
}>();

const referenceModeValue = computed({
  get: () => props.referenceMode,
  set: (value) => emit("update:referenceMode", value),
});

const videoModeValue = computed({
  get: () => props.videoMode,
  set: (value) => emit("update:videoMode", value),
});

const referenceModeDescriptions: Record<ReferenceMode, string> = {
  single_reference: "使用合成参考图精确控制画面构图，适合需要精确布局的场景",
  multi_reference:
    "组合角色/场景/道具图片作为参考，适合角色形象一致性要求高的场景",
};

const videoModeDescriptions: Record<VideoMode, string> = {
  audio_reference:
    "先生成音频，再由音频视频生成，适合对话镜头，口型与音频自动匹配",
  lip_sync: "先生成无声视频，再根据视频时长配音，适合动作复杂、表情夸张的镜头",
  video_only: "只生成画面，无音频，适合氛围展示或旁白后期添加的镜头",
};

const referenceModeDescription = computed(
  () => referenceModeDescriptions[props.referenceMode],
);
const videoModeDescription = computed(
  () => videoModeDescriptions[props.videoMode],
);

// 根据分镜类型推荐生成模式
const shotTypeRecommendations: Record<
  string,
  { label: string; description: string; mode: VideoMode }
> = {
  dialogue: {
    label: "音频参考",
    description: "对白场景推荐音频参考，口型与音频精准匹配",
    mode: "audio_reference",
  },
  action: {
    label: "对口型",
    description: "动作场景推荐对口型，确保动作流畅",
    mode: "lip_sync",
  },
  atmosphere: {
    label: "纯视频",
    description: "氛围场景推荐纯视频，专注画面表现",
    mode: "video_only",
  },
};

const shotTypeRecommendation = computed(() => {
  if (!props.shotType) return null;
  return shotTypeRecommendations[props.shotType.toLowerCase()] || null;
});
</script>

<style scoped>
.generation-mode-selector {
  padding: 16px 0;
}

.mode-description {
  display: block;
  margin-top: 8px;
  font-size: 13px;
}

.recommendation-alert {
  margin-top: 16px;
}
</style>

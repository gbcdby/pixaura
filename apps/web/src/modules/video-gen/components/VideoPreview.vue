<template>
  <n-card
    title="视频预览"
    class="video-preview-card"
  >
    <div
      v-if="!hasVideo"
      class="empty-preview"
    >
      <n-empty
        description="暂无视频"
        size="large"
      >
        <template #icon>
          <n-icon
            :component="VideocamOutline"
            :size="48"
          />
        </template>
        <n-text depth="3">
          {{ emptyDescription }}
        </n-text>
      </n-empty>
    </div>

    <div
      v-else
      class="video-container"
    >
      <video
        ref="videoRef"
        :src="videoUrl"
        controls
        class="video-player"
        @loadedmetadata="onLoadedMetadata"
      />

      <div class="video-info">
        <n-space
          justify="space-between"
          align="center"
        >
          <n-space
            vertical
            size="small"
          >
            <n-text strong>
              视频信息
            </n-text>
            <n-text
              depth="3"
              size="small"
            >
              时长: {{ formatDuration(duration) }}
            </n-text>
            <n-text
              depth="3"
              size="small"
            >
              分辨率: {{ resolution }}
            </n-text>
            <n-text
              depth="3"
              size="small"
            >
              模式: {{ modeLabel }}
            </n-text>
          </n-space>

          <n-space>
            <n-button
              secondary
              @click="handleDownload"
            >
              <template #icon>
                <n-icon :component="DownloadOutline" />
              </template>
              下载
            </n-button>
            <n-button
              type="primary"
              @click="handleRegenerate"
            >
              <template #icon>
                <n-icon :component="RefreshOutline" />
              </template>
              重新生成
            </n-button>
          </n-space>
        </n-space>
      </div>
    </div>

    <!-- 音频预览（如果有） -->
    <div
      v-if="audioUrl"
      class="audio-section"
    >
      <n-divider />
      <n-text depth="3">
        音频
      </n-text>
      <audio
        :src="audioUrl"
        controls
        class="audio-player"
      />
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  VideocamOutline,
  DownloadOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import type { VideoGenOutputDto, VideoMode } from "@pixaura/shared-types";

const props = defineProps<{
  outputs?: VideoGenOutputDto[];
  status?: string;
  videoMode?: VideoMode;
}>();

const emit = defineEmits<{
  regenerate: [];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const duration = ref(0);

const videoOutput = computed(() =>
  props.outputs?.find((o) => o.type === "video"),
);

const audioOutput = computed(() =>
  props.outputs?.find((o) => o.type === "audio"),
);

const hasVideo = computed(() => !!videoOutput.value);

const videoUrl = computed(() => videoOutput.value?.file.url || "");

const audioUrl = computed(() => audioOutput.value?.file.url);

const resolution = computed(() => videoOutput.value?.file.resolution || "720p");

const emptyDescription = computed(() => {
  if (props.status === "generating") {
    return "视频生成中，请稍候...";
  }
  if (props.status === "failed") {
    return "生成失败，请重试";
  }
  return "点击生成按钮开始制作视频";
});

const modeLabels: Record<VideoMode, string> = {
  audio_reference: "音频参考",
  lip_sync: "对口型",
  video_only: "纯视频",
};

const modeLabel = computed(() => {
  return props.videoMode ? modeLabels[props.videoMode] : "";
});

function onLoadedMetadata() {
  if (videoRef.value) {
    duration.value = videoRef.value.duration;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function handleDownload() {
  if (videoUrl.value) {
    const link = document.createElement("a");
    link.href = videoUrl.value;
    link.download = `video-${Date.now()}.mp4`;
    link.click();
  }
}

function handleRegenerate() {
  emit("regenerate");
}
</script>

<style scoped>
.video-preview-card {
  margin-bottom: 16px;
}

.empty-preview {
  padding: 48px 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.video-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.video-player {
  width: 100%;
  max-height: 400px;
  border-radius: 8px;
  background: #000;
}

.video-info {
  padding: 16px;
  background: var(--n-color-hover);
  border-radius: 8px;
}

.audio-section {
  margin-top: 16px;
}

.audio-player {
  width: 100%;
  margin-top: 8px;
}
</style>

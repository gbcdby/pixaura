<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NIcon, NProgress, NTooltip } from "naive-ui";
import { PlayOutline, ReloadOutline, DownloadOutline } from "@vicons/ionicons5";
import {
  useVideoConcat,
  type VideoClip,
} from "@/composables/useVideoConcat";
import type { Shot } from "@pixaura/shared-types";

/**
 * ShotGroupPreviewPlayer - 分镜组预览播放器
 * 当分镜组中所有 shots 都生成视频后，可预览拼接后的完整视频
 */

interface Props {
  /** 分镜组 ID */
  shotGroupId: string;
  /** shots 列表 */
  shots: Shot[];
  /** 视频宽高比 */
  aspectRatio?: string;
  /** 是否显示播放器（外部条件控制） */
  canShow?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: "9/16",
  canShow: false,
});

// 检查所有 shots 是否都已完成视频生成
const allShotsCompleted = computed(() => {
  if (!props.shots || props.shots.length === 0) return false;
  return props.shots.every(
    (shot) => shot.status === "completed" && shot.videoUrl,
  );
});

// 是否有多个 shot
const hasMultipleShots = computed(() => props.shots.length > 1);

// 是否应该显示播放器
const shouldShow = computed(() => {
  return props.canShow && allShotsCompleted.value && hasMultipleShots.value;
});

// 拼接后的视频 URL
const concatenatedVideoUrl = ref<string | null>(null);
const isConcatenating = ref(false);
const concatProgress = ref(0);
const concatStage = ref("");
const concatError = ref<string | null>(null);

// useVideoConcat
const {
  concatVideos,
  reset: resetConcat,
} = useVideoConcat({
  onProgress: (progress) => {
    concatProgress.value = progress.percentage;
    concatStage.value = progress.stage;
    if (progress.error) {
      concatError.value = progress.error;
    }
  },
  onComplete: (blob) => {
    concatenatedVideoUrl.value = URL.createObjectURL(blob);
    isConcatenating.value = false;
  },
  onError: (error) => {
    concatError.value = error.message;
    isConcatenating.value = false;
  },
});

// 构建 VideoClip 列表
function buildVideoClips(): VideoClip[] {
  return props.shots
    .filter((shot) => shot.videoUrl && shot.status === "completed")
    .map((shot, index) => ({
      id: shot.id,
      url: shot.videoUrl!,
      // Shot 类型已简化，duration 使用固定值
      duration: 3,
      order: index,
    }));
}

// 开始拼接
async function handleConcatVideos() {
  if (isConcatenating.value) return;

  const clips = buildVideoClips();
  if (clips.length === 0) {
    concatError.value = "没有可拼接的视频片段";
    return;
  }

  isConcatenating.value = true;
  concatError.value = null;

  try {
    const blob = await concatVideos(clips, {
      format: "mp4",
      useCache: true,
    });

    if (!blob) {
      concatError.value = "视频拼接失败";
    }
  } catch (error) {
    concatError.value = (error as Error).message;
    isConcatenating.value = false;
  }
}

// 重置
function handleReset() {
  if (concatenatedVideoUrl.value) {
    URL.revokeObjectURL(concatenatedVideoUrl.value);
    concatenatedVideoUrl.value = null;
  }
  resetConcat();
  concatError.value = null;
  concatProgress.value = 0;
  concatStage.value = "";
}

// 下载
function handleDownload() {
  if (!concatenatedVideoUrl.value) return;

  // 从 blob URL 下载
  const a = document.createElement("a");
  a.href = concatenatedVideoUrl.value;
  a.download = `shotgroup_${props.shotGroupId}_preview.mp4`;
  a.click();
}

// 监听 shots 变化，自动触发拼接
watch(
  [shouldShow, () => props.shots],
  ([show, shots]) => {
    if (show && shots.length > 1 && !concatenatedVideoUrl.value) {
      // 自动开始拼接
      handleConcatVideos();
    }
  },
  { immediate: true },
);

// 清理
watch(concatenatedVideoUrl, (_newUrl, oldUrl) => {
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl);
  }
});
</script>

<template>
  <div
    v-if="shouldShow"
    class="shotgroup-preview-player"
  >
    <div class="preview-header">
      <span class="preview-title">分镜组预览</span>
      <span class="shot-count">{{ shots.length }} 个分镜</span>
    </div>

    <!-- 拼接进度 -->
    <div
      v-if="isConcatenating"
      class="concat-progress"
    >
      <n-progress
        type="line"
        :percentage="concatProgress"
        :show-indicator="true"
        :height="8"
        :border-radius="4"
      />
      <span class="progress-stage">{{ concatStage }}</span>
    </div>

    <!-- 拼接错误 -->
    <div
      v-else-if="concatError"
      class="concat-error"
    >
      <span>{{ concatError }}</span>
      <n-button
        size="tiny"
        quaternary
        type="error"
        @click="handleReset"
      >
        重试
      </n-button>
    </div>

    <!-- 视频播放器 -->
    <div
      v-else-if="concatenatedVideoUrl"
      class="video-player-container"
      :style="{ aspectRatio: aspectRatio }"
    >
      <video
        :src="concatenatedVideoUrl"
        controls
        class="video-player"
        preload="metadata"
      />
    </div>

    <!-- 待拼接状态 -->
    <div
      v-else
      class="waiting-concat"
    >
      <n-button
        size="small"
        @click="handleConcatVideos"
      >
        <template #icon>
          <n-icon><PlayOutline /></n-icon>
        </template>
        生成预览视频
      </n-button>
    </div>

    <!-- 操作按钮 -->
    <div
      v-if="concatenatedVideoUrl || concatError"
      class="preview-actions"
    >
      <n-tooltip>
        <template #trigger>
          <n-button
            size="tiny"
            quaternary
            @click="handleReset"
          >
            <template #icon>
              <n-icon><ReloadOutline /></n-icon>
            </template>
          </n-button>
        </template>
        重新生成
      </n-tooltip>

      <n-tooltip v-if="concatenatedVideoUrl">
        <template #trigger>
          <n-button
            size="tiny"
            quaternary
            @click="handleDownload"
          >
            <template #icon>
              <n-icon><DownloadOutline /></n-icon>
            </template>
          </n-button>
        </template>
        下载预览视频
      </n-tooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shotgroup-preview-player {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 12px;
  background: #fafafa;
  margin-top: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.shot-count {
  font-size: 11px;
  color: #888;
}

.concat-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-stage {
  font-size: 11px;
  color: #2080f0;
}

.concat-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: #fff2f0;
  border-radius: 4px;
  font-size: 12px;
  color: #d03050;
}

.video-player-container {
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: #000;
}

.video-player {
  width: 100%;
  height: 100%;
  display: block;
}

.waiting-concat {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
</style>
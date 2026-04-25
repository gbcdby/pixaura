<script setup lang="ts">
import { computed } from "vue";
import { NIcon, NProgress, useMessage } from "naive-ui";
import {
  VideocamOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import type { Shot } from "@pixaura/shared-types";

/**
 * ShotPreview - 纯视频预览组件（无按钮）
 * 只显示视频播放器或生成状态，不包含任何操作按钮和信息
 */

// 显示错误信息提示（Shot 类型已简化，error 需从外部传入）
interface Props {
  /** 分镜数据 */
  shot?: Shot;
  /** 视频宽高比 */
  aspectRatio?: string;
  /** 是否正在生成 */
  isGenerating?: boolean;
  /** 生成进度 0-100 */
  generationProgress?: number;
  /** 错误信息（从外部传入） */
  errorMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: "9/16",
  isGenerating: false,
  generationProgress: 0,
  errorMessage: "",
});

const message = useMessage();

// 状态计算
const shotStatus = computed(() => props.shot?.status || "pending");
const isProcessing = computed(() => shotStatus.value === "processing");
const isCompleted = computed(() => shotStatus.value === "completed");
const isFailed = computed(() => shotStatus.value === "failed");

// 进度：从 props.generationProgress 读取（Shot 类型已简化，不再存储 progress）
const displayProgress = computed(() => props.generationProgress);

// 显示完整错误信息（使用 Message 提示）
function showErrorDetail() {
  if (props.errorMessage) {
    message.error(props.errorMessage, { duration: 5000 });
  }
}
</script>

<template>
  <div class="shot-preview">
    <!-- 视频播放器（已完成状态） -->
    <div
      v-if="isCompleted && shot?.videoUrl"
      class="video-container"
      :style="{ aspectRatio: aspectRatio }"
    >
      <video
        :src="shot.videoUrl"
        class="video-player"
        controls
        controlslist="nodownload noremoteplayback"
      />
    </div>

    <!-- 处理中状态 -->
    <div
      v-else-if="isProcessing"
      class="processing-container"
      :style="{ aspectRatio: aspectRatio }"
    >
      <n-icon
        size="24"
        color="#2080f0"
      >
        <VideocamOutline />
      </n-icon>
      <span class="processing-text">生成中 {{ displayProgress }}%</span>
      <!-- 进度条 -->
      <div class="progress-bar">
        <n-progress
          type="line"
          :percentage="displayProgress"
          :show-indicator="false"
          :height="4"
          :border-radius="2"
          color="#2080f0"
          rail-color="rgba(32, 128, 240, 0.2)"
        />
      </div>
    </div>

    <!-- 失败状态 -->
    <div
      v-else-if="isFailed"
      class="failed-container"
      :style="{ aspectRatio: aspectRatio }"
    >
      <n-icon
        size="24"
        color="#d03050"
      >
        <RefreshOutline />
      </n-icon>
      <span class="failed-text">生成失败</span>
      <span
        v-if="errorMessage"
        class="error-message"
        :title="errorMessage"
        @click="showErrorDetail"
      >
        {{ errorMessage.length > 30 ? errorMessage.substring(0, 30) + '...' : errorMessage }}
        <span class="error-hint">点击查看详情</span>
      </span>
    </div>

    <!-- 待生成状态（占位） -->
    <div
      v-else
      class="placeholder-container"
      :style="{ aspectRatio: aspectRatio }"
    >
      <span class="placeholder-text">视频待生成</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shot-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.video-container,
.processing-container,
.failed-container,
.placeholder-container {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.video-container {
  .video-player {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
}

// 全屏时保持 contain 样式（竖屏视频正确比例）
:global(video:fullscreen) {
  object-fit: contain;
}

// 兼容各浏览器前缀
:global(video:-webkit-full-screen) {
  object-fit: contain;
}

:global(video:-moz-full-screen) {
  object-fit: contain;
}

.processing-container {
  .processing-text {
    font-size: 12px;
    color: #2080f0;
    font-weight: 500;
  }

  .progress-bar {
    width: 80%;
    margin-top: 4px;
  }
}

.failed-container {
  .failed-text {
    font-size: 12px;
    color: #d03050;
    font-weight: 500;
  }

  .error-message {
    font-size: 11px;
    color: #d03050;
    max-width: 90%;
    text-align: center;
    word-break: break-all;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(208, 48, 80, 0.1);
    transition: background 0.2s;

    &:hover {
      background: rgba(208, 48, 80, 0.2);
    }

    .error-hint {
      font-size: 10px;
      color: #999;
      margin-left: 4px;
    }
  }
}

.placeholder-container {
  .placeholder-text {
    font-size: 12px;
    color: #999;
    font-weight: 500;
  }
}
</style>
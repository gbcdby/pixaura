<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NIcon, NTooltip, NProgress } from "naive-ui";
import {
  VideocamOutline,
  PlayOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import type {
  Shot,
  CharacterRegionConfig,
} from "@pixaura/shared-types";
import type { DialogueItem } from "./types";

/**
 * ShotCard - 单条对话对应的分镜视频卡片
 * 显示 mask 预览图、视频播放区域、生成按钮和状态
 */

interface Props {
  /** 分镜组 ID */
  shotGroupId: string;
  /** 分镜数据 */
  shot: Shot;
  /** 关联的对话数据 */
  dialogue: DialogueItem;
  /** 角色框选配置（用于获取 mask 预览图） */
  characterRegion?: CharacterRegionConfig;
  /** 视频宽高比 */
  aspectRatio?: string;
  /** 是否正在生成 */
  isGenerating?: boolean;
  /** 生成进度 0-100 */
  generationProgress?: number;
  /** 是否只读模式 */
  isReadonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: "9/16",
  isGenerating: false,
  generationProgress: 0,
  isReadonly: false,
});

const emit = defineEmits<{
  (e: "generate-video", shotGroupId: string, shotId: string): void;
  (e: "play-video", shotGroupId: string, shotId: string): void;
  (e: "retry", shotGroupId: string, shotId: string): void;
}>();

// 状态计算
const shotStatus = computed(() => props.shot.status);
const isPending = computed(() => shotStatus.value === "pending");
const isProcessing = computed(() => shotStatus.value === "processing");
const isCompleted = computed(() => shotStatus.value === "completed");
const isFailed = computed(() => shotStatus.value === "failed");

// 获取框选区域（用于 RegionOverlay 显示）
const characterRegion = computed(() => {
  if (!props.characterRegion) return null;
  const config = props.characterRegion;
  if (config.useManual && config.manualRegion) {
    return config.manualRegion;
  }
  // 自动检测的坐标需要从 shot 或其他地方获取
  // 这里简化处理，直接返回 null（因为 DetectedSubject 不在 ShotCard 中）
  return null;
});

// 视频时长显示（Shot 类型已简化，使用固定值）
const durationText = computed(() => "3s");

// 角色名称（从对话获取）
const characterName = computed(
  () => props.dialogue?.characterName || "未知角色",
);

// 对话文本（截取显示）
const dialogueText = computed(() => {
  const text = props.dialogue?.text || "";
  return text.length > 50 ? text.slice(0, 50) + "..." : text;
});

// 生成按钮禁用条件
const canGenerate = computed(() => {
  return !props.isReadonly && !props.isGenerating && isPending.value;
});

// 处理生成视频
function handleGenerateVideo() {
  emit("generate-video", props.shotGroupId, props.shot.id);
}

// 处理播放视频
function handlePlayVideo() {
  emit("play-video", props.shotGroupId, props.shot.id);
}

// 处理重试
function handleRetry() {
  emit("retry", props.shotGroupId, props.shot.id);
}

// 视频播放状态
const isPlaying = ref(false);

// 视频播放/暂停
function togglePlay() {
  isPlaying.value = !isPlaying.value;
}
</script>

<template>
  <div class="shot-card">
    <!-- 左侧：mask 预览图 + 视频播放区域 -->
    <div class="shot-media">
      <!-- 视频播放器（已完成状态） -->
      <div
        v-if="isCompleted && shot.videoUrl"
        class="video-container"
        :style="{ aspectRatio: aspectRatio }"
      >
        <video
          :src="shot.videoUrl"
          class="video-player"
          controls
          controlslist="nodownload noremoteplayback"
          @play="togglePlay"
          @pause="togglePlay"
        />
        <!-- 播放按钮覆盖层（未播放时显示） -->
        <div
          v-if="!isPlaying"
          class="play-overlay"
          @click="handlePlayVideo"
        >
          <n-icon
            size="32"
            color="#fff"
          >
            <PlayOutline />
          </n-icon>
        </div>
      </div>

      <!-- 框选区域预览（处理中状态，有坐标） -->
      <div
        v-else-if="isProcessing && characterRegion"
        class="mask-preview-container"
        :style="{ aspectRatio: aspectRatio }"
      >
        <!-- TODO: 需要主图 URL 来显示框选区域 -->
        <div class="region-preview-placeholder">
          <span class="region-label">已配置框选区域</span>
        </div>
        <!-- 进度条 -->
        <div class="progress-overlay">
          <n-progress
            type="line"
            :percentage="generationProgress"
            :show-indicator="false"
            :height="4"
            :border-radius="2"
            color="#2080f0"
            rail-color="rgba(255, 255, 255, 0.3)"
          />
          <span class="progress-text">{{ generationProgress }}%</span>
        </div>
      </div>

      <!-- 占位区域（待处理或失败状态） -->
      <div
        v-else
        class="placeholder-container"
        :style="{ aspectRatio: aspectRatio }"
      >
        <!-- 失败状态 -->
        <div
          v-if="isFailed"
          class="failed-state"
        >
          <n-icon
            size="24"
            color="#d03050"
          >
            <RefreshOutline />
          </n-icon>
          <span class="failed-text">生成失败</span>
        </div>

        <!-- 处理中无 mask -->
        <div
          v-else-if="isProcessing"
          class="processing-state"
        >
          <n-icon
            size="24"
            color="#2080f0"
          >
            <VideocamOutline />
          </n-icon>
          <span class="processing-text">生成中 {{ generationProgress }}%</span>
        </div>

        <!-- 待处理状态 -->
        <div
          v-else
          class="pending-state"
        >
          <n-icon
            size="24"
            color="#999"
          >
            <VideocamOutline />
          </n-icon>
          <span class="pending-text">待生成</span>
        </div>
      </div>
    </div>

    <!-- 右侧：对话信息 + 操作 -->
    <div class="shot-content">
      <!-- 对话信息 -->
      <div class="dialogue-info">
        <span class="character-name">{{ characterName }}</span>
        <span class="dialogue-text">{{ dialogueText }}</span>
        <span class="duration-badge">{{ durationText }}</span>
      </div>

      <!-- 状态标签 -->
      <div class="status-badge">
        <span
          :class="[
            'status-tag',
            {
              pending: isPending,
              processing: isProcessing,
              completed: isCompleted,
              failed: isFailed,
            },
          ]"
        >
          {{
            isPending
              ? "待生成"
              : isProcessing
                ? "生成中"
                : isCompleted
                  ? "已完成"
                  : "失败"
          }}
        </span>
      </div>

      <!-- 操作按钮 -->
      <div class="shot-actions">
        <!-- 待处理：生成按钮 -->
        <n-tooltip v-if="isPending && !isReadonly">
          <template #trigger>
            <n-button
              type="primary"
              size="small"
              :disabled="isGenerating"
              :loading="isGenerating"
              @click="handleGenerateVideo"
            >
              <template #icon>
                <n-icon><VideocamOutline /></n-icon>
              </template>
              {{ isGenerating ? "生成中..." : "生成视频" }}
            </n-button>
          </template>
          {{ canGenerate ? "开始生成此分镜的视频" : "请先配置必要参数" }}
        </n-tooltip>

        <!-- 处理中：进度显示 -->
        <div
          v-if="isProcessing"
          class="generation-progress"
        >
          <n-progress
            type="line"
            :percentage="generationProgress"
            :height="6"
            :border-radius="3"
          />
        </div>

        <!-- 已完成：播放/重新生成 -->
        <div
          v-if="isCompleted && !isReadonly"
          class="completed-actions"
        >
          <n-button
            size="small"
            quaternary
            @click="handlePlayVideo"
          >
            <template #icon>
              <n-icon><PlayOutline /></n-icon>
            </template>
            播放
          </n-button>
          <n-button
            size="small"
            quaternary
            @click="handleGenerateVideo"
          >
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
            重新生成
          </n-button>
        </div>

        <!-- 失败：重试按钮 -->
        <n-button
          v-if="isFailed && !isReadonly"
          type="error"
          size="small"
          ghost
          :disabled="isGenerating"
          :loading="isGenerating"
          @click="handleRetry"
        >
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          重试
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shot-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 12px;
  background: #fff;
  transition: all 0.2s;

  &:hover {
    border-color: #d0d0d0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
}

// 媒体区域
.shot-media {
  flex-shrink: 0;
  width: 100%;

  .video-container,
  .mask-preview-container,
  .placeholder-container {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
  }
}

.video-container {
  position: relative;

  .video-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.3);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.4);
    }
  }
}

.mask-preview-container {
  position: relative;

  .mask-preview-image {
    width: 100%;
    height: 100%;
  }

  .progress-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    gap: 8px;

    .progress-text {
      font-size: 12px;
      color: #fff;
      font-weight: 500;
    }
  }
}

.placeholder-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;

  .pending-state,
  .processing-state,
  .failed-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .pending-text,
  .processing-text,
  .failed-text {
    font-size: 12px;
    font-weight: 500;
  }

  .pending-text {
    color: #999;
  }

  .processing-text {
    color: #2080f0;
  }

  .failed-text {
    color: #d03050;
  }
}

// 内容区域
.shot-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialogue-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;

  .character-name {
    font-size: 12px;
    font-weight: 600;
    color: #333;
    padding: 2px 6px;
    background: #f0f0f0;
    border-radius: 4px;
  }

  .dialogue-text {
    font-size: 12px;
    color: #666;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .duration-badge {
    font-size: 10px;
    color: #888;
    padding: 1px 4px;
    background: #e8e8e8;
    border-radius: 4px;
  }
}

.status-badge {
  .status-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;

    &.pending {
      color: #999;
      background: #f5f5f5;
    }

    &.processing {
      color: #2080f0;
      background: #e6f4ff;
    }

    &.completed {
      color: #18a058;
      background: #e8f7e8;
    }

    &.failed {
      color: #d03050;
      background: #ffe8e8;
    }
  }
}

.shot-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;

  .generation-progress {
    width: 100%;
  }

  .completed-actions {
    display: flex;
    gap: 4px;
  }

  // 确保按钮紧凑显示
  :deep(.n-button) {
    font-size: 12px;
  }
}
</style>

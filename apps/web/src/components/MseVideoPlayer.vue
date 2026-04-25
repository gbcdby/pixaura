<script setup lang="ts">
/**
 * MSE 视频播放器组件
 * 使用 Media Source Extensions 实现无缝连续播放多个视频片段
 * 通过 mp4box.js 将普通 MP4 转换为 fMP4 格式后动态添加到播放器
 */
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from "vue";
import { NSpin, NProgress } from "naive-ui";
import { useFmp4Remux, type Fmp4Segments } from "@/composables/useFmp4Remux";

// ==================== Props ====================

const props = defineProps<{
  /** 视频 URL 列表 */
  videoUrls: string[];
  /** 视频容器宽高比 */
  aspectRatio?: string;
  /** 是否显示控件 */
  controls?: boolean;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 是否静音 */
  muted?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
}>();

// ==================== Emits ====================

const emit = defineEmits<{
  /** 播放开始 */
  (e: "play"): void;
  /** 播放暂停 */
  (e: "pause"): void;
  /** 播放结束 */
  (e: "ended"): void;
  /** 播放错误 */
  (e: "error", error: Error): void;
  /** 加载进度 */
  (e: "load-progress", percentage: number): void;
  /** 准备就绪 */
  (e: "ready"): void;
}>();

// ==================== 状态 ====================

const videoRef = ref<HTMLVideoElement>();

// MSE 相关状态
const mediaSource = ref<MediaSource | null>(null);
const sourceBuffer = ref<SourceBuffer | null>(null);

// 加载状态
const isLoading = ref(false);
const loadProgress = ref(0);
const loadStage = ref("");
const loadError = ref<string | null>(null);

// 播放状态
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

// 片段队列
const segmentsQueue = ref<Fmp4Segments[]>([]);
const currentSegmentIndex = ref(0);
const isAppendingBuffer = ref(false);

// 累计时长（用于设置时间戳偏移）
let accumulatedDuration = 0;

// ==================== 计算属性 ====================

const hasVideos = computed(() => props.videoUrls.length > 0);

const videoStyle = computed(() => ({
  aspectRatio: props.aspectRatio || "16/9",
}));

// ==================== fMP4 转换 ====================

const { remuxToFmp4 } = useFmp4Remux({
  onProgress: (progress) => {
    loadProgress.value = progress.percentage;
    loadStage.value = progress.stage;
    emit("load-progress", progress.percentage);
  },
  onError: (error) => {
    loadError.value = error.message;
    emit("error", error);
  },
});

// ==================== MSE 播放逻辑 ====================

/**
 * 初始化 MSE 播放器
 */
async function initializeMsePlayer(): Promise<void> {
  if (!videoRef.value || !hasVideos.value) return;

  isLoading.value = true;
  loadError.value = null;
  loadProgress.value = 0;
  loadStage.value = "初始化播放器...";

  // 等待 DOM 更新，确保 video 元素已渲染
  await nextTick();

  // 再次检查 videoRef
  if (!videoRef.value) {
    loadError.value = "视频元素初始化失败";
    isLoading.value = false;
    return;
  }

  try {
    // 创建 MediaSource
    mediaSource.value = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource.value);
    videoRef.value.src = objectUrl;

    // 等待 sourceopen 事件
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MediaSource 打开超时"));
      }, 10000);

      mediaSource.value!.addEventListener("sourceopen", () => {
        clearTimeout(timeout);
        resolve();
      });

      mediaSource.value!.addEventListener("sourceended", () => {});
      mediaSource.value!.addEventListener("sourceclose", () => {});
      mediaSource.value!.addEventListener("error", (e) => {
        clearTimeout(timeout);
        reject(new Error(`MediaSource 错误: ${e}`));
      });
    });

    loadStage.value = "创建 SourceBuffer...";

    // 创建 SourceBuffer
    // 使用标准的 H.264/AAC 编码格式
    // codecs 参数格式: avc1.(profile).(level), mp4a.40.(objectType)
    // 注意: avc1.640028 是 H.264 High Profile (profile_idc=100, level=40)
    // 大多数浏览器支持 avc1.64001F 或 avc1.640028
    const codecStrings = [
      "video/mp4; codecs=\"avc1.640028, mp4a.40.2\"",  // High Profile Level 40
      "video/mp4; codecs=\"avc1.64001F, mp4a.40.2\"",  // High Profile Level 31
      "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"",  // Baseline Profile
      "video/mp4; codecs=\"avc1.4D401E, mp4a.40.2\"",  // Main Profile
    ];

    for (const codec of codecStrings) {
      try {
        if (MediaSource.isTypeSupported(codec)) {
          sourceBuffer.value = mediaSource.value.addSourceBuffer(codec);
          break;
        }
      } catch {
        // codec 不支持，尝试下一个
      }
    }

    if (!sourceBuffer.value) {
      // 最后尝试不指定 codec
      try {
        sourceBuffer.value = mediaSource.value.addSourceBuffer("video/mp4");
      } catch (e) {
        throw new Error("无法创建 SourceBuffer，浏览器可能不支持该视频格式");
      }
    }

    // 设置 updateend 事件处理
    sourceBuffer.value.addEventListener("updateend", handleBufferUpdateEnd);
    sourceBuffer.value.addEventListener("error", (e) => {
      loadError.value = `SourceBuffer 错误: ${e}`;
      isLoading.value = false;
    });

    // 开始处理视频片段
    await processVideos();

  } catch (error) {
    loadError.value = (error as Error).message;
    isLoading.value = false;
    emit("error", error as Error);
  }
}

/**
 * 处理视频列表，转换为 fMP4
 */
async function processVideos(): Promise<void> {
  segmentsQueue.value = [];
  currentSegmentIndex.value = 0;
  accumulatedDuration = 0; // 重置累计时长

  // 转换所有视频为 fMP4
  for (let i = 0; i < props.videoUrls.length; i++) {
    loadStage.value = `转换视频 ${i + 1}/${props.videoUrls.length}...`;

    try {
      const segments = await remuxToFmp4(props.videoUrls[i]);
      segmentsQueue.value.push(segments);
    } catch (error) {
      loadError.value = `视频 ${i + 1} 转换失败: ${(error as Error).message}`;
      isLoading.value = false;
      emit("error", error as Error);
      return;
    }
  }

  loadProgress.value = 80;
  loadStage.value = "添加视频片段到播放器...";

  // 开始添加片段到 SourceBuffer
  if (segmentsQueue.value.length > 0) {
    await appendNextSegment();
  }
}

/**
 * 添加下一个片段到 SourceBuffer
 */
async function appendNextSegment(): Promise<void> {
  if (!sourceBuffer.value || currentSegmentIndex.value >= segmentsQueue.value.length) {
    // 所有片段已添加
    if (mediaSource.value && mediaSource.value.readyState === "open") {
      mediaSource.value.endOfStream();
      isLoading.value = false;
      loadProgress.value = 100;
      loadStage.value = "准备就绪";
      emit("ready");

      // 如果设置了自动播放
      if (props.autoplay && videoRef.value) {
        try {
          await videoRef.value.play();
        } catch {
          // 自动播放可能被浏览器阻止
        }
      }
    }
    return;
  }

  const segments = segmentsQueue.value[currentSegmentIndex.value];

  // 添加初始化片段（仅第一个片段需要）
  if (currentSegmentIndex.value === 0 && segments.initSegment.byteLength > 0) {
    await appendBufferToSourceBuffer(segments.initSegment);
  }

  // 关键修复：为后续视频设置时间戳偏移
  // 使第二个视频的时间戳从第一个视频结束时开始
  if (currentSegmentIndex.value > 0 && sourceBuffer.value) {
    // 使用 SourceBuffer 的 buffered 属性获取当前缓冲区的结束时间
    if (sourceBuffer.value.buffered.length > 0) {
      accumulatedDuration = sourceBuffer.value.buffered.end(sourceBuffer.value.buffered.length - 1);
    }
    // 设置时间戳偏移为当前累计时长
    sourceBuffer.value.timestampOffset = accumulatedDuration;
  }

  // 添加媒体片段
  for (let i = 0; i < segments.mediaSegments.length; i++) {
    const mediaSegment = segments.mediaSegments[i];
    await appendBufferToSourceBuffer(mediaSegment);
  }

  // 更新累计时长（使用 SourceBuffer 的 buffered 属性）
  if (sourceBuffer.value && sourceBuffer.value.buffered.length > 0) {
    accumulatedDuration = sourceBuffer.value.buffered.end(sourceBuffer.value.buffered.length - 1);
  }

  currentSegmentIndex.value++;
  loadProgress.value = Math.min(95, 80 + currentSegmentIndex.value * 5);

  // 继续添加下一个片段
  await appendNextSegment();
}

/**
 * 添加 buffer 到 SourceBuffer 并等待完成
 */
async function appendBufferToSourceBuffer(buffer: ArrayBuffer): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!sourceBuffer.value) {
      reject(new Error("SourceBuffer 不存在"));
      return;
    }

    // 检查 MediaSource 状态
    if (mediaSource.value && mediaSource.value.readyState !== "open") {
      reject(new Error(`MediaSource 状态错误: ${mediaSource.value.readyState}`));
      return;
    }

    // 监听 updateend 事件
    const onUpdateEnd = () => {
      sourceBuffer.value?.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.value?.removeEventListener("error", onError);
      isAppendingBuffer.value = false;
      resolve();
    };

    // 监听错误事件
    const onError = () => {
      sourceBuffer.value?.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.value?.removeEventListener("error", onError);
      reject(new Error("SourceBuffer 错误"));
    };

    sourceBuffer.value.addEventListener("updateend", onUpdateEnd);
    sourceBuffer.value.addEventListener("error", onError);

    try {
      isAppendingBuffer.value = true;
      sourceBuffer.value.appendBuffer(buffer);
    } catch (e) {
      sourceBuffer.value.removeEventListener("updateend", onUpdateEnd);
      sourceBuffer.value.removeEventListener("error", onError);
      reject(e);
    }
  });
}

/**
 * 处理 SourceBuffer updateend 事件
 */
function handleBufferUpdateEnd(): void {
  isAppendingBuffer.value = false;

  // 更新播放时长
  if (videoRef.value) {
    duration.value = videoRef.value.duration;
  }
}

// ==================== 播放控制 ====================

/**
 * 播放
 */
async function play(): Promise<void> {
  if (videoRef.value) {
    try {
      await videoRef.value.play();
      isPlaying.value = true;
      emit("play");
    } catch (error) {
      emit("error", error as Error);
    }
  }
}

/**
 * 暂停
 */
function pause(): void {
  if (videoRef.value) {
    videoRef.value.pause();
    isPlaying.value = false;
    emit("pause");
  }
}

/**
 * 重新加载
 */
async function reload(): Promise<void> {
  // 清理当前状态
  cleanupMse();
  segmentsQueue.value = [];
  currentSegmentIndex.value = 0;

  // 重新初始化
  await initializeMsePlayer();
}

// ==================== 事件处理 ====================

function handleVideoPlay(): void {
  isPlaying.value = true;
  emit("play");
}

function handleVideoPause(): void {
  isPlaying.value = false;
  emit("pause");
}

function handleVideoEnded(): void {
  isPlaying.value = false;
  emit("ended");

  // 如果设置了循环播放
  if (props.loop && videoRef.value) {
    videoRef.value.currentTime = 0;
    videoRef.value.play();
  }
}

function handleVideoTimeUpdate(): void {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime;
  }
}

function handleVideoError(): void {
  const error = new Error("视频播放错误");
  loadError.value = error.message;
  emit("error", error);
}

// ==================== 清理 ====================

function cleanupMse(): void {
  if (sourceBuffer.value) {
    try {
      sourceBuffer.value.removeEventListener("updateend", handleBufferUpdateEnd);
      if (mediaSource.value && mediaSource.value.readyState === "open") {
        mediaSource.value.removeSourceBuffer(sourceBuffer.value);
      }
    } catch {
      // 忽略清理错误
    }
    sourceBuffer.value = null;
  }

  if (mediaSource.value) {
    try {
      if (mediaSource.value.readyState === "open") {
        mediaSource.value.endOfStream();
      }
    } catch {
      // 忽略清理错误
    }
    mediaSource.value = null;
  }

  if (videoRef.value && videoRef.value.src) {
    URL.revokeObjectURL(videoRef.value.src);
    videoRef.value.src = "";
  }
}

// ==================== 生命周期 ====================

onMounted(async () => {
  if (hasVideos.value) {
    await initializeMsePlayer();
  }
});

onUnmounted(() => {
  cleanupMse();
});

// 监听 videoUrls 变化
watch(
  () => props.videoUrls,
  async (newUrls, oldUrls) => {
    // URL 列表变化时重新加载
    if (newUrls.length > 0 && JSON.stringify(newUrls) !== JSON.stringify(oldUrls)) {
      await reload();
    }
  },
  { deep: true },
);

// ==================== 暴露方法 ====================

defineExpose({
  play,
  pause,
  reload,
  videoRef,
});
</script>

<template>
  <div class="mse-video-player">
    <!-- 视频播放器 - 始终渲染 -->
    <video
      ref="videoRef"
      class="video-element"
      :style="videoStyle"
      :controls="controls && !isLoading"
      :muted="muted"
      :playsinline="true"
      @play="handleVideoPlay"
      @pause="handleVideoPause"
      @ended="handleVideoEnded"
      @timeupdate="handleVideoTimeUpdate"
      @error="handleVideoError"
    />

    <!-- 加载状态 -->
    <div
      v-if="isLoading"
      class="loading-overlay"
      :style="videoStyle"
    >
      <div class="loading-content">
        <n-spin size="medium" />
        <div class="loading-info">
          <span class="loading-stage">{{ loadStage }}</span>
          <n-progress
            type="line"
            :percentage="loadProgress"
            :show-indicator="false"
            :height="4"
            :border-radius="2"
          />
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div
      v-else-if="loadError"
      class="error-overlay"
      :style="videoStyle"
    >
      <span class="error-text">{{ loadError }}</span>
    </div>

    <!-- 无视频状态 -->
    <div
      v-else-if="!hasVideos"
      class="empty-overlay"
      :style="videoStyle"
    >
      <span class="empty-text">暂无视频</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mse-video-player {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
  position: relative;
}

.loading-overlay,
.error-overlay,
.empty-overlay {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
}

.loading-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 200px;
}

.loading-stage {
  font-size: 12px;
  color: #a0a0a0;
}

.error-overlay {
  background: rgba(255, 77, 79, 0.1);
}

.error-text {
  font-size: 12px;
  color: #d03050;
  text-align: center;
  padding: 20px;
}

.empty-overlay {
  background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
}

.empty-text {
  font-size: 12px;
  color: #888;
}

.video-element {
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
  border-radius: 8px;
}
</style>
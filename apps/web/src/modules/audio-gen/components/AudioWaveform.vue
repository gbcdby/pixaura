<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";

const props = defineProps<{
  url: string;
  duration: number;
  active?: boolean;
  height?: number;
  barCount?: number;
}>();

const emit = defineEmits<{
  play: [];
  pause: [];
  ended: [];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const audioRef = ref<HTMLAudioElement | null>(null);

const displayHeight = computed(() => props.height || 40);
const displayBarCount = computed(() => props.barCount || 50);

const formattedDuration = computed(() => {
  const minutes = Math.floor(props.duration / 60);
  const seconds = Math.floor(props.duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

const formattedCurrentTime = computed(() => {
  const minutes = Math.floor(currentTime.value / 60);
  const seconds = Math.floor(currentTime.value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

// 生成模拟波形数据
const waveformData = ref<number[]>([]);

function generateWaveformData() {
  const data: number[] = [];
  for (let i = 0; i < displayBarCount.value; i++) {
    // 使用伪随机但一致的数据，基于索引
    const height =
      0.2 + Math.abs(Math.sin(i * 0.5)) * 0.6 + Math.random() * 0.2;
    data.push(Math.min(1, height));
  }
  waveformData.value = data;
}

function drawWaveform() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const barWidth = width / displayBarCount.value;
  const gap = 2;
  const actualBarWidth = barWidth - gap;

  // 计算播放进度对应的位置
  const progressRatio =
    props.duration > 0 ? currentTime.value / props.duration : 0;
  const progressIndex = Math.floor(progressRatio * displayBarCount.value);

  waveformData.value.forEach((barHeight, index) => {
    const x = index * barWidth + gap / 2;
    const h = barHeight * height * 0.8;
    const y = (height - h) / 2;

    // 已播放部分使用主题色，未播放部分使用灰色
    if (index <= progressIndex) {
      ctx.fillStyle = props.active ? "#18a058" : "#2080f0";
    } else {
      ctx.fillStyle = "#d9d9d9";
    }

    // 绘制圆角矩形
    const radius = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, actualBarWidth, h, radius);
    ctx.fill();
  });
}

function togglePlay() {
  if (!audioRef.value) {
    // 如果没有音频元素，仅模拟播放状态
    isPlaying.value = !isPlaying.value;
    if (isPlaying.value) {
      emit("play");
      simulatePlayback();
    } else {
      emit("pause");
    }
    return;
  }

  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    emit("pause");
  } else {
    audioRef.value.play();
    isPlaying.value = true;
    emit("play");
  }
}

// 模拟播放进度
let playbackInterval: number | null = null;

function simulatePlayback() {
  if (playbackInterval) {
    clearInterval(playbackInterval);
  }

  playbackInterval = window.setInterval(() => {
    if (!isPlaying.value) return;

    currentTime.value += 0.1;
    if (currentTime.value >= props.duration) {
      currentTime.value = 0;
      isPlaying.value = false;
      emit("ended");
      if (playbackInterval) {
        clearInterval(playbackInterval);
      }
    }
    drawWaveform();
  }, 100);
}

// 监听URL变化重新绘制
watch(
  () => props.url,
  () => {
    generateWaveformData();
    drawWaveform();
  },
);

onMounted(() => {
  generateWaveformData();
  drawWaveform();
});
</script>

<template>
  <div
    class="audio-waveform"
    :class="{ active }"
  >
    <div class="waveform-container">
      <canvas
        ref="canvasRef"
        :width="displayBarCount * 4"
        :height="displayHeight"
      />
    </div>
    <div class="controls">
      <button
        class="play-btn"
        :class="{ playing: isPlaying }"
        @click="togglePlay"
      >
        <span class="icon">{{ isPlaying ? "⏸" : "▶" }}</span>
      </button>
      <span class="time">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>
    </div>

    <!-- 隐藏的真实音频元素 -->
    <audio
      v-if="url"
      ref="audioRef"
      :src="url"
      style="display: none"
      @play="
        isPlaying = true;
        emit('play');
      "
      @pause="
        isPlaying = false;
        emit('pause');
      "
      @ended="
        isPlaying = false;
        currentTime = 0;
        emit('ended');
      "
      @timeupdate="currentTime = audioRef?.currentTime || 0"
    />
  </div>
</template>

<style scoped>
.audio-waveform {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.audio-waveform:hover {
  background: #e8e8e8;
}

.audio-waveform.active {
  background: #e6f7e6;
  border-color: #18a058;
}

.waveform-container {
  flex: 1;
  height: v-bind(displayHeight + "px");
}

.waveform-container canvas {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #18a058;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.play-btn:hover {
  background: #0e7b43;
  transform: scale(1.05);
}

.play-btn.playing {
  background: #f0a020;
}

.play-btn .icon {
  font-size: 12px;
  margin-left: 2px;
}

.play-btn.playing .icon {
  margin-left: 0;
}

.time {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  font-family: monospace;
}
</style>

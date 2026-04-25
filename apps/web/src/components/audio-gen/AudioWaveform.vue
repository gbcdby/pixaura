<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

const props = defineProps({
  url: { type: String, required: true },
  duration: { type: Number, required: true },
  active: { type: Boolean, default: false },
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isPlaying = ref(false);
const currentTime = ref(0);

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

onMounted(() => {
  drawWaveform();
});

function drawWaveform() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = props.active ? "#18a058" : "#d9d9d9";
  ctx.lineWidth = 2;
  ctx.beginPath();

  const bars = 50;
  const barWidth = width / bars;

  for (let i = 0; i < bars; i++) {
    const x = i * barWidth;
    const barHeight = Math.random() * height * 0.6 + height * 0.1;
    const y = (height - barHeight) / 2;

    ctx.moveTo(x + barWidth / 2, y);
    ctx.lineTo(x + barWidth / 2, y + barHeight);
  }

  ctx.stroke();
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
}
</script>

<template>
  <div
    class="audio-waveform"
    :class="{ active }"
  >
    <div class="waveform-container">
      <canvas
        ref="canvasRef"
        width="200"
        height="40"
      />
    </div>
    <div class="controls">
      <button
        class="play-btn"
        @click="togglePlay"
      >
        {{ isPlaying ? "⏸" : "▶" }}
      </button>
      <span class="time">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>
    </div>
  </div>
</template>

<style scoped>
.audio-waveform {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.audio-waveform.active {
  background: #e6f7e6;
  border: 1px solid #18a058;
}

.waveform-container {
  flex: 1;
  height: 40px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.play-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: #18a058;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.time {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}
</style>

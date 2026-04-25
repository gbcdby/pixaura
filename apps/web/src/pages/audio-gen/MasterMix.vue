<script setup lang="ts">
import { ref, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NPageHeader,
  NCard,
  NSpace,
  NButton,
  NSlider,
  NSwitch,
  NTag,
  NDivider,
  NEmpty,
  NProgress,
  useMessage,
  useDialog,
  type DataTableColumns,
  NDataTable,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import type { MixTrack } from "@pixaura/shared-types";
import {
  AUDIO_TRACK_TYPE_DESCRIPTIONS,
  AudioTrackType,
} from "@pixaura/shared-types";
import MixingConsole from "@/modules/audio-gen/components/MixingConsole.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const audioStore = useAudioGenerationStore();

const { mixingLoading, currentTask } = storeToRefs(audioStore);

const projectId = computed(() => route.params.id as string);

// 轨道数据
const tracks = ref<MixTrack[]>([
  {
    trackId: "dialogue-1",
    trackType: AudioTrackType.DIALOGUE,
    audioUrl: "",
    startTime: 0,
    endTime: 10,
    volume: 1.0,
    fadeIn: 0.5,
    fadeOut: 0.5,
  },
  {
    trackId: "bgm-1",
    trackType: AudioTrackType.BGM,
    audioUrl: "",
    startTime: 0,
    endTime: 60,
    volume: 0.25,
    ducking: {
      triggerBy: [AudioTrackType.DIALOGUE],
      reductionDb: 20,
    },
  },
  {
    trackId: "ambience-1",
    trackType: AudioTrackType.AMBIENCE,
    audioUrl: "",
    startTime: 0,
    endTime: 60,
    volume: 0.15,
  },
]);

// 混音配置
const normalize = ref(true);
const targetLufs = ref(-14);

// 总时长
const totalDuration = computed(() => {
  return Math.max(...tracks.value.map((t) => t.endTime));
});

// 已启用轨道数
const activeTrackCount = computed(() => tracks.value.length);

// 轨道表格列
const trackColumns: DataTableColumns<MixTrack> = [
  {
    title: "轨道类型",
    key: "trackType",
    width: 100,
    render(row) {
      const desc = AUDIO_TRACK_TYPE_DESCRIPTIONS[row.trackType];
      return h(
        NTag,
        { type: "info", size: "small" },
        { default: () => desc?.label || row.trackType },
      );
    },
  },
  {
    title: "时间范围",
    key: "timeRange",
    width: 150,
    render(row) {
      return `${row.startTime}s - ${row.endTime}s`;
    },
  },
  {
    title: "音量",
    key: "volume",
    width: 100,
    render(row) {
      return `${Math.round(row.volume * 100)}%`;
    },
  },
  {
    title: "淡入/淡出",
    key: "fade",
    width: 120,
    render(row) {
      const fadeIn = row.fadeIn || 0;
      const fadeOut = row.fadeOut || 0;
      return `${fadeIn}s / ${fadeOut}s`;
    },
  },
  {
    title: "避让",
    key: "ducking",
    width: 80,
    render(row) {
      return row.ducking
        ? h(NTag, { size: "small" }, { default: () => "启用" })
        : "-";
    },
  },
];

// 添加轨道
function addTrack(type: AudioTrackType) {
  const desc = AUDIO_TRACK_TYPE_DESCRIPTIONS[type];
  const newTrack: MixTrack = {
    trackId: `${type}-${Date.now()}`,
    trackType: type,
    audioUrl: "",
    startTime: 0,
    endTime: totalDuration.value || 60,
    volume: desc?.defaultVolume || 0.5,
  };

  // BGM默认启用避让
  if (type === AudioTrackType.BGM) {
    newTrack.ducking = {
      triggerBy: [AudioTrackType.DIALOGUE],
      reductionDb: 20,
    };
  }

  tracks.value.push(newTrack);
  message.success(`已添加${desc?.label}轨道`);
}

// 删除轨道
function removeTrack(trackId: string) {
  const index = tracks.value.findIndex((t) => t.trackId === trackId);
  if (index > -1) {
    tracks.value.splice(index, 1);
  }
}

// 更新轨道
function updateTrack(trackId: string, updates: Partial<MixTrack>) {
  const track = tracks.value.find((t) => t.trackId === trackId);
  if (track) {
    Object.assign(track, updates);
  }
}

// 提交混音任务
async function handleSubmit() {
  if (tracks.value.length === 0) {
    message.warning("请至少添加一个轨道");
    return;
  }

  // 检查是否有音频URL
  const emptyTracks = tracks.value.filter((t) => !t.audioUrl);
  if (emptyTracks.length > 0) {
    dialog.warning({
      title: "确认提交",
      content: `有 ${emptyTracks.length} 个轨道未设置音频文件，是否继续？`,
      positiveText: "继续",
      negativeText: "取消",
      onPositiveClick: async () => {
        await submitMixingTask();
      },
    });
    return;
  }

  await submitMixingTask();
}

async function submitMixingTask() {
  try {
    const result = await audioStore.createMixing(projectId.value, {
      config: {
        tracks: tracks.value,
        normalize: normalize.value,
        targetLufs: targetLufs.value,
      },
      notifyWs: true,
    });
    message.success(`混音任务已创建: ${result.taskId}`);
  } catch (error: any) {
    message.error(error.message || "创建任务失败");
  }
}

// 重置
function handleReset() {
  dialog.warning({
    title: "确认重置",
    content: "重置将清除所有轨道配置，确定继续吗？",
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: () => {
      tracks.value = [];
      message.success("已重置");
    },
  });
}

function handleBack() {
  router.push(`/projects/${projectId.value}/audio-gen/tasks`);
}
</script>

<template>
  <div class="master-mix-page">
    <NPageHeader
      title="全局混音"
      subtitle="多轨道音频混合，支持音量调节、避让效果"
      @back="handleBack"
    />

    <div class="content-grid">
      <!-- 左侧：混音台 -->
      <div class="left-panel">
        <NCard
          title="混音台"
          class="console-card"
        >
          <MixingConsole
            :tracks="tracks"
            @update:track="updateTrack"
            @remove:track="removeTrack"
          />

          <NDivider />

          <!-- 添加轨道 -->
          <div class="add-track-section">
            <label class="section-label">添加轨道</label>
            <NSpace>
              <NButton
                size="small"
                @click="addTrack(AudioTrackType.DIALOGUE)"
              >
                + 对白
              </NButton>
              <NButton
                size="small"
                @click="addTrack(AudioTrackType.NARRATION)"
              >
                + 旁白
              </NButton>
              <NButton
                size="small"
                @click="addTrack(AudioTrackType.BGM)"
              >
                + BGM
              </NButton>
              <NButton
                size="small"
                @click="addTrack(AudioTrackType.AMBIENCE)"
              >
                + 环境音
              </NButton>
              <NButton
                size="small"
                @click="addTrack(AudioTrackType.SFX)"
              >
                + 音效
              </NButton>
            </NSpace>
          </div>
        </NCard>

        <NCard
          title="输出配置"
          class="output-card"
        >
          <NSpace vertical>
            <div class="config-item">
              <div class="config-label">
                <span>音频标准化</span>
                <NSwitch v-model:value="normalize" />
              </div>
              <p class="config-desc">
                启用后自动调整响度至广播标准(-14 LUFS)
              </p>
            </div>

            <div
              v-if="normalize"
              class="config-item"
            >
              <label class="config-label">目标响度: {{ targetLufs }} LUFS</label>
              <NSlider
                v-model:value="targetLufs"
                :min="-23"
                :max="-10"
                :step="1"
              />
            </div>
          </NSpace>
        </NCard>
      </div>

      <!-- 右侧：轨道列表和预览 -->
      <div class="right-panel">
        <NCard
          title="轨道列表"
          class="track-list-card"
        >
          <NDataTable
            :columns="trackColumns"
            :data="tracks"
            size="small"
            :pagination="false"
          />
          <NEmpty
            v-if="tracks.length === 0"
            description="请添加轨道"
          />
        </NCard>

        <NCard
          title="混音统计"
          class="stats-card"
        >
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">轨道数</span>
              <span class="stat-value">{{ activeTrackCount }}/8</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">总时长</span>
              <span class="stat-value">{{ totalDuration.toFixed(1) }}s</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">目标响度</span>
              <span class="stat-value">{{ targetLufs }} LUFS</span>
            </div>
          </div>
        </NCard>

        <NCard
          title="操作"
          class="action-card"
        >
          <NSpace vertical>
            <NButton
              type="primary"
              size="large"
              block
              :loading="mixingLoading"
              :disabled="tracks.length === 0"
              @click="handleSubmit"
            >
              开始混音
            </NButton>
            <NButton
              block
              @click="handleReset"
            >
              重置
            </NButton>
          </NSpace>
        </NCard>

        <NCard
          v-if="currentTask && currentTask.type === 'mixing'"
          title="当前任务"
          class="task-card"
        >
          <div class="task-info">
            <div class="info-row">
              <span class="label">状态:</span>
              <NTag
                :type="
                  currentTask.status === 'completed' ? 'success' : 'warning'
                "
                size="small"
              >
                {{ currentTask.status }}
              </NTag>
            </div>
            <div
              v-if="currentTask.progress"
              class="info-row"
            >
              <span class="label">进度:</span>
              <NProgress
                :percentage="currentTask.progress.percentage"
                :processing="currentTask.status === 'processing'"
                style="width: 150px"
              />
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.master-mix-page {
  padding: 24px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
  margin-top: 24px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.console-card {
  min-height: 400px;
}

.add-track-section {
  margin-top: 16px;
}

.section-label {
  display: block;
  margin-bottom: 12px;
  font-weight: 500;
  color: var(--text-color-base);
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-item {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.config-item:last-child {
  border-bottom: none;
}

.config-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}

.config-desc {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: #f8f8f8;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--primary-color);
}

.task-info {
  padding: 8px 0;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.info-row .label {
  color: #666;
  min-width: 50px;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>

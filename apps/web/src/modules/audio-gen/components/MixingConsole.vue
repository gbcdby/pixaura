<script setup lang="ts">
import {
  NSpace,
  NSlider,
  NSwitch,
  NButton,
  NTag,
  NInput,
  NDivider,
  NIcon,
  NTooltip,
} from "naive-ui";
import {
  VolumeMuteOutline,
  VolumeHighOutline,
  MusicalNotesOutline,
  MicOutline,
  EarOutline,
  CloseOutline,
} from "@vicons/ionicons5";
import type { MixTrack } from "@pixaura/shared-types";
import {
  AUDIO_TRACK_TYPE_DESCRIPTIONS,
  AudioTrackType,
} from "@pixaura/shared-types";

const props = defineProps<{
  tracks: MixTrack[];
}>();

const emit = defineEmits<{
  "update:track": [trackId: string, updates: Partial<MixTrack>];
  "remove:track": [trackId: string];
}>();

// 轨道颜色映射
const trackColors: Record<string, string> = {
  [AudioTrackType.DIALOGUE]: "#18a058",
  [AudioTrackType.NARRATION]: "#2080f0",
  [AudioTrackType.BGM]: "#f0a020",
  [AudioTrackType.AMBIENCE]: "#8a2be2",
  [AudioTrackType.SFX]: "#ff69b4",
};

// 轨道图标映射
const trackIcons: Record<string, typeof VolumeHighOutline> = {
  [AudioTrackType.DIALOGUE]: MicOutline,
  [AudioTrackType.NARRATION]: MicOutline,
  [AudioTrackType.BGM]: MusicalNotesOutline,
  [AudioTrackType.AMBIENCE]: EarOutline,
  [AudioTrackType.SFX]: VolumeHighOutline,
};

function getTrackColor(type: string): string {
  return trackColors[type] || "#999";
}

function getTrackIcon(type: string) {
  return trackIcons[type] || VolumeHighOutline;
}

function getTrackLabel(type: string): string {
  return AUDIO_TRACK_TYPE_DESCRIPTIONS[type as AudioTrackType]?.label || type;
}

function updateVolume(trackId: string, volume: number) {
  emit("update:track", trackId, { volume });
}

function toggleMute(trackId: string, currentVolume: number) {
  if (currentVolume > 0) {
    emit("update:track", trackId, { volume: 0 });
  } else {
    // 恢复默认音量
    const track = props.tracks.find((t) => t.trackId === trackId);
    if (track) {
      const defaultVolume =
        AUDIO_TRACK_TYPE_DESCRIPTIONS[track.trackType]?.defaultVolume || 0.5;
      emit("update:track", trackId, { volume: defaultVolume });
    }
  }
}

function updateTimeRange(trackId: string, startTime: number, endTime: number) {
  emit("update:track", trackId, { startTime, endTime });
}

function removeTrack(trackId: string) {
  emit("remove:track", trackId);
}

const volumeMarks = {
  0: "0%",
  0.25: "25%",
  0.5: "50%",
  0.75: "75%",
  1: "100%",
};
</script>

<template>
  <div class="mixing-console">
    <div
      v-if="tracks.length === 0"
      class="empty-state"
    >
      <NEmpty description="暂无轨道，请添加轨道开始混音" />
    </div>

    <div
      v-else
      class="tracks-container"
    >
      <div
        v-for="(track, index) in tracks"
        :key="track.trackId"
        class="track-channel"
        :style="{ borderLeftColor: getTrackColor(track.trackType) }"
      >
        <!-- 轨道头部 -->
        <div class="track-header">
          <div class="track-info">
            <NIcon
              :component="getTrackIcon(track.trackType)"
              :color="getTrackColor(track.trackType)"
              size="18"
            />
            <span class="track-name">{{ getTrackLabel(track.trackType) }}</span>
            <NTag
              size="tiny"
              :color="{
                color: getTrackColor(track.trackType),
                textColor: '#fff',
              }"
            >
              {{ index + 1 }}
            </NTag>
          </div>
          <NButton
            text
            size="tiny"
            type="error"
            @click="removeTrack(track.trackId)"
          >
            <template #icon>
              <NIcon :component="CloseOutline" />
            </template>
          </NButton>
        </div>

        <NDivider style="margin: 8px 0" />

        <!-- 时间范围 -->
        <div class="time-range">
          <div class="time-inputs">
            <div class="time-field">
              <label>开始</label>
              <NInput
                :value="String(track.startTime)"
                size="tiny"
                style="width: 60px"
                @update:value="
                  (v) =>
                    updateTimeRange(track.trackId, Number(v), track.endTime)
                "
              >
                <template #suffix>
                  s
                </template>
              </NInput>
            </div>
            <div class="time-field">
              <label>结束</label>
              <NInput
                :value="String(track.endTime)"
                size="tiny"
                style="width: 60px"
                @update:value="
                  (v) =>
                    updateTimeRange(track.trackId, track.startTime, Number(v))
                "
              >
                <template #suffix>
                  s
                </template>
              </NInput>
            </div>
          </div>
        </div>

        <!-- 音量控制 -->
        <div class="volume-control">
          <div class="volume-header">
            <NButton
              text
              size="tiny"
              @click="toggleMute(track.trackId, track.volume)"
            >
              <template #icon>
                <NIcon
                  :component="
                    track.volume > 0 ? VolumeHighOutline : VolumeMuteOutline
                  "
                  :color="
                    track.volume > 0 ? getTrackColor(track.trackType) : '#999'
                  "
                />
              </template>
            </NButton>
            <span class="volume-value">{{ Math.round(track.volume * 100) }}%</span>
          </div>
          <NSlider
            :value="track.volume"
            :min="0"
            :max="1"
            :step="0.01"
            :marks="volumeMarks"
            style="margin-top: 8px"
            @update:value="(v) => updateVolume(track.trackId, v)"
          />
        </div>

        <!-- 避让设置（仅BGM显示） -->
        <div
          v-if="track.trackType === AudioTrackType.BGM"
          class="ducking-control"
        >
          <NTooltip>
            <template #trigger>
              <NSpace
                align="center"
                size="small"
              >
                <NSwitch
                  :value="!!track.ducking"
                  size="small"
                  @update:value="
                    (enabled) =>
                      emit('update:track', track.trackId, {
                        ducking: enabled
                          ? {
                            triggerBy: [AudioTrackType.DIALOGUE],
                            reductionDb: 20,
                          }
                          : undefined,
                      })
                  "
                />
                <span class="ducking-label">对白避让</span>
              </NSpace>
            </template>
            当对白存在时自动降低BGM音量
          </NTooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mixing-console {
  width: 100%;
}

.empty-state {
  padding: 48px 0;
  text-align: center;
}

.tracks-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.track-channel {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px 16px;
  border-left: 4px solid;
  transition: all 0.2s;
}

.track-channel:hover {
  background: #f0f0f0;
}

.track-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.track-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-name {
  font-weight: 500;
  font-size: 14px;
}

.time-range {
  margin: 8px 0;
}

.time-inputs {
  display: flex;
  gap: 16px;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-field label {
  font-size: 11px;
  color: #999;
}

.volume-control {
  margin-top: 8px;
}

.volume-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-value {
  font-size: 12px;
  color: #666;
  min-width: 40px;
}

.ducking-control {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #ddd;
}

.ducking-label {
  font-size: 12px;
  color: #666;
}

:deep(.n-slider-mark) {
  font-size: 10px;
  color: #999;
}
</style>

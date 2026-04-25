<template>
  <div class="property-panel">
    <n-tabs
      v-model:value="activeTab"
      type="line"
      size="small"
    >
      <n-tab-pane
        name="subtitle"
        tab="字幕"
        :disabled="!subtitle"
      >
        <div
          v-if="subtitle"
          class="panel-content"
        >
          <div class="section">
            <div class="section-title">
              时间设置
            </div>
            <n-form-item
              label="开始时间"
              label-placement="left"
              label-width="70"
            >
              <n-input-number
                v-model:value="startTime"
                :min="0"
                :step="0.1"
                :precision="2"
                size="small"
                @update:value="updateStartTime"
              >
                <template #suffix>
                  s
                </template>
              </n-input-number>
            </n-form-item>
            <n-form-item
              label="结束时间"
              label-placement="left"
              label-width="70"
            >
              <n-input-number
                v-model:value="endTime"
                :min="0"
                :step="0.1"
                :precision="2"
                size="small"
                @update:value="updateEndTime"
              >
                <template #suffix>
                  s
                </template>
              </n-input-number>
            </n-form-item>
            <n-form-item
              label="时长"
              label-placement="left"
              label-width="70"
            >
              <n-input-number
                v-model:value="duration"
                :min="0.1"
                :step="0.1"
                :precision="2"
                size="small"
                readonly
              >
                <template #suffix>
                  s
                </template>
              </n-input-number>
            </n-form-item>
          </div>

          <div class="section">
            <div class="section-title">
              字幕内容
            </div>
            <n-input
              v-model:value="text"
              type="textarea"
              :rows="4"
              placeholder="输入字幕内容..."
              @blur="updateText"
            />
          </div>

          <div class="section">
            <div class="section-title">
              样式覆盖
            </div>
            <n-form-item
              label="字体"
              label-placement="left"
              label-width="70"
            >
              <n-select
                v-model:value="styleOverride.fontFamily"
                :options="fontOptions"
                size="small"
                clearable
                @update:value="updateStyleOverride"
              />
            </n-form-item>
            <n-form-item
              label="字号"
              label-placement="left"
              label-width="70"
            >
              <n-input-number
                v-model:value="styleOverride.fontSize"
                :min="12"
                :max="72"
                size="small"
                clearable
                @update:value="updateStyleOverride"
              />
            </n-form-item>
            <n-form-item
              label="颜色"
              label-placement="left"
              label-width="70"
            >
              <n-color-picker
                v-model:value="styleOverride.color"
                size="small"
                clearable
                @update:value="updateStyleOverride"
              />
            </n-form-item>
          </div>

          <n-space>
            <n-button
              type="primary"
              size="small"
              @click="handleSplit"
            >
              分割字幕
            </n-button>
            <n-button
              size="small"
              @click="handleSaveAsPreset"
            >
              保存为预设
            </n-button>
          </n-space>
        </div>

        <n-empty
          v-else
          description="选择一个字幕进行编辑"
          size="small"
        />
      </n-tab-pane>

      <n-tab-pane
        name="track"
        tab="轨道"
      >
        <div
          v-if="track"
          class="panel-content"
        >
          <div class="section">
            <div class="section-title">
              轨道样式
            </div>
            <n-form-item
              label="字体"
              label-placement="left"
              label-width="70"
            >
              <n-select
                v-model:value="trackStyle.fontFamily"
                :options="fontOptions"
                size="small"
                @update:value="updateTrackStyle"
              />
            </n-form-item>
            <n-form-item
              label="字号"
              label-placement="left"
              label-width="70"
            >
              <n-slider
                v-model:value="trackStyle.fontSize"
                :min="12"
                :max="72"
                @update:value="updateTrackStyle"
              />
              <span class="slider-value">{{ trackStyle.fontSize }}px</span>
            </n-form-item>
            <n-form-item
              label="颜色"
              label-placement="left"
              label-width="70"
            >
              <n-color-picker
                v-model:value="trackStyle.color"
                size="small"
                @update:value="updateTrackStyle"
              />
            </n-form-item>
            <n-form-item
              label="描边"
              label-placement="left"
              label-width="70"
            >
              <n-switch
                v-model:value="trackStyle.outlineEnabled"
                @update:value="updateTrackStyle"
              />
            </n-form-item>
            <template v-if="trackStyle.outlineEnabled">
              <n-form-item
                label="描边色"
                label-placement="left"
                label-width="70"
              >
                <n-color-picker
                  v-model:value="trackStyle.outlineColor"
                  size="small"
                  @update:value="updateTrackStyle"
                />
              </n-form-item>
              <n-form-item
                label="描边宽"
                label-placement="left"
                label-width="70"
              >
                <n-slider
                  v-model:value="trackStyle.outlineWidth"
                  :min="0"
                  :max="5"
                  @update:value="updateTrackStyle"
                />
                <span class="slider-value">{{ trackStyle.outlineWidth }}px</span>
              </n-form-item>
            </template>
          </div>

          <div class="section">
            <div class="section-title">
              位置对齐
            </div>
            <n-form-item
              label="位置"
              label-placement="left"
              label-width="70"
            >
              <n-radio-group
                v-model:value="trackStyle.position"
                size="small"
                @update:value="updateTrackStyle"
              >
                <n-radio-button value="top">
                  顶部
                </n-radio-button>
                <n-radio-button value="middle">
                  中间
                </n-radio-button>
                <n-radio-button value="bottom">
                  底部
                </n-radio-button>
              </n-radio-group>
            </n-form-item>
            <n-form-item
              label="对齐"
              label-placement="left"
              label-width="70"
            >
              <n-radio-group
                v-model:value="trackStyle.alignment"
                size="small"
                @update:value="updateTrackStyle"
              >
                <n-radio-button value="left">
                  左
                </n-radio-button>
                <n-radio-button value="center">
                  中
                </n-radio-button>
                <n-radio-button value="right">
                  右
                </n-radio-button>
              </n-radio-group>
            </n-form-item>
          </div>

          <div class="section">
            <div class="section-title">
              快速应用预设
            </div>
            <n-space wrap>
              <n-button
                v-for="preset in presets"
                :key="preset.id"
                size="small"
                @click="$emit('apply-preset', preset.id)"
              >
                {{ preset.name }}
              </n-button>
            </n-space>
          </div>
        </div>

        <n-empty
          v-else
          description="选择一个轨道进行编辑"
          size="small"
        />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type {
  SubtitleItemResponse,
  SubtitleTrackResponse,
  SubtitlePresetResponse,
  UpdateSubtitleItemDto,
  SubtitleExtendedStyle,
} from "@pixaura/shared-types";

interface Props {
  subtitle: SubtitleItemResponse | null;
  track: SubtitleTrackResponse | null;
  presets: SubtitlePresetResponse[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update-subtitle": [dto: UpdateSubtitleItemDto];
  "update-track": [style: Partial<SubtitleExtendedStyle>];
  "apply-preset": [presetId: string];
  "save-preset": [style: Partial<SubtitleExtendedStyle>];
  split: [];
}>();

const activeTab = ref("subtitle");

// 字幕编辑状态
const startTime = ref(0);
const endTime = ref(0);
const text = ref("");
const styleOverride = ref<Partial<SubtitleExtendedStyle>>({});

// 轨道样式状态
const trackStyle = ref<Partial<SubtitleExtendedStyle>>({
  fontFamily: "Noto Sans SC",
  fontSize: 24,
  color: "#FFFFFF",
  outlineEnabled: true,
  outlineColor: "#000000",
  outlineWidth: 2,
  position: "bottom",
  alignment: "center",
});

const duration = computed(() => {
  return Math.max(0, endTime.value - startTime.value);
});

const fontOptions = [
  { label: "思源黑体", value: "Noto Sans SC" },
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "宋体", value: "SimSun" },
  { label: "黑体", value: "SimHei" },
  { label: "PingFang SC", value: "PingFang SC" },
];

// 同步字幕数据
watch(
  () => props.subtitle,
  (newSubtitle) => {
    if (newSubtitle) {
      startTime.value = newSubtitle.startTime;
      endTime.value = newSubtitle.endTime;
      text.value = newSubtitle.text;
      styleOverride.value = { ...(newSubtitle.styleOverride || {}) };
    }
  },
  { immediate: true },
);

// 同步轨道样式数据
watch(
  () => props.track,
  (newTrack) => {
    if (newTrack?.style) {
      trackStyle.value = { ...trackStyle.value, ...newTrack.style };
    }
  },
  { immediate: true },
);

function updateStartTime(value: number | null) {
  if (value !== null) {
    emit("update-subtitle", { startTime: value });
  }
}

function updateEndTime(value: number | null) {
  if (value !== null) {
    emit("update-subtitle", { endTime: value });
  }
}

function updateText() {
  emit("update-subtitle", { text: text.value });
}

function updateStyleOverride() {
  emit("update-subtitle", {
    styleOverride: styleOverride.value,
  });
}

function updateTrackStyle() {
  emit("update-track", { ...trackStyle.value });
}

function handleSplit() {
  emit("split");
}

function handleSaveAsPreset() {
  emit("save-preset", { ...trackStyle.value });
}
</script>

<style scoped>
.property-panel {
  height: 100%;
  padding: 12px;
}

.panel-content {
  padding-top: 12px;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.slider-value {
  font-size: 12px;
  color: #888;
  margin-left: 8px;
  min-width: 40px;
}
</style>

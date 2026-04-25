<script setup lang="ts">
/**
 * 音色选择器组件
 * 用于选择 TTS 音色，支持分类展示和试听功能
 */
import { ref, computed, onMounted, nextTick, watch } from "vue";
import {
  NTabs,
  NTabPane,
  NInput,
  NIcon,
  NButton,
  NEmpty,
  NSpin,
  NTag,
  NTooltip,
} from "naive-ui";
import { Search, VolumeHigh } from "@vicons/ionicons5";

// 音色类型定义
export interface TTSVoice {
  id: string;
  voiceId: string;
  name: string;
  nameEn?: string;
  gender: "female" | "male" | "child" | "dialect";
  category?: "standard" | "dialect";
  style?: string;
  previewAudioUrl?: string;
  isActive: boolean;
}

interface Props {
  modelValue?: string; // 选中的音色 ID
  disabled?: boolean;
  // 外部传入的音色列表（从 API 加载后传入）
  voices?: TTSVoice[];
  loading?: boolean;
  // Popover 是否显示（用于触发定位）
  popoverVisible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  disabled: false,
  voices: () => [],
  loading: false,
  popoverVisible: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", voiceId: string | undefined): void;
  (e: "change", voice: TTSVoice | undefined): void;
}>();

// 当前选中的 Tab
const activeTab = ref<"female" | "male" | "child" | "dialect">("female");

// 搜索关键词
const searchKeyword = ref("");

// 当前播放的音频
const playingVoiceId = ref<string | null>(null);
const audioElement = ref<HTMLAudioElement | null>(null);

// 分类 Tab 配置
const tabConfig = [
  { name: "female" as const, label: "女声" },
  { name: "male" as const, label: "男声" },
  { name: "child" as const, label: "童声" },
  { name: "dialect" as const, label: "方言" },
];

// 过滤后的音色列表
const filteredVoices = computed(() => {
  let list = props.voices.filter((v) => v.isActive);

  // 按 Tab 分类过滤
  if (activeTab.value === "dialect") {
    list = list.filter((v) => v.category === "dialect");
  } else {
    list = list.filter(
      (v) => v.gender === activeTab.value && v.category !== "dialect",
    );
  }

  // 搜索过滤
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    list = list.filter(
      (v) =>
        v.name.toLowerCase().includes(keyword) ||
        v.nameEn?.toLowerCase().includes(keyword) ||
        v.style?.toLowerCase().includes(keyword),
    );
  }

  return list;
});

// 当前选中的音色信息
const selectedVoice = computed(() => {
  return props.voices.find((v) => v.voiceId === props.modelValue);
});

// 选择音色
function selectVoice(voice: TTSVoice) {
  if (props.disabled || !voice.isActive) return;
  emit("update:modelValue", voice.voiceId);
  emit("change", voice);
}

// 播放试听
async function playPreview(voice: TTSVoice, event: Event) {
  event.stopPropagation();

  if (!voice.previewAudioUrl) return;

  // 停止当前播放
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value = null;
  }

  // 如果点击的是正在播放的，则停止
  if (playingVoiceId.value === voice.voiceId) {
    playingVoiceId.value = null;
    return;
  }

  // 使用后端代理接口解决跨域问题
  playingVoiceId.value = voice.voiceId;
  // 添加时间戳参数防止浏览器缓存错误响应
  const proxyUrl = `/api/tts/voices/${voice.id}/preview-audio?t=${Date.now()}`;

  try {
    // 使用 fetch 获取音频数据，绕过 Vite 代理对流式响应的处理问题
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`获取音频失败: ${response.status}`);
    }
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    audioElement.value = new Audio(audioUrl);
    audioElement.value.onended = () => {
      playingVoiceId.value = null;
      URL.revokeObjectURL(audioUrl);
    };
    audioElement.value.onerror = () => {
      playingVoiceId.value = null;
      URL.revokeObjectURL(audioUrl);
    };
    audioElement.value.play();
  } catch (error) {
    console.error("播放试听音频失败:", error);
    playingVoiceId.value = null;
  }
}

// 检查是否选中
function isSelected(voice: TTSVoice): boolean {
  return props.modelValue === voice.voiceId;
}

// 检查是否正在播放
function isPlaying(voice: TTSVoice): boolean {
  return playingVoiceId.value === voice.voiceId;
}

// 停止音频播放（供外部调用）
function stopAudio() {
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value = null;
  }
  playingVoiceId.value = null;
}

// 定位到选中项的 tab 并滚动
function scrollToSelectedItem() {
  const selected = selectedVoice.value;
  if (!selected) return;

  // 切换到对应的 tab
  if (selected.category === "dialect") {
    activeTab.value = "dialect";
  } else {
    activeTab.value = selected.gender as
      | "female"
      | "male"
      | "child"
      | "dialect";
  }

  // 等待 DOM 更新后滚动到选中项
  nextTick(() => {
    const voiceGrid = document.querySelector(".voice-grid");
    if (!voiceGrid) return;

    const selectedCard = voiceGrid.querySelector(".voice-card.selected");
    if (selectedCard) {
      selectedCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

// 监听 popover 打开和 voices 数据准备，定位到选中项
watch(
  [() => props.popoverVisible, () => props.voices.length],
  ([visible, voicesLength]) => {
    if (visible && voicesLength > 0 && props.modelValue) {
      // 使用 setTimeout 确保 DOM 完全渲染后再执行
      setTimeout(() => scrollToSelectedItem(), 0);
    }
  },
  { immediate: true },
);

// 组件销毁时停止播放
onMounted(() => {
  return () => {
    stopAudio();
  };
});

// 暴露方法供外部调用
defineExpose({
  stopAudio,
});
</script>

<template>
  <div class="voice-selector">
    <!-- 搜索框 -->
    <NInput
      v-model:value="searchKeyword"
      placeholder="搜索音色..."
      clearable
      size="small"
      class="search-input"
    >
      <template #prefix>
        <NIcon><Search /></NIcon>
      </template>
    </NInput>

    <!-- 分类 Tab -->
    <NTabs
      v-model:value="activeTab"
      type="line"
      size="small"
    >
      <NTabPane
        v-for="tab in tabConfig"
        :key="tab.name"
        :name="tab.name"
        :tab="tab.label"
      >
        <!-- 加载状态 -->
        <NSpin
          v-if="loading"
          size="small"
          class="loading-spin"
        />

        <!-- 空状态 -->
        <NEmpty
          v-else-if="filteredVoices.length === 0"
          description="暂无音色"
          size="small"
        />

        <!-- 音色列表 -->
        <div
          v-else
          class="voice-grid"
        >
          <div
            v-for="voice in filteredVoices"
            :key="voice.voiceId"
            class="voice-card"
            :class="{
              selected: isSelected(voice),
              disabled: !voice.isActive || disabled,
            }"
            @click="selectVoice(voice)"
          >
            <div class="voice-info">
              <span class="voice-name">{{ voice.name }}</span>
            </div>
            <NTag
              v-if="voice.style"
              size="small"
              type="info"
              :bordered="false"
            >
              {{ voice.style }}
            </NTag>
            <div class="voice-actions">
              <!-- 试听按钮 -->
              <NTooltip v-if="voice.previewAudioUrl">
                <template #trigger>
                  <NButton
                    text
                    size="tiny"
                    :type="isPlaying(voice) ? 'primary' : 'default'"
                    @click="playPreview(voice, $event)"
                  >
                    <NIcon>
                      <VolumeHigh />
                    </NIcon>
                  </NButton>
                </template>
                {{ isPlaying(voice) ? "停止" : "试听" }}
              </NTooltip>
            </div>
          </div>
        </div>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped lang="scss">
.voice-selector {
  .search-input {
    margin-bottom: 12px;
  }

  .loading-spin {
    display: flex;
    justify-content: center;
    padding: 20px;
  }

  .voice-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 300px;
    overflow-y: auto;
    padding: 4px;
  }

  .voice-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid #e0e0e6;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(.disabled) {
      border-color: #18a058;
      background-color: #f6ffed;
    }

    &.selected {
      border-color: #18a058;
      background-color: #f6ffed;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .voice-info {
      flex: 1;

      .voice-name {
        font-size: 13px;
        font-weight: 500;
      }
    }

    .voice-actions {
      display: flex;
      align-items: center;
    }
  }
}
</style>

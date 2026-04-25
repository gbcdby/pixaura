<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NPageHeader,
  NCard,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NButton,
  NEmpty,
  NGrid,
  NGridItem,
  NPagination,
  useMessage,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { useAudioGenerationStore } from "@/stores/audioGeneration";
import { EMOTION_TYPE_DESCRIPTIONS } from "@pixaura/shared-types";
import BGMCard from "@/modules/audio-gen/components/BGMCard.vue";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const audioStore = useAudioGenerationStore();

const { bgmLoading } = storeToRefs(audioStore);

const projectId = computed(() => route.params.id as string);

// 搜索和筛选
const searchKeyword = ref("");
const selectedEmotion = ref<string | null>(null);
const selectedStyle = ref<string | null>(null);
const selectedTempo = ref<string | null>(null);

// 分页
const currentPage = ref(1);
const pageSize = ref(12);

// 模拟BGM数据
const bgmList = ref([
  {
    id: "bgm-1",
    title: "温馨日常",
    artist: "AI Composer",
    duration: 120,
    emotion: "happy",
    style: "light",
    tempo: 90,
    url: "https://example.com/bgm1.mp3",
    cover: "",
  },
  {
    id: "bgm-2",
    title: "紧张追逐",
    artist: "AI Composer",
    duration: 85,
    emotion: "excited",
    style: "epic",
    tempo: 140,
    url: "https://example.com/bgm2.mp3",
    cover: "",
  },
  {
    id: "bgm-3",
    title: "悲伤离别",
    artist: "AI Composer",
    duration: 150,
    emotion: "sad",
    style: "emotional",
    tempo: 70,
    url: "https://example.com/bgm3.mp3",
    cover: "",
  },
  {
    id: "bgm-4",
    title: "悬疑推理",
    artist: "AI Composer",
    duration: 180,
    emotion: "fearful",
    style: "tense",
    tempo: 100,
    url: "https://example.com/bgm4.mp3",
    cover: "",
  },
  {
    id: "bgm-5",
    title: "浪漫邂逅",
    artist: "AI Composer",
    duration: 200,
    emotion: "happy",
    style: "romantic",
    tempo: 80,
    url: "https://example.com/bgm5.mp3",
    cover: "",
  },
  {
    id: "bgm-6",
    title: "愤怒爆发",
    artist: "AI Composer",
    duration: 95,
    emotion: "angry",
    style: "epic",
    tempo: 160,
    url: "https://example.com/bgm6.mp3",
    cover: "",
  },
]);

// 选项
const emotionOptions = [
  { label: "全部情绪", value: "" },
  ...Object.entries(EMOTION_TYPE_DESCRIPTIONS).map(([key, value]) => ({
    label: `${value.emoji} ${value.label}`,
    value: key,
  })),
];

const styleOptions = [
  { label: "全部风格", value: "" },
  { label: "轻快 Light", value: "light" },
  { label: "史诗 Epic", value: "epic" },
  { label: "情感 Emotional", value: "emotional" },
  { label: "紧张 Tense", value: "tense" },
  { label: "浪漫 Romantic", value: "romantic" },
  { label: "电子 Electronic", value: "electronic" },
];

const tempoOptions = [
  { label: "全部节拍", value: "" },
  { label: "慢板 (< 80 BPM)", value: "slow" },
  { label: "中板 (80-120 BPM)", value: "medium" },
  { label: "快板 (> 120 BPM)", value: "fast" },
];

// 筛选后的BGM列表
const filteredBGMList = computed(() => {
  let result = bgmList.value;

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(
      (bgm) =>
        bgm.title.toLowerCase().includes(keyword) ||
        bgm.artist.toLowerCase().includes(keyword),
    );
  }

  if (selectedEmotion.value) {
    result = result.filter((bgm) => bgm.emotion === selectedEmotion.value);
  }

  if (selectedStyle.value) {
    result = result.filter((bgm) => bgm.style === selectedStyle.value);
  }

  if (selectedTempo.value) {
    result = result.filter((bgm) => {
      if (selectedTempo.value === "slow") return bgm.tempo < 80;
      if (selectedTempo.value === "medium")
        return bgm.tempo >= 80 && bgm.tempo <= 120;
      if (selectedTempo.value === "fast") return bgm.tempo > 120;
      return true;
    });
  }

  return result;
});

// 分页后的列表
const paginatedBGMList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredBGMList.value.slice(start, start + pageSize.value);
});

// 总页数
const totalPages = computed(() =>
  Math.ceil(filteredBGMList.value.length / pageSize.value),
);

// 选中的BGM
const selectedBGM = ref<string | null>(null);

// 生成配置
const targetDuration = ref(60);
const needBeatPoints = ref(false);

function handleSelect(bgmId: string) {
  selectedBGM.value = bgmId;
}

async function handleGenerate() {
  if (!selectedBGM.value) {
    message.warning("请先选择一首BGM");
    return;
  }

  const bgm = bgmList.value.find((b) => b.id === selectedBGM.value);
  if (!bgm) return;

  try {
    // 构建情绪曲线（简单版本：基于BGM的情绪）
    const emotionCurve = [
      {
        time: 0,
        emotion: bgm.emotion,
        intensity: 0.8,
      },
      {
        time: targetDuration.value / 2,
        emotion: bgm.emotion,
        intensity: 1.0,
      },
      {
        time: targetDuration.value,
        emotion: bgm.emotion,
        intensity: 0.6,
      },
    ];

    const result = await audioStore.createBGM(projectId.value, {
      config: {
        emotionCurve,
        duration: targetDuration.value,
        style: bgm.style,
        tempo: bgm.tempo,
        needBeatPoints: needBeatPoints.value,
      },
      notifyWs: true,
    });

    message.success(`BGM生成任务已创建: ${result.taskId}`);
  } catch (error: any) {
    message.error(error.message || "创建任务失败");
  }
}

function handleReset() {
  searchKeyword.value = "";
  selectedEmotion.value = null;
  selectedStyle.value = null;
  selectedTempo.value = null;
  selectedBGM.value = null;
  currentPage.value = 1;
}

function handleBack() {
  router.push(`/projects/${projectId.value}/audio-gen/tasks`);
}
</script>

<template>
  <div class="bgm-select-page">
    <NPageHeader
      title="BGM选择"
      subtitle="选择或生成背景音乐"
      @back="handleBack"
    />

    <div class="content-grid">
      <!-- 左侧：BGM库 -->
      <div class="left-panel">
        <NCard
          title="BGM库"
          class="bgm-library-card"
        >
          <!-- 筛选栏 -->
          <div class="filter-bar">
            <NInput
              v-model:value="searchKeyword"
              placeholder="搜索BGM名称"
              clearable
              style="width: 200px"
            />
            <NSelect
              v-model:value="selectedEmotion"
              :options="emotionOptions"
              placeholder="情绪"
              clearable
              style="width: 140px"
            />
            <NSelect
              v-model:value="selectedStyle"
              :options="styleOptions"
              placeholder="风格"
              clearable
              style="width: 140px"
            />
            <NSelect
              v-model:value="selectedTempo"
              :options="tempoOptions"
              placeholder="节拍"
              clearable
              style="width: 150px"
            />
            <NButton @click="handleReset">
              重置
            </NButton>
          </div>

          <!-- BGM列表 -->
          <div class="bgm-grid">
            <NGrid
              :cols="3"
              :x-gap="16"
              :y-gap="16"
            >
              <NGridItem
                v-for="bgm in paginatedBGMList"
                :key="bgm.id"
              >
                <BGMCard
                  :bgm="bgm"
                  :selected="selectedBGM === bgm.id"
                  @select="handleSelect"
                />
              </NGridItem>
            </NGrid>
          </div>

          <NEmpty
            v-if="paginatedBGMList.length === 0"
            description="未找到匹配的BGM"
          />

          <!-- 分页 -->
          <div
            v-if="totalPages > 1"
            class="pagination"
          >
            <NPagination
              v-model:page="currentPage"
              :page-count="totalPages"
              :page-size="pageSize"
            />
          </div>
        </NCard>
      </div>

      <!-- 右侧：配置面板 -->
      <div class="right-panel">
        <NCard
          title="生成配置"
          class="config-card"
        >
          <NSpace
            vertical
            size="large"
          >
            <div>
              <label class="form-label">目标时长（秒）</label>
              <NInputNumber
                v-model:value="targetDuration"
                :min="10"
                :max="600"
              />
            </div>

            <div>
              <label class="form-label">节拍点</label>
              <NSpace>
                <NButton
                  :type="needBeatPoints ? 'primary' : 'default'"
                  @click="needBeatPoints = true"
                >
                  需要
                </NButton>
                <NButton
                  :type="!needBeatPoints ? 'primary' : 'default'"
                  @click="needBeatPoints = false"
                >
                  不需要
                </NButton>
              </NSpace>
              <p class="hint">
                节拍点可用于视频卡点
              </p>
            </div>

            <div
              v-if="selectedBGM"
              class="selected-info"
            >
              <label class="form-label">已选择</label>
              <div class="bgm-info">
                <div class="bgm-title">
                  {{ bgmList.find((b) => b.id === selectedBGM)?.title }}
                </div>
                <div class="bgm-meta">
                  {{ bgmList.find((b) => b.id === selectedBGM)?.duration }}s ·
                  {{ bgmList.find((b) => b.id === selectedBGM)?.tempo }} BPM
                </div>
              </div>
            </div>
          </NSpace>
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
              :loading="bgmLoading"
              :disabled="!selectedBGM"
              @click="handleGenerate"
            >
              生成BGM
            </NButton>
            <NButton
              block
              @click="handleBack"
            >
              返回任务列表
            </NButton>
          </NSpace>
        </NCard>

        <NCard
          title="使用提示"
          class="tips-card"
        >
          <ul class="tips-list">
            <li>根据视频情绪选择合适的BGM</li>
            <li>风格会影响音乐的整体感觉</li>
            <li>节拍点可用于对齐镜头切换</li>
            <li>目标时长应匹配视频长度</li>
          </ul>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bgm-select-page {
  padding: 24px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: 24px;
  margin-top: 24px;
}

.left-panel {
  min-width: 0;
}

.bgm-library-card {
  min-height: 600px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.bgm-grid {
  margin-bottom: 24px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-color-base);
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
}

.selected-info {
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
}

.bgm-info {
  margin-top: 8px;
}

.bgm-title {
  font-weight: 500;
  color: var(--text-color-base);
}

.bgm-meta {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.tips-card {
  background: #f6ffed;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
  color: #666;
  font-size: 13px;
  line-height: 2;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .filter-bar {
    flex-direction: column;
  }

  .filter-bar .n-input,
  .filter-bar .n-select {
    width: 100% !important;
  }
}
</style>

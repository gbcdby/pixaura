<template>
  <div class="batch-video-gen">
    <n-alert
      type="info"
      class="info-alert"
    >
      <n-space
        vertical
        size="small"
      >
        <n-text>批量生成最多支持 10 个分镜同时生成</n-text>
        <n-text depth="3">
          所有分镜将使用相同的生成模式和分辨率配置
        </n-text>
      </n-space>
    </n-alert>

    <n-form
      size="small"
      label-placement="left"
      label-width="80"
      class="config-form"
    >
      <n-form-item label="参考模式">
        <n-radio-group
          v-model:value="config.referenceMode"
          size="small"
        >
          <n-radio-button value="single_reference">
            单张参考图
          </n-radio-button>
          <n-radio-button value="multi_reference">
            多资产参考
          </n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="生成模式">
        <n-radio-group
          v-model:value="config.videoMode"
          size="small"
        >
          <n-radio-button value="audio_reference">
            音频参考
          </n-radio-button>
          <n-radio-button value="lip_sync">
            对口型
          </n-radio-button>
          <n-radio-button value="video_only">
            纯视频
          </n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="分辨率">
        <n-radio-group
          v-model:value="config.outputConfig.resolution"
          size="small"
        >
          <n-radio-button value="480p">
            480P
          </n-radio-button>
          <n-radio-button value="720p">
            720P
          </n-radio-button>
          <n-radio-button value="1080p">
            1080P
          </n-radio-button>
        </n-radio-group>
      </n-form-item>

      <n-form-item label="画面比例">
        <n-radio-group
          v-model:value="config.outputConfig.aspectRatio"
          size="small"
        >
          <n-radio-button value="9:16">
            竖屏
          </n-radio-button>
          <n-radio-button value="16:9">
            横屏
          </n-radio-button>
          <n-radio-button value="1:1">
            方形
          </n-radio-button>
        </n-radio-group>
      </n-form-item>
    </n-form>

    <n-divider />

    <div class="selection-section">
      <n-space
        justify="space-between"
        align="center"
        class="section-header"
      >
        <n-text strong>
          选择分镜 ({{ selectedShots.length }}/10)
        </n-text>
        <n-button
          text
          size="small"
          @click="clearSelection"
        >
          清空选择
        </n-button>
      </n-space>

      <n-data-table
        :columns="columns"
        :data="availableShots"
        :row-key="(row: StoryboardListItemDto) => row.id"
        :checked-row-keys="selectedShots"
        size="small"
        max-height="300"
        @update:checked-row-keys="handleSelectionChange"
      />
    </div>

    <n-space
      justify="center"
      class="action-area"
    >
      <n-button
        type="primary"
        size="large"
        :disabled="!canSubmit"
        :loading="batchLoading"
        @click="handleSubmit"
      >
        <template #icon>
          <n-icon :component="PlayOutline" />
        </template>
        批量生成 ({{ selectedShots.length }} 个)
      </n-button>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useVideoGenStore } from "@/stores/video-gen";
import { PlayOutline } from "@vicons/ionicons5";
import { useMessage } from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import type { StoryboardListItemDto } from "@pixaura/shared-types";

const props = defineProps<{
  projectId: string;
  shots: StoryboardListItemDto[];
}>();

const message = useMessage();
const store = useVideoGenStore();
const { generationConfig: config, batchLoading } = storeToRefs(store);

const selectedShots = ref<string[]>([]);

const availableShots = computed(() => {
  return props.shots.filter((s) => s.status === "generated");
});

const canSubmit = computed(() => {
  return selectedShots.value.length > 0 && selectedShots.value.length <= 10;
});

const columns: DataTableColumns<StoryboardListItemDto> = [
  {
    type: "selection",
  },
  {
    title: "序号",
    key: "sequenceNumber",
    width: 60,
  },
  {
    title: "场景",
    key: "sceneName",
    width: 120,
  },
  {
    title: "描述",
    key: "description",
    ellipsis: true,
  },
  {
    title: "时长",
    key: "duration",
    width: 80,
    render(row) {
      return `${row.duration}s`;
    },
  },
];

function handleSelectionChange(keys: string[]) {
  if (keys.length > 10) {
    message.warning("最多选择 10 个分镜");
    return;
  }
  selectedShots.value = keys;
}

function clearSelection() {
  selectedShots.value = [];
}

async function handleSubmit() {
  if (!canSubmit.value) return;

  try {
    await store.createBatchTasks(props.projectId, selectedShots.value);
    message.success(`已提交 ${selectedShots.value.length} 个分镜的生成任务`);
    clearSelection();
  } catch (error: any) {
    message.error(error.message || "提交失败");
  }
}
</script>

<style scoped>
.batch-video-gen {
  padding: 8px 0;
}

.info-alert {
  margin-bottom: 16px;
}

.config-form {
  margin-bottom: 16px;
}

.selection-section {
  margin-bottom: 16px;
}

.section-header {
  margin-bottom: 12px;
}

.action-area {
  padding-top: 16px;
  border-top: 1px solid var(--n-border-color);
}
</style>

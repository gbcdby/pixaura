<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import { useStoryboardStore } from "@/stores/storyboard";
import { storeToRefs } from "pinia";
import {
  NButton,
  NSelect,
  NCard,
  NEmpty,
  NSpin,
  NTag,
  NSpace,
  NTabs,
  NTabPane,
} from "naive-ui";
import { Plus, Grid3X3, Film } from "lucide-vue-next";
import StoryboardEditor from "./StoryboardEditor.vue";
import StoryboardTimeline from "./StoryboardTimeline.vue";

const route = useRoute();
const storyboardStore = useStoryboardStore();
const { storyboards, total, loading, viewMode, totalDuration } =
  storeToRefs(storyboardStore);

const projectId = route.params.id as string;

// 状态选项
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "待资产", value: "pending_asset" },
  { label: "待生成", value: "ready_for_description" },
  { label: "已生成", value: "generated" },
  { label: "粗剪完成", value: "rough_cut" },
  { label: "音频合成", value: "audio_mixed" },
  { label: "精剪完成", value: "final_cut" },
];

onMounted(() => {
  loadStoryboards();
});

async function loadStoryboards() {
  await storyboardStore.fetchStoryboards(projectId, { page: 1, pageSize: 50 });
}

function handleCreate() {
  storyboardStore.openEditor();
}

function handleEdit(storyboardId: string) {
  storyboardStore.openEditor(storyboardId);
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_asset: "待资产",
    ready_for_description: "待生成",
    generated: "已生成",
    rough_cut: "粗剪",
    audio_mixed: "音频",
    final_cut: "精剪",
    exported: "已导出",
    failed: "失败",
    skipped: "跳过",
  };
  return map[status] || status;
}

function getStatusType(
  status: string,
): "default" | "success" | "warning" | "error" | "info" {
  const map: Record<
    string,
    "default" | "success" | "warning" | "error" | "info"
  > = {
    pending_asset: "warning",
    ready_for_description: "info",
    generated: "success",
    rough_cut: "success",
    audio_mixed: "success",
    final_cut: "success",
    exported: "success",
    failed: "error",
    skipped: "default",
  };
  return map[status] || "default";
}

function getShotTypeLabel(type: string): string {
  const map: Record<string, string> = {
    extreme_wide: "极远景",
    wide: "远景",
    medium: "中景",
    close_up: "近景",
    extreme_close_up: "特写",
    establishing: " establishing",
  };
  return map[type] || type;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`;
}
</script>

<template>
  <div class="storyboard-list">
    <!-- 页面头部 -->
    <div class="header">
      <div class="header-left">
        <h1>分镜管理</h1>
        <span class="stats">
          共 {{ total }} 个分镜，总时长 {{ formatDuration(totalDuration) }}
        </span>
      </div>
      <NSpace>
        <NButton
          type="primary"
          @click="handleCreate"
        >
          <template #icon>
            <Plus :size="16" />
          </template>
          新建分镜
        </NButton>
      </NSpace>
    </div>

    <!-- 筛选栏 -->
    <div class="filters">
      <NSelect
        :value="storyboardStore.filters.status || ''"
        :options="statusOptions"
        placeholder="状态筛选"
        clearable
        style="width: 140px"
        @update:value="
          (v) =>
            storyboardStore.setFilters({
              ...storyboardStore.filters,
              status: v || undefined,
            })
        "
      />

      <NTabs
        :value="viewMode"
        type="segment"
        size="small"
        style="margin-left: auto"
        @update:value="
          (v) => storyboardStore.setViewMode(v as 'grid' | 'timeline')
        "
      >
        <NTabPane
          name="grid"
          tab="网格视图"
        >
          <template #tab>
            <NSpace
              align="center"
              :size="4"
            >
              <Grid3X3 :size="14" />
              <span>网格</span>
            </NSpace>
          </template>
        </NTabPane>
        <NTabPane
          name="timeline"
          tab="时间线"
        >
          <template #tab>
            <NSpace
              align="center"
              :size="4"
            >
              <Film :size="14" />
              <span>时间线</span>
            </NSpace>
          </template>
        </NTabPane>
      </NTabs>
    </div>

    <!-- 分镜列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="storyboards.length === 0 && !loading"
        description="暂无分镜"
      />

      <!-- 网格视图 -->
      <div
        v-else-if="viewMode === 'grid'"
        class="storyboard-grid"
      >
        <NCard
          v-for="sb in storyboards"
          :key="sb.id"
          class="storyboard-card"
          hoverable
          @click="handleEdit(sb.id)"
        >
          <!-- 序号 -->
          <div class="sequence-badge">
            #{{ sb.sequenceNumber }}
          </div>

          <!-- 缩略图 -->
          <div class="image-section">
            <div
              v-if="!sb.thumbnailUrl"
              class="placeholder"
            >
              <span class="placeholder-text">暂无图片</span>
            </div>
            <img
              v-else
              :src="sb.thumbnailUrl"
              alt="分镜图"
            >
          </div>

          <!-- 信息 -->
          <div class="info-section">
            <div class="info-row">
              <NTag
                size="small"
                :type="getStatusType(sb.status)"
              >
                {{ getStatusLabel(sb.status) }}
              </NTag>
              <span class="duration">{{ sb.duration }}秒</span>
            </div>
            <p class="description">
              {{ sb.description }}
            </p>
            <div class="meta">
              <span>{{ getShotTypeLabel(sb.shotType) }}</span>
              <span v-if="sb.characterCount > 0">· {{ sb.characterCount }}人</span>
              <span v-if="sb.sceneName">· {{ sb.sceneName }}</span>
            </div>
          </div>
        </NCard>
      </div>

      <!-- 时间线视图 -->
      <StoryboardTimeline
        v-else
        @edit="handleEdit"
      />
    </NSpin>

    <!-- 编辑器抽屉 -->
    <StoryboardEditor />
  </div>
</template>

<style scoped lang="scss">
.storyboard-list {
  padding: 24px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .header-left {
      display: flex;
      align-items: baseline;
      gap: 16px;

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
      }

      .stats {
        font-size: 14px;
        color: #666;
      }
    }
  }

  .filters {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .storyboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .storyboard-card {
    cursor: pointer;
    position: relative;

    .sequence-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 1;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .image-section {
      height: 160px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      .placeholder {
        color: #999;
        font-size: 14px;
      }

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .info-section {
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .duration {
          font-size: 13px;
          color: #666;
        }
      }

      .description {
        margin: 0 0 8px;
        font-size: 14px;
        color: #333;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.5;
      }

      .meta {
        font-size: 12px;
        color: #999;
      }
    }
  }
}
</style>

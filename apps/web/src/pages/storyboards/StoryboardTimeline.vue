<script setup lang="ts">
import { computed } from "vue";
import { useStoryboardStore } from "@/stores/storyboard";
import { storeToRefs } from "pinia";
import { NEmpty, NTag } from "naive-ui";
import { Clock, Image as ImageIcon } from "lucide-vue-next";

const storyboardStore = useStoryboardStore();
const { storyboards, loading } = storeToRefs(storyboardStore);

const emit = defineEmits<{
  edit: [storyboardId: string];
}>();

// 计算时间线数据
const timelineItems = computed(() => {
  let currentTime = 0;
  return storyboards.value.map((sb) => {
    const item = {
      ...sb,
      startTime: currentTime,
    };
    currentTime += sb.duration || 3;
    return item;
  });
});

// 总时长
const totalDuration = computed(() => {
  return storyboards.value.reduce((sum, sb) => sum + (sb.duration || 3), 0);
});

// 格式化时间显示（秒 -> 分:秒）
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
}

// 获取状态标签
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

// 获取景别标签
function getShotTypeLabel(type: string): string {
  const map: Record<string, string> = {
    extreme_wide: "极远景",
    wide: "远景",
    medium: "中景",
    close_up: "近景",
    extreme_close_up: "特写",
    establishing: "定场",
  };
  return map[type] || type;
}

function handleEdit(storyboardId: string) {
  emit("edit", storyboardId);
}
</script>

<template>
  <div class="storyboard-timeline">
    <NEmpty
      v-if="storyboards.length === 0 && !loading"
      description="暂无分镜"
    />

    <div
      v-else
      class="timeline-container"
    >
      <!-- 时间轴头部 -->
      <div class="timeline-header">
        <div class="timeline-scale">
          <div
            v-for="i in Math.ceil(totalDuration / 10) + 1"
            :key="i"
            class="scale-mark"
            :style="{ left: `${(i - 1) * 100}px` }"
          >
            <span class="scale-label">{{ formatTime((i - 1) * 10) }}</span>
            <div class="scale-line" />
          </div>
        </div>
      </div>

      <!-- 时间轴主体 -->
      <div class="timeline-body">
        <div
          v-for="(item, index) in timelineItems"
          :key="item.id"
          class="timeline-item"
          :style="{
            left: `${item.startTime * 10}px`,
            width: `${(item.duration || 3) * 10}px`,
          }"
          @click="handleEdit(item.id)"
        >
          <!-- 分镜卡片 -->
          <div class="timeline-card">
            <!-- 缩略图 -->
            <div class="card-image">
              <img
                v-if="item.thumbnailUrl"
                :src="item.thumbnailUrl"
                alt="分镜图"
              >
              <div
                v-else
                class="image-placeholder"
              >
                <ImageIcon :size="24" />
              </div>
              <div class="sequence-badge">
                #{{ item.sequenceNumber }}
              </div>
            </div>

            <!-- 信息 -->
            <div class="card-info">
              <div class="info-row">
                <NTag
                  size="tiny"
                  :type="getStatusType(item.status)"
                >
                  {{ getStatusLabel(item.status) }}
                </NTag>
                <span class="duration">
                  <Clock :size="12" />
                  {{ item.duration }}s
                </span>
              </div>
              <p class="description">
                {{ item.description }}
              </p>
              <div class="meta">
                <span>{{ getShotTypeLabel(item.shotType) }}</span>
                <span v-if="item.characterCount > 0">· {{ item.characterCount }}人</span>
              </div>
            </div>
          </div>

          <!-- 连接线 -->
          <div
            v-if="index < timelineItems.length - 1"
            class="connector"
          />
        </div>
      </div>

      <!-- 总时长指示 -->
      <div
        class="total-duration"
        :style="{ left: `${totalDuration * 10}px` }"
      >
        <div class="duration-line" />
        <span class="duration-label">{{ formatTime(totalDuration) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.storyboard-timeline {
  padding: 16px;
  overflow-x: auto;

  .timeline-container {
    position: relative;
    min-width: 100%;
    padding-bottom: 40px;
  }

  .timeline-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--bg-color, #fff);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    margin-bottom: 16px;

    .timeline-scale {
      position: relative;
      height: 30px;

      .scale-mark {
        position: absolute;
        top: 0;
        height: 100%;

        .scale-label {
          font-size: 12px;
          color: #666;
          white-space: nowrap;
        }

        .scale-line {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 1px;
          height: 8px;
          background: #ccc;
        }
      }
    }
  }

  .timeline-body {
    position: relative;
    min-height: 200px;
    padding: 8px 0;

    .timeline-item {
      position: absolute;
      top: 0;
      min-width: 80px;
      cursor: pointer;
      transition: transform 0.2s;

      &:hover {
        transform: translateY(-4px);
        z-index: 5;

        .timeline-card {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      }

      .timeline-card {
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        overflow: hidden;
        transition: box-shadow 0.2s;
        height: 100%;
        display: flex;
        flex-direction: column;

        .card-image {
          position: relative;
          height: 80px;
          background: #f5f5f5;
          overflow: hidden;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .image-placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
          }

          .sequence-badge {
            position: absolute;
            top: 4px;
            left: 4px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
        }

        .card-info {
          padding: 8px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;

          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .duration {
              font-size: 11px;
              color: #666;
              display: flex;
              align-items: center;
              gap: 2px;
            }
          }

          .description {
            margin: 0;
            font-size: 12px;
            color: #333;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            flex: 1;
          }

          .meta {
            font-size: 11px;
            color: #999;
          }
        }
      }

      .connector {
        position: absolute;
        top: 50%;
        right: -12px;
        width: 12px;
        height: 2px;
        background: #e0e0e0;
        transform: translateY(-50%);

        &::after {
          content: "";
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 0;
          height: 0;
          border-left: 4px solid #e0e0e0;
          border-top: 4px solid transparent;
          border-bottom: 4px solid transparent;
        }
      }
    }
  }

  .total-duration {
    position: absolute;
    bottom: 0;
    transform: translateX(-50%);

    .duration-line {
      width: 2px;
      height: 20px;
      background: #18a058;
      margin: 0 auto;
    }

    .duration-label {
      font-size: 12px;
      color: #18a058;
      font-weight: 600;
    }
  }
}

// 深色模式适配
:deep(.dark) {
  .storyboard-timeline {
    .timeline-header {
      background: var(--bg-color, #1a1a1a);
      border-bottom-color: var(--border-color, #333);

      .timeline-scale .scale-mark .scale-label {
        color: #999;
      }
    }

    .timeline-body .timeline-item .timeline-card {
      background: #2a2a2a;
      border-color: #333;

      .card-image {
        background: #1a1a1a;

        .image-placeholder {
          color: #666;
        }
      }

      .card-info {
        .description {
          color: #e0e0e0;
        }

        .meta {
          color: #666;
        }
      }
    }
  }
}
</style>

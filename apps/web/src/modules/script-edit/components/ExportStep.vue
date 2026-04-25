<script setup lang="ts">
/**
 * 导出步骤组件
 * 使用 FFmpeg.wasm 实现视频导出功能
 */
import { ref, computed, onUnmounted } from "vue";
import {
  NButton,
  NSelect,
  NProgress,
  NIcon,
  NEmpty,
  NSwitch,
  useMessage,
} from "naive-ui";
import {
  DownloadOutline,
  VideocamOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from "@vicons/ionicons5";
import { useVideoExport, getDefaultExportConfig, downloadBlob } from "@/composables/useVideoExport";
import { extractExportData } from "@/modules/script-edit/utils/exportDataExtractor";
import { useScriptEditStore } from "../store/scriptEdit";
import type { StoryboardRef } from "../store/types";
import type { ExportConfig } from "@/types/video-editor-temp";
import type { UnifiedTimelineData } from "@/modules/video-edit/composables/useTimelineBuilder";

// Props
interface Props {
  projectId: string;
  scriptId: string;
  storyboards: StoryboardRef[];
  unifiedTimelineData: UnifiedTimelineData;
}

const props = defineProps<Props>();

// Message
const message = useMessage();

// Store
const scriptEditStore = useScriptEditStore();

// 导出配置
const exportConfig = ref<ExportConfig>(getDefaultExportConfig());

// 导出完成后的视频预览 URL
const exportedVideoUrl = ref<string>("");

// 分辨率选项（匹配 ExportConfig.resolution 类型，FFmpeg.wasm 最高支持 1080p）
// 注意：wasm 版 FFmpeg 内存固定 1GB，1080p 编码容易内存耗尽导致崩溃
const resolutionOptions = [
  { label: "480P", value: "480p" },
  { label: "720P", value: "720p" },
  { label: "1080P", value: "1080p" },
];

// 格式选项
const formatOptions = [
  { label: "MP4", value: "mp4" },
  { label: "WebM", value: "webm" },
];

// FFmpeg 导出 composable
const {
  status: exportStatus,
  progress: exportProgress,
  stage: exportStage,
  error: exportError,
  isLoaded: ffmpegLoaded,
  isLoading: ffmpegLoading,
  loadFFmpeg,
  exportWithSubtitles,
} = useVideoExport({
  onProgress: (p) => {
    console.log(`[ExportStep] 导出进度: ${p}%`);
  },
  onError: (err) => {
    console.error("[ExportStep] 导出错误:", err);
    message.error(`导出失败: ${err.message}`);
  },
});

// 是否可以导出（已有至少一个视频片段生成完成即可导出）
const canExport = computed(() => {
  return (
    props.storyboards.length > 0 &&
    generatedCount.value > 0 &&
    exportStatus.value !== "encoding" &&
    exportStatus.value !== "preparing"
  );
});

// 总视频片段数（按 videoMode 区分）
// - video_only/audio_reference：每个分镜组 1 个片段
// - lip_sync：每个 shot/dialogue 对应 1 个片段
const totalClips = computed(() => {
  return props.storyboards.reduce((total, storyboard) => {
    const videoMode = storyboard.videoMode || 'lip_sync';
    const shots = storyboard.shots || [];
    const dialogues = storyboard.dialogues || [];

    // video_only/audio_reference：分镜组级别，1 个片段
    if (videoMode === 'video_only' || videoMode === 'audio_reference') {
      return total + 1;
    }

    // lip_sync：按 shots 或 dialogues 数量
    if (videoMode === 'lip_sync') {
      if (shots.length > 0) {
        return total + shots.length;
      }
      // 没有 shots 时按 dialogues
      if (dialogues.length > 0) {
        return total + dialogues.length;
      }
      // 兜底：检查 videoGeneration
      const vg = storyboard.videoGeneration;
      return vg?.status ? total + 1 : total;
    }

    return total;
  }, 0);
});

// 已生成视频数量（非黑屏片段）
// - video_only/audio_reference：检查 shotGroup.video.completed
// - lip_sync：检查 shots.completed 数量
const generatedCount = computed(() => {
  return props.storyboards.reduce((count, storyboard) => {
    const videoMode = storyboard.videoMode || 'lip_sync';
    const shots = storyboard.shots || [];

    // video_only/audio_reference：检查分镜组视频
    if (videoMode === 'video_only' || videoMode === 'audio_reference') {
      const video = storyboard.video;
      if (video?.url && video?.status === 'completed') {
        return count + 1;
      }
      // 兼容旧数据：videoGeneration
      const vg = storyboard.videoGeneration;
      if (vg?.videoUrl && vg?.status === 'completed') {
        return count + 1;
      }
      return count;
    }

    // lip_sync：统计 completed shots
    if (videoMode === 'lip_sync') {
      if (shots.length > 0) {
        const completedShots = shots.filter(
          (shot) => shot.status === 'completed' && shot.videoUrl,
        );
        return count + completedShots.length;
      }
      // 没有 shots 时无法判断，返回 0
      return count;
    }

    return count;
  }, 0);
});

// 导出按钮状态文本
const exportButtonText = computed(() => {
  if (ffmpegLoading.value) {
    return "加载 FFmpeg...";
  }
  if (exportStatus.value === "preparing") {
    return "准备素材...";
  }
  if (exportStatus.value === "encoding") {
    return `导出中 ${exportProgress.value}%`;
  }
  if (exportStatus.value === "done") {
    return "导出完成";
  }
  if (exportStatus.value === "error") {
    return "导出失败";
  }
  return "开始导出";
});

// 处理导出
async function handleExport() {
  if (!canExport.value) {
    message.warning("暂无可导出的视频内容");
    return;
  }

  // 确保 FFmpeg 已加载
  if (!ffmpegLoaded.value) {
    await loadFFmpeg();
  }

  try {
    // 构建 ScriptContent
    const content = scriptEditStore.buildContentForSave();

    // 提取导出数据（直接使用统一时间轴数据）
    const exportData = extractExportData(
      content,
      props.projectId,
      props.scriptId,
      props.unifiedTimelineData,
    );

    // 检查是否有视频轨道
    if (exportData.videoTracks.length === 0 || exportData.videoTracks[0].clips.length === 0) {
      message.error("没有可导出的视频片段");
      return;
    }

    // 将用户在 UI 选择的分辨率同步到 timeline，确保导出使用所选分辨率
    exportData.timeline.resolution = exportConfig.value.resolution;

    // 开始导出
    const blob = await exportWithSubtitles(exportData, exportConfig.value);

    if (blob) {
      /* 导出结果预览功能已注释掉 —— 暂不展示导出后视频预览
      if (exportedVideoUrl.value) {
        URL.revokeObjectURL(exportedVideoUrl.value);
      }
      exportedVideoUrl.value = URL.createObjectURL(blob);
      */

      // 下载文件
      const filename = `${scriptEditStore.script?.title || "export"}_${Date.now()}.${exportConfig.value.format}`;
      downloadBlob(blob, filename);
      message.success("视频导出成功！");
    } else {
      message.error(`导出失败: ${exportError.value || "未知错误"}`);
    }
  } catch (err) {
    console.error("[ExportStep] 导出异常:", err);
    message.error(`导出异常: ${(err as Error).message}`);
  }
}

// 重置导出状态
function resetExport() {
  exportStatus.value = "idle";
  exportProgress.value = 0;
  exportStage.value = "";
  exportError.value = undefined;
  if (exportedVideoUrl.value) {
    URL.revokeObjectURL(exportedVideoUrl.value);
    exportedVideoUrl.value = "";
  }
}

// 组件卸载时释放资源
onUnmounted(() => {
  if (exportedVideoUrl.value) {
    URL.revokeObjectURL(exportedVideoUrl.value);
  }
});
</script>

<template>
  <div class="export-step">
    <!-- 无内容提示 -->
    <div
      v-if="storyboards.length === 0"
      class="empty-state"
    >
      <n-empty description="暂无可导出的视频内容">
        <template #icon>
          <n-icon :size="48">
            <VideocamOutline />
          </n-icon>
        </template>
      </n-empty>
    </div>

    <!-- 导出配置 -->
    <div
      v-else
      class="export-content"
    >
      <!-- 配置区域 -->
      <div class="config-section">
        <div class="config-item">
          <label class="config-label">分辨率</label>
          <n-select
            v-model:value="exportConfig.resolution"
            :options="resolutionOptions"
            placeholder="选择分辨率"
            style="width: 200px"
            :disabled="exportStatus === 'encoding'"
          />
        </div>

        <div class="config-item">
          <label class="config-label">格式</label>
          <n-select
            v-model:value="exportConfig.format"
            :options="formatOptions"
            placeholder="选择格式"
            style="width: 120px"
            :disabled="exportStatus === 'encoding'"
          />
        </div>

        <div class="config-item">
          <label class="config-label">导出字幕</label>
          <n-switch
            v-model:value="exportConfig.includeSubtitles"
            :disabled="exportStatus === 'encoding'"
          />
        </div>
      </div>

      <!-- 视频统计信息 -->
      <div class="stats-section">
        <div class="stat-item">
          <span class="stat-label">视频片段</span>
          <span class="stat-value">{{ totalClips }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">已生成</span>
          <span class="stat-value">{{ generatedCount }}</span>
        </div>
      </div>

      <!-- 导出进度 -->
      <div
        v-if="exportStatus !== 'idle'"
        class="progress-section"
      >
        <div class="progress-header">
          <n-icon
            :size="20"
            :color="
              exportStatus === 'done'
                ? '#18a058'
                : exportStatus === 'error'
                  ? '#d03050'
                  : '#2080f0'
            "
          >
            <CheckmarkCircleOutline v-if="exportStatus === 'done'" />
            <CloseCircleOutline v-else-if="exportStatus === 'error'" />
            <VideocamOutline v-else />
          </n-icon>
          <span class="progress-title">{{ exportStage }}</span>
        </div>
        <n-progress
          type="line"
          :percentage="exportProgress"
          :status="
            exportStatus === 'done'
              ? 'success'
              : exportStatus === 'error'
                ? 'error'
                : 'default'
          "
          :show-indicator="true"
          :height="24"
          :border-radius="4"
        />
        <div
          v-if="exportError"
          class="error-message"
        >
          {{ exportError }}
        </div>
      </div>

      <!-- 导出按钮 -->
      <div class="action-section">
        <n-button
          type="primary"
          size="large"
          :disabled="!canExport"
          :loading="exportStatus === 'encoding' || exportStatus === 'preparing' || ffmpegLoading"
          @click="handleExport"
        >
          <template #icon>
            <n-icon>
              <DownloadOutline />
            </n-icon>
          </template>
          {{ exportButtonText }}
        </n-button>

        <!-- 重置按钮（仅在失败时显示） -->
        <n-button
          v-if="exportStatus === 'error'"
          size="large"
          @click="resetExport"
        >
          重新导出
        </n-button>
      </div>

      <!-- 导出结果预览 —— 已注释掉，暂不展示导出后视频预览
      <div
        v-if="exportedVideoUrl"
        class="preview-section"
      >
        <div class="preview-header">
          <n-icon
            :size="16"
            color="#18a058"
          >
            <CheckmarkCircleOutline />
          </n-icon>
          <span class="preview-title">导出结果预览（可对比字幕效果）</span>
        </div>
        <div class="preview-video-wrapper">
          <video
            :src="exportedVideoUrl"
            controls
            class="preview-video"
          />
        </div>
      </div>
      -->

      <!-- 提示信息 -->
      <div class="hint-section">
        <p class="hint-text">
          <n-icon
            :size="14"
            color="#999"
          >
            <VideocamOutline />
          </n-icon>
          导出过程使用浏览器本地处理。1080P 分辨率可能因浏览器内存限制（1GB）导致导出失败，推荐使用 720P。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.export-step {
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  min-height: 200px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.export-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.config-section {
  display: flex;
  gap: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.stats-section {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #eee;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.stat-value {
  font-size: 16px;
  color: #1a1a1a;
  font-weight: 600;
}

.progress-section {
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.progress-title {
  font-size: 14px;
  color: #666;
}

.error-message {
  margin-top: 12px;
  padding: 8px 12px;
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 4px;
  color: #d03050;
  font-size: 13px;
}

.action-section {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.hint-section {
  text-align: center;
}

.hint-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: #999;
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e0e3e7;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.preview-video-wrapper {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 9 / 16;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

@media (max-width: 768px) {
  .config-section {
    flex-direction: column;
    gap: 16px;
  }

  .config-item {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
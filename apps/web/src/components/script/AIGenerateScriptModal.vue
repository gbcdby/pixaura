<script setup lang="ts">
/**
 * AI 生成剧本弹窗组件
 * 支持输入创意、配置参数、显示生成进度和结果预览
 */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NSpace,
  NProgress,
  NSpin,
  NIcon,
  NDivider,
  useMessage,
} from "naive-ui";
import {
  Sparkles,
  Close,
  RefreshOutline,
  CreateOutline,
  CheckmarkCircleOutline,
  DocumentTextOutline,
} from "@vicons/ionicons5";
import { useScriptStore } from "@/modules/script/store";
import { useWebSocketStore } from "@/stores/websocket";
import { WsEventNames } from "@pixaura/shared-types";
import type {
  ScriptGenerateProgressWsData,
  ScriptContent,
} from "@pixaura/shared-types";

interface Props {
  visible: boolean;
  projectId: string;
}

interface Emits {
  (e: "close"): void;
  (e: "success", scriptId: string): void;
  (e: "edit", scriptId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();
const scriptStore = useScriptStore();
const wsStore = useWebSocketStore();

// 存储 WebSocket 取消注册函数
let unregisterWs: (() => void) | null = null;

// 生成阶段：input | generating | completed
const generatePhase = ref<"input" | "generating" | "completed">("input");

// 表单数据
const formData = ref({
  idea: "",
  genre: undefined as string | undefined,
  tone: undefined as string | undefined,
  targetDuration: 5,
  characterCount: 3,
});

// 生成状态
const taskId = ref<string | null>(null);
const scriptId = ref<string | null>(null);
const progress = ref(0);
const streamContent = ref("");
// Phase 4: AI 生成结果中的场景数据包含 name/description（运行时字段）
// 因为生成阶段还没有素材库数据，后端返回临时字段
type GeneratedScene = {
  id: string;
  sceneId: string;
  name?: string;
  description?: string;
};

const generatedResult = ref<{
  title: string;
  content: ScriptContent;
  stats: {
    acts: number;
    scenes: number;
    characters: number;
    props: number;
    duration: number;
  };
} | null>(null);

// 类型选项
const genreOptions = [
  { label: "悬疑", value: "悬疑" },
  { label: "爱情", value: "爱情" },
  { label: "动作", value: "动作" },
  { label: "喜剧", value: "喜剧" },
  { label: "科幻", value: "科幻" },
  { label: "古装", value: "古装" },
  { label: "现代", value: "现代" },
];

const toneOptions = [
  { label: "严肃", value: "严肃" },
  { label: "轻松", value: "轻松" },
  { label: "紧张", value: "紧张" },
  { label: "温馨", value: "温馨" },
  { label: "幽默", value: "幽默" },
  { label: "悬疑", value: "悬疑" },
];

// 字数统计
const ideaLength = computed(() => formData.value.idea.length);
const isIdeaValid = computed(
  () => ideaLength.value >= 10 && ideaLength.value <= 2000,
);

// 是否可以开始生成
const canGenerate = computed(() => {
  return isIdeaValid.value && !scriptStore.aiGenerating;
});

// 处理生成进度
const handleGenerateProgress = (data: unknown) => {
  const progressData = data as ScriptGenerateProgressWsData;
  // 只处理当前任务的进度
  if (progressData.taskId !== taskId.value) return;

  progress.value = progressData.progress || 0;

  if (progressData.status === "streaming" && progressData.chunk) {
    streamContent.value += progressData.chunk;
  } else if (progressData.status === "completed") {
    // 生成完成
    if (progressData.result) {
      const content = progressData.result.content as ScriptContent;
      generatedResult.value = {
        title: progressData.result.title || "未命名剧本",
        content,
        stats: {
          acts: 0, // acts 已移除
          scenes: content.scenes?.length || 0,
          characters: content.characters?.length || 0,
          props: content.props?.length || 0,
          duration: formData.value.targetDuration,
        },
      };
    }
    generatePhase.value = "completed";
    scriptStore.aiGenerating = false;
  } else if (progressData.status === "failed") {
    // 生成失败
    scriptStore.aiGenerating = false;
    message.error(progressData.error?.message || "生成失败，请重试");
    generatePhase.value = "input";
  }
};

// 开始生成
const handleGenerate = async () => {
  if (!canGenerate.value) return;

  try {
    generatePhase.value = "generating";
    progress.value = 0;
    streamContent.value = "";
    scriptStore.aiGenerating = true;

    const response = await scriptStore.generateScript(props.projectId, {
      idea: formData.value.idea,
      genre: formData.value.genre,
      tone: formData.value.tone,
      targetDuration: formData.value.targetDuration,
      characterCount: formData.value.characterCount,
    });

    // 保存任务信息
    taskId.value = (response as unknown as { task: { id: string } }).task?.id;
    scriptId.value = (
      response as unknown as { script: { id: string } }
    ).script?.id;

    // 订阅 WebSocket 进度（通过 wsStore）
    if (taskId.value && scriptId.value) {
      wsStore.subscribeScriptTask(taskId.value, scriptId.value, "generate");
    }
  } catch (error: unknown) {
    scriptStore.aiGenerating = false;
    generatePhase.value = "input";

    const err = error as { code?: number; message?: string };
    if (err.code === 6023) {
      message.error("额度不足，请充值后再试");
    } else {
      message.error(err.message || "生成失败，请稍后重试");
    }
  }
};

// 取消生成
const handleCancel = async () => {
  if (taskId.value && scriptId.value) {
    try {
      await scriptStore.cancelAITask(
        props.projectId,
        scriptId.value,
        taskId.value,
      );
      message.info("已取消生成");
    } catch (error) {
      console.error("取消生成失败:", error);
    }
  }
  generatePhase.value = "input";
  scriptStore.aiGenerating = false;
};

// 重新生成
const handleRegenerate = () => {
  generatePhase.value = "input";
  progress.value = 0;
  streamContent.value = "";
  generatedResult.value = null;
};

// 直接创建（跳转到确认页）
const handleCreate = () => {
  if (scriptId.value) {
    emit("success", scriptId.value);
    handleClose();
  }
};

// 继续编辑（跳转到编辑页）
const handleEdit = () => {
  if (scriptId.value) {
    emit("edit", scriptId.value);
    handleClose();
  }
};

// 关闭弹窗
const handleClose = () => {
  if (generatePhase.value === "generating") {
    // 生成中需要确认
    const confirmed = window.confirm("生成任务正在进行中，确定要关闭吗？");
    if (!confirmed) return;
    handleCancel();
  }
  emit("close");
};

// 监听 visible 变化，重置状态
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      generatePhase.value = "input";
      progress.value = 0;
      streamContent.value = "";
      generatedResult.value = null;
      taskId.value = null;
      scriptId.value = null;
    }
  },
);

// 组件挂载时注册 WebSocket 事件处理器
onMounted(() => {
  unregisterWs = wsStore.registerHandler(
    WsEventNames.SCRIPT_GENERATE_PROGRESS,
    handleGenerateProgress,
  );
});

// 组件卸载时取消注册
onUnmounted(() => {
  if (unregisterWs) {
    unregisterWs();
    unregisterWs = null;
  }
});

// 格式化流式内容预览
const formattedPreview = computed(() => {
  if (!streamContent.value) return "";
  try {
    // 尝试解析 JSON 并格式化显示
    const data = JSON.parse(streamContent.value);
    if (data.storyboards && data.storyboards.length > 0) {
      const firstStoryboard = data.storyboards[0];
      return `《${data.title || "未命名"}》\n\n分镜1：${firstStoryboard.title || firstStoryboard.description?.substring(0, 50) || ""}`;
    }
    // 降级为显示 title
    return `《${data.title || "未命名"}》`;
  } catch {
    return streamContent.value;
  }
});
</script>

<template>
  <n-modal
    :show="visible"
    preset="card"
    :style="{ width: '720px', maxWidth: '90vw' }"
    :closable="false"
    :mask-closable="generatePhase !== 'generating'"
    @close="handleClose"
  >
    <template #header>
      <div class="modal-header">
        <n-icon
          size="20"
          :component="Sparkles"
          class="header-icon"
        />
        <span>AI 生成剧本</span>
      </div>
    </template>

    <template #header-extra>
      <n-button
        text
        @click="handleClose"
      >
        <n-icon
          size="20"
          :component="Close"
        />
      </n-button>
    </template>

    <!-- 输入阶段 -->
    <div
      v-if="generatePhase === 'input'"
      class="input-phase"
    >
      <n-form label-placement="top">
        <n-form-item
          label="创意想法"
          required
        >
          <n-input
            v-model:value="formData.idea"
            type="textarea"
            :rows="6"
            placeholder="描述你的创意想法，例如：一个关于时间循环的悬疑短剧，主角每天早上醒来都会回到同一天，直到他找到打破循环的方法..."
            :maxlength="2000"
            show-count
          />
          <div class="input-hint">
            <span :class="{ 'text-error': !isIdeaValid && ideaLength > 0 }">
              已输入 {{ ideaLength }}/2000 字，至少需要10个字
            </span>
          </div>
        </n-form-item>

        <n-form-item label="生成配置">
          <n-space
            :size="16"
            wrap
          >
            <div class="config-item">
              <span class="config-label">类型</span>
              <n-select
                v-model:value="formData.genre"
                :options="genreOptions"
                placeholder="选择类型"
                clearable
                style="width: 140px"
              />
            </div>
            <div class="config-item">
              <span class="config-label">基调</span>
              <n-select
                v-model:value="formData.tone"
                :options="toneOptions"
                placeholder="选择基调"
                clearable
                style="width: 140px"
              />
            </div>
            <div class="config-item">
              <span class="config-label">预估时长</span>
              <n-select
                v-model:value="formData.targetDuration"
                :options="[
                  { label: '1分钟', value: 1 },
                  { label: '3分钟', value: 3 },
                  { label: '5分钟', value: 5 },
                  { label: '8分钟', value: 8 },
                  { label: '10分钟', value: 10 },
                ]"
                style="width: 100px"
              />
            </div>
            <div class="config-item">
              <span class="config-label">主要角色数</span>
              <n-select
                v-model:value="formData.characterCount"
                :options="[
                  { label: '1-2人', value: 2 },
                  { label: '3-5人', value: 4 },
                  { label: '5-8人', value: 6 },
                  { label: '8-10人', value: 9 },
                ]"
                style="width: 100px"
              />
            </div>
          </n-space>
        </n-form-item>
      </n-form>

      <div class="modal-footer">
        <n-space>
          <n-button @click="handleClose">
            取消
          </n-button>
          <n-button
            type="primary"
            size="large"
            :disabled="!canGenerate"
            :loading="scriptStore.aiGenerating"
            @click="handleGenerate"
          >
            <template #icon>
              <n-icon :component="Sparkles" />
            </template>
            开始生成
          </n-button>
        </n-space>
      </div>
    </div>

    <!-- 生成中阶段 -->
    <div
      v-else-if="generatePhase === 'generating'"
      class="generating-phase"
    >
      <n-spin
        :show="true"
        description="正在生成剧本..."
      >
        <div class="progress-section">
          <n-progress
            type="line"
            :percentage="progress"
            :indicator-placement="'inside'"
            :height="24"
            :border-radius="12"
            :fill-border-radius="12"
            :status="'info'"
          />
          <p class="progress-text">
            {{
              progress < 30
                ? "正在构思剧情..."
                : progress < 60
                  ? "正在创作场景..."
                  : progress < 90
                    ? "正在完善对话..."
                    : "即将完成..."
            }}
          </p>
        </div>

        <div class="preview-section">
          <div class="preview-header">
            <n-icon :component="DocumentTextOutline" />
            <span>实时预览</span>
          </div>
          <div class="preview-content">
            <pre v-if="streamContent">{{ formattedPreview }}</pre>
            <div
              v-else
              class="preview-placeholder"
            >
              <n-spin :size="20" />
              <span>正在初始化...</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <n-button @click="handleCancel">
            <template #icon>
              <n-icon :component="Close" />
            </template>
            取消生成
          </n-button>
        </div>
      </n-spin>
    </div>

    <!-- 完成阶段 -->
    <div
      v-else-if="generatePhase === 'completed'"
      class="completed-phase"
    >
      <div class="success-header">
        <n-icon
          size="48"
          :component="CheckmarkCircleOutline"
          class="success-icon"
        />
        <h3>生成完成！</h3>
      </div>

      <div
        v-if="generatedResult"
        class="result-preview"
      >
        <n-card
          :bordered="false"
          class="preview-card"
        >
          <h4 class="script-title">
            《{{ generatedResult.title }}》
          </h4>

          <div class="script-stats">
            <n-space :size="24">
              <div class="stat-item">
                <span class="stat-value">{{
                  generatedResult.stats.scenes
                }}</span>
                <span class="stat-label">分镜</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{
                  generatedResult.stats.scenes
                }}</span>
                <span class="stat-label">场</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{
                  generatedResult.stats.characters
                }}</span>
                <span class="stat-label">角色</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{
                  generatedResult.stats.duration
                }}</span>
                <span class="stat-label">分钟</span>
              </div>
            </n-space>
          </div>

          <n-divider />

          <div class="content-preview">
            <div
              v-for="(
                scene, sceneIndex
              ) in generatedResult.content.scenes?.slice(0, 4)"
              :key="scene.id"
              class="scene-preview"
            >
              <h5>场景 {{ sceneIndex + 1 }}：{{ (scene as GeneratedScene).name }}</h5>
              <p class="scene-summary">
                {{ (scene as GeneratedScene).description }}
              </p>
            </div>
            <p
              v-if="(generatedResult.content.scenes?.length || 0) > 4"
              class="more-hint"
            >
              还有 {{ generatedResult.content.scenes!.length - 4 }} 个场景...
            </p>
          </div>
        </n-card>
      </div>

      <div class="modal-footer">
        <n-space>
          <n-button @click="handleRegenerate">
            <template #icon>
              <n-icon :component="RefreshOutline" />
            </template>
            重新生成
          </n-button>
          <n-button
            type="primary"
            @click="handleEdit"
          >
            <template #icon>
              <n-icon :component="CreateOutline" />
            </template>
            继续编辑
          </n-button>
          <n-button
            type="success"
            @click="handleCreate"
          >
            <template #icon>
              <n-icon :component="CheckmarkCircleOutline" />
            </template>
            直接创建
          </n-button>
        </n-space>
      </div>
    </div>
  </n-modal>
</template>

<style scoped lang="scss">
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;

  .header-icon {
    color: var(--color-primary, #9d8ae7);
  }
}

.input-phase {
  .input-hint {
    margin-top: 8px;
    font-size: 12px;
    color: #999;

    .text-error {
      color: #ff4d4f;
    }
  }

  .config-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .config-label {
      font-size: 12px;
      color: #666;
    }
  }
}

.generating-phase {
  padding: 24px 0;

  .progress-section {
    margin-bottom: 24px;

    .progress-text {
      margin-top: 12px;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
  }

  .preview-section {
    background: #f5f7fa;
    border-radius: 8px;
    overflow: hidden;

    .preview-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(157, 138, 231, 0.1);
      font-size: 14px;
      font-weight: 500;
      color: var(--color-primary, #9d8ae7);
    }

    .preview-content {
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;

      pre {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: #333;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .preview-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 40px;
        color: #999;
      }
    }
  }
}

.completed-phase {
  .success-header {
    text-align: center;
    margin-bottom: 24px;

    .success-icon {
      color: #52c41a;
      margin-bottom: 12px;
    }

    h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
    }
  }

  .result-preview {
    margin-bottom: 24px;

    .preview-card {
      background: #f8f9fa;

      .script-title {
        margin: 0 0 16px;
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
        text-align: center;
      }

      .script-stats {
        display: flex;
        justify-content: center;
        margin-bottom: 16px;

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;

          .stat-value {
            font-size: 24px;
            font-weight: 600;
            color: var(--color-primary, #9d8ae7);
          }

          .stat-label {
            font-size: 12px;
            color: #666;
          }
        }
      }

      .content-preview {
        .act-preview {
          margin-bottom: 16px;

          h5 {
            margin: 0 0 8px;
            font-size: 14px;
            font-weight: 600;
            color: #1a1a1a;
            padding: 8px 12px;
            background: rgba(157, 138, 231, 0.1);
            border-radius: 4px;
          }

          .scene-preview {
            padding: 8px 12px;
            margin-bottom: 8px;
            background: white;
            border-radius: 4px;

            .scene-title {
              margin: 0 0 4px;
              font-size: 13px;
              font-weight: 500;
              color: #333;
            }

            .scene-summary {
              margin: 0;
              font-size: 12px;
              color: #666;
              line-height: 1.5;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
          }

          .more-hint {
            margin: 8px 0 0;
            font-size: 12px;
            color: #999;
            text-align: center;
          }
        }
      }
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>

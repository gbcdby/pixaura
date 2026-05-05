<script setup lang="ts">
import { ref, computed, watch, onMounted, h } from "vue";
import {
  NInput,
  NSelect,
  NAlert,
  NIcon,
  NSpace,
  useMessage,
  useDialog,
} from "naive-ui";
import { Sparkles, Refresh, CheckmarkCircle, Flash } from "@vicons/ionicons5";
import WorkflowStep from "./WorkflowStep.vue";
import { useScriptEditStore, type StepStatusType } from "../store/scriptEdit";
import { useScriptModelsStore, type ModelOptionWithPrice } from "@/stores/script-models";
import type { CharacterRef, SceneRef, PropRef } from "@pixaura/shared-types";
import { useDebounceFn } from "@vueuse/core";
import { scriptApi } from "../../script/api";

// Props
interface Props {
  projectId: string;
  scriptId: string;
}

// Props
const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  (e: "generated"): void;
  (e: "error", message: string): void;
  (
    e: "resourcesParsed",
    data: { characters: CharacterRef[]; scenes: SceneRef[]; props: PropRef[] },
  ): void;
}>();

// 剧本描述输入提示词
const scriptDescriptionPlaceholder = `请详细描述您的剧本创意，包含以下要素可以获得更好的生成效果：

【故事梗概】
简要描述故事主线，例如：一个关于青春校园爱情的短剧

【主要角色】
- 角色名称、性格特点、外貌特征
- 角色之间的关系

【场景设定】
- 主要场景描述（室内/室外、时代背景、氛围）

【关键道具】
- 对剧情有重要作用的物品

【剧情要点】
- 开端、发展、高潮、结局
- 关键对话或情感冲突

【风格要求】
- 喜剧/悲剧/悬疑/浪漫等
- 节奏快慢、情感基调`;

// Stores
const scriptEditStore = useScriptEditStore();
const scriptModelsStore = useScriptModelsStore();

// Message
const message = useMessage();
const dialog = useDialog();

// 本地状态
const description = ref("");
const selectedModelId = ref("");
const isGenerating = ref(false);
const hasParsedResources = ref(false); // 是否已经解析过资源
const saveStatus = ref<"idle" | "saving" | "saved">("idle"); // 自动保存状态
const lastSavedTime = ref<Date | null>(null); // 最后保存时间

// 计算属性
const stepState = computed(() => scriptEditStore.steps.script);

// 剧本生成步骤状态
const stepStatus = computed<StepStatusType>(() => {
  return stepState.value.status;
});

// 是否正在解析
const isParsing = computed(() => stepState.value.status === "parsing");

const hasContent = computed(() => description.value.trim().length > 0);

const canGenerate = computed(() => {
  return hasContent.value && selectedModelId.value && !isGenerating.value;
});

// 模型选项 - 使用 Store 的文本生成模型选项
const modelOptions = computed(() => scriptModelsStore.textModelOptions);

// 是否有可用模型
const hasAvailableModels = computed(() => modelOptions.value.length > 0);

// 是否正在加载模型
const isLoadingModels = computed(() => scriptModelsStore.isLoading);

// 渲染模型选项标签（带价格信息）
function renderModelLabel(option: ModelOptionWithPrice) {
  const model = option.model;
  // 处理 label 可能是字符串、函数或 undefined 的情况
  const labelText = typeof option.label === 'function'
    ? String(option.value)
    : (option.label ? String(option.label) : String(option.value));
  const children: (string | ReturnType<typeof h> | null)[] = [labelText];

  // 价格信息
  if (model.pricePer1kTokens) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePer1kTokens}/千token`),
    );
  }
  if (model.pricePerCall) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePerCall}/次`),
    );
  }
  if (model.pricePerSecond) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePerSecond}/秒`),
    );
  }
  if (model.pricePerChar) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, `¥${model.pricePerChar}/字`),
    );
  }
  // 未配置售价时显示"免费"
  if (!model.pricePer1kTokens && !model.pricePerCall && !model.pricePerSecond && !model.pricePerChar) {
    children.push(
      h("span", { style: "color: #999; font-size: 12px;" }, "免费"),
    );
  }

  return h(NSpace, { align: "center", size: 8 }, { default: () => children });
}

const actionButtons = computed(() => {
  const buttons = [];

  if (stepStatus.value === "pending" || stepStatus.value === "failed") {
    buttons.push({
      key: "generate",
      label: isGenerating.value
        ? "绘梦中"
        : stepStatus.value === "failed"
          ? "重新生成"
          : "开始生成",
      type: "primary" as const,
      disabled: !canGenerate.value,
      loading: isGenerating.value,
      icon: Sparkles,
    });
  } else if (
    stepStatus.value === "completed" ||
    stepStatus.value === "parsing"
  ) {
    // 再次生成按钮 - 只有在正在生成或解析中时才禁用
    buttons.push({
      key: "regenerate",
      label: isGenerating.value ? "绘梦中" : "再次生成",
      type: "default" as const,
      disabled: isGenerating.value || isParsing.value,
      loading: isGenerating.value,
      icon: Refresh,
    });

    // 解析资源按钮 - 只有在正在生成或解析中时才禁用
    buttons.push({
      key: "parse",
      label: isParsing.value ? "解析中..." : "解析资源",
      type: "primary" as const,
      disabled: isParsing.value || isGenerating.value,
      loading: isParsing.value,
      icon: Flash,
    });
  }

  return buttons;
});

// 自动保存状态显示文本
const saveStatusText = computed(() => {
  if (saveStatus.value === "saving") {
    return "保存中...";
  }
  if (saveStatus.value === "saved" && lastSavedTime.value) {
    const seconds = Math.floor(
      (Date.now() - lastSavedTime.value.getTime()) / 1000,
    );
    if (seconds < 60) {
      return `已自动保存 ${seconds}秒前`;
    } else {
      const minutes = Math.floor(seconds / 60);
      return `已自动保存 ${minutes}分钟前`;
    }
  }
  return "";
});

// 监听store状态变化 - 初始化时同步内容，生成完成后也同步新内容
watch(
  () => stepState.value.content,
  (newContent, oldContent) => {
    // 初始化时同步，或者内容来自后端更新（生成完成后刷新）
    if (newContent && (!description.value || newContent !== oldContent)) {
      // 只有用户没有未保存的修改时才覆盖，避免覆盖用户正在编辑的内容
      if (!stepState.value.hasUnsavedChanges) {
        description.value = newContent;
      }
    }
  },
  { immediate: true },
);

// 方法
async function handleGenerate() {
  if (!canGenerate.value) {
    if (!hasContent.value) {
      message.warning("请输入剧本描述");
    } else if (!selectedModelId.value) {
      message.warning("请选择生成模型");
    }
    return;
  }

  isGenerating.value = true;

  try {
    // 先保存描述
    await scriptEditStore.updateScriptDescription(description.value);

    // 开始生成
    await scriptEditStore.startScriptGeneration(selectedModelId.value);

    message.success("剧本生成任务已启动");
    emit("generated");
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "生成失败";
    message.error(errMsg);
    emit("error", errMsg);
  } finally {
    isGenerating.value = false;
  }
}

function handleRegenerate() {
  console.log("[handleRegenerate] 开始重新生成");

  // 检查是否选择了模型
  if (!selectedModelId.value) {
    message.warning("请先选择生成模型");
    return;
  }

  // BUG-09：确认弹框，提示用户重新生成会影响已有资产和图片
  dialog.warning({
    title: "确认重新生成",
    content:
      "重新生成剧本后，角色/场景/道具列表可能变化，已生成的图片数据可能丢失。是否继续？",
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: () => {
      void doRegenerate();
    },
  });
}

async function doRegenerate() {
  isGenerating.value = true;

  try {
    console.log(
      "[handleRegenerate] 调用 regenerateScript API，模型:",
      selectedModelId.value,
    );

    // 先把最新的描述同步到 store，确保生成时使用用户最新修改的内容
    if (description.value.trim()) {
      scriptEditStore.steps.script.content = description.value;
      scriptEditStore.steps.script.hasUnsavedChanges = false;
    }

    // 立即更新 store 状态，让页面显示"AI正在绘梦中"
    scriptEditStore.steps.script.status = "processing";
    scriptEditStore.steps.script.modelId = selectedModelId.value;
    scriptEditStore.steps.script.progress = 0;

    // 调用新的 regenerate API，在原剧本上重新生成
    const response = await scriptApi.regenerateScript(
      props.projectId,
      props.scriptId,
      {
        modelId: selectedModelId.value,
        description: description.value || undefined,
      },
    );

    // 提取 taskId 并订阅进度，生成完成后会自动刷新剧本数据
    const taskId = (response as unknown as { taskId?: string })?.taskId;
    if (taskId) {
      scriptEditStore.steps.script.currentTaskId = taskId;
      scriptEditStore.subscribeToTask(taskId, "script");
    }

    message.success("重新生成任务已启动");
  } catch (error: unknown) {
    console.error("[handleRegenerate] 重新生成失败:", error);
    scriptEditStore.steps.script.status = "failed";
    const errMsg = error instanceof Error ? error.message : "重新生成失败";
    message.error(errMsg);
    emit("error", errMsg);
  } finally {
    isGenerating.value = false;
  }
}

function handleAction(actionKey: string) {
  console.log("[handleAction] 收到 actionKey:", actionKey);
  switch (actionKey) {
    case "generate":
      console.log("[handleAction] 调用 handleGenerate");
      handleGenerate();
      break;
    case "regenerate":
      console.log("[handleAction] 调用 handleRegenerate");
      handleRegenerate();
      break;
    case "parse":
      console.log("[handleAction] 调用 handleParseResources");
      handleParseResources();
      break;
    default:
      console.warn("[handleAction] 未知的 actionKey:", actionKey);
  }
}

function handleRetry() {
  handleRegenerate();
}

// 防抖自动保存
const autoSave = useDebounceFn(async (content: string) => {
  if (!content.trim()) return;

  try {
    await scriptEditStore.updateScriptDescription(content);
    // 重置未保存状态，确保刷新后能正确同步 store 中的数据
    scriptEditStore.steps.script.hasUnsavedChanges = false;
    saveStatus.value = "saved";
    lastSavedTime.value = new Date();
    message.success("剧本描述已保存");
  } catch (error) {
    console.error("自动保存失败:", error);
    saveStatus.value = "idle";
    const errMsg = error instanceof Error ? error.message : "保存失败，请重试";
    message.error(errMsg);
  }
}, 1000);

// 处理描述变更（触发自动保存）
function handleDescriptionChange(value: string) {
  description.value = value;
  scriptEditStore.steps.script.hasUnsavedChanges = true;
  saveStatus.value = "saving";
  autoSave(value);
}

// 解析剧本资源
async function handleParseResources() {
  if (!props.projectId || !props.scriptId) {
    message.error("项目ID或剧本ID未设置");
    return;
  }

  // 如果已经在解析中，不重复提交
  if (isParsing.value) {
    message.info("解析任务正在进行中...");
    return;
  }

  // 检查是否已有资源数据
  const hasExistingResources =
    scriptEditStore.steps.characters.items.length > 0 ||
    scriptEditStore.steps.scenes.items.length > 0 ||
    scriptEditStore.steps.props.items.length > 0;

  // 如果已有资源，弹出确认对话框
  if (hasExistingResources) {
    dialog.warning({
      title: "重新解析确认",
      content:
        "已有解析结果，重新解析将清除所有已生成的素材（图片、音频、视频）。确定要继续吗？",
      positiveText: "确定重新解析",
      negativeText: "取消",
      onPositiveClick: async () => {
        await doParseResources(true);
      },
    });
    return;
  }

  // 无现有资源，直接解析
  await doParseResources(false);
}

// 执行解析
async function doParseResources(force: boolean) {
  try {
    // 使用 store 中的解析方法
    const result = await scriptEditStore.parseScriptResources(force);

    // parseScriptResources 返回的数据已经是 API 响应的 data 部分
    // 根据返回的数据结构判断任务状态
    const data = result as unknown as
      | { taskId?: string; status?: string }
      | undefined;

    if (data?.taskId) {
      // 任务已启动，等待 WebSocket 或轮询更新
      message.success(
        force ? "素材已清理，重新解析任务已启动" : "资源解析任务已启动",
      );
    } else if (data?.status === "completed") {
      // 任务已完成（缓存数据）
      hasParsedResources.value = true;
      message.success("资源解析完成");
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "解析资源失败";
    message.error(errMsg);
  }
}

// 处理模型变更
async function handleModelChange(modelId: string) {
  selectedModelId.value = modelId;

  // 同步更新剧本模型配置
  if (props.projectId && props.scriptId && modelId) {
    try {
      await scriptModelsStore.updateScriptModelConfig(
        props.projectId,
        props.scriptId,
        "script",
        modelId,
      );
    } catch (error) {
      console.error("更新剧本模型配置失败:", error);
      // 不显示错误提示，避免打扰用户
    }
  }
}

// 组件挂载时检查是否已解析资源
onMounted(() => {
  // 如果角色/场景/道具已有数据，认为已经解析过
  if (
    scriptEditStore.steps.characters.items.length > 0 ||
    scriptEditStore.steps.scenes.items.length > 0 ||
    scriptEditStore.steps.props.items.length > 0
  ) {
    hasParsedResources.value = true;
  }
});

// 监听并设置默认模型
watch(
  () => {
    // 使用剧本级别的模型配置
    const defaultFromScript = scriptModelsStore.getDefaultModelId("script");
    const firstAvailable = modelOptions.value[0]?.value;
    return {
      effectiveModelId: defaultFromScript || firstAvailable || "",
      hasScriptConfig: !!defaultFromScript,
    };
  },
  async ({ effectiveModelId, hasScriptConfig }) => {
    if (effectiveModelId && !selectedModelId.value) {
      selectedModelId.value = String(effectiveModelId);

      // 如果后端没有剧本模型配置（回退到第一个可用模型），自动保存到后端
      // 避免 parse-resources 时后端查不到模型 ID
      if (!hasScriptConfig && props.projectId && props.scriptId) {
        try {
          await scriptModelsStore.updateScriptModelConfig(
            props.projectId,
            props.scriptId,
            "script",
            String(effectiveModelId),
          );
        } catch (error) {
          console.error("自动保存默认模型配置失败:", error);
        }
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <workflow-step
    step-id="script"
    title="剧本生成"
    :step-number="1"
    description="输入剧本描述，AI将为您生成完整的剧本内容"
    :status="stepStatus"
    :progress="stepState.progress"
    :action-buttons="actionButtons"
    :error-message="
      stepState.status === 'failed' ? '生成失败，请重试' : undefined
    "
    show-model-selector
    @action="handleAction"
    @retry="handleRetry"
  >
    <!-- 剧本描述输入 -->
    <div class="script-generation-content">
      <!-- 已完成状态显示 -->
      <div
        v-if="stepStatus === 'completed' && scriptEditStore.script"
        class="generation-result"
      >
        <n-alert
          type="success"
          :show-icon="true"
        >
          <template #icon>
            <n-icon :component="CheckmarkCircle" />
          </template>
          剧本生成完成！点击"解析资源"提取角色、场景和道具
        </n-alert>

        <!-- 直接编辑模式 -->
        <div class="result-preview">
          <div class="result-header">
            <h4>剧本描述</h4>
            <span
              v-if="saveStatusText"
              class="save-status"
              :class="{ saving: saveStatus === 'saving' }"
            >
              {{ saveStatusText }}
            </span>
          </div>

          <div class="description-input-wrapper">
            <n-input
              v-model:value="description"
              type="textarea"
              :rows="8"
              placeholder="请输入剧本描述..."
              aria-label="剧本描述"
              :status="!hasContent ? 'warning' : undefined"
              @update:value="handleDescriptionChange"
            />
          </div>

          <div class="input-hint">
            <span>{{ description.length }} / 10000 字符</span>
            <span
              v-if="!hasContent"
              class="hint-warning"
            >请输入剧本描述</span>
          </div>
        </div>
      </div>

      <!-- 编辑状态 -->
      <div v-else>
        <div class="input-section">
          <label class="input-label">
            剧本描述
            <span class="required">*</span>
          </label>
          <n-input
            v-model:value="description"
            type="textarea"
            :rows="10"
            :placeholder="scriptDescriptionPlaceholder"
            :disabled="stepStatus === 'processing'"
            :status="
              !hasContent && stepStatus === 'pending' ? 'warning' : undefined
            "
            @update:value="handleDescriptionChange"
          />
          <div class="input-hint">
            <span>{{ description.length }} / 10000 字符</span>
            <span
              v-if="!hasContent"
              class="hint-warning"
            >请输入剧本描述</span>
          </div>
        </div>

        <!-- 生成中提示 -->
        <div
          v-if="stepStatus === 'processing'"
          class="generating-tip"
        >
          <n-alert type="info">
            <template #icon>
              <n-icon :component="Sparkles" />
            </template>
            AI正在根据您的描述生成剧本，请稍候...
          </n-alert>
        </div>
      </div>
    </div>

    <!-- 模型选择器 -->
    <template #modelSelector>
      <div class="model-selector-wrapper">
        <n-select
          v-if="hasAvailableModels"
          v-model:value="selectedModelId"
          :options="modelOptions"
          :placeholder="isLoadingModels ? '加载中...' : '选择生成模型'"
          aria-label="生成模型"
          :disabled="stepStatus === 'processing' || isLoadingModels"
          :loading="isLoadingModels"
          :consistent-menu-width="false"
          :render-label="renderModelLabel"
          @update:value="handleModelChange"
        />
        <span
          v-else
          class="no-model-hint"
        >
          {{ isLoadingModels ? "加载中..." : "暂无可用模型" }}
        </span>
      </div>
    </template>
  </workflow-step>
</template>

<style scoped lang="scss">
.script-generation-content {
  padding: 8px 0;
}

.input-section {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;

  .required {
    color: #d03050;
    margin-left: 4px;
  }
}

.input-hint {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: #999;

  .hint-warning {
    color: #f0a020;
  }
}

.generating-tip {
  margin-top: 16px;
}

.generation-result {
  .result-preview {
    margin-top: 16px;
    padding: 16px;
    background: #f8f8f8;
    border-radius: 8px;

    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h4 {
        margin: 0;
        font-size: 14px;
        color: #666;
      }
    }

    :deep(.n-input__textarea) {
      min-height: 160px;
    }
  }
}

.no-model-hint {
  font-size: 13px;
  color: #999;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.save-status {
  font-size: 12px;
  color: #52c41a;
  padding: 2px 8px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 4px;

  &.saving {
    color: #faad14;
    background: #fffbe6;
    border-color: #ffe58f;
  }
}
</style>

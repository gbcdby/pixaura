<script setup lang="ts">
/**
 * AI 辅助编辑浮动工具栏
 * 用户选中文本时显示，提供续写/改写/扩写/缩写功能
 */
import { ref, onMounted, onUnmounted, nextTick, watch } from "vue";
import {
  NButton,
  NIcon,
  NPopover,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NInput,
  NSpace,
  useMessage,
} from "naive-ui";
import {
  Sparkles,
  PencilOutline,
  ExpandOutline,
  ContractOutline,
  ArrowForwardOutline,
} from "@vicons/ionicons5";
import { useScriptStore } from "@/modules/script/store";
import { useWebSocketStore } from "@/stores/websocket";
import { WsEventNames } from "@pixaura/shared-types";
import type { ScriptEditProgressWsData } from "@pixaura/shared-types";

// 本地定义段落类型（旧版结构，用于兼容）
interface Paragraph {
  id: string;
  type: "dialogue" | "action" | "narration";
  character?: string;
  content: string;
}

interface Props {
  projectId: string;
  scriptId: string;
  selectedParagraphs: Paragraph[];
  selectedText: string;
  containerRef?: { $el: HTMLElement } | null;
}

interface Emits {
  (e: "close"): void;
  (e: "result", type: EditType, paragraphs: Paragraph[]): void;
  (e: "loading", loading: boolean): void;
}

type EditType = "continue" | "rewrite" | "expand" | "condense";

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();
const scriptStore = useScriptStore();
const wsStore = useWebSocketStore();

// 存储 WebSocket 取消注册函数
let unregisterWs: (() => void) | null = null;

// 当前编辑任务 ID
const currentTaskId = ref<string | null>(null);

// 工具栏位置
const toolbarRef = ref<HTMLElement | null>(null);
const toolbarPosition = ref({ x: 0, y: 0 });
const isVisible = ref(false);

// 当前操作类型
const currentEditType = ref<EditType | null>(null);

// 配置弹窗显示状态
const showConfigModal = ref(false);

// 配置表单
const continueConfig = ref({
  length: "medium" as "short" | "medium" | "long",
  style: "match" as "match" | "casual" | "dramatic",
});

const rewriteConfig = ref({
  instruction: "",
  preserveLength: false,
});

const expandConfig = ref({
  expansionRatio: "100%" as "50%" | "100%" | "200%",
  focus: "description" as "description" | "emotion" | "action" | "dialogue",
});

const condenseConfig = ref({
  compressionRatio: "50%" as "30%" | "50%",
  keepKeyPoints: true,
});

// 预设改写指令
const rewritePresets = [
  { label: "更口语化", value: "让对话更口语化、自然" },
  { label: "增加紧张感", value: "增加紧张感和戏剧冲突" },
  { label: "更简洁", value: "精简表达，去除冗余" },
  { label: "增加细节", value: "增加环境细节和动作描写" },
  { label: "幽默风格", value: "增加幽默感和轻松氛围" },
];

// 工具栏按钮配置
const toolbarButtons = [
  { key: "continue" as EditType, label: "AI 续写", icon: ArrowForwardOutline },
  { key: "rewrite" as EditType, label: "AI 改写", icon: PencilOutline },
  { key: "expand" as EditType, label: "AI 扩写", icon: ExpandOutline },
  { key: "condense" as EditType, label: "AI 缩写", icon: ContractOutline },
];

// 计算工具栏位置
const calculatePosition = () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // 计算相对于容器的位置
  let containerRect: DOMRect | undefined;
  if (props.containerRef?.$el) {
    containerRect = props.containerRef.$el.getBoundingClientRect();
  }

  const x = rect.left + rect.width / 2 - 140; // 居中，工具栏宽度约 280px
  const y = rect.top - 50; // 在选区上方

  toolbarPosition.value = {
    x: containerRect ? x - containerRect.left : x,
    y: containerRect ? y - containerRect.top : y,
  };
};

// 显示工具栏
const showToolbar = () => {
  calculatePosition();
  isVisible.value = true;
};

// 隐藏工具栏
const hideToolbar = () => {
  isVisible.value = false;
  currentEditType.value = null;
  showConfigModal.value = false;
};

// 处理工具栏按钮点击
const handleToolbarClick = (type: EditType) => {
  currentEditType.value = type;
  showConfigModal.value = true;
};

// 处理编辑进度
const handleEditProgress = (data: unknown) => {
  const progressData = data as ScriptEditProgressWsData;
  // 只处理当前任务的进度
  if (progressData.taskId !== currentTaskId.value) return;

  if (progressData.status === "completed") {
    emit("loading", false);
    if (progressData.result?.paragraphs) {
      emit(
        "result",
        currentEditType.value!,
        progressData.result.paragraphs as Paragraph[],
      );
    }
    hideToolbar();
  } else if (progressData.status === "failed") {
    emit("loading", false);
    message.error(progressData.error?.message || "编辑失败，请重试");
  }
};

// 执行编辑操作
const executeEdit = async () => {
  if (!currentEditType.value || props.selectedParagraphs.length === 0) return;

  try {
    emit("loading", true);
    showConfigModal.value = false;

    const paragraphIds = props.selectedParagraphs.map((p) => p.id);

    let response: any = null;

    switch (currentEditType.value) {
      case "continue": {
        // 续写使用最后一段的 sceneId
        const lastParagraph =
          props.selectedParagraphs[props.selectedParagraphs.length - 1];
        response = await scriptStore.continueWithAI(
          props.projectId,
          props.scriptId,
          {
            sceneId: lastParagraph.id, // 这里需要根据实际数据结构调整
            afterParagraphId: lastParagraph.id,
            length: continueConfig.value.length,
            style: continueConfig.value.style,
          },
        );
        break;
      }

      case "rewrite": {
        if (!rewriteConfig.value.instruction.trim()) {
          message.error("请输入改写要求");
          emit("loading", false);
          return;
        }
        response = await scriptStore.rewriteWithAI(
          props.projectId,
          props.scriptId,
          {
            paragraphIds,
            instruction: rewriteConfig.value.instruction,
          },
        );
        break;
      }

      case "expand": {
        response = await scriptStore.expandWithAI(
          props.projectId,
          props.scriptId,
          {
            paragraphIds,
            targetLength: expandConfig.value.expansionRatio,
          },
        );
        break;
      }

      case "condense": {
        response = await scriptStore.condenseWithAI(
          props.projectId,
          props.scriptId,
          {
            paragraphIds,
            targetLength: condenseConfig.value.compressionRatio,
          },
        );
        break;
      }
    }

    // 保存任务 ID，由 onMounted 注册的 handler 处理进度
    if (response?.id) {
      currentTaskId.value = response.id;
      // 订阅后端任务
      wsStore.subscribeScriptTask(response.id, props.scriptId, "edit");
    }
  } catch (error: unknown) {
    emit("loading", false);
    const err = error as { message?: string };
    message.error(err.message || "操作失败，请稍后重试");
  }
};

// 应用预设改写指令
const applyRewritePreset = (preset: string) => {
  rewriteConfig.value.instruction = preset;
};

// 监听选中文本变化
watch(
  () => props.selectedText,
  (newVal) => {
    if (newVal && newVal.trim()) {
      nextTick(() => {
        showToolbar();
      });
    } else {
      hideToolbar();
    }
  },
  { immediate: true },
);

// 点击外部隐藏
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (
    toolbarRef.value &&
    !toolbarRef.value.contains(target) &&
    !target.closest(".ai-config-popover")
  ) {
    hideToolbar();
  }
};

// 监听选区变化
const handleSelectionChange = () => {
  const selection = window.getSelection();
  if (!selection || selection.toString().trim() === "") {
    hideToolbar();
  }
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
  document.addEventListener("selectionchange", handleSelectionChange);

  // 注册 WebSocket 编辑进度处理器
  unregisterWs = wsStore.registerHandler(
    WsEventNames.SCRIPT_EDIT_PROGRESS,
    handleEditProgress,
  );
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("selectionchange", handleSelectionChange);

  // 取消 WebSocket 处理器注册
  if (unregisterWs) {
    unregisterWs();
    unregisterWs = null;
  }
});
</script>

<template>
  <teleport to="body">
    <transition name="toolbar-fade">
      <div
        v-if="isVisible"
        ref="toolbarRef"
        class="ai-floating-toolbar"
        :style="{
          left: `${toolbarPosition.x}px`,
          top: `${toolbarPosition.y}px`,
        }"
      >
        <!-- 主工具栏 -->
        <div class="toolbar-main">
          <n-space :size="4">
            <n-button
              v-for="btn in toolbarButtons"
              :key="btn.key"
              size="small"
              quaternary
              class="toolbar-btn"
              @click="handleToolbarClick(btn.key)"
            >
              <template #icon>
                <n-icon :component="btn.icon" />
              </template>
              {{ btn.label }}
            </n-button>
          </n-space>
        </div>

        <!-- 配置弹窗 -->
        <n-popover
          :show="showConfigModal"
          trigger="manual"
          placement="bottom"
          class="ai-config-popover"
          :style="{ width: '320px' }"
        >
          <template #trigger>
            <div />
          </template>

          <!-- 续写配置 -->
          <div
            v-if="currentEditType === 'continue'"
            class="config-panel"
          >
            <h4 class="config-title">
              <n-icon :component="ArrowForwardOutline" />
              AI 续写配置
            </h4>
            <n-form
              label-placement="left"
              label-width="80px"
            >
              <n-form-item label="续写长度">
                <n-radio-group v-model:value="continueConfig.length">
                  <n-space vertical>
                    <n-radio value="short">
                      简短（1-2段）
                    </n-radio>
                    <n-radio value="medium">
                      中等（3-5段）
                    </n-radio>
                    <n-radio value="long">
                      较长（6-10段）
                    </n-radio>
                  </n-space>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="风格">
                <n-radio-group v-model:value="continueConfig.style">
                  <n-space vertical>
                    <n-radio value="match">
                      保持原文风格
                    </n-radio>
                    <n-radio value="casual">
                      轻松随意
                    </n-radio>
                    <n-radio value="dramatic">
                      戏剧张力
                    </n-radio>
                    <n-radio value="humorous">
                      幽默诙谐
                    </n-radio>
                  </n-space>
                </n-radio-group>
              </n-form-item>
            </n-form>
          </div>

          <!-- 改写配置 -->
          <div
            v-else-if="currentEditType === 'rewrite'"
            class="config-panel"
          >
            <h4 class="config-title">
              <n-icon :component="PencilOutline" />
              AI 改写配置
            </h4>
            <n-form label-placement="top">
              <n-form-item
                label="改写要求"
                required
              >
                <n-input
                  v-model:value="rewriteConfig.instruction"
                  type="textarea"
                  :rows="3"
                  placeholder="描述你想要的改写效果，例如：让对话更口语化"
                />
              </n-form-item>
              <n-form-item label="预设指令">
                <n-space
                  wrap
                  :size="8"
                >
                  <n-button
                    v-for="preset in rewritePresets"
                    :key="preset.value"
                    size="tiny"
                    @click="applyRewritePreset(preset.value)"
                  >
                    {{ preset.label }}
                  </n-button>
                </n-space>
              </n-form-item>
            </n-form>
          </div>

          <!-- 扩写配置 -->
          <div
            v-else-if="currentEditType === 'expand'"
            class="config-panel"
          >
            <h4 class="config-title">
              <n-icon :component="ExpandOutline" />
              AI 扩写配置
            </h4>
            <n-form
              label-placement="left"
              label-width="80px"
            >
              <n-form-item label="扩写比例">
                <n-radio-group v-model:value="expandConfig.expansionRatio">
                  <n-space vertical>
                    <n-radio value="50%">
                      50%（1.5倍长度）
                    </n-radio>
                    <n-radio value="100%">
                      100%（2倍长度）
                    </n-radio>
                    <n-radio value="200%">
                      200%（3倍长度）
                    </n-radio>
                  </n-space>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="扩写重点">
                <n-radio-group v-model:value="expandConfig.focus">
                  <n-space vertical>
                    <n-radio value="description">
                      环境描写
                    </n-radio>
                    <n-radio value="emotion">
                      心理情感
                    </n-radio>
                    <n-radio value="action">
                      动作细节
                    </n-radio>
                    <n-radio value="dialogue">
                      对话内容
                    </n-radio>
                  </n-space>
                </n-radio-group>
              </n-form-item>
            </n-form>
          </div>

          <!-- 缩写配置 -->
          <div
            v-else-if="currentEditType === 'condense'"
            class="config-panel"
          >
            <h4 class="config-title">
              <n-icon :component="ContractOutline" />
              AI 缩写配置
            </h4>
            <n-form
              label-placement="left"
              label-width="80px"
            >
              <n-form-item label="压缩比例">
                <n-radio-group v-model:value="condenseConfig.compressionRatio">
                  <n-space vertical>
                    <n-radio value="30%">
                      压缩至30%
                    </n-radio>
                    <n-radio value="50%">
                      压缩至50%
                    </n-radio>
                  </n-space>
                </n-radio-group>
              </n-form-item>
              <n-form-item label="保留要点">
                <n-radio-group v-model:value="condenseConfig.keepKeyPoints">
                  <n-radio :value="true">
                    保留关键情节点
                  </n-radio>
                  <n-radio :value="false">
                    精简所有内容
                  </n-radio>
                </n-radio-group>
              </n-form-item>
            </n-form>
          </div>

          <div class="config-actions">
            <n-space justify="end">
              <n-button
                size="small"
                @click="showConfigModal = false"
              >
                取消
              </n-button>
              <n-button
                size="small"
                type="primary"
                :disabled="
                  currentEditType === 'rewrite' &&
                    !rewriteConfig.instruction.trim()
                "
                @click="executeEdit"
              >
                <template #icon>
                  <n-icon :component="Sparkles" />
                </template>
                开始{{
                  currentEditType === "continue"
                    ? "续写"
                    : currentEditType === "rewrite"
                      ? "改写"
                      : currentEditType === "expand"
                        ? "扩写"
                        : "缩写"
                }}
              </n-button>
            </n-space>
          </div>
        </n-popover>
      </div>
    </transition>
  </teleport>
</template>

<style scoped lang="scss">
.ai-floating-toolbar {
  position: fixed;
  z-index: 1000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px;
  transform: translateX(-50%);

  &::after {
    content: "";
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid white;
  }
}

.toolbar-main {
  display: flex;
  align-items: center;
}

.toolbar-btn {
  font-size: 13px;

  :deep(.n-button__content) {
    gap: 4px;
  }
}

.config-panel {
  padding: 16px;

  .config-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: #1a1a1a;
  }
}

.config-actions {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
}

// 动画
.toolbar-fade-enter-active,
.toolbar-fade-leave-active {
  transition: all 0.2s ease;
}

.toolbar-fade-enter-from,
.toolbar-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-10px);
}
</style>

<script setup lang="ts">
/**
 * AI 编辑结果弹窗
 * 展示 AI 编辑结果，以 diff 形式对比原文和修改后内容
 */
import { ref, computed, watch } from "vue";
import {
  NModal,
  NCard,
  NButton,
  NSpace,
  NSpin,
  NIcon,
  NDivider,
  NTag,
  useMessage,
} from "naive-ui";
import {
  Close,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  RefreshOutline,
  Sparkles,
} from "@vicons/ionicons5";

// 本地定义段落类型（旧版结构，用于兼容）
interface Paragraph {
  id: string;
  type: "dialogue" | "action" | "narration";
  character?: string;
  content: string;
}

interface Props {
  visible: boolean;
  type: "continue" | "rewrite" | "expand" | "condense";
  originalParagraphs: Paragraph[];
  editedParagraphs: Paragraph[];
  loading?: boolean;
}

interface Emits {
  (e: "close"): void;
  (e: "accept", paragraphs: Paragraph[]): void;
  (e: "reject"): void;
  (e: "regenerate"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const message = useMessage();

// 当前显示的段落索引
const currentIndex = ref(0);

// 是否显示差异对比
const showDiff = ref(true);

// 类型标签映射
const typeMap: Record<string, { label: string; color: string }> = {
  continue: { label: "AI 续写", color: "blue" },
  rewrite: { label: "AI 改写", color: "purple" },
  expand: { label: "AI 扩写", color: "green" },
  condense: { label: "AI 缩写", color: "orange" },
};

// 计算差异统计
const diffStats = computed(() => {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  const maxLen = Math.max(
    props.originalParagraphs.length,
    props.editedParagraphs.length,
  );

  for (let i = 0; i < maxLen; i++) {
    const original = props.originalParagraphs[i];
    const edited = props.editedParagraphs[i];

    if (!original && edited) {
      additions++;
    } else if (original && !edited) {
      deletions++;
    } else if (original && edited) {
      if (original.content !== edited.content) {
        // 简化处理：只要有变化就计为修改
        unchanged++;
      } else {
        unchanged++;
      }
    }
  }

  return { additions, deletions, unchanged };
});

// 格式化段落内容显示
const formatParagraph = (paragraph: Paragraph): string => {
  if (!paragraph) return "";

  switch (paragraph.type) {
    case "dialogue":
      return `${paragraph.character || "角色"}：${paragraph.content}`;
    case "action":
      return `[${paragraph.content}]`;
    case "narration":
      return `（${paragraph.content}）`;
    default:
      return paragraph.content;
  }
};

// 获取段落类型标签
const getParagraphTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    dialogue: "对话",
    action: "动作",
    narration: "旁白",
  };
  return labels[type] || type;
};

// 接受修改
const handleAccept = () => {
  emit("accept", props.editedParagraphs);
  message.success("已应用修改");
};

// 拒绝修改
const handleReject = () => {
  emit("reject");
  message.info("已拒绝修改");
};

// 重新生成
const handleRegenerate = () => {
  emit("regenerate");
};

// 关闭弹窗
const handleClose = () => {
  emit("close");
};

// 监听 visible 变化，重置状态
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      currentIndex.value = 0;
    }
  },
);
</script>

<template>
  <n-modal
    :show="visible"
    preset="card"
    :style="{ width: '900px', maxWidth: '95vw', maxHeight: '90vh' }"
    :closable="false"
    @close="handleClose"
  >
    <template #header>
      <div class="modal-header">
        <n-icon
          size="20"
          :component="Sparkles"
          class="header-icon"
        />
        <span>{{ typeMap[type]?.label || "AI 编辑" }}结果</span>
        <n-tag
          v-if="typeMap[type]"
          :type="typeMap[type].color as any"
          size="small"
          class="type-tag"
        >
          {{ typeMap[type].label }}
        </n-tag>
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

    <!-- 加载中状态 -->
    <div
      v-if="loading"
      class="loading-state"
    >
      <n-spin
        size="large"
        description="AI 正在生成..."
      />
      <p class="loading-hint">
        请稍候，正在处理您的请求
      </p>
    </div>

    <!-- 结果展示 -->
    <div
      v-else
      class="result-content"
    >
      <!-- 统计信息 -->
      <div class="stats-bar">
        <n-space :size="24">
          <div class="stat-item additions">
            <span class="stat-dot" />
            <span class="stat-label">新增</span>
            <span class="stat-value">{{ diffStats.additions }} 处</span>
          </div>
          <div class="stat-item deletions">
            <span class="stat-dot" />
            <span class="stat-label">删除</span>
            <span class="stat-value">{{ diffStats.deletions }} 处</span>
          </div>
          <div class="stat-item unchanged">
            <span class="stat-dot" />
            <span class="stat-label">修改/保留</span>
            <span class="stat-value">{{ diffStats.unchanged }} 处</span>
          </div>
        </n-space>
      </div>

      <n-divider />

      <!-- Diff 对比 -->
      <div class="diff-container">
        <div class="diff-header">
          <div class="diff-column">
            <span class="column-label">原文</span>
          </div>
          <div class="diff-column">
            <span class="column-label">修改后</span>
          </div>
        </div>

        <div class="diff-body">
          <div
            v-for="(paragraph, index) in editedParagraphs"
            :key="index"
            class="diff-row"
            :class="{
              'is-new': index >= originalParagraphs.length,
              'is-modified':
                index < originalParagraphs.length &&
                originalParagraphs[index]?.content !== paragraph?.content,
            }"
          >
            <!-- 原文 -->
            <div class="diff-cell original">
              <div
                v-if="index < originalParagraphs.length"
                class="paragraph-content"
              >
                <span class="type-badge">
                  {{ getParagraphTypeLabel(originalParagraphs[index].type) }}
                </span>
                <p>{{ formatParagraph(originalParagraphs[index]) }}</p>
              </div>
              <div
                v-else
                class="empty-cell"
              >
                <span class="empty-label">（新增）</span>
              </div>
            </div>

            <!-- 修改后 -->
            <div class="diff-cell edited">
              <div class="paragraph-content">
                <span class="type-badge">
                  {{ getParagraphTypeLabel(paragraph.type) }}
                </span>
                <p>{{ formatParagraph(paragraph) }}</p>
              </div>
            </div>
          </div>

          <!-- 显示被删除的段落 -->
          <div
            v-for="(paragraph, index) in originalParagraphs.slice(
              editedParagraphs.length,
            )"
            :key="`deleted-${index}`"
            class="diff-row is-deleted"
          >
            <div class="diff-cell original">
              <div class="paragraph-content">
                <span class="type-badge">
                  {{ getParagraphTypeLabel(paragraph.type) }}
                </span>
                <p>{{ formatParagraph(paragraph) }}</p>
              </div>
            </div>
            <div class="diff-cell edited">
              <div class="empty-cell">
                <span class="empty-label">（删除）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览模式（单栏） -->
      <div
        v-if="!showDiff"
        class="preview-mode"
      >
        <n-card
          :bordered="false"
          class="preview-card"
        >
          <div
            v-for="(paragraph, index) in editedParagraphs"
            :key="index"
            class="preview-paragraph"
            :class="paragraph.type"
          >
            <span class="preview-type">{{
              getParagraphTypeLabel(paragraph.type)
            }}</span>
            <p>{{ formatParagraph(paragraph) }}</p>
          </div>
        </n-card>
      </div>
    </div>

    <template #footer>
      <div class="modal-footer">
        <n-space
          justify="end"
          :size="12"
        >
          <n-button @click="handleReject">
            <template #icon>
              <n-icon :component="CloseCircleOutline" />
            </template>
            拒绝
          </n-button>
          <n-button @click="handleRegenerate">
            <template #icon>
              <n-icon :component="RefreshOutline" />
            </template>
            重新生成
          </n-button>
          <n-button
            type="primary"
            @click="handleAccept"
          >
            <template #icon>
              <n-icon :component="CheckmarkCircleOutline" />
            </template>
            接受修改
          </n-button>
        </n-space>
      </div>
    </template>
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

  .type-tag {
    margin-left: 8px;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;

  .loading-hint {
    margin-top: 16px;
    font-size: 14px;
    color: #999;
  }
}

.result-content {
  max-height: 60vh;
  overflow-y: auto;
}

.stats-bar {
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;

  .stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;

    .stat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .stat-label {
      color: #666;
    }

    .stat-value {
      font-weight: 500;
      color: #1a1a1a;
    }

    &.additions .stat-dot {
      background: #52c41a;
    }

    &.deletions .stat-dot {
      background: #ff4d4f;
    }

    &.unchanged .stat-dot {
      background: #1890ff;
    }
  }
}

.diff-container {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;

  .diff-header {
    display: flex;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;

    .diff-column {
      flex: 1;
      padding: 12px 16px;

      .column-label {
        font-size: 13px;
        font-weight: 500;
        color: #666;
      }

      &:first-child {
        border-right: 1px solid #e8e8e8;
      }
    }
  }

  .diff-body {
    max-height: 400px;
    overflow-y: auto;

    .diff-row {
      display: flex;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
      }

      &.is-new {
        .edited {
          background: rgba(82, 196, 26, 0.05);
        }
      }

      &.is-modified {
        .original {
          background: rgba(255, 77, 79, 0.05);
        }
        .edited {
          background: rgba(82, 196, 26, 0.05);
        }
      }

      &.is-deleted {
        .original {
          background: rgba(255, 77, 79, 0.05);
        }
      }

      .diff-cell {
        flex: 1;
        padding: 12px 16px;

        &:first-child {
          border-right: 1px solid #e8e8e8;
        }

        .paragraph-content {
          .type-badge {
            display: inline-block;
            padding: 2px 8px;
            font-size: 11px;
            color: #666;
            background: #f0f0f0;
            border-radius: 4px;
            margin-bottom: 4px;
          }

          p {
            margin: 0;
            font-size: 13px;
            line-height: 1.6;
            color: #333;
          }
        }

        .empty-cell {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 40px;

          .empty-label {
            font-size: 12px;
            color: #999;
            font-style: italic;
          }
        }
      }
    }
  }
}

.preview-mode {
  .preview-card {
    background: #f8f9fa;

    .preview-paragraph {
      padding: 12px;
      margin-bottom: 8px;
      background: white;
      border-radius: 4px;

      &:last-child {
        margin-bottom: 0;
      }

      .preview-type {
        display: inline-block;
        padding: 2px 8px;
        font-size: 11px;
        color: var(--color-primary, #9d8ae7);
        background: rgba(157, 138, 231, 0.1);
        border-radius: 4px;
        margin-bottom: 4px;
      }

      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: #333;
      }

      &.dialogue {
        padding-left: 24px;
      }

      &.action {
        color: #666;
        font-style: italic;
      }
    }
  }
}

.modal-footer {
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>

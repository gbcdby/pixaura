<script setup lang="ts">
/**
 * 7步生成流程竖向时间线组件
 * 显示剧本从生成到导出的完整流程
 * 包含状态指示器圆点、连线和操作按钮
 */
import { computed } from "vue";
import { NButton, NTag, NProgress, NIcon, NSpace, NTooltip } from "naive-ui";
import {
  DocumentText,
  Cut,
  Image,
  Videocam,
  MusicalNotes,
  Text,
  Download,
  CheckmarkCircle,
  Play,
  Eye,
} from "@vicons/ionicons5";

type StepStatus = "pending" | "processing" | "completed" | "error";

interface StepAction {
  label: string;
  key: string;
  icon?: typeof DocumentText;
  type?: "primary" | "default";
}

interface Step {
  id: number;
  title: string;
  description: string;
  icon: typeof DocumentText;
  status: StepStatus;
  progress?: number;
  progressText?: string;
  actions?: StepAction[];
  details?: string;
}

interface Props {
  currentStep?: number;
  steps?: Step[];
}

const props = withDefaults(defineProps<Props>(), {
  currentStep: 1,
  steps: () => [],
});

const emit = defineEmits<{
  (e: "stepClick", stepId: number): void;
  (e: "actionClick", stepId: number, actionKey: string): void;
}>();

// 默认7步流程
const defaultSteps: Step[] = [
  {
    id: 1,
    title: "剧本生成与确认",
    description: "AI生成或导入剧本，确认剧本内容",
    icon: DocumentText,
    status: "completed",
    actions: [{ label: "查看详情", key: "view", icon: Eye }],
  },
  {
    id: 2,
    title: "智能分镜与资产关联",
    description: "自动拆解分镜，关联角色、场景、道具",
    icon: Cut,
    status: "processing",
    progress: 67,
    progressText: "8/12 分镜已拆解",
    actions: [
      { label: "继续拆解", key: "continue", icon: Play, type: "primary" },
      { label: "查看分镜", key: "view", icon: Eye },
    ],
    details: "待处理: 2个角色待创建",
  },
  {
    id: 3,
    title: "镜头级多媒体生成",
    description: "生成视频、音频素材",
    icon: Image,
    status: "pending",
    actions: [{ label: "开始生成", key: "start", icon: Play, type: "primary" }],
  },
  {
    id: 4,
    title: "智能剪辑与粗剪",
    description: "镜头编排、转场、粗剪",
    icon: Videocam,
    status: "pending",
    actions: [{ label: "开始剪辑", key: "start", icon: Play, type: "primary" }],
  },
  {
    id: 5,
    title: "全局音频工程",
    description: "BGM、音效、混音",
    icon: MusicalNotes,
    status: "pending",
    actions: [{ label: "开始处理", key: "start", icon: Play, type: "primary" }],
  },
  {
    id: 6,
    title: "字幕与包装",
    description: "字幕生成、片头片尾、特效",
    icon: Text,
    status: "pending",
    actions: [{ label: "开始包装", key: "start", icon: Play, type: "primary" }],
  },
  {
    id: 7,
    title: "导出与分发",
    description: "多平台导出、格式转换",
    icon: Download,
    status: "pending",
    actions: [{ label: "开始导出", key: "start", icon: Play, type: "primary" }],
  },
];

const steps = computed(() => {
  if (props.steps.length > 0) return props.steps;

  return defaultSteps.map((step, index) => ({
    ...step,
    status:
      index < props.currentStep - 1
        ? "completed"
        : index === props.currentStep - 1
          ? "processing"
          : ("pending" as StepStatus),
  }));
});

// 计算整体进度百分比
const overallProgress = computed(() => {
  const completedSteps = steps.value.filter(
    (s) => s.status === "completed",
  ).length;
  const processingStep = steps.value.find((s) => s.status === "processing");
  const processingProgress = processingStep?.progress || 0;

  return Math.round(
    ((completedSteps + processingProgress / 100) / steps.value.length) * 100,
  );
});

const handleStepClick = (stepId: number) => {
  emit("stepClick", stepId);
};

const handleActionClick = (stepId: number, actionKey: string) => {
  emit("actionClick", stepId, actionKey);
};

// 获取状态样式
const getStatusClass = (status: StepStatus) => {
  switch (status) {
    case "completed":
      return "completed";
    case "processing":
      return "in-progress";
    case "error":
      return "failed";
    default:
      return "pending";
  }
};

// 获取状态图标
const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case "completed":
      return CheckmarkCircle;
    default:
      return undefined;
  }
};
</script>

<template>
  <div class="generation-timeline">
    <!-- 头部 -->
    <div class="timeline-header">
      <h3 class="title">
        短剧生成流程
      </h3>
      <n-tooltip trigger="hover">
        <template #trigger>
          <n-tag
            :type="
              steps[currentStep - 1]?.status === 'completed'
                ? 'success'
                : 'warning'
            "
            size="small"
          >
            步骤 {{ currentStep }}/7
          </n-tag>
        </template>
        整体进度: {{ overallProgress }}%
      </n-tooltip>
    </div>

    <!-- 时间线 -->
    <div class="timeline-content">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="timeline-item"
        :class="[
          getStatusClass(step.status),
          { active: step.id === currentStep },
        ]"
        @click="handleStepClick(step.id)"
      >
        <!-- 节点圆点 -->
        <div class="timeline-node">
          <div class="node-dot">
            <n-icon
              v-if="getStatusIcon(step.status)"
              :component="getStatusIcon(step.status)"
            />
            <span
              v-else
              class="node-number"
            >{{ step.id }}</span>
          </div>
          <!-- 连接线（除最后一个） -->
          <div
            v-if="index < steps.length - 1"
            class="node-line"
          />
        </div>

        <!-- 内容区域 -->
        <div class="timeline-item-content">
          <!-- 标题行 -->
          <div class="item-header">
            <div class="item-title-wrapper">
              <n-icon
                :component="step.icon"
                class="item-icon"
              />
              <span class="item-title">{{ step.title }}</span>
            </div>
            <n-tag
              v-if="step.status === 'completed'"
              type="success"
              size="tiny"
              class="status-tag"
            >
              已完成
            </n-tag>
            <n-tag
              v-else-if="step.status === 'processing'"
              type="warning"
              size="tiny"
              class="status-tag"
            >
              进行中
            </n-tag>
            <n-tag
              v-else
              type="default"
              size="tiny"
              class="status-tag"
            >
              待开始
            </n-tag>
          </div>

          <!-- 描述 -->
          <p class="item-description">
            {{ step.description }}
          </p>

          <!-- 进度信息 -->
          <div
            v-if="step.status === 'processing' && step.progress !== undefined"
            class="item-progress"
          >
            <div class="progress-header">
              <span class="progress-text">{{
                step.progressText || `${step.progress}%`
              }}</span>
            </div>
            <n-progress
              :percentage="step.progress"
              :show-indicator="false"
              :height="6"
              color="#9D8AE7"
              class="progress-bar"
            />
          </div>

          <!-- 详细信息 -->
          <p
            v-if="step.details"
            class="item-details"
          >
            {{ step.details }}
          </p>

          <!-- 操作按钮 -->
          <div
            v-if="step.actions && step.actions.length > 0"
            class="item-actions"
          >
            <n-space :size="8">
              <n-button
                v-for="action in step.actions"
                :key="action.key"
                :type="action.type || 'default'"
                size="tiny"
                @click.stop="handleActionClick(step.id, action.key)"
              >
                <template
                  v-if="action.icon"
                  #icon
                >
                  <n-icon :component="action.icon" />
                </template>
                {{ action.label }}
              </n-button>
            </n-space>
          </div>
        </div>
      </div>
    </div>

    <!-- 整体进度 -->
    <div class="timeline-footer">
      <div class="overall-progress">
        <span class="progress-label">整体进度</span>
        <span class="progress-value">{{ overallProgress }}%</span>
      </div>
      <n-progress
        :percentage="overallProgress"
        :show-indicator="false"
        :height="8"
        color="#9D8AE7"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.generation-timeline {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;

  .timeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);

    .title {
      font-size: 16px;
      font-weight: 600;
      color: var(--color-text-primary, #1a1a1a);
      margin: 0;
    }
  }

  .timeline-content {
    flex: 1;
    position: relative;

    .timeline-item {
      display: flex;
      gap: 16px;
      padding: 12px 0;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        .timeline-item-content {
          background: rgba(157, 138, 231, 0.05);
        }
      }

      &.active {
        .timeline-item-content {
          background: rgba(157, 138, 231, 0.1);
          border-color: rgba(157, 138, 231, 0.3);
        }
      }

      // 节点样式
      .timeline-node {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;

        .node-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
          z-index: 2;
          transition: all 0.3s ease;
        }

        .node-line {
          width: 2px;
          flex: 1;
          min-height: 40px;
          background: rgba(157, 138, 231, 0.2);
          margin: 4px 0;
        }
      }

      // 状态样式
      &.completed {
        .node-dot {
          background: #34d399;
          color: white;
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
        }

        .node-line {
          background: linear-gradient(
            to bottom,
            #34d399,
            rgba(157, 138, 231, 0.2)
          );
        }
      }

      &.in-progress {
        .node-dot {
          background: #9d8ae7;
          color: white;
          box-shadow: 0 0 0 3px rgba(157, 138, 231, 0.3);
          animation: pulse 2s infinite;
        }

        .node-line {
          background: linear-gradient(
            to bottom,
            #9d8ae7,
            rgba(157, 138, 231, 0.2)
          );
        }
      }

      &.pending {
        .node-dot {
          background: white;
          color: var(--color-text-tertiary, #a8a4c8);
          border: 2px solid rgba(157, 138, 231, 0.3);
        }
      }

      &.failed {
        .node-dot {
          background: #ff4d4f;
          color: white;
          box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.2);
        }
      }

      // 内容区域
      .timeline-item-content {
        flex: 1;
        padding: 12px 16px;
        border-radius: 12px;
        border: 1px solid transparent;
        transition: all 0.2s ease;

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;

          .item-title-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;

            .item-icon {
              font-size: 16px;
              color: var(--color-primary, #9d8ae7);
            }

            .item-title {
              font-size: 14px;
              font-weight: 600;
              color: var(--color-text-primary, #1a1a1a);
            }
          }

          .status-tag {
            font-size: 11px;
          }
        }

        .item-description {
          font-size: 12px;
          color: var(--color-text-secondary, #6b6690);
          margin: 0 0 12px;
          line-height: 1.5;
        }

        .item-progress {
          margin-bottom: 12px;

          .progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;

            .progress-text {
              font-size: 12px;
              color: var(--color-primary, #9d8ae7);
              font-weight: 500;
            }
          }

          .progress-bar {
            :deep(.n-progress-rail) {
              background: rgba(157, 138, 231, 0.15);
            }
          }
        }

        .item-details {
          font-size: 12px;
          color: var(--color-warning, #f59e0b);
          margin: 0 0 12px;
          padding: 6px 10px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 6px;
        }

        .item-actions {
          display: flex;
          gap: 8px;
        }
      }
    }
  }

  .timeline-footer {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(157, 138, 231, 0.1);

    .overall-progress {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .progress-label {
        font-size: 13px;
        color: var(--color-text-secondary, #6b6690);
      }

      .progress-value {
        font-size: 16px;
        font-weight: 600;
        color: var(--color-primary, #9d8ae7);
      }
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(157, 138, 231, 0.3);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(157, 138, 231, 0.15);
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .generation-timeline {
    background: rgba(16, 16, 32, 0.7);
    border-color: rgba(157, 78, 221, 0.2);

    .timeline-header {
      border-bottom-color: rgba(157, 78, 221, 0.15);

      .title {
        color: #e0e0e0;
      }
    }

    .timeline-content {
      .timeline-item {
        &.completed {
          .node-dot {
            background: #00d9a5;
            box-shadow: 0 0 0 3px rgba(0, 217, 165, 0.2);
          }

          .node-line {
            background: linear-gradient(
              to bottom,
              #00d9a5,
              rgba(157, 78, 221, 0.2)
            );
          }
        }

        &.in-progress {
          .node-dot {
            background: #9d4edd;
            box-shadow: 0 0 0 3px rgba(157, 78, 221, 0.4);
            animation: neon-pulse 2s infinite;
          }
        }

        &.pending {
          .node-dot {
            background: rgba(16, 16, 32, 0.8);
            color: #a8a4c8;
            border-color: rgba(157, 78, 221, 0.3);
          }
        }

        .timeline-item-content {
          .item-header {
            .item-title-wrapper {
              .item-title {
                color: #e0e0e0;
              }
            }
          }

          .item-description {
            color: #a8a4c8;
          }
        }
      }
    }

    .timeline-footer {
      border-top-color: rgba(157, 78, 221, 0.15);
    }
  }
}

@keyframes neon-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 3px rgba(157, 78, 221, 0.4);
  }
  50% {
    box-shadow:
      0 0 0 6px rgba(157, 78, 221, 0.2),
      0 0 10px rgba(157, 78, 221, 0.5);
  }
}
</style>

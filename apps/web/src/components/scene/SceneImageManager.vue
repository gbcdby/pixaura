<script setup lang="ts">
/**
 * 场景图像管理器组件
 * 简化版：只管理一张全景图
 */
import { ref, computed, watch } from "vue";
import {
  NCard,
  NButton,
  NSpace,
  NImage,
  NEmpty,
  NTag,
  NTooltip,
  useMessage,
  NModal,
  NForm,
  NFormItem,
  NInput,
} from "naive-ui";
import { Wand2, RefreshCw, Loader2 } from "lucide-vue-next";
import type { SceneDetailDto } from "@pixaura/shared-types";

interface Props {
  scene: SceneDetailDto | null;
  projectId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "refresh"): void;
}>();

const message = useMessage();

// 生成状态
const generating = ref(false);
const taskId = ref<string | null>(null);

// 自定义提示词弹窗
const customPromptModalVisible = ref(false);
const customPrompt = ref("");

// 获取主图（全景图）
const mainImage = computed(() => {
  // panorama 是单个 SceneImageDto 对象
  if (props.scene?.images?.panorama) {
    return props.scene.images.panorama;
  }
  return null;
});

// 是否有主图
const hasMainImage = computed(() => {
  return mainImage.value !== null;
});

// 监听场景变化
watch(
  () => props.scene?.id,
  () => {
    generating.value = false;
    taskId.value = null;
  },
);

// 开始生成图片
const handleGenerateImage = async (withCustomPrompt = false) => {
  if (withCustomPrompt) {
    customPromptModalVisible.value = true;
    return;
  }

  await executeGenerate();
};

// 执行生成
const executeGenerate = async (prompt?: string) => {
  generating.value = true;

  try {
    const response = await fetch(
      `/api/scenes/${props.scene?.id}/images/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "panorama", // 只生成全景图
          customPrompt: prompt || undefined,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.msg || "生成失败");
    }

    const data = await response.json();
    taskId.value = data.data?.taskId;

    message.success("图片生成任务已创建，请稍候...");

    // 轮询任务状态
    pollTaskStatus();
  } catch (error) {
    generating.value = false;
    message.error(
      error instanceof Error ? error.message : "生成图片失败，请重试",
    );
  }
};

// 轮询任务状态
const pollTaskStatus = async () => {
  if (!taskId.value) return;

  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/tasks/${taskId.value}`);
      if (!response.ok) {
        clearInterval(pollInterval);
        generating.value = false;
        return;
      }

      const data = await response.json();
      const task = data.data;

      if (task?.status === "completed") {
        clearInterval(pollInterval);
        generating.value = false;
        taskId.value = null;
        message.success("图片生成完成");
        emit("refresh");
      } else if (task?.status === "failed") {
        clearInterval(pollInterval);
        generating.value = false;
        taskId.value = null;
        message.error(task.error?.message || "图片生成失败");
      }
    } catch {
      clearInterval(pollInterval);
      generating.value = false;
    }
  }, 2000);

  // 最多轮询 60 秒
  setTimeout(() => {
    clearInterval(pollInterval);
    if (generating.value) {
      generating.value = false;
      message.warning("生成超时，请刷新页面查看结果");
    }
  }, 60000);
};

// 确认自定义提示词生成
const handleConfirmCustomPrompt = async () => {
  customPromptModalVisible.value = false;
  await executeGenerate(customPrompt.value);
  customPrompt.value = "";
};

// 重新生成
const handleRegenerate = async () => {
  await executeGenerate();
};
</script>

<template>
  <NCard
    title="场景参考图"
    class="image-manager"
  >
    <!-- 图片预览区 -->
    <div class="image-preview-area">
      <div
        v-if="mainImage?.url"
        class="image-preview"
      >
        <NImage
          :src="mainImage.url"
          :preview-src="mainImage.url"
          object-fit="cover"
          class="preview-image"
        />
      </div>
      <NEmpty
        v-else-if="!generating"
        description="暂无图片，点击生成按钮创建"
        class="empty-state"
      >
        <template #icon>
          <Wand2 :size="48" />
        </template>
      </NEmpty>
      <div
        v-else
        class="generating-state"
      >
        <Loader2
          :size="32"
          class="spin-icon"
        />
        <span>正在生成图片...</span>
      </div>
    </div>

    <!-- 生成信息 -->
    <div
      v-if="mainImage && !generating"
      class="generation-info"
    >
      <NSpace>
        <NTag
          v-if="mainImage.createdAt"
          size="small"
        >
          生成时间: {{ new Date(mainImage.createdAt).toLocaleDateString() }}
        </NTag>
      </NSpace>
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <NSpace>
        <NTooltip v-if="hasMainImage && !generating">
          <template #trigger>
            <NButton
              quaternary
              @click="handleGenerateImage(true)"
            >
              <template #icon>
                <Wand2 :size="16" />
              </template>
              自定义生成
            </NButton>
          </template>
          使用自定义提示词补充生成
        </NTooltip>

        <NButton
          v-if="hasMainImage && !generating"
          type="primary"
          ghost
          @click="handleRegenerate"
        >
          <template #icon>
            <RefreshCw :size="16" />
          </template>
          重新生成
        </NButton>

        <NButton
          v-if="!hasMainImage && !generating"
          type="primary"
          @click="handleGenerateImage()"
        >
          <template #icon>
            <Wand2 :size="16" />
          </template>
          生成全景图
        </NButton>

        <NButton
          v-if="generating"
          disabled
        >
          <template #icon>
            <Loader2
              :size="16"
              class="spin-icon"
            />
          </template>
          生成中...
        </NButton>
      </NSpace>
    </div>
  </NCard>

  <!-- 自定义提示词弹窗 -->
  <NModal
    v-model:show="customPromptModalVisible"
    preset="card"
    title="自定义提示词生成"
    style="width: 400px"
  >
    <NForm label-placement="top">
      <NFormItem label="补充提示词">
        <NInput
          v-model:value="customPrompt"
          type="textarea"
          placeholder="输入额外的提示词，会追加到基础描述后"
          :rows="3"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="customPromptModalVisible = false">
          取消
        </NButton>
        <NButton
          type="primary"
          @click="handleConfirmCustomPrompt"
        >
          开始生成
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.image-manager {
  .image-preview-area {
    aspect-ratio: 16 / 9;
    background: var(--card-color);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: center;

    .image-preview {
      width: 100%;
      height: 100%;

      .preview-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .empty-state {
      color: var(--text-color-3);
    }

    .generating-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: var(--primary-color);
    }
  }

  .generation-info {
    margin-bottom: 16px;
    padding: 12px;
    background: var(--code-color);
    border-radius: 4px;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
  }
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

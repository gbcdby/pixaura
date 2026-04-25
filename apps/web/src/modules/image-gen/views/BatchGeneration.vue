<template>
  <div class="batch-generation-page">
    <PageHeader
      title="批量生成"
      :breadcrumb="breadcrumb"
    />

    <div class="page-content two-column">
      <!-- 左侧：参数设置 -->
      <div class="settings-panel">
        <n-card title="批量生成设置">
          <n-form
            ref="formRef"
            :model="config"
            :rules="rules"
          >
            <!-- 模型选择 -->
            <n-form-item
              label="生成模型"
              path="modelId"
            >
              <n-select
                v-model:value="config.modelId"
                :options="modelOptions"
                placeholder="选择生成模型"
              />
            </n-form-item>

            <!-- 场景类型 -->
            <n-form-item
              label="生成类型"
              path="sceneType"
            >
              <n-radio-group v-model:value="sceneType">
                <n-radio-button value="character_views">
                  角色四视图
                </n-radio-button>
                <n-radio-button value="prop_views">
                  道具三视图
                </n-radio-button>
                <n-radio-button value="scene_views">
                  场景视图
                </n-radio-button>
              </n-radio-group>
            </n-form-item>

            <!-- 基础描述 -->
            <n-form-item
              label="基础描述"
              path="basePrompt"
            >
              <n-input
                v-model:value="config.basePrompt"
                type="textarea"
                :rows="4"
                placeholder="描述基础内容，所有图片共享这部分描述..."
                maxlength="1000"
                show-count
              />
            </n-form-item>

            <!-- 负面提示词 -->
            <n-form-item
              label="不想出现的内容"
              path="negativePrompt"
            >
              <n-input
                v-model:value="config.negativePrompt"
                type="textarea"
                :rows="2"
                placeholder="描述你不想要的元素..."
                maxlength="500"
                show-count
              />
            </n-form-item>

            <!-- 尺寸选择 -->
            <n-form-item
              label="图片尺寸"
              path="size"
            >
              <n-radio-group v-model:value="selectedSize">
                <n-radio-button
                  v-for="size in sizeOptions"
                  :key="size.value"
                  :value="size.value"
                >
                  {{ size.label }}
                </n-radio-button>
              </n-radio-group>
            </n-form-item>

            <!-- 种子设置 -->
            <n-form-item
              label="共享种子"
              path="shareSeed"
            >
              <n-switch v-model:value="config.shareSeed" />
              <span class="help-text">开启后所有图片使用相同种子，保持风格一致</span>
            </n-form-item>

            <n-form-item
              v-if="config.shareSeed"
              label="基础种子"
              path="baseSeed"
            >
              <n-input-number
                v-model:value="config.baseSeed"
                :min="0"
                :max="2147483647"
                placeholder="随机"
              />
              <n-button
                text
                @click="randomSeed"
              >
                随机
              </n-button>
            </n-form-item>
          </n-form>

          <div class="cost-estimate">
            <span>预估消耗</span>
            <span class="cost">{{ estimatedCost }} 积分</span>
          </div>

          <n-button
            type="primary"
            size="large"
            block
            :loading="submitting"
            @click="handleSubmit"
          >
            开始生成 ({{ batchCount }}张)
          </n-button>
        </n-card>
      </div>

      <!-- 右侧：预览和历史 -->
      <div class="preview-panel">
        <n-card title="实时预览">
          <!-- 生成进度 -->
          <ImageGenerationProgress
            v-if="activeTask"
            :progress="activeTask.progress"
            :status="activeTask.status"
          />

          <!-- 结果预览 -->
          <ImageResultGrid
            v-if="activeTask?.results?.length"
            :results="activeTask.results"
            @regenerate="handleRegenerate"
          />

          <n-empty
            v-else
            description="提交任务后将在此显示进度和结果"
          />
        </n-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import {
  NCard,
  NButton,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NSwitch,
  type FormRules,
} from "naive-ui";
import PageHeader from "@/components/PageHeader.vue";
import ImageGenerationProgress from "../components/ImageGenerationProgress.vue";
import ImageResultGrid from "../components/ImageResultGrid.vue";
import { useImageGenerationStore } from "@/stores/imageGeneration";
import type { BatchGenerationConfig } from "@pixaura/shared-types";

const route = useRoute();
const imageGenStore = useImageGenerationStore();

const projectId = computed(() => route.params.id as string);

const breadcrumb = [
  { name: "项目", path: "/projects" },
  { name: "图片生成", path: `/projects/${projectId.value}/image-gen` },
  { name: "批量生成" },
];

// 批量项配置
const batchItemsMap: Record<
  string,
  Array<{ type: string; promptSuffix: string }>
> = {
  character_views: [
    {
      type: "front_view",
      promptSuffix: "front view, facing camera, full body",
    },
    {
      type: "side_view",
      promptSuffix: "side view, 90 degree profile, full body",
    },
    {
      type: "back_view",
      promptSuffix: "back view, facing away from camera, full body",
    },
    {
      type: "angle_view",
      promptSuffix: "45 degree angle view, three-quarter view, full body",
    },
  ],
  prop_views: [
    { type: "front_view", promptSuffix: "front view" },
    { type: "side_view", promptSuffix: "side view" },
    { type: "top_view", promptSuffix: "top view" },
  ],
  scene_views: [
    { type: "panoramic", promptSuffix: "panoramic view" },
    { type: "day", promptSuffix: "daytime lighting" },
    { type: "night", promptSuffix: "nighttime lighting" },
  ],
};

const sceneType = ref("character_views");

// 生成配置
const config = ref<BatchGenerationConfig>({
  modelId: "default",
  basePrompt: "",
  negativePrompt: "",
  width: 1024,
  height: 1024,
  shareSeed: true,
  baseSeed: undefined,
  items: batchItemsMap.character_views.map((item, index) => ({
    ...item,
    index,
  })),
});

const formRef = ref<InstanceType<typeof NForm>>();
const submitting = ref(false);
const currentTaskId = ref<string | null>(null);

// 批量数量
const batchCount = computed(() => batchItemsMap[sceneType.value]?.length || 0);

// 预估成本（0.5 CNY = 50 积分/张）
const estimatedCost = computed(() => batchCount.value * 50);

// 尺寸选项
const sizeOptions = [
  { value: "1024x1024", label: "1:1 (1024x1024)", width: 1024, height: 1024 },
  { value: "768x1344", label: "9:16 (768x1344)", width: 768, height: 1344 },
  { value: "1344x768", label: "16:9 (1344x768)", width: 1344, height: 768 },
  { value: "768x1024", label: "3:4 (768x1024)", width: 768, height: 1024 },
  { value: "1024x768", label: "4:3 (1024x768)", width: 1024, height: 768 },
];

// 计算当前选中的尺寸
const selectedSize = computed({
  get: () => {
    const { width, height } = config.value;
    const found = sizeOptions.find(
      (s) => s.width === width && s.height === height,
    );
    return found?.value || "1024x1024";
  },
  set: (val: string) => {
    const size = sizeOptions.find((s) => s.value === val);
    if (size) {
      config.value.width = size.width;
      config.value.height = size.height;
    }
  },
});

// 模型选项（待从 model-config 获取）
const modelOptions = ref([
  { label: "SD XL", value: "sd-xl" },
  { label: "SD 1.5", value: "sd-1.5" },
  { label: "Midjourney", value: "midjourney" },
]);

// 表单验证规则
const rules: FormRules = {
  modelId: { required: true, message: "请选择模型", trigger: "change" },
  basePrompt: {
    required: true,
    message: "请输入基础描述",
    trigger: "blur",
    max: 1000,
  },
  negativePrompt: { max: 500, message: "最多 500 字符", trigger: "blur" },
};

// 当前活跃任务
const activeTask = computed(() => {
  if (!currentTaskId.value) return null;
  return (
    imageGenStore.activeTasks.find((t) => t.id === currentTaskId.value) ||
    imageGenStore.taskList.find((t) => t.id === currentTaskId.value)
  );
});

// 轮询任务状态
let pollInterval: number | null = null;

function startPolling(taskId: string) {
  pollInterval = window.setInterval(async () => {
    await imageGenStore.fetchTaskDetail(taskId);
    const task = imageGenStore.currentTask;
    if (task && ["completed", "failed", "cancelled"].includes(task.status)) {
      stopPolling();
    }
  }, 2000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// 随机种子
function randomSeed() {
  config.value.baseSeed = Math.floor(Math.random() * 2147483647);
}

async function handleSubmit() {
  const valid = await formRef.value?.validate();
  if (!valid) return;

  submitting.value = true;
  try {
    // 更新 items 根据当前场景类型
    const items = batchItemsMap[sceneType.value].map((item, index) => ({
      ...item,
      index,
    }));

    const result = await imageGenStore.createBatchGeneration(projectId.value, {
      projectId: projectId.value,
      sceneType: sceneType.value as
        | "character_views"
        | "prop_views"
        | "scene_views",
      config: {
        ...config.value,
        items,
      },
      notifyWs: true,
    });

    currentTaskId.value = result.taskId;
    startPolling(result.taskId);
  } catch (error) {
    console.error("提交失败:", error);
  } finally {
    submitting.value = false;
  }
}

async function handleRegenerate(resultId: string) {
  await imageGenStore.regenerateImage(resultId, {});
}

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped lang="scss">
.batch-generation-page {
  padding: 24px;
}

.page-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
}

.settings-panel {
  max-width: 500px;
}

.help-text {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-color-3);
}

.cost-estimate {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 24px 0;
  padding: 12px 16px;
  background: var(--fill-color);
  border-radius: 8px;

  .cost {
    font-weight: bold;
    color: var(--primary-color);
  }
}

@media (max-width: 1024px) {
  .page-content {
    grid-template-columns: 1fr;
  }

  .settings-panel {
    max-width: 100%;
  }
}
</style>

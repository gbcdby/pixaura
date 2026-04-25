<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NCard,
  NButton,
  NInput,
  NForm,
  NFormItem,
  NTabs,
  NTabPane,
  NUpload,
  NIcon,
  NSpin,
  NSelect,
  NProgress,
  useMessage,
} from "naive-ui";
import {
  Sparkles,
  CloudUploadOutline,
  CreateOutline,
  ArrowBack,
} from "@vicons/ionicons5";
import { useScriptStore } from "@/modules/script/store";
import { useBillingStore } from "@/stores/billing";
import { useScriptModelsStore, renderModelLabelWithPrice, type ModelOptionWithPrice } from "@/stores/script-models";
import { useProjectStore } from "@/stores/project";
import type { UploadFileInfo, SelectOption } from "naive-ui";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const scriptStore = useScriptStore();
const billingStore = useBillingStore();
const scriptModelsStore = useScriptModelsStore();
const projectStore = useProjectStore();

const projectId = computed(() => route.params.id as string);

// 加载状态标记（用于判断数据是否已加载）
const dataLoaded = ref(false);

// 加载模型配置和项目详情（获取项目默认模型）
onMounted(async () => {
  if (projectId.value) {
    // 并行加载可用模型列表和项目详情
    await Promise.all([
      scriptModelsStore.loadModels(projectId.value),
      projectStore.fetchProjectDetail(projectId.value),
    ]);
    // 数据加载完成后，设置默认模型
    dataLoaded.value = true;
    if (defaultModelId.value && !aiForm.value.modelId) {
      aiForm.value.modelId = defaultModelId.value;
    }
  }
});

// 当前激活的tab
const activeTab = ref("ai");

// AI生成表单
const aiForm = ref({
  idea: "",
  targetDuration: "",
  characterCount: "",
  modelId: "",
});

// 模型选项
const modelOptions = computed(() => scriptModelsStore.textModelOptions);
const hasAvailableModels = computed(() => modelOptions.value.length > 0);
const isLoadingModels = computed(() => scriptModelsStore.isLoading);

// 渲染模型选项标签（带价格信息，两端对齐布局）
function renderModelLabel(option: SelectOption): ReturnType<typeof h> {
  return renderModelLabelWithPrice(option, modelOptions.value as ModelOptionWithPrice[]);
}

// 默认模型 - 优先使用项目设置的默认文本生成模型
const defaultModelId = computed<string>(() => {
  // 1. 优先使用项目设置的 TEXT_GENERATION 默认模型
  const projectDefaultModel = projectStore.modelConfigs?.TEXT_GENERATION;
  if (projectDefaultModel?.modelId) {
    return projectDefaultModel.modelId;
  }
  // 2. 使用剧本配置中的默认模型（仅编辑剧本时有效）
  const defaultFromScript = scriptModelsStore.getDefaultModelId("script");
  if (defaultFromScript) {
    return defaultFromScript;
  }
  // 3. 最后使用第一个可用模型（模型ID始终为字符串）
  const firstAvailable = modelOptions.value[0]?.value;
  return typeof firstAvailable === "string" ? firstAvailable : "";
});

// 监听默认模型变化，仅在数据加载后、用户未手动选择时生效
// 注意：不再使用 immediate，默认值在 onMounted 中设置
watch(defaultModelId, (newId) => {
  // 仅在数据加载完成且用户尚未手动选择模型时更新
  if (dataLoaded.value && newId && !aiForm.value.modelId) {
    aiForm.value.modelId = newId;
  }
});

// 手动创建表单
const manualForm = ref({
  title: "",
  description: "",
});
const uploadFileList = ref<UploadFileInfo[]>([]);

// 加载状态
const generating = computed(() => scriptStore.aiGenerating);
const loading = computed(() => scriptStore.loading);
const aiProgress = computed(() => scriptStore.aiProgress);

// 返回列表
function goBack() {
  router.push(`/projects/${projectId.value}/scripts`);
}

// 处理时长输入（限制数字和最大值）
function handleDurationInput(val: string) {
  // 只保留数字
  let numStr = val.replace(/[^0-9]/g, "");
  // 限制最大值300
  const num = parseInt(numStr, 10);
  if (num > 300) {
    numStr = "300";
    message.warning("预估时长最大为300分钟");
  }
  aiForm.value.targetDuration = numStr;
}

// 处理角色数输入（限制数字和最大值）
function handleCharacterCountInput(val: string) {
  // 只保留数字
  let numStr = val.replace(/[^0-9]/g, "");
  // 限制最大值100
  const num = parseInt(numStr, 10);
  if (num > 100) {
    numStr = "100";
    message.warning("主要角色数最大为100个");
  }
  aiForm.value.characterCount = numStr;
}

// 检查额度
async function checkQuota(): Promise<boolean> {
  await billingStore.fetchQuota();
  const quota = billingStore.quota;
  if (!quota) {
    message.warning("无法获取额度信息");
    return false;
  }

  // 管理员豁免额度检查
  if (billingStore.isAdmin) {
    return true;
  }

  // 检查订阅额度是否可用
  const textGenerationQuota = quota.quotas.categories.find(
    (q) => q.categoryId === "TEXT_GENERATION",
  );
  if (
    textGenerationQuota &&
    textGenerationQuota.canUseSubscription &&
    textGenerationQuota.smallCycle.remaining > 0
  ) {
    return true;
  }

  // 检查余额
  const balance = billingStore.balance;
  if (balance <= 0) {
    message.error("额度不足，请充值后再试");
    return false;
  }
  return true;
}

// AI生成剧本
async function handleAIGenerate() {
  if (!aiForm.value.idea.trim()) {
    message.error("请输入创意想法");
    return;
  }
  if (aiForm.value.idea.length < 10) {
    message.error("创意想法至少需要10个字符");
    return;
  }

  // 检查额度
  const hasQuota = await checkQuota();
  if (!hasQuota) {
    return;
  }

  try {
    const params: {
      idea: string;
      targetDuration?: number;
      characterCount?: number;
      modelId?: string;
    } = {
      idea: aiForm.value.idea,
    };

    // 仅在填写时传递参数（输入时已限制边界值）
    if (aiForm.value.targetDuration !== "") {
      params.targetDuration = parseInt(aiForm.value.targetDuration, 10);
    }
    if (aiForm.value.characterCount !== "") {
      params.characterCount = parseInt(aiForm.value.characterCount, 10);
    }
    if (aiForm.value.modelId) {
      params.modelId = aiForm.value.modelId;
    }

    const response = (await scriptStore.generateScript(
      projectId.value,
      params,
    )) as unknown as { scriptId: string; taskId?: string };

    message.success("剧本生成任务已创建，正在绘梦中...");

    // 直接跳转到剧本编辑页面，传递taskId用于订阅WebSocket进度
    router.push({
      path: `/projects/${projectId.value}/scripts/${response.scriptId}`,
      query: response.taskId ? { taskId: response.taskId } : undefined,
    });
  } catch {
    message.error("生成失败，请稍后重试");
  }
}

// 手动创建剧本
async function handleManualCreate() {
  if (!manualForm.value.title.trim()) {
    message.error("请输入剧本标题");
    return;
  }
  if (!manualForm.value.description.trim()) {
    message.error("请输入剧本描述");
    return;
  }

  try {
    const response = await scriptStore.createScript(projectId.value, {
      title: manualForm.value.title,
      description: manualForm.value.description || undefined,
      content: {
        characters: [],
        scenes: [],
        props: [],
        shotGroups: [],
        bgmTracks: [],
      },
      metadata: {
        source: "manual",
        totalScenes: 0,
        totalParagraphs: 0,
        wordCount: 0,
        aiGenerated: false,
      },
    });

    message.success("剧本创建成功");
    router.push(
      `/projects/${projectId.value}/scripts/${(response as unknown as { id: string }).id}`,
    );
  } catch {
    message.error("创建失败，请稍后重试");
  }
}

// 处理文件上传（用于手动创建页面的导入）
async function handleFileUpload(options: {
  file: UploadFileInfo;
  onFinish?: () => void;
  onError?: () => void;
}) {
  const file = options.file.file;
  if (!file) return;

  // 检查文件格式
  const validExtensions = [".txt", ".md"];
  const fileName = file.name.toLowerCase();
  const isValidFormat = validExtensions.some((ext) => fileName.endsWith(ext));
  if (!isValidFormat) {
    message.error("仅支持 .txt 或 .md 格式的文件");
    uploadFileList.value = [];
    return;
  }

  if (file.size && file.size > 5 * 1024 * 1024) {
    message.error("文件大小不能超过5MB");
    uploadFileList.value = [];
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    // 长度校验：描述上限10000
    if (content.length > 10000) {
      message.warning(`文件内容过长，已截取前10000字符显示`);
      manualForm.value.description = content.slice(0, 10000);
    } else {
      manualForm.value.description = content;
    }
    message.success("文件内容已导入到描述框");
    uploadFileList.value = [];
  };
  reader.onerror = () => {
    message.error("文件读取失败");
  };
  reader.readAsText(file);
}
</script>

<template>
  <div class="script-create-page">
    <!-- 页面标题栏 -->
    <n-card
      :bordered="false"
      class="header-card"
    >
      <div class="header-content">
        <n-button
          text
          @click="goBack"
        >
          <template #icon>
            <n-icon><ArrowBack /></n-icon>
          </template>
          返回列表
        </n-button>
        <div class="header-title">
          <h1>创建剧本</h1>
          <p class="subtitle">
            选择适合的方式创建你的剧本
          </p>
        </div>
      </div>
    </n-card>

    <!-- 创建选项卡 -->
    <n-card
      :bordered="false"
      class="create-card"
    >
      <n-tabs
        v-model:value="activeTab"
        type="line"
        animated
      >
        <!-- AI生成 -->
        <n-tab-pane
          name="ai"
          tab="AI生成"
        >
          <div class="tab-content">
            <n-spin :show="generating">
              <n-form
                label-placement="left"
                label-width="100px"
              >
                <n-form-item
                  label="创意想法"
                  required
                >
                  <n-input
                    v-model:value="aiForm.idea"
                    type="textarea"
                    :rows="6"
                    placeholder="描述你的创意想法，例如：一个关于失忆侦探在雨夜追查连环杀手的故事..."
                    :maxlength="5000"
                    show-count
                  />
                </n-form-item>

                <n-form-item label="预估时长">
                  <n-input
                    :value="aiForm.targetDuration"
                    type="text"
                    placeholder="不填写则不生效"
                    style="width: 200px"
                    @input="handleDurationInput"
                  >
                    <template #suffix>
                      分钟
                    </template>
                  </n-input>
                </n-form-item>

                <n-form-item label="主要角色数">
                  <n-input
                    :value="aiForm.characterCount"
                    type="text"
                    placeholder="不填写则不生效"
                    style="width: 200px"
                    @input="handleCharacterCountInput"
                  >
                    <template #suffix>
                      个
                    </template>
                  </n-input>
                </n-form-item>

                <n-form-item label="生成模型">
                  <n-select
                    v-if="hasAvailableModels"
                    v-model:value="aiForm.modelId"
                    :options="modelOptions"
                    :placeholder="
                      isLoadingModels ? '加载中...' : '选择生成模型'
                    "
                    style="width: 280px"
                    :disabled="isLoadingModels || generating"
                    :loading="isLoadingModels"
                    :render-label="renderModelLabel"
                  />
                  <span
                    v-else
                    class="no-model-hint"
                  >
                    {{ isLoadingModels ? "加载中..." : "暂无可用模型" }}
                  </span>
                </n-form-item>

                <n-form-item>
                  <n-button
                    type="primary"
                    size="large"
                    :loading="generating"
                    @click="handleAIGenerate"
                  >
                    <template #icon>
                      <n-icon><Sparkles /></n-icon>
                    </template>
                    开始生成
                  </n-button>
                </n-form-item>

                <!-- 生成进度 -->
                <div
                  v-if="generating"
                  class="progress-section"
                >
                  <n-progress
                    type="line"
                    :percentage="aiProgress"
                    :show-indicator="true"
                  />
                  <p class="progress-text">
                    AI正在生成剧本，请稍候...
                  </p>
                </div>
              </n-form>
            </n-spin>
          </div>
        </n-tab-pane>

        <!-- 手动创建 -->
        <n-tab-pane
          name="manual"
          tab="手动创建"
        >
          <div class="tab-content">
            <n-form
              label-placement="left"
              label-width="100px"
            >
              <n-form-item
                label="剧本标题"
                required
              >
                <n-input
                  v-model:value="manualForm.title"
                  placeholder="输入剧本标题"
                  :maxlength="50"
                  show-count
                />
              </n-form-item>

              <n-form-item
                label="剧本描述"
                required
              >
                <n-input
                  v-model:value="manualForm.description"
                  type="textarea"
                  :rows="10"
                  placeholder="输入剧本描述"
                  :maxlength="10000"
                  show-count
                />
              </n-form-item>

              <n-form-item>
                <n-space>
                  <n-button
                    type="primary"
                    size="large"
                    :loading="loading"
                    @click="handleManualCreate"
                  >
                    <template #icon>
                      <n-icon><CreateOutline /></n-icon>
                    </template>
                    创建剧本
                  </n-button>
                  <n-upload
                    v-model:file-list="uploadFileList"
                    :max="1"
                    accept=".txt,.md"
                    :custom-request="handleFileUpload"
                    :show-file-list="false"
                  >
                    <n-button size="large">
                      <template #icon>
                        <n-icon><CloudUploadOutline /></n-icon>
                      </template>
                      导入文件
                    </n-button>
                  </n-upload>
                </n-space>
                <p class="upload-tip">
                  支持导入 .txt 或 .md 文件到描述框（最大5MB）
                </p>
              </n-form-item>
            </n-form>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.script-create-page {
  padding-bottom: 24px;
}

.header-card {
  margin-bottom: 16px;

  :deep(.n-card__content) {
    padding: 16px 24px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;

    .header-title {
      flex: 1;

      h1 {
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0;
      }

      .subtitle {
        font-size: 13px;
        color: #666;
        margin: 4px 0 0;
      }
    }
  }
}

.create-card {
  :deep(.n-card__content) {
    padding: 24px;
  }
}

.tab-content {
  padding: 24px 0;
  max-width: 800px;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 300px;

  :deep(.n-slider) {
    flex: 1;
  }

  .slider-value {
    font-size: 14px;
    color: #666;
    min-width: 60px;
  }
}

.progress-section {
  margin-top: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;

  .progress-text {
    margin: 12px 0 0;
    font-size: 14px;
    color: #666;
    text-align: center;
  }
}

.upload-section {
  :deep(.n-upload) {
    width: 100%;
  }

  :deep(.n-upload-trigger) {
    width: 100%;
  }
}

.upload-dragger-content {
  padding: 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.or-divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: #999;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: #e8e8e8;
  }

  span {
    padding: 0 16px;
    font-size: 14px;
  }
}

.upload-tip {
  margin: 0 12px;
  font-size: 12px;
  color: #999;
}

.no-model-hint {
  font-size: 13px;
  color: #999;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, h } from "vue";
import type { FormInst } from "naive-ui";
import {
  NCard,
  NButton,
  NDataTable,
  NTag,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NInputNumber,
  NRadioGroup,
  NRadio,
  useMessage,
  useDialog,
  NIcon,
  NDivider,
  NSlider,
  NGrid,
  NGi,
  NTabs,
  NTabPane,
} from "naive-ui";
import { useModelConfigStore } from "@/stores/model-config";
import type {
  AdminModelListItemDto,
  CreateModelDto,
  UpdateModelDto,
  BillingMode,
} from "@/types/model-config";
import {
  FunctionCategory as FC,
  type FunctionCategory,
} from "@pixaura/shared-types";
import {
  getDefaultParamsByCategory,
  TextGenerationParams,
  ImageGenerationParams,
  VideoGenerationParams,
  IMAGE_SIZE_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  VIDEO_GENERATION_MODE_OPTIONS,
} from "@/types/model-config";
import type { DataTableColumns } from "naive-ui";
import { Refresh, Add, Create, Trash, Cube, Search } from "@vicons/ionicons5";

const message = useMessage();
const dialog = useDialog();
const store = useModelConfigStore();

// 功能类别选项（排除音频生成和语音生成，TTS 模型在 TTS 配置中独立管理）
// 注：LIP_SYNC 是计费类别，不属于模型配置系统，对口型配置在独立的管理页面
const categoryOptions: Array<{ label: string; value: FC }> = [
  { label: "文本生成", value: FC.TEXT_GENERATION },
  { label: "图像生成", value: FC.IMAGE_GENERATION },
  { label: "视频生成", value: FC.VIDEO_GENERATION },
  { label: "音频生成", value: FC.AUDIO_GENERATION },
];

// 功能类别映射
const categoryMap: Record<string, string> = {
  TEXT_GENERATION: "文本生成",
  IMAGE_GENERATION: "图像生成",
  VIDEO_GENERATION: "视频生成",
  AUDIO_GENERATION: "音频生成",
  VOICE_GENERATION: "语音生成",
  LIP_SYNC: "对口型",
};

// 订阅等级选项
const tierOptions = [
  { label: "免费", value: "free" },
  { label: "基础", value: "basic" },
  { label: "专业", value: "pro" },
];

// 视频时长选项（多选）- 默认选项 3-15
const durationOptions = Array.from({ length: 13 }, (_, i) => i + 3).map(
  (v) => ({
    label: `${v}秒`,
    value: v,
  }),
);

// 视频生成方式选项（使用从类型文件导入的常量）
const generationModeOptions = VIDEO_GENERATION_MODE_OPTIONS;

// 创建自定义时长标签的校验函数
function createDurationTag(label: string): { label: string; value: number } {
  // 提取数字部分
  const num = parseInt(label.replace(/[^0-9]/g, ""), 10);
  // 校验：必须是正整数且在合理范围内（1-3600秒）
  if (Number.isNaN(num) || num < 1 || num > 3600) {
    // 返回一个无效值，让 Naive UI 知道创建失败
    throw new Error("请输入有效的正整数（1-3600）");
  }
  return {
    label: `${num}秒`,
    value: num,
  };
}

// 搜索和筛选
const searchQuery = ref("");
const filterCategory = ref<string>("");
const filterProvider = ref<string>("");
const filterMinTier = ref<string>("");

// 供应商选项（用于筛选）
const providerFilterOptions = computed(() => {
  const providers = store.providers.map((p) => ({
    label: p.providerName,
    value: p.providerId,
  }));
  return [{ label: "全部", value: "" }, ...providers];
});

// 类别筛选选项（添加"全部"）
const categoryFilterOptions = [
  { label: "全部", value: "" },
  ...categoryOptions,
];

// 等级筛选选项（添加"全部"）
const tierFilterOptions = [{ label: "全部", value: "" }, ...tierOptions];

// 过滤后的模型列表
const filteredModels = computed(() => {
  // 排除语音生成类别（TTS 模型在 TTS 配置中独立管理）
  let result = store.models.filter(
    (model) => model.category !== "VOICE_GENERATION",
  );

  // 按模型名称搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      (model) =>
        model.modelName.toLowerCase().includes(query) ||
        model.modelId.toLowerCase().includes(query),
    );
  }

  // 按功能类别筛选
  if (filterCategory.value) {
    result = result.filter((model) => model.category === filterCategory.value);
  }

  // 按供应商筛选
  if (filterProvider.value) {
    result = result.filter(
      (model) => model.providerId === filterProvider.value,
    );
  }

  // 按最低等级筛选
  if (filterMinTier.value) {
    result = result.filter((model) => model.minTier === filterMinTier.value);
  }

  return result;
});

// 清除筛选
function clearFilters() {
  searchQuery.value = "";
  filterCategory.value = "";
  filterProvider.value = "";
  filterMinTier.value = "";
}

// 表格列定义
const columns: DataTableColumns<AdminModelListItemDto> = [
  {
    title: "模型 ID",
    key: "modelId",
    width: 150,
  },
  {
    title: "模型名称",
    key: "modelName",
    width: 150,
  },
  {
    title: "功能类别",
    key: "category",
    width: 100,
    render(row) {
      return categoryMap[row.category] || row.category;
    },
  },
  {
    title: "供应商",
    key: "providerName",
    width: 120,
  },
  {
    title: "最低等级",
    key: "minTier",
    width: 100,
    render(row) {
      const tierMap: Record<string, string> = {
        free: "免费",
        basic: "基础",
        pro: "专业",
      };
      return tierMap[row.minTier] || row.minTier;
    },
  },
  {
    title: "默认",
    key: "isDefault",
    width: 80,
    render(row) {
      return row.isDefault
        ? h(NTag, { type: "primary", size: "small" }, { default: () => "是" })
        : "否";
    },
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      return h(
        NSwitch,
        {
          value: row.status === "enabled",
          onUpdateValue: (val: boolean) => handleStatusChange(row, val),
        },
        {
          checked: () => "启用",
          unchecked: () => "禁用",
        },
      );
    },
  },
  {
    title: "成本",
    key: "cost",
    width: 120,
    render(row) {
      if (row.costPer1kTokens) {
        return `￥${row.costPer1kTokens}/千 token`;
      }
      if (row.costPerCall) {
        return `￥${row.costPerCall}/次`;
      }
      if (row.costPerSecond) {
        return `￥${row.costPerSecond}/秒`;
      }
      return "-";
    },
  },
  {
    title: "售价",
    key: "price",
    width: 120,
    render(row) {
      if (row.pricePer1kTokens) {
        return `￥${row.pricePer1kTokens}/千 token`;
      }
      if (row.pricePerCall) {
        return `￥${row.pricePerCall}/次`;
      }
      if (row.pricePerSecond) {
        return `￥${row.pricePerSecond}/秒`;
      }
      return "-";
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 150,
    render(row) {
      return h(
        NSpace,
        {},
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                onClick: () => handleEdit(row),
              },
              {
                default: () => "编辑",
                icon: () => h(NIcon, null, { default: () => h(Create) }),
              },
            ),
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                type: "error",
                onClick: () => handleDelete(row),
              },
              {
                default: () => "删除",
                icon: () => h(NIcon, null, { default: () => h(Trash) }),
              },
            ),
          ],
        },
      );
    },
  },
];

// 弹窗状态
const showModal = ref(false);
const isEditing = ref(false);
const currentModel = ref<AdminModelListItemDto | null>(null);

// 自定义参数子弹窗
const showCustomParamsModal = ref(false);
const customParamsEdit = ref<Array<{ key: string; value: string; type: "string" | "number" | "boolean" }>>([]);

// 表单引用
const formRef = ref<FormInst | null>(null);

// 远程模型列表
const remoteModels = ref<
  Array<{ id: string; name: string; description?: string }>
>([]);
const loadingRemoteModels = ref(false);

// 表单数据
const formData = ref<CreateModelDto>({
  modelId: "",
  modelName: "",
  providerId: null as unknown as string,
  providerModelId: null as unknown as string,
  category: "TEXT_GENERATION",
  description: "",
  minTier: "free",
  isDefault: false,
  billingMode: "per_token",
  costPer1kTokens: 0,
  pricePer1kTokens: 0,
  costPerCall: 0,
  pricePerCall: 0,
  costPerSecond: 0,
  pricePerSecond: 0,
  defaultParams: {},
  customParams: {},
  supportedFeatures: [],
});

// 供应商选项（用于下拉选择，支持搜索）
const providerOptions = computed(() => {
  return store.providers.map((p) => ({
    label: `${p.providerName} (${p.providerId})`,
    value: p.providerId,
  }));
});

// 远程模型选项（用于下拉选择，只显示 ID）
const remoteModelOptions = computed(() => {
  return remoteModels.value.map((m) => ({
    label: m.id,
    value: m.id,
  }));
});

// 供应商变化时自动获取模型列表
function onProviderChange(value: string) {
  if (value) {
    // 清空已选择的模型 - 使用 null 而不是空字符串，确保 placeholder 显示
    formData.value.providerModelId = null as unknown as string;
    formData.value.modelId = "";
    formData.value.modelName = "";
    formData.value.description = "";
    // 获取远程模型列表
    fetchRemoteModels();
  } else {
    remoteModels.value = [];
  }
}

// 当类别变化时重置默认参数
function onCategoryChange(value: FunctionCategory) {
  formData.value.defaultParams = getDefaultParamsByCategory(value) as Record<
    string,
    unknown
  >;
}

// 将 DB 中可能存在的 camelCase defaultParams 规范化为 snake_case
function normalizeSavedParams(
  category: string,
  saved: Record<string, unknown>,
): Record<string, unknown> {
  if (category === "IMAGE_GENERATION") {
    const r: Record<string, unknown> = {};
    const v = (k1: string, k2: string) => saved[k1] ?? saved[k2];
    if (v("image_size", "imageSize") !== undefined)
      r.image_size = v("image_size", "imageSize");
    if (saved.quality !== undefined) r.quality = saved.quality;
    if (saved.number !== undefined) r.number = saved.number;
    if (v("max_references", "maxReferences") !== undefined)
      r.max_references = v("max_references", "maxReferences");
    if (v("size_mode", "sizeMode") !== undefined)
      r.size_mode = v("size_mode", "sizeMode");
    return r;
  }
  if (category === "VIDEO_GENERATION") {
    const r: Record<string, unknown> = {};
    const v = (k1: string, k2: string) => saved[k1] ?? saved[k2];
    if (v("aspect_ratio", "aspectRatio") !== undefined)
      r.aspect_ratio = v("aspect_ratio", "aspectRatio");
    if (saved.duration !== undefined) r.duration = saved.duration;
    if (saved.quality !== undefined) r.quality = saved.quality;
    if (v("generate_audio", "generateAudio") !== undefined)
      r.generate_audio = v("generate_audio", "generateAudio");
    if (v("generation_mode", "generationMode") !== undefined)
      r.generation_mode = v("generation_mode", "generationMode");
    if (v("max_references_images", "maxReferencesImages") !== undefined)
      r.max_references_images = v(
        "max_references_images",
        "maxReferencesImages",
      );
    if (v("max_references_videos", "maxReferencesVideos") !== undefined)
      r.max_references_videos = v(
        "max_references_videos",
        "maxReferencesVideos",
      );
    if (v("max_references_audios", "maxReferencesAudios") !== undefined)
      r.max_references_audios = v(
        "max_references_audios",
        "maxReferencesAudios",
      );
    return r;
  }
  // TEXT / AUDIO / LIP_SYNC 直接返回（字段名一致）
  return { ...saved };
}

// 类型守卫函数
function isTextGenerationParams(
  params: unknown,
): params is TextGenerationParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "temperature" in params &&
    "max_tokens" in params
  );
}

function isImageGenerationParams(
  params: unknown,
): params is ImageGenerationParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "image_size" in params &&
    "quality" in params &&
    "number" in params &&
    "max_references" in params
  );
}

function isVideoGenerationParams(
  params: unknown,
): params is VideoGenerationParams {
  return (
    typeof params === "object" &&
    params !== null &&
    "aspect_ratio" in params &&
    "duration" in params &&
    "quality" in params &&
    "generation_mode" in params
  );
}

import type { FormRules } from "naive-ui";

const formRules = {
  modelId: { required: true, message: "请输入模型 ID", trigger: "blur" },
  modelName: { required: true, message: "请输入模型名称", trigger: "blur" },
  category: { required: true, message: "请选择功能类别", trigger: "change" },
  providerId: { required: true, message: "请选择供应商", trigger: "change" },
} as FormRules;

// 加载数据
onMounted(() => {
  store.fetchModels();
  store.fetchProviders();
});

// 处理新增
function handleAdd() {
  isEditing.value = false;
  currentModel.value = null;
  const initialCategory: FunctionCategory = "TEXT_GENERATION";
  formData.value = {
    modelId: "",
    modelName: "",
    providerId: null as unknown as string,
    providerModelId: null as unknown as string,
    category: initialCategory,
    description: "",
    minTier: "free",
    isDefault: false,
    billingMode: "per_token",
    costPer1kTokens: 0,
    pricePer1kTokens: 0,
    costPerCall: 0,
    pricePerCall: 0,
    costPerSecond: 0,
    pricePerSecond: 0,
    defaultParams: getDefaultParamsByCategory(initialCategory) as Record<
      string,
      unknown
    >,
    customParams: {},
    supportedFeatures: [],
  };
  // 加载供应商列表
  if (store.providers.length === 0) {
    store.fetchProviders();
  }
  showModal.value = true;
}

// 从供应商获取模型列表
async function fetchRemoteModels() {
  if (!formData.value.providerId) {
    message.warning("请先选择供应商");
    return;
  }

  loadingRemoteModels.value = true;
  try {
    remoteModels.value = await store.fetchRemoteModels(
      formData.value.providerId,
    );
    if (remoteModels.value.length === 0) {
      message.warning("该供应商暂无可用模型");
    }
  } catch (error) {
    message.error(
      error instanceof Error ? error.message : "获取远程模型列表失败",
    );
  } finally {
    loadingRemoteModels.value = false;
  }
}

// 选择远程模型后自动填充
function onRemoteModelChange(value: string) {
  if (!value) return;

  const selectedModel = remoteModels.value.find((m) => m.id === value);
  if (selectedModel) {
    // 填充供应商模型 ID
    formData.value.providerModelId = selectedModel.id;
    // 默认本地模型 ID 与供应商一致
    formData.value.modelId = selectedModel.id;
    // 填充模型名称
    formData.value.modelName = selectedModel.name;
    // 填充描述（如果有）
    if (selectedModel.description) {
      formData.value.description = selectedModel.description;
    }
  }
}

// 处理编辑
function handleEdit(row: AdminModelListItemDto) {
  isEditing.value = true;
  currentModel.value = row;
  // 获取当前类别的默认参数，用于合并
  const categoryDefaults = getDefaultParamsByCategory(row.category);
  const savedNormalized = normalizeSavedParams(
    row.category,
    (row.defaultParams || {}) as Record<string, unknown>,
  );
  formData.value = {
    modelId: row.modelId,
    modelName: row.modelName,
    providerId: row.providerId === "-" ? "" : row.providerId,
    providerModelId: "",
    category: row.category,
    minTier: row.minTier as "free" | "basic" | "pro",
    isDefault: row.isDefault,
    billingMode: (row.billingMode as BillingMode) || "per_token",
    costPer1kTokens: row.costPer1kTokens || 0,
    pricePer1kTokens: row.pricePer1kTokens || 0,
    costPerCall: row.costPerCall || 0,
    pricePerCall: row.pricePerCall || 0,
    costPerSecond: row.costPerSecond || 0,
    pricePerSecond: row.pricePerSecond || 0,
    defaultParams: { ...categoryDefaults, ...savedNormalized },
    customParams: (row.customParams || {}) as Record<string, unknown>,
    supportedFeatures: [],
  };
  if (store.providers.length === 0) {
    store.fetchProviders();
  }
  showModal.value = true;
}

// 处理删除
function handleDelete(row: AdminModelListItemDto) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除模型 "${row.modelName}" 吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await store.deleteModel(row.modelId);
        message.success("删除成功");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "删除失败";
        message.error(errorMessage);
      }
    },
  });
}

// 处理状态切换
async function handleStatusChange(
  row: AdminModelListItemDto,
  enabled: boolean,
) {
  try {
    await store.updateModel(row.modelId, {
      status: enabled ? "enabled" : "disabled",
    });
    message.success("状态更新成功");
  } catch {
    message.error("状态更新失败");
  }
}

// 提交表单
async function handleSubmit() {
  // 先进行表单校验
  if (!formRef.value) return;

  // 动态设置校验规则：新建模式下需要校验 providerModelId
  if (!isEditing.value) {
    formRules.providerModelId = {
      required: true,
      message: "请选择供应商模型",
      trigger: "change",
    };
  } else {
    delete (formRules as any).providerModelId;
  }

  try {
    await formRef.value.validate();
  } catch (errors) {
    // 校验失败，返回错误
    return;
  }

  try {
    if (isEditing.value && currentModel.value) {
      const updateData: UpdateModelDto = {};
      if (formData.value.modelName)
        updateData.modelName = formData.value.modelName;
      if (formData.value.description)
        updateData.description = formData.value.description;
      if (formData.value.minTier) updateData.minTier = formData.value.minTier;
      if (formData.value.isDefault !== undefined)
        updateData.isDefault = formData.value.isDefault;
      if (formData.value.billingMode)
        updateData.billingMode = formData.value.billingMode;
      if (formData.value.billingMode === "per_token") {
        updateData.costPer1kTokens = formData.value.costPer1kTokens;
        updateData.pricePer1kTokens = formData.value.pricePer1kTokens;
      } else if (formData.value.billingMode === "per_call") {
        updateData.costPerCall = formData.value.costPerCall;
        updateData.pricePerCall = formData.value.pricePerCall;
      } else if (formData.value.billingMode === "per_second") {
        updateData.costPerSecond = formData.value.costPerSecond;
        updateData.pricePerSecond = formData.value.pricePerSecond;
      }
      if (formData.value.defaultParams) {
        updateData.defaultParams = formData.value.defaultParams;
      }
      if (formData.value.customParams) {
        updateData.customParams = formData.value.customParams;
      }

      await store.updateModel(currentModel.value.modelId, updateData);
      message.success("更新成功");
    } else {
      // 根据计费模式清理不需要的字段
      const createData: CreateModelDto = { ...formData.value };
      if (createData.billingMode === "per_token") {
        delete (createData as { costPerCall?: number }).costPerCall;
        delete (createData as { pricePerCall?: number }).pricePerCall;
        delete (createData as { costPerSecond?: number }).costPerSecond;
        delete (createData as { pricePerSecond?: number }).pricePerSecond;
      } else if (createData.billingMode === "per_call") {
        delete (createData as { costPer1kTokens?: number }).costPer1kTokens;
        delete (createData as { pricePer1kTokens?: number }).pricePer1kTokens;
        delete (createData as { costPerSecond?: number }).costPerSecond;
        delete (createData as { pricePerSecond?: number }).pricePerSecond;
      } else if (createData.billingMode === "per_second") {
        delete (createData as { costPer1kTokens?: number }).costPer1kTokens;
        delete (createData as { pricePer1kTokens?: number }).pricePer1kTokens;
        delete (createData as { costPerCall?: number }).costPerCall;
        delete (createData as { pricePerCall?: number }).pricePerCall;
      }

      // 清理空的 providerModelId
      if (!createData.providerModelId) {
        delete (createData as { providerModelId?: string }).providerModelId;
      }

      await store.createModel(createData);
      message.success("创建成功");
    }
    showModal.value = false;
  } catch {
    message.error(isEditing.value ? "更新失败" : "创建失败");
  }
}

// 打开自定义参数编辑弹窗
function openCustomParamsModal() {
  const entries: Array<{ key: string; value: string; type: "string" | "number" | "boolean" }> = [];
  const params = (formData.value.customParams || {}) as Record<string, unknown>;
  for (const [key, val] of Object.entries(params)) {
    const t = typeof val;
    if (t === "boolean") {
      entries.push({ key, value: String(val), type: "boolean" });
    } else if (t === "number") {
      entries.push({ key, value: String(val), type: "number" });
    } else {
      entries.push({ key, value: String(val ?? ""), type: "string" });
    }
  }
  customParamsEdit.value = entries.length > 0 ? entries : [{ key: "", value: "", type: "string" }];
  showCustomParamsModal.value = true;
}

// 保存自定义参数
function saveCustomParams() {
  const result: Record<string, unknown> = {};
  for (let i = 0; i < customParamsEdit.value.length; i++) {
    const row = customParamsEdit.value[i];
    if (!row.key.trim()) continue;
    const k = row.key.trim();
    if (row.type === "number") {
      const n = Number(row.value);
      if (Number.isNaN(n) || row.value.trim() === "") {
        message.error(`第 ${i + 1} 行：数字类型参数值无效，请输入有效数字`);
        return;
      }
      result[k] = n;
    } else if (row.type === "boolean") {
      result[k] = row.value === "true" || row.value === "1";
    } else {
      result[k] = row.value;
    }
  }
  formData.value.customParams = result;
  showCustomParamsModal.value = false;
}

// 添加一行自定义参数
function addCustomParamRow() {
  customParamsEdit.value.push({ key: "", value: "", type: "string" });
}

// 删除一行自定义参数
function removeCustomParamRow(index: number) {
  customParamsEdit.value.splice(index, 1);
  if (customParamsEdit.value.length === 0) {
    customParamsEdit.value.push({ key: "", value: "", type: "string" });
  }
}

// 刷新列表
async function handleRefresh() {
  await store.fetchModels();
  message.success("刷新成功");
}
</script>

<template>
  <div class="model-list page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <Cube />
        </n-icon>
        <span>模型管理</span>
      </div>
      <n-space>
        <n-button
          quaternary
          @click="handleRefresh"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button
          type="primary"
          @click="handleAdd"
        >
          <template #icon>
            <n-icon><Add /></n-icon>
          </template>
          新增模型
        </n-button>
      </n-space>
    </div>

    <n-divider class="page-divider" />

    <!-- 数据表格卡片 -->
    <n-card
      class="data-card"
      :bordered="false"
    >
      <!-- 搜索和筛选栏 -->
      <div class="filter-bar">
        <div class="filter-search">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索模型名称或 ID"
            clearable
            style="width: 280px"
          >
            <template #prefix>
              <n-icon :component="Search" />
            </template>
          </n-input>
        </div>
        <div class="filter-group">
          <n-select
            v-model:value="filterCategory"
            :options="categoryFilterOptions"
            placeholder="功能类别"
            clearable
            style="width: 140px"
          />
          <n-select
            v-model:value="filterProvider"
            :options="providerFilterOptions"
            placeholder="供应商"
            clearable
            style="width: 140px"
          />
          <n-select
            v-model:value="filterMinTier"
            :options="tierFilterOptions"
            placeholder="最低等级"
            clearable
            style="width: 120px"
          />
          <n-button
            v-if="
              searchQuery || filterCategory || filterProvider || filterMinTier
            "
            quaternary
            @click="clearFilters"
          >
            <template #icon>
              <n-icon :component="Refresh" />
            </template>
            清除
          </n-button>
        </div>
      </div>

      <n-data-table
        :columns="columns"
        :data="filteredModels"
        :loading="store.loading"
        :pagination="{ pageSize: 10 }"
        :bordered="false"
        :single-line="false"
        class="admin-table"
      />
    </n-card>

    <!-- 新增/编辑弹窗 -->
    <n-modal
      v-model:show="showModal"
      :title="isEditing ? '编辑模型' : '新增模型'"
      preset="card"
      style="width: 900px"
      :bordered="false"
      class="admin-modal"
    >
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100"
        label-align="left"
      >
        <n-tabs type="line" animated>
          <!-- Tab 1: 基本信息（含计费） -->
          <n-tab-pane name="basic" tab="基本信息">
            <!-- 基础信息 -->
            <n-grid :cols="3" :x-gap="16">
              <n-gi>
                <n-form-item label="供应商" path="providerId">
                  <n-select
                    v-model:value="formData.providerId"
                    :options="providerOptions"
                    placeholder="请选择供应商"
                    :disabled="isEditing"
                    filterable
                    @update:value="onProviderChange"
                  />
                </n-form-item>
              </n-gi>
              <n-gi v-if="!isEditing">
                <n-form-item label="供应商模型" path="providerModelId">
                  <n-select
                    v-model:value="formData.providerModelId"
                    :options="remoteModelOptions"
                    placeholder="先选供应商"
                    :loading="loadingRemoteModels"
                    filterable
                    @update:value="onRemoteModelChange"
                  />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="模型 ID" path="modelId">
                  <n-input
                    v-model:value="formData.modelId"
                    placeholder="如：qwen2.5-72b"
                    :disabled="isEditing"
                  />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="模型名称" path="modelName">
                  <n-input
                    v-model:value="formData.modelName"
                    placeholder="请输入模型名称"
                  />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="功能类别" path="category">
                  <n-select
                    v-model:value="formData.category"
                    :options="categoryOptions"
                    @update:value="onCategoryChange"
                  />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="最低等级">
                  <n-select
                    v-model:value="formData.minTier"
                    :options="tierOptions"
                  />
                </n-form-item>
              </n-gi>
              <n-gi>
                <n-form-item label="设为默认">
                  <n-switch v-model:value="formData.isDefault" />
                </n-form-item>
              </n-gi>
            </n-grid>
            <n-grid :cols="3" :x-gap="16">
              <n-gi span="3">
                <n-form-item label="模型描述">
                  <n-input
                    v-model:value="formData.description"
                    placeholder="请输入模型描述"
                  />
                </n-form-item>
              </n-gi>
            </n-grid>

            <!-- 计费配置 -->
            <n-divider style="margin: 4px 0 12px;" />
            <n-grid :cols="3" :x-gap="16">
              <n-gi>
                <n-form-item label="计费模式">
                  <n-radio-group v-model:value="formData.billingMode" size="small">
                    <n-radio value="per_token">按 Token</n-radio>
                    <n-radio value="per_call">按次</n-radio>
                    <n-radio value="per_second">按秒</n-radio>
                  </n-radio-group>
                </n-form-item>
              </n-gi>
              <template v-if="formData.billingMode === 'per_token'">
                <n-gi key="per_token_cost">
                  <n-form-item label="成本价">
                    <n-input-number
                      v-model:value="formData.costPer1kTokens"
                      :min="0"
                      :precision="4"
                      placeholder="0.0001"
                    >
                      <template #suffix>元/千token</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
                <n-gi key="per_token_price">
                  <n-form-item label="售价">
                    <n-input-number
                      v-model:value="formData.pricePer1kTokens"
                      :min="0"
                      :precision="4"
                      placeholder="0.0001"
                    >
                      <template #suffix>元/千token</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
              </template>
              <template v-else-if="formData.billingMode === 'per_call'">
                <n-gi key="per_call_cost">
                  <n-form-item label="成本价">
                    <n-input-number
                      v-model:value="formData.costPerCall"
                      :min="0"
                      :precision="2"
                      placeholder="0.01"
                    >
                      <template #suffix>元/次</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
                <n-gi key="per_call_price">
                  <n-form-item label="售价">
                    <n-input-number
                      v-model:value="formData.pricePerCall"
                      :min="0"
                      :precision="2"
                      placeholder="0.01"
                    >
                      <template #suffix>元/次</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
              </template>
              <template v-else-if="formData.billingMode === 'per_second'">
                <n-gi key="per_second_cost">
                  <n-form-item label="成本价">
                    <n-input-number
                      v-model:value="formData.costPerSecond"
                      :min="0"
                      :precision="4"
                      placeholder="0.0001"
                    >
                      <template #suffix>元/秒</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
                <n-gi key="per_second_price">
                  <n-form-item label="售价">
                    <n-input-number
                      v-model:value="formData.pricePerSecond"
                      :min="0"
                      :precision="4"
                      placeholder="0.0001"
                    >
                      <template #suffix>元/秒</template>
                    </n-input-number>
                  </n-form-item>
                </n-gi>
              </template>
            </n-grid>
          </n-tab-pane>

          <!-- Tab 2: 模型参数 -->
          <n-tab-pane name="params" tab="模型参数">
            <!-- 默认参数配置 -->
            <div class="param-section-title">默认参数</div>

            <!-- 文本生成参数 -->
            <template
              v-if="
                formData.category === 'TEXT_GENERATION' &&
                  isTextGenerationParams(formData.defaultParams)
              "
            >
              <n-grid :cols="2" :x-gap="16">
                <n-gi>
                  <n-form-item label="随机性 (temperature)">
                    <n-space align="center">
                      <n-slider
                        v-model:value="formData.defaultParams.temperature"
                        :min="0"
                        :max="2"
                        :step="0.1"
                        style="width: 150px"
                      />
                      <n-input-number
                        v-model:value="formData.defaultParams.temperature"
                        :min="0"
                        :max="2"
                        :step="0.1"
                        style="width: 80px"
                      />
                    </n-space>
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="最大 Token 数">
                    <n-input-number
                      v-model:value="formData.defaultParams.max_tokens"
                      :min="1000"
                      :max="128000"
                      style="width: 150px"
                    />
                  </n-form-item>
                </n-gi>
              </n-grid>
            </template>

            <!-- 图像生成参数 -->
            <template
              v-if="
                formData.category === 'IMAGE_GENERATION' &&
                  isImageGenerationParams(formData.defaultParams)
              "
            >
              <n-grid :cols="3" :x-gap="16">
                <n-gi>
                  <n-form-item label="尺寸模式">
                    <n-radio-group
                      v-model:value="formData.defaultParams.size_mode"
                      size="small"
                    >
                      <n-radio value="ratio">比例模式</n-radio>
                      <n-radio value="pixel">像素模式</n-radio>
                    </n-radio-group>
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="图片尺寸">
                    <n-select
                      v-model:value="formData.defaultParams.image_size"
                      filterable
                      tag
                      :placeholder="formData.defaultParams.size_mode === 'pixel' ? '如 720*1080' : '请选择或输入'"
                      :options="IMAGE_SIZE_OPTIONS"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="图片质量">
                    <n-select
                      v-model:value="formData.defaultParams.quality"
                      filterable
                      tag
                      clearable
                      placeholder="请选择或输入"
                      :options="IMAGE_QUALITY_OPTIONS"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="生成数量">
                    <n-space align="center">
                      <n-slider
                        v-model:value="formData.defaultParams.number"
                        :min="1"
                        :max="4"
                        :step="1"
                        style="width: 100px"
                      />
                      <n-input-number
                        v-model:value="formData.defaultParams.number"
                        :min="1"
                        :max="4"
                        style="width: 80px"
                      />
                    </n-space>
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="最大参考图数">
                    <n-input-number
                      v-model:value="formData.defaultParams.max_references"
                      :min="0"
                      :max="20"
                      style="width: 80px"
                    />
                  </n-form-item>
                </n-gi>
              </n-grid>
            </template>

            <!-- 视频生成参数 -->
            <template
              v-if="
                formData.category === 'VIDEO_GENERATION' &&
                  isVideoGenerationParams(formData.defaultParams)
              "
            >
              <n-grid :cols="3" :x-gap="16">
                <n-gi>
                  <n-form-item label="视频比例">
                    <n-select
                      v-model:value="formData.defaultParams.aspect_ratio"
                      filterable
                      tag
                      placeholder="请选择或输入"
                      :options="VIDEO_ASPECT_RATIO_OPTIONS"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="视频质量">
                    <n-select
                      v-model:value="formData.defaultParams.quality"
                      filterable
                      tag
                      placeholder="请选择或输入"
                      :options="VIDEO_QUALITY_OPTIONS"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="生成方式">
                    <n-select
                      v-model:value="formData.defaultParams.generation_mode"
                      :options="generationModeOptions"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="视频时长">
                    <n-select
                      v-model:value="formData.defaultParams.duration"
                      multiple
                      tag
                      filterable
                      :max-tag-count="2"
                      :options="durationOptions"
                      placeholder="请选择或输入时长选项"
                      :on-create="createDurationTag"
                      :fallback-option="false"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="最大参考图片数">
                    <n-input-number
                      v-model:value="formData.defaultParams.max_references_images"
                      :min="0"
                      :max="20"
                      style="width: 80px"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="最大参考视频数">
                    <n-input-number
                      v-model:value="formData.defaultParams.max_references_videos"
                      :min="0"
                      :max="20"
                      style="width: 80px"
                    />
                  </n-form-item>
                </n-gi>
                <n-gi>
                  <n-form-item label="最大参考音频数">
                    <n-input-number
                      v-model:value="formData.defaultParams.max_references_audios"
                      :min="0"
                      :max="20"
                      style="width: 80px"
                    />
                  </n-form-item>
                </n-gi>
              </n-grid>
            </template>

            <!-- 音频生成参数 -->
            <template v-if="formData.category === 'AUDIO_GENERATION'">
              <n-form-item label="参数说明">
                <span class="form-hint">该类型模型无额外可配置参数</span>
              </n-form-item>
            </template>

            <!-- 自定义参数 -->
            <div class="param-section-title" style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
              <span>自定义参数（透传给外部服务）</span>
              <n-button size="small" quaternary @click="openCustomParamsModal">
                <template #icon>
                  <n-icon><Create /></n-icon>
                </template>
                编辑
              </n-button>
            </div>
            <div
              v-if="Object.keys(formData.customParams || {}).length === 0"
              class="form-hint"
              style="margin-bottom: 8px;"
            >
              暂无自定义参数
            </div>
            <n-space v-else wrap size="small" style="margin-bottom: 12px;">
              <n-tag
                v-for="(value, key) in formData.customParams"
                :key="key"
                type="info"
                size="small"
                bordered
              >
                {{ key }}: {{ JSON.stringify(value) }}
              </n-tag>
            </n-space>
          </n-tab-pane>
        </n-tabs>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="store.loading"
            @click="handleSubmit"
          >
            确定
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 自定义参数编辑弹窗 -->
    <n-modal
      v-model:show="showCustomParamsModal"
      title="编辑自定义参数"
      preset="card"
      style="width: 600px"
      :bordered="false"
    >
      <n-space vertical>
        <n-space
          v-for="(row, index) in customParamsEdit"
          :key="index"
          align="center"
          style="width: 100%"
        >
          <n-input
            v-model:value="row.key"
            placeholder="参数名"
            style="width: 180px"
          />
          <n-select
            v-model:value="row.type"
            :options="[
              { label: '字符串', value: 'string' },
              { label: '数字', value: 'number' },
              { label: '布尔', value: 'boolean' },
            ]"
            style="width: 100px"
          />
          <n-input-number
            v-if="row.type === 'number'"
            :value="row.value === '' ? null : Number(row.value)"
            placeholder="如 0.8"
            style="width: 180px"
            @update:value="(v: number | null) => { row.value = v === null ? '' : String(v); }"
          />
          <n-input
            v-else-if="row.type === 'string'"
            v-model:value="row.value"
            placeholder="参数值"
            style="width: 180px"
          />
          <n-select
            v-else
            v-model:value="row.value"
            :options="[
              { label: 'true', value: 'true' },
              { label: 'false', value: 'false' },
            ]"
            style="width: 180px"
          />
          <n-button
            quaternary
            type="error"
            size="small"
            @click="removeCustomParamRow(index)"
          >
            <template #icon>
              <n-icon><Trash /></n-icon>
            </template>
          </n-button>
        </n-space>
        <n-button
          dashed
          size="small"
          @click="addCustomParamRow"
        >
          + 添加一行
        </n-button>
      </n-space>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showCustomParamsModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            @click="saveCustomParams"
          >
            确定
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 24px;
  min-height: 100%;
  background: #fff;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
    color: #2d2b4d;

    .title-icon {
      color: #9d8ae7;
    }
  }
}

.page-divider {
  margin: 16px 0 24px;
}

.data-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  :deep(.n-card__content) {
    padding: 0;
  }

  // 搜索和筛选栏
  .filter-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    background: rgba(157, 138, 231, 0.02);
    flex-wrap: wrap;

    .filter-search {
      flex-shrink: 0;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
  }
}

// 表格样式覆盖
.admin-table {
  :deep(.n-data-table-thead) {
    background: rgba(157, 138, 231, 0.08);

    .n-data-table-th {
      font-weight: 600;
      color: #2d2b4d;
      background: transparent;
      border-bottom: 1px solid rgba(157, 138, 231, 0.15);
    }
  }

  :deep(.n-data-table-tbody) {
    .n-data-table-tr {
      &:hover {
        background: rgba(157, 138, 231, 0.04);
      }
    }

    .n-data-table-td {
      border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    }
  }
}

// 弹窗样式
.admin-modal {
  :deep(.n-card-header) {
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    padding: 20px 24px;

    .n-card-header__main {
      font-size: 18px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  :deep(.n-card__content) {
    padding: 24px;
  }

  :deep(.n-card__footer) {
    border-top: 1px solid rgba(157, 138, 231, 0.1);
    padding: 16px 24px;
  }
}

// 参数区块标题
.param-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #2d2b4d;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(157, 138, 231, 0.15);
}

// 表单提示文字
.form-hint {
  color: #999;
  font-size: 12px;
  margin-left: 8px;
  display: inline-block;
  vertical-align: middle;
}
</style>

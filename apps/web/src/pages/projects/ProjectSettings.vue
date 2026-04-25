<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NCard,
  NSpace,
  NAlert,
  NTag,
  NDivider,
  useDialog,
  useMessage,
} from "naive-ui";
import { Trash, Save } from "@vicons/ionicons5";
import { useProjectStore } from "@/stores/project";
import { modelConfigApi } from "@/api/model-config";
import ModelConfigForm from "@/components/ai/ModelConfigForm.vue";
import { PROJECT_MODEL_CATEGORIES } from "@/constants/model";
import type { FormRules, SelectOption } from "naive-ui";
import type {
  ProjectStatus,
  UserModelListItemDto,
} from "@pixaura/shared-types";

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();
const dialog = useDialog();
const message = useMessage();

// 当前项目ID
const projectId = computed(() => route.params.id as string);

// 当前项目
const project = computed(() => projectStore.currentProject);
const isOwner = computed(() => projectStore.isOwner);
const isEditor = computed(() => projectStore.isEditor);
const modelConfigs = computed(() => projectStore.modelConfigs);
const modelConfigsList = computed(() => projectStore.modelConfigsList);

// 可用模型列表
const availableModels = ref<Record<string, UserModelListItemDto[]>>({});
const loadingModels = ref(false);

// 用户个人默认模型 ID（从个人中心配置）
const userDefaultModelIds = ref<Record<string, string | null>>({});

// 模型配置表单
const modelForm = ref<Record<string, string>>({});

// 模型来源信息（后端级联解析结果）
const modelSources = ref<Record<string, "project" | "user" | "system">>({});

// 级联解析后的模型名称（用于显示默认选项的正确名称）
const cascadeDefaultNames = ref<Record<string, string>>({});

// 加载可用模型列表
const loadAvailableModels = async () => {
  loadingModels.value = true;
  try {
    const categories = await modelConfigApi.getModels();
    const models: Record<string, UserModelListItemDto[]> = {};

    for (const category of categories) {
      models[category.category] = category.models;
    }

    availableModels.value = models;
  } catch (error) {
    message.error("加载模型列表失败");
  } finally {
    loadingModels.value = false;
  }
};

// 初始化模型配置表单
const initModelForm = () => {
  const configs = modelConfigs.value;
  const form: Record<string, string> = {};
  const sources: Record<string, "project" | "user" | "system"> = {};
  const cascadeNames: Record<string, string> = {};

  // "用户默认"选项的显示文本始终使用用户在个人中心配置的模型名称
  // 与项目级联结果无关，确保切换项目配置时"用户默认"显示文本不变
  for (const category of PROJECT_MODEL_CATEGORIES) {
    const userId = userDefaultModelIds.value[category.key];
    if (userId) {
      // 用户有个人默认配置，显示该模型名称
      const model = (availableModels.value[category.key] || []).find((m) => m.modelId === userId);
      cascadeNames[category.key] = model?.modelName || "";
    } else {
      // 用户没有个人默认配置，显示系统默认模型名称
      const systemModel = (availableModels.value[category.key] || []).find((m) => m.isDefault);
      cascadeNames[category.key] = systemModel?.modelName || "";
    }
  }

  for (const category of PROJECT_MODEL_CATEGORIES) {
    const config = configs[category.key];
    // 后端已做级联解析（项目 → 用户 → 系统），直接使用 modelId
    form[category.key] = config?.modelId || "";
    sources[category.key] = config?.source || "system";
  }

  modelForm.value = form;
  modelSources.value = sources;
  cascadeDefaultNames.value = cascadeNames;
};

// 保存模型配置
const savingModels = ref(false);
const handleSaveModels = async () => {
  if (!project.value) return;

  savingModels.value = true;
  try {
    const data: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(modelForm.value)) {
      data[key] = value || null;
    }

    await projectStore.updateModelConfigs(project.value.id, data);
    message.success("模型配置已更新");
  } catch (error: any) {
    message.error(error.message || "更新失败");
  } finally {
    savingModels.value = false;
  }
};

// 基本信息表单
const basicForm = ref({
  name: "",
  description: "",
});

const basicFormRef = ref<InstanceType<typeof NForm>>();

const basicRules: FormRules = {
  name: [
    { required: true, message: "请输入项目名称", trigger: "blur" },
    {
      min: 2,
      max: 50,
      message: "项目名称长度应为 2-50 个字符",
      trigger: "blur",
    },
  ],
  description: [
    { max: 500, message: "项目描述不能超过 500 个字符", trigger: "blur" },
  ],
};

// 状态选项
const statusOptions: SelectOption[] = [
  { label: "草稿", value: "draft" },
  { label: "进行中", value: "active" },
  { label: "已完成", value: "completed" },
  { label: "已归档", value: "archived" },
];

// 当前状态（从store读取，确保同步）
const currentStatus = computed<ProjectStatus>(
  () => project.value?.status || "draft",
);

// 加载用户个人默认模型配置
const loadUserDefaultModels = async () => {
  try {
    userDefaultModelIds.value = await modelConfigApi.getUserDefaultModels();
  } catch (error) {
    console.error("加载用户默认模型失败:", error);
    userDefaultModelIds.value = {};
  }
};

// 加载项目信息
onMounted(async () => {
  // 如果 store 中没有项目数据，从 API 加载
  if (!project.value && projectId.value) {
    try {
      await projectStore.fetchProjectDetail(projectId.value);
    } catch (error) {
      message.error("加载项目信息失败");
      return;
    }
  }

  // 从 store 初始化表单数据
  if (project.value) {
    basicForm.value.name = project.value.name;
    basicForm.value.description = project.value.description || "";
  }

  // 加载模型列表
  await loadAvailableModels();

  // 加载用户个人默认模型配置
  await loadUserDefaultModels();

  // 加载项目模型配置
  if (projectId.value) {
    try {
      await projectStore.fetchModelConfigs(projectId.value);
    } catch (error) {
      message.error("加载模型配置失败");
    }
  }

  initModelForm();
});

// 监听数据变化，自动更新表单
watch(
  [modelConfigs, availableModels, modelConfigsList, userDefaultModelIds],
  () => {
    if (Object.keys(availableModels.value).length > 0) {
      initModelForm();
    }
  },
  { deep: true },
);

// 保存基本信息
const saving = ref(false);
const handleSaveBasic = async () => {
  try {
    await basicFormRef.value?.validate();

    if (!project.value) return;

    saving.value = true;

    // 允许将描述清空（空字符串转为null传给后端表示清空描述）
    const description = basicForm.value.description.trim();
    await projectStore.updateProject(project.value.id, {
      name: basicForm.value.name,
      description: description || null,
    });

    message.success("基本信息已更新");
  } catch (error: any) {
    if (error.message) {
      message.error(error.message);
    }
  } finally {
    saving.value = false;
  }
};

// 更新状态
const statusLoading = ref(false);
const handleStatusChange = async (status: ProjectStatus) => {
  if (!project.value) return;

  // 归档需要确认
  if (status === "archived" && project.value.status !== "archived") {
    dialog.warning({
      title: "确认归档",
      content: "归档后的项目将不再活跃，是否继续？",
      positiveText: "归档",
      negativeText: "取消",
      onPositiveClick: async () => {
        await doUpdateStatus(status);
      },
    });
    return;
  }

  await doUpdateStatus(status);
};

const doUpdateStatus = async (status: ProjectStatus) => {
  if (!project.value) return;

  statusLoading.value = true;
  try {
    await projectStore.updateProject(project.value.id, { status });
    message.success("状态已更新");
  } catch (error: any) {
    message.error(error.message || "更新失败");
  } finally {
    statusLoading.value = false;
  }
};

// 删除项目
const handleDelete = () => {
  if (!project.value) return;

  dialog.warning({
    title: "确认删除",
    content:
      "删除后的项目将进入回收站，30天后自动永久删除。此操作不可撤销，是否继续？",
    positiveText: "删除",
    negativeText: "取消",
    type: "warning",
    onPositiveClick: async () => {
      try {
        await projectStore.deleteProject(project.value!.id);
        message.success("项目已移至回收站");
        router.push("/projects");
      } catch (error: any) {
        message.error(error.message || "删除失败");
      }
    },
  });
};
</script>

<template>
  <div
    v-if="project"
    class="project-settings-page"
  >
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">
        项目设置
      </h1>
      <p class="page-subtitle">
        管理项目的基本信息和状态
      </p>
    </div>

    <!-- 基本信息 -->
    <n-card
      title="基本信息"
      class="settings-card"
    >
      <n-form
        ref="basicFormRef"
        :model="basicForm"
        :rules="basicRules"
        label-placement="left"
        label-width="100"
        require-mark-placement="right-hanging"
      >
        <n-form-item
          label="项目名称"
          path="name"
        >
          <n-input
            v-model:value="basicForm.name"
            placeholder="请输入项目名称"
            maxlength="50"
            show-count
            :disabled="!isEditor"
          />
        </n-form-item>

        <n-form-item
          label="项目描述"
          path="description"
        >
          <n-input
            v-model:value="basicForm.description"
            type="textarea"
            placeholder="描述您的项目"
            maxlength="500"
            show-count
            :rows="4"
            :disabled="!isEditor"
          />
        </n-form-item>

        <div
          v-if="isEditor"
          class="form-actions"
        >
          <n-button
            type="primary"
            :loading="saving"
            @click="handleSaveBasic"
          >
            <template #icon>
              <n-icon><Save /></n-icon>
            </template>
            保存
          </n-button>
        </div>
      </n-form>
    </n-card>

    <!-- 项目状态 -->
    <n-card
      title="项目状态"
      class="settings-card"
      style="margin-top: 16px"
    >
      <div class="status-section">
        <div class="current-status">
          <span class="label">当前状态：</span>
          <n-tag
            :type="
              currentStatus === 'active'
                ? 'success'
                : currentStatus === 'archived'
                  ? 'default'
                  : 'info'
            "
            size="large"
          >
            {{
              currentStatus === "draft"
                ? "草稿"
                : currentStatus === "active"
                  ? "进行中"
                  : currentStatus === "completed"
                    ? "已完成"
                    : "已归档"
            }}
          </n-tag>
        </div>

        <n-divider />

        <div
          v-if="isOwner"
          class="status-actions"
        >
          <p class="section-desc">
            更改项目状态
          </p>
          <n-space>
            <n-button
              v-for="option in statusOptions"
              :key="option.value"
              :type="currentStatus === option.value ? 'primary' : 'default'"
              :ghost="currentStatus !== option.value"
              :loading="statusLoading"
              @click="handleStatusChange(option.value as ProjectStatus)"
            >
              {{ option.label }}
            </n-button>
          </n-space>
        </div>

        <n-alert
          v-if="currentStatus === 'archived'"
          type="info"
          title="项目已归档"
          style="margin-top: 16px"
        >
          归档的项目可以恢复为其他状态继续编辑。
        </n-alert>
      </div>
    </n-card>

    <!-- 默认模型配置 -->
    <n-card
      title="默认模型配置"
      class="settings-card"
      style="margin-top: 16px"
    >
      <n-alert
        type="info"
        :show-icon="false"
        style="margin-bottom: 16px"
      >
        配置项目默认使用的 AI
        模型，项目创建时自动继承您的个人默认配置。留空表示跟随系统默认。
      </n-alert>

      <ModelConfigForm
        v-model:model-value="modelForm"
        :categories="PROJECT_MODEL_CATEGORIES"
        :models="availableModels"
        :loading="loadingModels"
        :disabled="!isEditor"
        :label-width="120"
        :model-sources="modelSources"
        default-level-label="用户默认"
        :cascade-default-names="cascadeDefaultNames"
      />

      <div
        v-if="isEditor"
        class="form-actions"
      >
        <n-button
          type="primary"
          :loading="savingModels"
          @click="handleSaveModels"
        >
          <template #icon>
            <n-icon><Save /></n-icon>
          </template>
          保存配置
        </n-button>
      </div>
    </n-card>

    <!-- 危险操作 -->
    <n-card
      v-if="isOwner"
      title="危险操作"
      class="settings-card danger-card"
      style="margin-top: 16px"
    >
      <n-alert
        type="warning"
        :show-icon="false"
        style="margin-bottom: 16px"
      >
        以下操作不可撤销，请谨慎操作。
      </n-alert>

      <div class="danger-actions">
        <div class="danger-item">
          <div class="danger-info">
            <h4>删除项目</h4>
            <p>删除后的项目将进入回收站，30天后自动永久删除。</p>
          </div>
          <n-button
            type="error"
            @click="handleDelete"
          >
            <template #icon>
              <n-icon><Trash /></n-icon>
            </template>
            删除项目
          </n-button>
        </div>
      </div>
    </n-card>
  </div>
</template>

<style scoped lang="scss">
.project-settings-page {
  padding: 16px 24px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px;
  }

  .page-subtitle {
    font-size: 14px;
    color: #666;
    margin: 0;
  }
}

.settings-card {
  :deep(.n-card__content) {
    padding: 24px;
  }

  :deep(.n-card-header) {
    font-size: 16px;
    font-weight: 600;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }
}

.danger-card {
  :deep(.n-card-header__main) {
    color: #ff4d4f;
  }
}

.status-section {
  .current-status {
    display: flex;
    align-items: center;
    gap: 12px;

    .label {
      color: #666;
    }
  }

  .status-actions {
    .section-desc {
      font-size: 14px;
      color: #666;
      margin: 0 0 12px;
    }
  }
}

.danger-actions {
  .danger-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #fff2f0;
    border: 1px solid #ffccc7;
    border-radius: 8px;

    .danger-info {
      h4 {
        font-size: 14px;
        font-weight: 600;
        color: #ff4d4f;
        margin: 0 0 4px;
      }

      p {
        font-size: 13px;
        color: #666;
        margin: 0;
      }
    }
  }
}
</style>

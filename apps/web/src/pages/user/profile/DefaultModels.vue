<script setup lang="ts">
import { ref, onMounted } from "vue";
import { NCard, NButton, NAlert, useMessage } from "naive-ui";
import { Save } from "@vicons/ionicons5";
import { modelConfigApi } from "@/api/model-config";
import ModelConfigForm from "@/components/ai/ModelConfigForm.vue";
import { USER_MODEL_CATEGORIES } from "@/constants/model";
import type { UserModelListItemDto } from "@pixaura/shared-types";

const message = useMessage();

// 可用模型列表
const availableModels = ref<Record<string, UserModelListItemDto[]>>({});
const loadingModels = ref(false);

// 用户选择的模型
const userSelections = ref<Record<string, string>>({});

// 加载可用模型列表
const loadModels = async () => {
  loadingModels.value = true;
  try {
    const categories = await modelConfigApi.getModels();
    const models: Record<string, UserModelListItemDto[]> = {};

    for (const category of categories) {
      models[category.category] = category.models;
    }

    availableModels.value = models;

    // 加载用户配置
    await loadUserConfigs();
  } catch (error) {
    message.error("加载模型列表失败");
  } finally {
    loadingModels.value = false;
  }
};

// 加载用户默认模型配置
const loadUserConfigs = async () => {
  try {
    const configs = await modelConfigApi.getUserDefaultModels();
    // 使用用户配置初始化选择
    initUserSelections(configs);
  } catch (error) {
    // 如果获取失败，使用系统默认
    initUserSelections();
  }
};

// 初始化用户选择（从用户配置中读取）
const initUserSelections = (userConfigs?: Record<string, string | null>) => {
  const selections: Record<string, string> = {};
  for (const category of USER_MODEL_CATEGORIES) {
    // 优先使用用户保存的配置，如果没有则使用系统默认
    if (userConfigs && category.key in userConfigs) {
      // null 或空字符串都表示使用系统默认
      selections[category.key] = userConfigs[category.key] || "";
    } else {
      const categoryModels = availableModels.value[category.key] || [];
      const defaultModel = categoryModels.find((m) => m.isDefault);
      selections[category.key] = defaultModel?.modelId || "";
    }
  }
  userSelections.value = selections;
};

// 保存加载状态
const saving = ref(false);

// 保存用户默认模型设置
const handleSave = async () => {
  saving.value = true;
  try {
    // 构建配置对象，空字符串转为 null 表示使用系统默认
    const configs: Record<string, string | null> = {};
    for (const category of USER_MODEL_CATEGORIES) {
      const value = userSelections.value[category.key];
      configs[category.key] = value || null;
    }

    await modelConfigApi.updateUserDefaultModels(configs);
    message.success("默认模型设置已保存");
  } catch (error: any) {
    message.error(error.message || "保存失败");
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadModels();
});
</script>

<template>
  <div class="default-models-page">
    <n-layout>
      <n-layout-header bordered class="header">
        <div class="header-content">
          <div class="logo" @click="$router.push('/')">
            <h2>Pixaura</h2>
          </div>
          <n-space>
            <n-button quaternary @click="$router.push('/user/profile')">个人中心</n-button>
            <n-button quaternary @click="$router.push('/')">返回首页</n-button>
          </n-space>
        </div>
      </n-layout-header>

      <n-layout-content class="main-content">
        <n-card class="main-card" title="默认模型设置">
          <n-alert
            type="info"
            :show-icon="false"
            style="margin-bottom: 24px"
          >
            设置您个人偏好的默认 AI 模型，这些设置将应用于您创建的所有新项目。
            您也可以在项目设置中为每个项目单独配置。
          </n-alert>

          <ModelConfigForm
            v-model:model-value="userSelections"
            :categories="USER_MODEL_CATEGORIES"
            :models="availableModels"
            :loading="loadingModels"
          />

          <div class="form-actions">
            <n-button
              type="primary"
              :loading="saving"
              @click="handleSave"
            >
              <template #icon>
                <n-icon><Save /></n-icon>
              </template>
              保存设置
            </n-button>
          </div>
        </n-card>

        <!-- 说明卡片 -->
        <n-card
          title="说明"
          class="info-card"
        >
          <ul class="info-list">
            <li>系统默认模型由管理员配置，适用于所有用户</li>
            <li>您可以选择跟随系统默认，或为每个类别指定特定模型</li>
            <li>项目创建时将使用您的个人默认模型设置</li>
            <li>您可以在项目设置中随时更改单个项目的模型配置</li>
          </ul>
        </n-card>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.default-models-page {
  min-height: 100vh;
  background: var(--color-bg-base);
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
}

.logo {
  cursor: pointer;

  h2 {
    margin: 0;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.main-card {
  max-width: 800px;
  margin: 0 auto;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}

.info-card {
  max-width: 800px;
  margin: 16px auto 0;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);

  :deep(.n-card__content) {
    padding: 20px;
  }

  .info-list {
    margin: 0;
    padding-left: 20px;
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 2;
  }
}
</style>

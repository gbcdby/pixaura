<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NCheckbox,
  NSpin,
  NEmpty,
  NDivider,
  NIcon,
  useMessage,
} from "naive-ui";
import { ArrowBack, CheckmarkCircle } from "@vicons/ionicons5";
import { useTemplateStore } from "@/stores/template";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const templateStore = useTemplateStore();

// 模板ID
const templateId = computed(() => route.params.template_id as string);

// 加载状态
const loading = computed(() => templateStore.loading);
const creating = computed(() => templateStore.creating);

// 当前模板
const template = computed(() => templateStore.currentTemplate);

// 表单数据
const formData = ref({
  name: "",
  description: "",
  coverUrl: "",
  options: {
    includeCharacters: true,
    includeScenes: true,
    includeProps: true,
    includeScriptOutline: true,
    includeModelConfigs: true,
  },
});

// 表单规则
const rules = {
  name: [
    { required: true, message: "请输入项目名称", trigger: "blur" },
    { min: 2, max: 50, message: "项目名称2-50个字符", trigger: "blur" },
  ],
};

// 表单引用
const formRef = ref<InstanceType<typeof NForm>>();

// 加载模板详情
const loadTemplateDetail = async () => {
  try {
    await templateStore.fetchTemplateDetail(templateId.value);
    // 预填充描述
    if (template.value?.description) {
      formData.value.description = template.value.description;
    }
  } catch (error) {
    message.error("加载模板详情失败");
  }
};

// 返回
const handleBack = () => {
  router.back();
};

// 创建项目
const handleCreate = async () => {
  try {
    await formRef.value?.validate();

    const result = await templateStore.createProjectFromTemplate(
      templateId.value,
      formData.value,
    );

    message.success("项目创建成功");
    router.push(`/projects/${result.id}`);
  } catch (error: any) {
    if (error.msg) {
      message.error(error.msg);
    } else {
      message.error("创建失败，请检查输入");
    }
  }
};

// 全选/取消全选
const toggleAllOptions = (checked: boolean) => {
  formData.value.options = {
    includeCharacters: checked,
    includeScenes: checked,
    includeProps: checked,
    includeScriptOutline: checked,
    includeModelConfigs: checked,
  };
};

// 检查是否全选
const allSelected = computed(() => {
  return Object.values(formData.value.options).every((v) => v);
});

onMounted(() => {
  loadTemplateDetail();
});
</script>

<template>
  <div class="create-from-template-page">
    <n-layout class="main-layout">
      <!-- 顶部栏 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <n-space align="center">
            <n-button
              quaternary
              @click="handleBack"
            >
              <template #icon>
                <n-icon><ArrowBack /></n-icon>
              </template>
              返回
            </n-button>
            <h1 class="page-title">
              从模板创建项目
            </h1>
          </n-space>
        </div>
      </n-layout-header>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <n-empty
            v-if="!loading && !template"
            description="模板不存在或无法访问"
          />

          <template v-else-if="template">
            <n-card class="create-form-card">
              <n-form
                ref="formRef"
                :model="formData"
                :rules="rules"
                label-placement="top"
                require-mark-placement="right-hanging"
              >
                <!-- 项目基本信息 -->
                <h3 class="section-title">
                  项目信息
                </h3>

                <n-form-item
                  label="项目名称"
                  path="name"
                >
                  <n-input
                    v-model:value="formData.name"
                    placeholder="请输入项目名称"
                    maxlength="50"
                    show-count
                  />
                </n-form-item>

                <n-form-item label="项目描述">
                  <n-input
                    v-model:value="formData.description"
                    type="textarea"
                    placeholder="请输入项目描述（可选）"
                    maxlength="500"
                    show-count
                    :rows="3"
                  />
                </n-form-item>

                <n-divider />

                <!-- 内容选择 -->
                <div class="content-options">
                  <div class="options-header">
                    <h3 class="section-title">
                      选择要继承的内容
                    </h3>
                    <n-checkbox
                      :checked="allSelected"
                      @update:checked="toggleAllOptions"
                    >
                      全选
                    </n-checkbox>
                  </div>

                  <n-space vertical>
                    <n-checkbox
                      v-model:checked="formData.options.includeCharacters"
                    >
                      角色设定
                      <span
                        v-if="template.content?.characters?.length"
                        class="option-count"
                      >
                        ({{ template.content.characters.length }} 个角色)
                      </span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeScenes"
                    >
                      场景设定
                      <span
                        v-if="template.content?.scenes?.length"
                        class="option-count"
                      >
                        ({{ template.content.scenes.length }} 个场景)
                      </span>
                    </n-checkbox>

                    <n-checkbox v-model:checked="formData.options.includeProps">
                      道具设定
                      <span
                        v-if="template.content?.props?.length"
                        class="option-count"
                      >
                        ({{ template.content.props.length }} 个道具)
                      </span>
                      <span
                        v-else
                        class="option-count"
                      >(无)</span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeScriptOutline"
                    >
                      剧本大纲
                      <span
                        v-if="template.content?.scriptOutline"
                        class="option-count"
                      >
                        ({{ template.content.scriptOutline.acts?.length || 0 }}
                        幕)
                      </span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeModelConfigs"
                    >
                      模型配置
                      <span
                        v-if="template.modelConfigs"
                        class="option-count"
                      >
                        ({{ Object.keys(template.modelConfigs).length }} 项)
                      </span>
                      <span
                        v-else
                        class="option-count"
                      >(无)</span>
                    </n-checkbox>
                  </n-space>
                </div>

                <n-divider />

                <!-- 操作按钮 -->
                <div class="form-actions">
                  <n-space>
                    <n-button @click="handleBack">
                      取消
                    </n-button>
                    <n-button
                      type="primary"
                      :loading="creating"
                      @click="handleCreate"
                    >
                      <template #icon>
                        <n-icon><CheckmarkCircle /></n-icon>
                      </template>
                      创建项目
                    </n-button>
                  </n-space>
                </div>
              </n-form>
            </n-card>
          </template>
        </n-spin>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<style scoped lang="scss">
.create-from-template-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;
}

.header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
  }
}

.content {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.create-form-card {
  background: #fff;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 16px;
}

.content-options {
  .options-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    .section-title {
      margin: 0;
    }
  }

  .option-count {
    color: #999;
    font-size: 13px;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16px;
}
</style>

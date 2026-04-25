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
  NTag,
  NIcon,
  useMessage,
} from "naive-ui";
import { ArrowBack, SaveOutline } from "@vicons/ionicons5";
import { useTemplateStore } from "@/stores/template";
import { useProjectStore } from "@/stores/project";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const templateStore = useTemplateStore();
const projectStore = useProjectStore();

// 项目ID
const projectId = computed(() => route.params.id as string);

// 加载状态
const loading = ref(false);
const saving = computed(() => templateStore.saving);

// 当前项目
const project = computed(() => projectStore.currentProject);

// 项目统计
const projectStats = ref({
  characterCount: 0,
  sceneCount: 0,
  propCount: 0,
  hasScriptOutline: false,
  hasModelConfigs: false,
});

// 表单数据
const formData = ref({
  name: "",
  description: "",
  tags: [] as string[],
  options: {
    includeCharacters: true,
    includeScenes: true,
    includeProps: true,
    includeScriptOutline: true,
    includeModelConfigs: true,
  },
});

// 当前输入的标签
const currentTag = ref("");

// 表单规则
const rules = {
  name: [
    { required: true, message: "请输入模板名称", trigger: "blur" },
    { min: 2, max: 50, message: "模板名称2-50个字符", trigger: "blur" },
  ],
};

// 表单引用
const formRef = ref<InstanceType<typeof NForm>>();

// 加载项目详情
const loadProjectDetail = async () => {
  loading.value = true;
  try {
    await projectStore.fetchProjectDetail(projectId.value);
    // 预填充模板名称
    if (project.value?.name) {
      formData.value.name = `${project.value.name} 模板`;
    }
    // 预填充描述
    if (project.value?.description) {
      formData.value.description = project.value.description;
    }
    // TODO: 获取项目统计信息
    // 这里应该调用 API 获取角色、场景、道具数量
  } catch (error) {
    message.error("加载项目详情失败");
  } finally {
    loading.value = false;
  }
};

// 返回
const handleBack = () => {
  router.back();
};

// 添加标签
const handleAddTag = () => {
  const tag = currentTag.value.trim();
  if (!tag) return;
  if (formData.value.tags.length >= 5) {
    message.warning("最多添加5个标签");
    return;
  }
  if (formData.value.tags.includes(tag)) {
    message.warning("标签已存在");
    return;
  }
  formData.value.tags.push(tag);
  currentTag.value = "";
};

// 删除标签
const handleRemoveTag = (tag: string) => {
  const index = formData.value.tags.indexOf(tag);
  if (index > -1) {
    formData.value.tags.splice(index, 1);
  }
};

// 保存模板
const handleSave = async () => {
  try {
    await formRef.value?.validate();

    await templateStore.saveProjectAsTemplate(projectId.value, formData.value);

    message.success("模板保存成功");
    router.push("/projects/templates");
  } catch (error: any) {
    if (error.msg) {
      message.error(error.msg);
    } else {
      message.error("保存失败，请检查输入");
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
  loadProjectDetail();
});
</script>

<template>
  <div class="save-as-template-page">
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
              保存为模板
            </h1>
          </n-space>
        </div>
      </n-layout-header>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-spin :show="loading">
          <n-empty
            v-if="!loading && !project"
            description="项目不存在或无法访问"
          />

          <template v-else-if="project">
            <n-card class="save-form-card">
              <n-form
                ref="formRef"
                :model="formData"
                :rules="rules"
                label-placement="top"
                require-mark-placement="right-hanging"
              >
                <!-- 模板基本信息 -->
                <h3 class="section-title">
                  模板信息
                </h3>

                <n-form-item
                  label="模板名称"
                  path="name"
                >
                  <n-input
                    v-model:value="formData.name"
                    placeholder="请输入模板名称"
                    maxlength="50"
                    show-count
                  />
                </n-form-item>

                <n-form-item label="模板描述">
                  <n-input
                    v-model:value="formData.description"
                    type="textarea"
                    placeholder="请输入模板描述（可选）"
                    maxlength="500"
                    show-count
                    :rows="3"
                  />
                </n-form-item>

                <!-- 标签 -->
                <n-form-item label="标签">
                  <n-space
                    vertical
                    style="width: 100%"
                  >
                    <n-space>
                      <n-tag
                        v-for="tag in formData.tags"
                        :key="tag"
                        closable
                        @close="handleRemoveTag(tag)"
                      >
                        {{ tag }}
                      </n-tag>
                    </n-space>
                    <n-input
                      v-model:value="currentTag"
                      placeholder="输入标签后按回车添加（最多5个）"
                      maxlength="10"
                      @keyup.enter="handleAddTag"
                    />
                  </n-space>
                </n-form-item>

                <n-divider />

                <!-- 内容选择 -->
                <div class="content-options">
                  <div class="options-header">
                    <h3 class="section-title">
                      选择要保存的内容
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
                      <span class="option-count">
                        ({{ projectStats.characterCount }} 个角色)
                      </span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeScenes"
                    >
                      场景设定
                      <span class="option-count">
                        ({{ projectStats.sceneCount }} 个场景)
                      </span>
                    </n-checkbox>

                    <n-checkbox v-model:checked="formData.options.includeProps">
                      道具设定
                      <span class="option-count">
                        ({{ projectStats.propCount }} 个道具)
                      </span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeScriptOutline"
                    >
                      剧本大纲
                      <span
                        v-if="projectStats.hasScriptOutline"
                        class="option-count"
                      >
                        (有)
                      </span>
                      <span
                        v-else
                        class="option-count"
                      >(无)</span>
                    </n-checkbox>

                    <n-checkbox
                      v-model:checked="formData.options.includeModelConfigs"
                    >
                      模型配置
                      <span
                        v-if="projectStats.hasModelConfigs"
                        class="option-count"
                      >
                        (有)
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
                      :loading="saving"
                      @click="handleSave"
                    >
                      <template #icon>
                        <n-icon><SaveOutline /></n-icon>
                      </template>
                      保存模板
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
.save-as-template-page {
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

.save-form-card {
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

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NButton,
  useMessage,
} from "naive-ui";
import type { FormRules } from "naive-ui";
import { useProjectStore } from "@/stores/project";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "success", projectId: string): void;
}>();

const projectStore = useProjectStore();
const message = useMessage();

const formRef = ref<InstanceType<typeof NForm>>();
const formData = ref({
  name: "",
  description: "",
});
const submitting = ref(false);

const rules: FormRules = {
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

// 弹窗打开时重置表单
watch(
  () => props.show,
  (val) => {
    if (val) {
      formData.value = { name: "", description: "" };
    }
  },
);

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    submitting.value = true;
    const result = await projectStore.createProject({
      name: formData.value.name,
      description: formData.value.description || undefined,
    });
    message.success("项目创建成功");
    emit("update:show", false);
    emit("success", result.id);
  } catch (error: any) {
    if (error.message) {
      message.error(error.message);
    }
  } finally {
    submitting.value = false;
  }
};

const handleCancel = () => {
  emit("update:show", false);
};
</script>

<template>
  <n-modal
    :show="show"
    title="创建新项目"
    preset="card"
    class="create-project-modal"
    :style="{ width: '520px' }"
    :bordered="false"
    :segmented="{ content: true }"
    @update:show="(v) => emit('update:show', v)"
  >
    <n-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-placement="left"
      label-width="80"
      require-mark-placement="right-hanging"
    >
      <n-form-item label="项目名称" path="name">
        <n-input
          v-model:value="formData.name"
          placeholder="请输入项目名称（2-50个字符）"
          maxlength="50"
          show-count
          clearable
        />
      </n-form-item>

      <n-form-item label="项目描述" path="description">
        <n-input
          v-model:value="formData.description"
          type="textarea"
          placeholder="描述您的项目（可选，最多500个字符）"
          maxlength="500"
          show-count
          :rows="3"
          clearable
        />
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="modal-footer">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">
          创建项目
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<style scoped lang="scss">
.create-project-modal {
  :deep(.n-card-header) {
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;

    .n-card-header__main {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
    }
  }

  :deep(.n-card__content) {
    padding: 24px;
  }

  :deep(.n-card__footer) {
    padding: 16px 24px;
    border-top: 1px solid #e2e8f0;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

// 暗黑模式适配
[data-theme="dark"] {
  .create-project-modal {
    :deep(.n-card-header) {
      border-bottom-color: rgba(148, 163, 184, 0.15);

      .n-card-header__main {
        color: #f1f5f9;
      }
    }

    :deep(.n-card__footer) {
      border-top-color: rgba(148, 163, 184, 0.15);
    }
  }
}
</style>

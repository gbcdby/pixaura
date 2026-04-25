<script setup lang="ts">
/**
 * 新建资产弹窗组件
 *
 * 功能：
 * - 表单：名称（必填）、描述（可选）
 * - 角色专属：性别选择、年龄输入
 * - 表单验证
 * - 提交调用 createAndLinkAsset API
 */
import { ref, computed, watch } from "vue";
import {
  NModal,
  NButton,
  NInput,
  NFormItem,
  NForm,
  NSelect,
  NSpace,
  useMessage,
  type FormRules,
  type FormInst,
} from "naive-ui";
import { useScriptEditStore } from "../store/scriptEdit";
import type { AssetType } from "../store/types";

// Props 定义
interface Props {
  show: boolean;
  projectId: string;
  scriptId: string;
  assetType: AssetType; // 'character' | 'scene' | 'prop'
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "success"): void;
}>();

const message = useMessage();
const scriptEditStore = useScriptEditStore();

// 本地状态
const formRef = ref<FormInst | null>(null);
const submitting = ref(false);

// 表单数据
const formData = ref({
  name: "",
  description: "",
  gender: undefined as string | undefined,
  age: "",
});

// 类型标签映射
const typeLabelMap: Record<AssetType, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

// 标题
const modalTitle = computed(() => `新建${typeLabelMap[props.assetType]}`);

// 是否显示角色字段
const showCharacterFields = computed(() => props.assetType === "character");

// 性别选项
const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
  { label: "其他", value: "other" },
];

// 表单验证规则
const formRules: FormRules = {
  name: [
    {
      required: true,
      message: `请输入${typeLabelMap[props.assetType]}名称`,
      trigger: ["blur", "input"],
    },
    {
      min: 1,
      max: 100,
      message: "名称长度不能超过100个字符",
      trigger: ["blur", "input"],
    },
  ],
  description: [
    {
      max: 500,
      message: "描述长度不能超过500个字符",
      trigger: ["blur", "input"],
    },
  ],
};

// 监听弹窗显示，重置表单
watch(
  () => props.show,
  (visible) => {
    if (visible) {
      formData.value = {
        name: "",
        description: "",
        gender: undefined,
        age: "",
      };
    }
  },
);

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    // 表单验证失败
    return;
  }

  submitting.value = true;
  try {
    const data = {
      name: formData.value.name,
      description: formData.value.description || undefined,
      gender: showCharacterFields.value ? formData.value.gender || undefined : undefined,
      age: showCharacterFields.value ? formData.value.age || undefined : undefined,
    };

    const result = await scriptEditStore.createAndLinkAsset(
      props.assetType,
      data,
    );

    message.success(`成功创建${typeLabelMap[props.assetType]} "${result.name}"`);

    emit("success");
    emit("update:show", false);
  } catch (error) {
    console.error("创建资产失败:", error);
    message.error("创建失败，请重试");
  } finally {
    submitting.value = false;
  }
}

// 关闭弹窗
function handleClose() {
  emit("update:show", false);
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="create-asset-modal"
    style="width: 500px; max-width: 90vw"
    :title="modalTitle"
    :bordered="false"
    :segmented="{ content: 'soft' }"
    @update:show="$emit('update:show', $event)"
  >
    <NForm
      ref="formRef"
      :model="formData"
      :rules="formRules"
      class="asset-form"
      label-placement="top"
      label-width="auto"
    >
      <NFormItem
        label="资产名称"
        path="name"
      >
        <NInput
          v-model:value="formData.name"
          :placeholder="`请输入${typeLabelMap[assetType]}名称`"
          maxlength="100"
          show-count
          class="form-input"
        />
      </NFormItem>

      <NFormItem
        label="描述"
        path="description"
      >
        <NInput
          v-model:value="formData.description"
          type="textarea"
          placeholder="可选，描述资产的外观、特征等"
          maxlength="500"
          show-count
          :rows="3"
          :resizable="false"
          class="form-textarea"
        />
      </NFormItem>

      <!-- 角色专属字段 -->
      <template v-if="showCharacterFields">
        <div class="character-fields">
          <NFormItem
            label="性别"
            path="gender"
          >
            <NSelect
              v-model:value="formData.gender"
              :options="genderOptions"
              placeholder="请选择性别"
              clearable
              class="form-select"
              :consistent-menu-width="false"
            />
          </NFormItem>

          <NFormItem
            label="年龄"
            path="age"
          >
            <NInput
              v-model:value="formData.age"
              placeholder="如：25岁、青年"
              maxlength="20"
              class="form-input"
            />
          </NFormItem>
        </div>
      </template>
    </NForm>

    <!-- 底部按钮 -->
    <div class="actions">
      <NSpace>
        <NButton class="btn-cancel" @click="handleClose">
          取消
        </NButton>
        <NButton
          type="primary"
          class="btn-submit"
          :loading="submitting"
          @click="handleSubmit"
        >
          创建并关联
        </NButton>
      </NSpace>
    </div>
  </NModal>
</template>

<style scoped lang="scss">
// 弹窗整体 - 使用默认样式，不自定义圆角
:deep(.create-asset-modal .n-card-header) {
  padding: 20px 24px 12px;
  font-weight: 600;
  font-size: 16px;
}

:deep(.n-card__content) {
  padding: 0 24px 16px;
}

// 表单
.asset-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-fields {
  display: flex;
  gap: 16px;

  > * {
    flex: 1;
    min-width: 0;
  }
}

.form-input,
.form-select,
.form-textarea {
  transition: border-color 0.2s, box-shadow 0.2s;
}

// 底部按钮
.actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.btn-cancel {
  height: 36px;
  padding: 0 16px;
}

.btn-submit {
  height: 36px;
  padding: 0 20px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(32, 128, 240, 0.25);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(32, 128, 240, 0.35);
  }
}
</style>

<template>
  <n-modal
    :show="visibleModel"
    title="修改用户名"
    preset="card"
    style="width: 440px"
    @update:show="onModalUpdate"
  >
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
      <n-form-item label="当前用户名">
        <n-input :value="currentUsername" disabled />
      </n-form-item>
      <n-form-item label="新用户名" path="username">
        <n-input v-model:value="formData.username" placeholder="请输入新用户名" maxlength="20" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="onClose">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">确认修改</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useUserStore } from "@/stores/user";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const message = useMessage();
const userStore = useUserStore();

const visibleModel = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const currentUsername = computed(() => userStore.profile?.username ?? "");

const submitting = ref(false);
const formRef = ref<FormInst | null>(null);

const formData = reactive({
  username: "",
});

const formRules: FormRules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    {
      validator: (_rule, value) => {
        if (value === currentUsername.value) {
          return new Error("新用户名不能与当前用户名相同");
        }
        return true;
      },
      trigger: "blur",
    },
  ],
};

function resetState() {
  submitting.value = false;
  formData.username = "";
  formRef.value?.restoreValidation();
}

function onModalUpdate(value: boolean) {
  emit("update:visible", value);
  if (!value) {
    onClose();
  }
}

function onClose() {
  emit("update:visible", false);
  resetState();
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      formData.username = currentUsername.value;
    } else {
      resetState();
    }
  },
);

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    submitting.value = true;

    await userStore.updateProfile({ username: formData.username });
    message.success("用户名修改成功");
    emit("update:visible", false);
    resetState();
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message) {
      message.error(err.message);
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <n-modal :show="modalShow" @update:show="onModalUpdate" title="修改密码" preset="card" style="width: 500px">
    <n-alert type="warning" title="安全提示" style="margin-bottom: 16px">
      修改密码后，您需要重新登录。建议定期更换密码以保护账户安全。
    </n-alert>

    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="top">
      <n-form-item label="原密码" path="oldPassword">
        <n-input v-model:value="formData.oldPassword" type="password" placeholder="请输入原密码" show-password-on="click" />
      </n-form-item>

      <n-form-item label="新密码" path="newPassword">
        <n-input v-model:value="formData.newPassword" type="password" placeholder="8-20位，包含字母和数字" show-password-on="click" />
        <div v-if="formData.newPassword" class="password-strength">
          <div class="strength-bar">
            <div
              class="strength-fill"
              :class="`strength-${passwordStrength.level}`"
              :style="{ width: `${(passwordStrength.level + 1) * 25}%` }"
            ></div>
          </div>
          <span class="strength-text" :class="`strength-${passwordStrength.level}`">{{ passwordStrength.text }}</span>
        </div>
      </n-form-item>

      <n-form-item label="确认新密码" path="confirmPassword">
        <n-input v-model:value="formData.confirmPassword" type="password" placeholder="请再次输入新密码" show-password-on="click" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="onClose">取消</n-button>
        <n-button type="primary" :loading="loading" @click="handleSubmit">确认修改</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const modalShow = computed(() => props.visible);

function onModalUpdate(value: boolean) {
  emit("update:visible", value);
  if (!value) onClose();
}

const router = useRouter();
const message = useMessage();
const userStore = useUserStore();
const authStore = useAuthStore();

const formRef = ref<FormInst | null>(null);
const loading = ref(false);

const formData = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

// 密码强度计算
const passwordStrength = computed(() => {
  const pwd = formData.newPassword;
  if (!pwd) return { level: -1, text: "" };

  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;

  if (score <= 2) return { level: 0, text: "弱" };
  if (score <= 4) return { level: 1, text: "中" };
  return { level: 2, text: "强" };
});

const formRules: FormRules = {
  oldPassword: [{ required: true, message: "请输入原密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 8, message: "密码长度不能少于8位", trigger: "blur" },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
      message: "密码必须包含字母和数字",
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "请确认新密码", trigger: "blur" },
    {
      validator: (_rule, value) => {
        return value === formData.newPassword || new Error("两次输入的密码不一致");
      },
      trigger: "blur",
    },
  ],
};

function onClose() {
  emit("update:visible", false);
  resetForm();
}

function resetForm() {
  formData.oldPassword = "";
  formData.newPassword = "";
  formData.confirmPassword = "";
  formRef.value?.restoreValidation();
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    loading.value = true;

    await userStore.changePassword({
      oldPassword: formData.oldPassword,
      newPassword: formData.newPassword,
      confirmPassword: formData.confirmPassword,
    });

    message.success("密码修改成功，请重新登录");
    emit("update:visible", false);
    resetForm();

    await authStore.logout();
    router.push("/login");
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message) {
      message.error(err.message);
    }
  } finally {
    loading.value = false;
  }
}

// 弹窗关闭时重置表单
watch(
  () => props.visible,
  (val) => {
    if (!val) {
      resetForm();
    }
  }
);
</script>

<style scoped lang="scss">
.password-strength {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;

  .strength-bar {
    flex: 1;
    height: 4px;
    background-color: var(--color-border);
    border-radius: 2px;
    overflow: hidden;

    .strength-fill {
      height: 100%;
      transition: all 0.3s;

      &.strength-0 {
        background-color: var(--color-error);
      }

      &.strength-1 {
        background-color: var(--color-warning);
      }

      &.strength-2 {
        background-color: var(--color-success);
      }
    }
  }

  .strength-text {
    font-size: 12px;

    &.strength-0 {
      color: var(--color-error);
    }

    &.strength-1 {
      color: var(--color-warning);
    }

    &.strength-2 {
      color: var(--color-success);
    }
  }
}
</style>

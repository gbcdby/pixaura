<template>
  <n-modal
    :show="visibleModel"
    title="修改邮箱"
    preset="card"
    style="width: 500px"
    @update:show="onModalUpdate"
  >
    <n-alert
      type="warning"
      title="安全提示"
      style="margin-bottom: 16px"
    >
      修改邮箱需要发送验证码到新邮箱地址。
    </n-alert>

    <n-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-placement="top"
    >
      <n-form-item label="当前邮箱">
        <n-input
          :value="currentEmail"
          disabled
        />
      </n-form-item>
      <n-form-item
        label="新邮箱"
        path="newEmail"
      >
        <n-input
          v-model:value="formData.newEmail"
          placeholder="请输入新邮箱地址"
        />
      </n-form-item>
      <n-form-item
        label="验证码"
        path="code"
      >
        <n-input-group>
          <n-input
            v-model:value="formData.code"
            placeholder="请输入验证码"
            maxlength="6"
          />
          <n-button
            :disabled="cooldown > 0 || !formData.newEmail"
            :loading="sendingCode"
            @click="handleSendCode"
          >
            {{ cooldown > 0 ? `${cooldown}s` : "获取验证码" }}
          </n-button>
        </n-input-group>
      </n-form-item>
    </n-form>

    <template #footer>
      <n-space justify="end">
        <n-button @click="onClose">取消</n-button>
        <n-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          确认修改
        </n-button>
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

const currentEmail = computed(() => userStore.profile?.email ?? "未设置");

const submitting = ref(false);
const formRef = ref<FormInst | null>(null);
const sendingCode = ref(false);
const cooldown = ref(0);

const formData = reactive({
  newEmail: "",
  code: "",
});

const formRules: FormRules = {
  newEmail: [
    { required: true, message: "请输入新邮箱地址", trigger: "blur" },
    {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message: "请输入正确的邮箱地址",
      trigger: "blur",
    },
    {
      validator: (_rule, value) => {
        if (value === currentEmail.value) {
          return new Error("新邮箱不能与当前邮箱相同");
        }
        return true;
      },
      trigger: "blur",
    },
  ],
  code: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    { pattern: /^\d{6}$/, message: "验证码为6位数字", trigger: "blur" },
  ],
};

function resetState() {
  submitting.value = false;
  sendingCode.value = false;
  cooldown.value = 0;
  formData.newEmail = "";
  formData.code = "";
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
    if (!val) {
      resetState();
    }
  },
);

function startCooldown() {
  cooldown.value = 60;
  const timer = setInterval(() => {
    cooldown.value--;
    if (cooldown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

async function handleSendCode() {
  if (!formData.newEmail) {
    message.error("请输入新邮箱地址");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.newEmail)) {
    message.error("请输入正确的邮箱地址");
    return;
  }

  sendingCode.value = true;
  try {
    await userStore.sendChangeEmailCode(formData.newEmail);
    message.success("验证码已发送");
    startCooldown();
  } catch (error: unknown) {
    const err = error as { message?: string };
    message.error(err.message || "发送失败");
  } finally {
    sendingCode.value = false;
  }
}

async function handleSubmit() {
  try {
    await formRef.value?.validate();
    submitting.value = true;

    await userStore.changeEmail({
      newEmail: formData.newEmail,
      code: formData.code,
    });

    message.success("邮箱修改成功");
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

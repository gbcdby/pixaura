<template>
  <n-modal
    :show="visibleModel"
    title="修改手机号"
    preset="card"
    style="width: 500px"
    @update:show="onModalUpdate"
  >
    <n-alert
      type="warning"
      title="安全提示"
      style="margin-bottom: 16px"
    >
      修改手机号需要验证身份。修改成功后，您需要重新登录。
    </n-alert>

    <n-steps
      :current="step"
      style="margin-bottom: 24px"
    >
      <n-step title="验证原手机号" />
      <n-step title="绑定新手机号" />
    </n-steps>

    <!-- 步骤1: 验证原手机号 -->
    <div v-if="step === 1">
      <n-form
        ref="oldPhoneFormRef"
        :model="formData"
        :rules="oldPhoneRules"
        label-placement="top"
      >
        <n-form-item label="原手机号">
          <n-input
            :value="maskPhone(currentPhone)"
            disabled
          />
        </n-form-item>
        <n-form-item
          label="验证码"
          path="oldPhoneCode"
        >
          <n-input-group>
            <n-input
              v-model:value="formData.oldPhoneCode"
              placeholder="请输入验证码"
              maxlength="6"
            />
            <n-button
              :disabled="oldCooldown > 0"
              :loading="sendingOldCode"
              @click="handleSendOldCode"
            >
              {{ oldCooldown > 0 ? `${oldCooldown}s` : "获取验证码" }}
            </n-button>
          </n-input-group>
        </n-form-item>
      </n-form>
      <div style="margin-top: 16px">
        <n-button
          type="primary"
          :loading="verifying"
          @click="handleVerifyOldPhone"
        >
          下一步
        </n-button>
      </div>
    </div>

    <!-- 步骤2: 绑定新手机号 -->
    <div v-else-if="step === 2 && !success">
      <n-form
        ref="newPhoneFormRef"
        :model="formData"
        :rules="newPhoneRules"
        label-placement="top"
      >
        <n-form-item
          label="新手机号"
          path="newPhone"
        >
          <n-input
            v-model:value="formData.newPhone"
            placeholder="请输入新手机号"
            maxlength="11"
          />
        </n-form-item>
        <n-form-item
          label="验证码"
          path="newPhoneCode"
        >
          <n-input-group>
            <n-input
              v-model:value="formData.newPhoneCode"
              placeholder="请输入验证码"
              maxlength="6"
            />
            <n-button
              :disabled="newCooldown > 0 || !formData.newPhone"
              :loading="sendingNewCode"
              @click="handleSendNewCode"
            >
              {{ newCooldown > 0 ? `${newCooldown}s` : "获取验证码" }}
            </n-button>
          </n-input-group>
        </n-form-item>
      </n-form>
      <div style="margin-top: 16px">
        <n-space>
          <n-button @click="step = 1">上一步</n-button>
          <n-button
            type="primary"
            :loading="submitting"
            @click="handleSubmit"
          >
            确认修改
          </n-button>
        </n-space>
      </div>
    </div>

    <!-- 成功结果 -->
    <div v-else-if="success">
      <n-result
        status="success"
        title="手机号修改成功"
        description="请使用新手机号重新登录"
      >
        <template #footer>
          <n-button
            type="primary"
            @click="handleGoLogin"
          >
            去登录
          </n-button>
        </template>
      </n-result>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useUserStore } from "@/stores/user";
import { useAuthStore } from "@/stores/auth";
import { userApi } from "@/api/user";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const router = useRouter();
const message = useMessage();
const userStore = useUserStore();
const authStore = useAuthStore();

const visibleModel = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const currentPhone = computed(() => userStore.profile?.phone ?? "");

const step = ref(1);
const success = ref(false);
const verifying = ref(false);
const submitting = ref(false);
const oldPhoneFormRef = ref<FormInst | null>(null);
const newPhoneFormRef = ref<FormInst | null>(null);
const sendingOldCode = ref(false);
const sendingNewCode = ref(false);
const oldCooldown = ref(0);
const newCooldown = ref(0);
const verifyToken = ref("");

const formData = reactive({
  oldPhoneCode: "",
  newPhone: "",
  newPhoneCode: "",
});

const oldPhoneRules: FormRules = {
  oldPhoneCode: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    { pattern: /^\d{6}$/, message: "验证码为6位数字", trigger: "blur" },
  ],
};

const newPhoneRules: FormRules = {
  newPhone: [
    { required: true, message: "请输入新手机号", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur",
    },
    {
      validator: (_rule, value) => {
        if (value === currentPhone.value) {
          return new Error("新手机号不能与当前手机号相同");
        }
        return true;
      },
      trigger: "blur",
    },
  ],
  newPhoneCode: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    { pattern: /^\d{6}$/, message: "验证码为6位数字", trigger: "blur" },
  ],
};

function maskPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function resetState() {
  step.value = 1;
  success.value = false;
  verifying.value = false;
  submitting.value = false;
  sendingOldCode.value = false;
  sendingNewCode.value = false;
  oldCooldown.value = 0;
  newCooldown.value = 0;
  verifyToken.value = "";
  formData.oldPhoneCode = "";
  formData.newPhone = "";
  formData.newPhoneCode = "";
  oldPhoneFormRef.value?.restoreValidation();
  newPhoneFormRef.value?.restoreValidation();
}

function onModalUpdate(value: boolean) {
  emit("update:visible", value);
  if (!value) {
    onClose();
  }
}

function onClose() {
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

function startOldCooldown() {
  oldCooldown.value = 60;
  const timer = setInterval(() => {
    oldCooldown.value--;
    if (oldCooldown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

function startNewCooldown() {
  newCooldown.value = 60;
  const timer = setInterval(() => {
    newCooldown.value--;
    if (newCooldown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

async function handleSendOldCode() {
  if (!currentPhone.value) return;

  sendingOldCode.value = true;
  try {
    await userApi.sendUpdatePhoneCode("verify_old");
    message.success("验证码已发送");
    startOldCooldown();
  } catch (error: unknown) {
    const err = error as { message?: string };
    message.error(err.message || "发送失败");
  } finally {
    sendingOldCode.value = false;
  }
}

async function handleSendNewCode() {
  if (!formData.newPhone) {
    message.error("请输入新手机号");
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(formData.newPhone)) {
    message.error("请输入正确的手机号");
    return;
  }

  sendingNewCode.value = true;
  try {
    await userApi.sendUpdatePhoneCode("verify_new", formData.newPhone);
    message.success("验证码已发送");
    startNewCooldown();
  } catch (error: unknown) {
    const err = error as { message?: string };
    message.error(err.message || "发送失败");
  } finally {
    sendingNewCode.value = false;
  }
}

async function handleVerifyOldPhone() {
  try {
    await oldPhoneFormRef.value?.validate();
    verifying.value = true;

    const result = await userApi.verifyOldPhone(formData.oldPhoneCode);
    verifyToken.value = result.verifyToken;
    step.value = 2;
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message) {
      message.error(err.message);
    }
  } finally {
    verifying.value = false;
  }
}

async function handleSubmit() {
  try {
    await newPhoneFormRef.value?.validate();
    submitting.value = true;

    await userStore.changePhone({
      newPhone: formData.newPhone,
      newPhoneCode: formData.newPhoneCode,
      verifyToken: verifyToken.value,
    });

    success.value = true;
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message) {
      message.error(err.message);
    }
  } finally {
    submitting.value = false;
  }
}

function handleGoLogin() {
  authStore.logout();
  router.push("/login");
  visibleModel.value = false;
}
</script>

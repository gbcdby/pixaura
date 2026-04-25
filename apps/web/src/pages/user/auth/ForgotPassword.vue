<template>
  <div class="forgot-form">
    <n-card
      class="auth-card"
      title="重置密码"
    >
      <!-- 步骤条 -->
      <n-steps
        :current="step"
        class="forgot-steps"
        size="small"
      >
        <n-step title="验证手机号" />
        <n-step title="设置新密码" />
      </n-steps>

      <!-- 步骤1: 验证手机号 -->
      <div
        v-if="step === 1"
        class="step-content"
      >
        <n-form
          ref="phoneFormRef"
          :model="formData"
          :rules="phoneStepRules"
          label-placement="top"
        >
          <n-form-item
            label="手机号"
            path="phone"
          >
            <n-input
              v-model:value="formData.phone"
              placeholder="请输入手机号"
              size="large"
              maxlength="11"
            >
              <template #prefix>
                <n-icon><PhonePortraitOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item
            label="验证码"
            path="code"
          >
            <n-input-group>
              <n-input
                v-model:value="formData.code"
                placeholder="请输入验证码"
                size="large"
                maxlength="6"
              >
                <template #prefix>
                  <n-icon><KeyOutline /></n-icon>
                </template>
              </n-input>
              <n-button
                size="large"
                :disabled="cooldownSeconds > 0"
                :loading="sendingCode"
                @click="handleSendCode"
              >
                {{ cooldownSeconds > 0 ? `${cooldownSeconds}s` : "获取验证码" }}
              </n-button>
            </n-input-group>
          </n-form-item>

          <n-button
            type="primary"
            size="large"
            block
            @click="handleVerifyPhone"
          >
            下一步
          </n-button>
        </n-form>
      </div>

      <!-- 步骤2: 设置新密码 -->
      <div
        v-else
        class="step-content"
      >
        <n-result
          v-if="success"
          status="success"
          title="密码重置成功"
          description="请使用新密码登录"
        >
          <template #footer>
            <n-button
              type="primary"
              @click="$router.push('/login')"
            >
              去登录
            </n-button>
          </template>
        </n-result>

        <n-form
          v-else
          ref="passwordFormRef"
          :model="formData"
          :rules="passwordStepRules"
          label-placement="top"
        >
          <n-form-item
            label="新密码"
            path="newPassword"
          >
            <n-input
              v-model:value="formData.newPassword"
              type="password"
              placeholder="8-20位，包含字母和数字"
              size="large"
              show-password-on="click"
            >
              <template #prefix>
                <n-icon><LockClosedOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item
            label="确认新密码"
            path="confirmPassword"
          >
            <n-input
              v-model:value="formData.confirmPassword"
              type="password"
              placeholder="请再次输入新密码"
              size="large"
              show-password-on="click"
            >
              <template #prefix>
                <n-icon><LockClosedOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-space vertical>
            <n-button
              type="primary"
              size="large"
              block
              :loading="loading"
              @click="handleResetPassword"
            >
              重置密码
            </n-button>
            <n-button
              size="large"
              block
              @click="step = 1"
            >
              上一步
            </n-button>
          </n-space>
        </n-form>
      </div>

      <template #footer>
        <div class="card-footer">
          <n-button
            text
            type="primary"
            @click="$router.push('/login')"
          >
            返回登录
          </n-button>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { authApi } from "@/api/auth";
import {
  PhonePortraitOutline,
  KeyOutline,
  LockClosedOutline,
} from "@vicons/ionicons5";

const message = useMessage();

const step = ref(1);
const success = ref(false);
const loading = ref(false);
const phoneFormRef = ref<FormInst | null>(null);
const passwordFormRef = ref<FormInst | null>(null);
const sendingCode = ref(false);
const cooldownSeconds = ref(0);

const formData = reactive({
  phone: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
});

// 步骤1验证规则
const phoneStepRules: FormRules = {
  phone: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur",
    },
  ],
  code: [
    { required: true, message: "请输入验证码", trigger: "blur" },
    { pattern: /^\d{6}$/, message: "验证码为6位数字", trigger: "blur" },
  ],
};

// 步骤2验证规则
const passwordStepRules: FormRules = {
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
        return (
          value === formData.newPassword || new Error("两次输入的密码不一致")
        );
      },
      trigger: "blur",
    },
  ],
};

// 发送验证码
async function handleSendCode() {
  if (!formData.phone) {
    message.error("请输入手机号");
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
    message.error("请输入正确的手机号");
    return;
  }

  sendingCode.value = true;
  try {
    await authApi.sendCode({ phone: formData.phone, type: "reset_password" });
    message.success("验证码已发送");
    startCooldown();
  } catch (error: any) {
    message.error(error.message || "发送失败");
  } finally {
    sendingCode.value = false;
  }
}

// 开始倒计时
function startCooldown() {
  cooldownSeconds.value = 60;
  const timer = setInterval(() => {
    cooldownSeconds.value--;
    if (cooldownSeconds.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);
}

// 验证手机号
async function handleVerifyPhone() {
  try {
    await phoneFormRef.value?.validate();
    step.value = 2;
  } catch {
    // 验证失败
  }
}

// 重置密码
async function handleResetPassword() {
  try {
    await passwordFormRef.value?.validate();
    loading.value = true;
    await authApi.resetPassword({
      phone: formData.phone,
      code: formData.code,
      newPassword: formData.newPassword,
      confirmPassword: formData.confirmPassword,
    });
    success.value = true;
  } catch (error: any) {
    message.error(error.message || "重置失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/auth-shared" as *;

.forgot-form {
  width: 100%;
}

.forgot-steps {
  margin-bottom: 24px;
}

.step-content {
  margin-top: 16px;
}
</style>

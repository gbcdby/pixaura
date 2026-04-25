<template>
  <div class="register-form">
    <n-card
      class="auth-card"
      :title="step === 1 ? '手机号验证' : '设置账号信息'"
    >
      <!-- 步骤条 -->
      <n-steps
        :current="step"
        class="register-steps"
        size="small"
      >
        <n-step title="手机号验证" />
        <n-step title="设置账号" />
      </n-steps>

      <!-- 步骤1: 手机号验证 -->
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
                :disabled="authStore.cooldownSeconds > 0"
                :loading="sendingCode"
                @click="handleSendCode"
              >
                {{
                  authStore.cooldownSeconds > 0
                    ? `${authStore.cooldownSeconds}s`
                    : "获取验证码"
                }}
              </n-button>
            </n-input-group>
          </n-form-item>

          <n-button
            type="primary"
            size="large"
            block
            @click="handlePhoneVerify"
          >
            下一步
          </n-button>
        </n-form>
      </div>

      <!-- 步骤2: 设置账号 -->
      <div
        v-else
        class="step-content"
      >
        <n-form
          ref="accountFormRef"
          :model="formData"
          :rules="accountStepRules"
          label-placement="top"
        >
          <n-form-item
            label="用户名"
            path="username"
          >
            <n-input
              v-model:value="formData.username"
              placeholder="3-20位字符，支持字母、数字、下划线"
              size="large"
              maxlength="20"
            >
              <template #prefix>
                <n-icon><PersonOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item
            label="密码"
            path="password"
          >
            <n-input
              v-model:value="formData.password"
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

          <!-- 密码强度指示器 -->
          <div
            v-if="formData.password"
            class="password-strength"
          >
            <div class="strength-bar">
              <div
                class="strength-fill"
                :class="`strength-${passwordStrength.level}`"
                :style="{ width: `${(passwordStrength.level + 1) * 33.33}%` }"
              />
            </div>
            <span
              class="strength-text"
              :class="`strength-text-${passwordStrength.level}`"
            >
              {{ passwordStrength.text }}
            </span>
          </div>

          <n-form-item
            label="确认密码"
            path="confirmPassword"
          >
            <n-input
              v-model:value="formData.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              size="large"
              show-password-on="click"
            >
              <template #prefix>
                <n-icon><LockClosedOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item
            label="邮箱（可选）"
            path="email"
          >
            <n-input
              v-model:value="formData.email"
              placeholder="用于接收通知和找回密码"
              size="large"
            >
              <template #prefix>
                <n-icon><MailOutline /></n-icon>
              </template>
            </n-input>
          </n-form-item>

          <n-form-item>
            <n-checkbox v-model:checked="agreed">
              我已阅读并同意
              <n-button
                text
                type="primary"
              >
                用户协议
              </n-button> 和
              <n-button
                text
                type="primary"
              >
                隐私政策
              </n-button>
            </n-checkbox>
          </n-form-item>

          <n-space vertical>
            <n-button
              type="primary"
              size="large"
              block
              :loading="authStore.loading"
              @click="handleRegister"
            >
              注册
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
          <span>已有账号？</span>
          <n-button
            text
            type="primary"
            @click="$router.push('/login')"
          >
            立即登录
          </n-button>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useAuthStore } from "@/stores/auth";
import {
  PhonePortraitOutline,
  KeyOutline,
  PersonOutline,
  LockClosedOutline,
  MailOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const message = useMessage();
const authStore = useAuthStore();

const step = ref(1);
const phoneFormRef = ref<FormInst | null>(null);
const accountFormRef = ref<FormInst | null>(null);
const sendingCode = ref(false);
const agreed = ref(false);

const formData = reactive({
  phone: "",
  code: "",
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
});

// 计算密码强度（满分 5 分）
const passwordStrength = computed(() => {
  const pwd = formData.password;
  if (!pwd) return { level: -1, text: "" };

  let score = 0;
  // 长度评分（最多2分）
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  // 字符类型评分（最多3分）
  if (/[a-z]/.test(pwd)) score += 0.5; // 小写字母 0.5
  if (/[A-Z]/.test(pwd)) score += 0.5; // 大写字母 0.5
  if (/\d/.test(pwd)) score += 1; // 数字 1分
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1; // 特殊字符 1分

  // 扣分项
  if (/(.+)\1{2,}/.test(pwd)) score -= 1; // 重复字符如 aaa 减1分
  if (/^(.)\1+$/.test(pwd)) score = 0; // 全部相同字符直接0分

  // 确保分数在 0-5 范围内
  score = Math.max(0, Math.min(5, score));

  if (score < 2) return { level: 0, text: "弱" };
  if (score < 4) return { level: 1, text: "中" };
  return { level: 2, text: "强" };
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
const accountStepRules: FormRules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    {
      pattern: /^[a-zA-Z0-9_]{3,20}$/,
      message: "用户名3-20位，支持字母、数字、下划线",
      trigger: "blur",
    },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 8, message: "密码长度不能少于8位", trigger: "blur" },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
      message: "密码必须包含字母和数字",
      trigger: "blur",
    },
  ],
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    {
      validator: (_rule, value) => {
        return value === formData.password || new Error("两次输入的密码不一致");
      },
      trigger: "blur",
    },
  ],
  email: [{ type: "email", message: "请输入正确的邮箱地址", trigger: "blur" }],
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
    await authStore.sendVerifyCode(formData.phone, "register");
    message.success("验证码已发送");
  } catch (error: any) {
    message.error(error.message || "发送失败");
  } finally {
    sendingCode.value = false;
  }
}

// 手机号验证
async function handlePhoneVerify() {
  try {
    await phoneFormRef.value?.validate();
    step.value = 2;
  } catch {
    // 验证失败
  }
}

// 注册
async function handleRegister() {
  if (!agreed.value) {
    message.error("请同意用户协议和隐私政策");
    return;
  }

  try {
    await accountFormRef.value?.validate();
    await authStore.register({
      phone: formData.phone,
      code: formData.code,
      username: formData.username,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      email: formData.email || undefined,
    });
    message.success("注册成功，请登录");
    router.push("/login");
  } catch (error: any) {
    message.error(error.message || "注册失败");
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/auth-shared" as *;

.register-form {
  width: 100%;
}

.register-steps {
  margin-bottom: 24px;
}

.step-content {
  margin-top: 16px;
}

// 密码强度指示器 - 一行布局
.password-strength {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;

  .strength-bar {
    flex: 1;
    min-width: 100px;
    height: 4px;
    background-color: rgba(0, 0, 0, 0.06);
    border-radius: 2px;
    overflow: hidden;

    .strength-fill {
      height: 100%;
      transition: all 0.3s ease;
      border-radius: 2px;

      &.strength-0 {
        background: linear-gradient(90deg, #ff4d4f 0%, #ff7875 100%);
      }

      &.strength-1 {
        background: linear-gradient(90deg, #faad14 0%, #ffc53d 100%);
      }

      &.strength-2 {
        background: linear-gradient(90deg, #52c41a 0%, #73d13d 100%);
      }
    }
  }

  .strength-text {
    font-size: 14px;
    font-weight: 600;
    min-width: 28px;
    text-align: right;
    text-shadow: 0 0 1px rgba(255, 255, 255, 0.5);

    &.strength-text-0 {
      color: #cf1322;
    }

    &.strength-text-1 {
      color: #d48806;
    }

    &.strength-text-2 {
      color: #389e0d;
    }
  }
}
</style>

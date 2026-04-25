<template>
  <div class="login-form">
    <n-card
      class="auth-card"
      title="用户登录"
    >
      <!-- 登录方式切换 -->
      <n-tabs
        v-model:value="loginType"
        type="line"
        class="login-tabs"
      >
        <n-tab-pane
          name="account"
          tab="账号密码登录"
        >
          <n-form
            ref="accountFormRef"
            :model="accountForm"
            :rules="accountRules"
            label-placement="top"
          >
            <n-form-item
              label="账号"
              path="username"
            >
              <n-input
                v-model:value="accountForm.username"
                placeholder="请输入用户名/手机号/邮箱"
                size="large"
                @keyup.enter="handleAccountLogin"
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
                v-model:value="accountForm.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                show-password-on="click"
                @keyup.enter="handleAccountLogin"
              >
                <template #prefix>
                  <n-icon><LockClosedOutline /></n-icon>
                </template>
              </n-input>
            </n-form-item>

            <n-button
              type="primary"
              size="large"
              block
              :loading="authStore.loading"
              @click="handleAccountLogin"
            >
              登录
            </n-button>
          </n-form>
        </n-tab-pane>

        <n-tab-pane
          name="phone"
          tab="手机号登录"
        >
          <n-form
            ref="phoneFormRef"
            :model="phoneForm"
            :rules="phoneRules"
            label-placement="top"
          >
            <n-form-item
              label="手机号"
              path="phone"
            >
              <n-input
                v-model:value="phoneForm.phone"
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
                  v-model:value="phoneForm.code"
                  placeholder="请输入验证码"
                  size="large"
                  maxlength="6"
                  @keyup.enter="handlePhoneLogin"
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
              :loading="authStore.loading"
              @click="handlePhoneLogin"
            >
              登录
            </n-button>
          </n-form>
        </n-tab-pane>
      </n-tabs>

      <template #footer>
        <div class="card-footer">
          <n-button
            text
            type="primary"
            @click="$router.push('/forgot-password')"
          >
            忘记密码？
          </n-button>
          <div class="footer-right">
            <span>还没有账号？</span>
            <n-button
              text
              type="primary"
              @click="$router.push('/register')"
            >
              立即注册
            </n-button>
          </div>
        </div>
      </template>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import type { FormInst, FormRules } from "naive-ui";
import { useAuthStore } from "@/stores/auth";
import {
  PersonOutline,
  LockClosedOutline,
  PhonePortraitOutline,
  KeyOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const authStore = useAuthStore();

const loginType = ref<"account" | "phone">("account");
const accountFormRef = ref<FormInst | null>(null);
const phoneFormRef = ref<FormInst | null>(null);
const sendingCode = ref(false);

// 账号密码表单
const accountForm = reactive({
  username: "",
  password: "",
});

// 手机号表单
const phoneForm = reactive({
  phone: "",
  code: "",
});

// 表单验证规则
const accountRules: FormRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于6位", trigger: "blur" },
  ],
};

const phoneRules: FormRules = {
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

// 账号密码登录
async function handleAccountLogin() {
  try {
    await accountFormRef.value?.validate();
    await authStore.login({
      username: accountForm.username,
      password: accountForm.password,
    });
    message.success("登录成功");
    const redirect = route.query.redirect as string;
    router.replace(redirect || "/");
  } catch (error: any) {
    message.error(error.message || "登录失败");
  }
}

// 手机号登录
async function handlePhoneLogin() {
  try {
    await phoneFormRef.value?.validate();
    await authStore.loginWithPhone(phoneForm.phone, phoneForm.code);
    message.success("登录成功");
    const redirect = route.query.redirect as string;
    router.replace(redirect || "/");
  } catch (error: any) {
    message.error(error.message || "登录失败");
  }
}

// 发送验证码
async function handleSendCode() {
  if (!phoneForm.phone) {
    message.error("请输入手机号");
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(phoneForm.phone)) {
    message.error("请输入正确的手机号");
    return;
  }

  sendingCode.value = true;
  try {
    await authStore.sendVerifyCode(phoneForm.phone, "login");
    message.success("验证码已发送");
  } catch (error: any) {
    message.error(error.message || "发送失败");
  } finally {
    sendingCode.value = false;
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/auth-shared" as *;

.login-form {
  width: 100%;
}

.login-tabs {
  :deep(.n-tabs-nav) {
    margin-bottom: 24px;
  }
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}
</style>

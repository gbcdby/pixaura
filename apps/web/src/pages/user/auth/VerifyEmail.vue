<template>
  <div class="verify-email-page">
    <n-card
      class="verify-card"
      title="邮箱验证"
    >
      <div class="verify-content">
        <n-spin
          v-if="loading"
          size="large"
          description="验证中..."
        />

        <n-result
          v-else-if="success"
          status="success"
          title="邮箱验证成功"
          description="您的邮箱已验证成功，即将跳转到登录页"
        >
          <template #footer>
            <n-button
              type="primary"
              @click="goToLogin"
            >
              立即登录
            </n-button>
          </template>
        </n-result>

        <n-result
          v-else-if="alreadyVerified"
          status="info"
          title="邮箱已验证"
          description="该邮箱已经验证过了，无需重复验证"
        >
          <template #footer>
            <n-button
              type="primary"
              @click="goToLogin"
            >
              去登录
            </n-button>
          </template>
        </n-result>

        <n-result
          v-else
          status="error"
          title="邮箱验证失败"
          :description="errorMessage"
        >
          <template #footer>
            <n-space>
              <n-button @click="resendEmail">
                重新发送验证邮件
              </n-button>
              <n-button
                type="primary"
                @click="goToLogin"
              >
                返回登录
              </n-button>
            </n-space>
          </template>
        </n-result>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { authApi } from "@/api/auth";

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const success = ref(false);
const alreadyVerified = ref(false);
const errorMessage = ref("");

onMounted(async () => {
  const token = route.query.token as string;

  if (!token) {
    errorMessage.value = "验证令牌无效";
    loading.value = false;
    return;
  }

  try {
    await authApi.verifyEmail(token);
    success.value = true;

    // 3 秒后自动跳转到登录页
    setTimeout(() => {
      goToLogin();
    }, 3000);
  } catch (error: any) {
    const code = error.code;
    if (code === 1022) {
      alreadyVerified.value = true;
    } else if (code === 1020) {
      errorMessage.value = "验证令牌已过期，请重新发送验证邮件";
    } else if (code === 1021) {
      errorMessage.value = "验证令牌无效，请重新发送验证邮件";
    } else {
      errorMessage.value = error.message || "验证失败，请稍后重试";
    }
  } finally {
    loading.value = false;
  }
});

function goToLogin() {
  router.push({ name: "Login" });
}

function resendEmail() {
  router.push("/login");
}
</script>

<style scoped lang="scss">
.verify-email-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-soft);
  padding: 24px;
}

.verify-card {
  width: 100%;
  max-width: 500px;
  border-radius: var(--radius-3xl);
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 8px 32px rgba(157, 138, 231, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);

  :deep(.n-card-header) {
    text-align: center;
    background: transparent;

    .n-card-header__main {
      font-size: 20px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
  }

  :deep(.n-card__content) {
    background: transparent;
  }
}

.verify-content {
  padding: 24px 0;
}
</style>

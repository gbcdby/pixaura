<template>
  <section class="cta-section">
    <div class="cta-bg"></div>
    <div class="cta-content">
      <h2 class="cta-title">准备好开始创作了吗？</h2>
      <p class="cta-subtitle">加入数千名创作者，用 AI 释放你的故事力量</p>
      <div class="cta-buttons">
        <n-button
          type="primary"
          size="large"
          class="btn-gradient"
          @click="handleRegister"
        >
          免费注册，立即创作
        </n-button>
        <n-button size="large" class="btn-outline" @click="showDemo">
          <template #icon>
            <n-icon><VideocamOutline /></n-icon>
          </template>
          预约产品演示
        </n-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { VideocamOutline } from "@vicons/ionicons5";
import { useMessage } from "naive-ui";

const router = useRouter();
const authStore = useAuthStore();
const message = useMessage();

function handleRegister() {
  if (authStore.isLogin) {
    router.push("/projects");
  } else {
    router.push("/register");
  }
}

function showDemo() {
  message.info("演示预约功能正在开发中");
}
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>
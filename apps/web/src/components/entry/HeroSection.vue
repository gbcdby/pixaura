<template>
  <section class="hero-section">
    <!-- Background Decorations -->
    <div class="hero-bg">
      <div class="hero-gradient"></div>
      <div class="floating-orb orb-1 animate-pulse-slow"></div>
      <div class="floating-orb orb-2 animate-pulse-slow"></div>
    </div>

    <!-- Content -->
    <div class="hero-content">
      <!-- Badge -->
      <div class="hero-badge animate-fade-in-up">
        <span class="badge-dot"></span>
        <span class="badge-text">AI 驱动的短剧创作新时代</span>
      </div>

      <!-- Title -->
      <h1 class="hero-title animate-fade-in-up">
        <span class="title-line">让创意</span>
        <span class="title-gradient">触手可及</span>
      </h1>

      <!-- Subtitle -->
      <p class="hero-subtitle animate-fade-in-up">
        Pixaura 将人工智能与叙事艺术完美融合，只需输入你的想法，即可生成专业级短剧剧本、分镜与视频。从零到成片，只需几分钟。
      </p>

      <!-- CTA Buttons -->
      <div class="hero-cta animate-fade-in-up">
        <n-button
          type="primary"
          size="large"
          class="btn-gradient cta-primary"
          @click="handleStart"
        >
          立刻开始创作
          <template #icon>
            <n-icon class="cta-icon-right"><ArrowForwardOutline /></n-icon>
          </template>
        </n-button>
        <n-button size="large" class="btn-outline" @click="showDemo">
          <template #icon>
            <n-icon><PlayCircleOutline /></n-icon>
          </template>
          观看演示
        </n-button>
      </div>
    </div>

    <!-- Scroll Indicator -->
    <div class="scroll-indicator animate-bounce">
      <n-icon size="24"><ChevronDownOutline /></n-icon>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ArrowForwardOutline, PlayCircleOutline, ChevronDownOutline } from "@vicons/ionicons5";
import { useMessage } from "naive-ui";

const router = useRouter();
const authStore = useAuthStore();
const message = useMessage();

function handleStart() {
  if (authStore.isLogin) {
    router.push("/projects");
  } else {
    router.push("/login");
  }
}

function showDemo() {
  message.info("演示视频功能正在开发中");
}
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;

.cta-primary {
  padding: 14px 32px !important; // 减小按钮高度
  font-size: 18px !important;
  font-weight: 500 !important;
  height: auto !important;

  // 将图标移动到右侧
  :deep(.n-button__icon) {
    order: 2;
    margin-left: 8px;
    margin-right: 0;
  }

  :deep(.n-button__content) {
    font-size: 18px;
  }
}

// outline 按钮样式
.btn-outline {
  padding: 14px 32px !important;
  font-size: 18px !important;
  height: auto !important;

  :deep(.n-button__content) {
    font-size: 18px;
  }
}

.cta-icon-right {
  transition: transform 0.3s ease;
}

.cta-primary:hover .cta-icon-right {
  transform: translateX(4px);
}
</style>
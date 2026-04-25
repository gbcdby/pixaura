<template>
  <div class="auth-layout">
    <!-- 统一渐变背景 -->
    <div class="auth-background">
      <div class="gradient-orb orb-1" />
      <div class="gradient-orb orb-2" />
      <div class="gradient-orb orb-3" />
    </div>

    <!-- 主内容区域：限制最大宽度并居中 -->
    <div class="auth-container">
      <!-- 左侧：品牌展示区 -->
      <div class="auth-brand">
        <div class="brand-content">
          <!-- Logo -->
          <div
            class="brand-logo"
            @click="$router.push('/')"
          >
            <div class="logo-icon">
              <n-icon
                :size="48"
                color="#fff"
              >
                <SparklesOutline />
              </n-icon>
            </div>
            <h1 class="logo-text">
              Pixaura
            </h1>
          </div>

          <!-- 动态标语区 -->
          <div class="brand-slogan">
            <transition
              name="fade-slide"
              mode="out-in"
            >
              <div
                :key="currentContent.key"
                class="slogan-content"
              >
                <h2 class="slogan-title">
                  {{ currentContent.title }}
                </h2>
                <p class="slogan-desc">
                  {{ currentContent.desc }}
                </p>

                <!-- 特性列表 -->
                <ul class="feature-list">
                  <li
                    v-for="(feature, index) in currentContent.features"
                    :key="index"
                    class="feature-item"
                    :style="{ animationDelay: `${index * 100}ms` }"
                  >
                    <n-icon
                      :size="20"
                      color="#fff"
                    >
                      <CheckmarkCircleOutline />
                    </n-icon>
                    <span>{{ feature }}</span>
                  </li>
                </ul>
              </div>
            </transition>
          </div>

          <!-- 底部信息 -->
          <div class="brand-footer">
            <p class="copyright">
              © 2024 Pixaura. All rights reserved.
            </p>
            <div class="social-links">
              <n-button
                quaternary
                circle
                size="small"
              >
                <template #icon>
                  <n-icon color="rgba(255,255,255,0.7)">
                    <LogoGithub />
                  </n-icon>
                </template>
              </n-button>
              <n-button
                quaternary
                circle
                size="small"
              >
                <template #icon>
                  <n-icon color="rgba(255,255,255,0.7)">
                    <MailOutline />
                  </n-icon>
                </template>
              </n-button>
            </div>
          </div>
        </div>

        <!-- 左侧装饰区：几何圆环 + 点阵 + 弧线 -->
        <div class="brand-decoration">
          <!-- 背景点阵（底层点缀） -->
          <div class="dot-grid">
            <span
              v-for="n in 24"
              :key="n"
              :class="`grid-dot dot-${n}`"
            />
          </div>
          <!-- 几何圆环 -->
          <div class="geo-ring ring-1" />
          <div class="geo-ring ring-2" />
          <div class="geo-circle circle-1" />
          <div class="geo-circle circle-2" />
          <!-- 弧线装饰 -->
          <div class="arc arc-1" />
          <div class="arc arc-2" />
        </div>
      </div>

      <!-- 右侧：表单区 -->
      <div class="auth-form">
        <div class="form-container">
          <router-view v-slot="{ Component }">
            <transition
              name="form-fade"
              mode="out-in"
            >
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </div>

      <!-- 中间连接装饰区：光桥 + 浮动光点 -->
      <div class="auth-connector">
        <div class="light-bridge" />
        <div class="floating-particles">
          <span
            v-for="n in 6"
            :key="n"
            :class="`particle particle-${n}`"
          />
        </div>
        <div class="glow-orb" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  SparklesOutline,
  CheckmarkCircleOutline,
  LogoGithub,
  MailOutline,
} from "@vicons/ionicons5";

const route = useRoute();

// 根据路由显示不同的左侧内容
const contentMap: Record<string, AuthContent> = {
  "/login": {
    key: "login",
    title: "欢迎回来",
    desc: "登录您的账户，开始创作之旅",
    features: [
      "AI 智能视频生成",
      "海量素材库支持",
      "专业级视频编辑",
      "云端项目同步",
    ],
  },
  "/register": {
    key: "register",
    title: "开启创作之旅",
    desc: "注册账户，免费体验 AI 短剧生成",
    features: [
      "新用户免费试用",
      "多种模板可选",
      "实时协作功能",
      "7x24小时技术支持",
    ],
  },
  "/forgot-password": {
    key: "forgot",
    title: "找回密码",
    desc: "别担心，我们帮您重置密码",
    features: [
      "手机验证码找回",
      "安全快速重置",
      "24/7 自助服务",
      "账户安全保护",
    ],
  },
};

interface AuthContent {
  key: string;
  title: string;
  desc: string;
  features: string[];
}

const currentContent = computed(() => {
  const path = route.path;
  return contentMap[path] || contentMap["/login"];
});
</script>

<style scoped lang="scss">
.auth-layout {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #b8a5f0 0%, #9d8ae7 50%, #7eb8f7 100%);
  overflow: hidden;
}

/* 主内容容器：限制最大宽度并居中 */
.auth-container {
  display: flex;
  width: 100%;
  max-width: 1280px;
  position: relative;
  z-index: 1;
}

/* 统一背景装饰 - 覆盖整个页面 */
.auth-background {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;

  .gradient-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.5;
    animation: float 20s ease-in-out infinite;

    &.orb-1 {
      width: 500px;
      height: 500px;
      background: #e879f9;
      top: -150px;
      left: -100px;
      animation-delay: 0s;
    }

    &.orb-2 {
      width: 400px;
      height: 400px;
      background: #818cf8;
      bottom: -100px;
      right: 10%;
      animation-delay: -7s;
    }

    &.orb-3 {
      width: 350px;
      height: 350px;
      background: #60a5fa;
      top: 40%;
      left: 30%;
      animation-delay: -14s;
    }
  }
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.05);
  }
  50% {
    transform: translate(0, 20px) scale(0.95);
  }
  75% {
    transform: translate(-30px, -10px) scale(1.02);
  }
}

/* ========== 左侧品牌区 ========== */
.auth-brand {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 48px 64px;
  z-index: 1;

  /* 右侧分割线 - 微妙的光晕效果 */
  &::after {
    content: "";
    position: absolute;
    top: 10%;
    right: 0;
    width: 1px;
    height: 80%;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(255, 255, 255, 0.3) 20%,
      rgba(255, 255, 255, 0.3) 80%,
      transparent 100%
    );
  }
}

/* 品牌内容 */
.brand-content {
  position: relative;
  z-index: 1;
  max-width: 480px;
  color: #fff;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 64px;
  cursor: pointer;
  transition: opacity 0.3s;

  &:hover {
    opacity: 0.9;
  }

  .logo-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .logo-text {
    font-size: 32px;
    font-weight: 700;
    margin: 0;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
}

/* 标语区 */
.brand-slogan {
  margin-bottom: 48px;

  .slogan-content {
    animation: contentIn 0.5s ease-out;
  }

  .slogan-title {
    font-size: 48px;
    font-weight: 700;
    margin: 0 0 16px;
    line-height: 1.2;
    text-shadow:
      0 2px 4px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.2);
    letter-spacing: -0.5px;
  }

  .slogan-desc {
    font-size: 18px;
    margin: 0 0 32px;
    opacity: 1;
    line-height: 1.6;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    font-weight: 500;
  }
}

/* 特性列表 */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;

  .feature-item {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 16px;
    opacity: 0;
    animation: slideIn 0.5s ease-out forwards;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
    font-weight: 500;

    span {
      opacity: 1;
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes contentIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 左侧装饰区 - 几何图形 + 点阵 */
.brand-decoration {
  position: absolute;
  right: 60px;
  top: 50%;
  transform: translateY(-50%);
  width: 200px;
  height: 400px;
  pointer-events: none;
  z-index: 0;
}

/* 几何圆环 */
.geo-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  animation: ring-rotate 20s linear infinite;
}

.ring-1 {
  width: 180px;
  height: 180px;
  right: 40px;
  top: 10%;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    0 0 30px rgba(255, 255, 255, 0.1),
    inset 0 0 30px rgba(255, 255, 255, 0.05);
}

.ring-2 {
  width: 120px;
  height: 120px;
  right: 80px;
  top: 25%;
  border-color: rgba(255, 255, 255, 0.15);
  animation-direction: reverse;
  animation-duration: 15s;
}

@keyframes ring-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 实心圆形装饰 */
.geo-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(2px);
  animation: circle-pulse 4s ease-in-out infinite;
}

.circle-1 {
  width: 40px;
  height: 40px;
  right: 120px;
  top: 5%;
  animation-delay: 0s;
}

.circle-2 {
  width: 25px;
  height: 25px;
  right: 60px;
  top: 50%;
  animation-delay: -2s;
}

@keyframes circle-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}

/* 背景点阵（底层点缀） */
.dot-grid {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 160px;
  height: 320px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 24px;
  z-index: -1;
  opacity: 0.6;
}

.grid-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  animation: grid-dot-pulse 4s ease-in-out infinite;
}

.grid-dot:nth-child(1) {
  animation-delay: 0s;
}
.grid-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.grid-dot:nth-child(3) {
  animation-delay: 0.4s;
}
.grid-dot:nth-child(4) {
  animation-delay: 0.6s;
}
.grid-dot:nth-child(5) {
  animation-delay: 0.8s;
}
.grid-dot:nth-child(6) {
  animation-delay: 1s;
}
.grid-dot:nth-child(7) {
  animation-delay: 1.2s;
}
.grid-dot:nth-child(8) {
  animation-delay: 1.4s;
}
.grid-dot:nth-child(9) {
  animation-delay: 1.6s;
}
.grid-dot:nth-child(10) {
  animation-delay: 1.8s;
}
.grid-dot:nth-child(11) {
  animation-delay: 2s;
}
.grid-dot:nth-child(12) {
  animation-delay: 2.2s;
}
.grid-dot:nth-child(13) {
  animation-delay: 2.4s;
}
.grid-dot:nth-child(14) {
  animation-delay: 2.6s;
}
.grid-dot:nth-child(15) {
  animation-delay: 2.8s;
}
.grid-dot:nth-child(16) {
  animation-delay: 3s;
}
.grid-dot:nth-child(17) {
  animation-delay: 3.2s;
}
.grid-dot:nth-child(18) {
  animation-delay: 3.4s;
}
.grid-dot:nth-child(19) {
  animation-delay: 3.6s;
}
.grid-dot:nth-child(20) {
  animation-delay: 3.8s;
}
.grid-dot:nth-child(21) {
  animation-delay: 0.1s;
}
.grid-dot:nth-child(22) {
  animation-delay: 0.3s;
}
.grid-dot:nth-child(23) {
  animation-delay: 0.5s;
}
.grid-dot:nth-child(24) {
  animation-delay: 0.7s;
}

@keyframes grid-dot-pulse {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(0.8);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

/* 弧线装饰 */
.arc {
  position: absolute;
  border: 1px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  animation: arc-rotate 12s ease-in-out infinite;
}

.arc-1 {
  width: 250px;
  height: 250px;
  right: -20px;
  top: 30%;
  transform: rotate(-30deg);
}

.arc-2 {
  width: 200px;
  height: 200px;
  right: 10px;
  bottom: 10%;
  border-top-color: rgba(255, 255, 255, 0.15);
  animation-name: arc-rotate-2;
  animation-duration: 10s;
  transform: rotate(45deg);
}

@keyframes arc-rotate {
  0%,
  100% {
    transform: rotate(-30deg) translateX(0);
  }
  50% {
    transform: rotate(-30deg) translateX(10px);
  }
}

@keyframes arc-rotate-2 {
  0%,
  100% {
    transform: rotate(45deg) translateX(0);
  }
  50% {
    transform: rotate(45deg) translateX(-10px);
  }
}

/* 底部信息 */
.brand-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 48px;

  .copyright {
    font-size: 14px;
    opacity: 0.8;
    margin: 0;
  }

  .social-links {
    display: flex;
    gap: 8px;
  }
}

/* ========== 中间连接装饰区 ========== */
.auth-connector {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 120px;
  transform: translateX(-50%);
  z-index: 2;
  pointer-events: none;
}

/* 光桥效果 - 垂直渐变光柱 */
.light-bridge {
  position: absolute;
  left: 50%;
  top: 15%;
  bottom: 15%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 10%,
    rgba(255, 255, 255, 0.4) 30%,
    rgba(255, 255, 255, 0.6) 50%,
    rgba(255, 255, 255, 0.4) 70%,
    rgba(255, 255, 255, 0.1) 90%,
    transparent 100%
  );
  box-shadow:
    0 0 20px rgba(255, 255, 255, 0.3),
    0 0 40px rgba(184, 165, 240, 0.4),
    0 0 60px rgba(157, 138, 231, 0.3);
  animation: pulse-bridge 4s ease-in-out infinite;
}

@keyframes pulse-bridge {
  0%,
  100% {
    opacity: 0.6;
    box-shadow:
      0 0 20px rgba(255, 255, 255, 0.3),
      0 0 40px rgba(184, 165, 240, 0.4),
      0 0 60px rgba(157, 138, 231, 0.3);
  }
  50% {
    opacity: 1;
    box-shadow:
      0 0 30px rgba(255, 255, 255, 0.5),
      0 0 60px rgba(184, 165, 240, 0.6),
      0 0 90px rgba(157, 138, 231, 0.5);
  }
}

/* 浮动光点 */
.floating-particles {
  position: absolute;
  inset: 0;
}

.particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow:
    0 0 10px rgba(255, 255, 255, 0.8),
    0 0 20px rgba(184, 165, 240, 0.6),
    0 0 30px rgba(157, 138, 231, 0.4);
  animation: float-particle 8s ease-in-out infinite;
}

.particle-1 {
  left: 20%;
  top: 20%;
  animation-delay: 0s;
  width: 4px;
  height: 4px;
}

.particle-2 {
  left: 70%;
  top: 35%;
  animation-delay: -1.5s;
  width: 5px;
  height: 5px;
}

.particle-3 {
  left: 30%;
  top: 55%;
  animation-delay: -3s;
  width: 3px;
  height: 3px;
}

.particle-4 {
  left: 60%;
  top: 70%;
  animation-delay: -4.5s;
  width: 4px;
  height: 4px;
}

.particle-5 {
  left: 40%;
  top: 40%;
  animation-delay: -6s;
  width: 6px;
  height: 6px;
}

.particle-6 {
  left: 50%;
  top: 85%;
  animation-delay: -7s;
  width: 3px;
  height: 3px;
}

@keyframes float-particle {
  0%,
  100% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0.4;
  }
  25% {
    transform: translateY(-30px) translateX(10px) scale(1.2);
    opacity: 1;
  }
  50% {
    transform: translateY(-15px) translateX(-5px) scale(0.9);
    opacity: 0.7;
  }
  75% {
    transform: translateY(-40px) translateX(15px) scale(1.1);
    opacity: 0.9;
  }
}

/* 中心光晕 */
.glow-orb {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.3) 0%,
    rgba(184, 165, 240, 0.2) 30%,
    rgba(157, 138, 231, 0.1) 50%,
    transparent 70%
  );
  border-radius: 50%;
  animation: glow-pulse 6s ease-in-out infinite;
}

@keyframes glow-pulse {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0.8;
  }
}

/* ========== 右侧表单区 ========== */
.auth-form {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  z-index: 1;
}

.form-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
}

/* ========== 过渡动画 ========== */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.form-fade-enter-active,
.form-fade-leave-active {
  transition: all 0.3s ease-out;
}

.form-fade-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.form-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* ========== 响应式 ========== */
@media (max-width: 1280px) {
  .auth-container {
    max-width: 100%;
  }
}

@media (max-width: 1024px) {
  .auth-brand,
  .auth-connector,
  .brand-decoration {
    display: none;
  }

  .auth-form {
    padding: 24px;
  }
}

@media (max-width: 480px) {
  .auth-form {
    padding: 16px;
  }

  .form-container {
    max-width: 100%;
  }
}
</style>

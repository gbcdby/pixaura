<template>
  <nav :class="['entry-navbar', { scrolled: isScrolled }]">
    <div class="navbar-content">
      <!-- Logo -->
      <div class="logo-group" @click="$router.push('/')">
        <div class="logo-icon">P</div>
        <span class="logo-text">pixaura</span>
      </div>

      <!-- Desktop Menu -->
      <div class="desktop-menu">
        <a href="#features" @click.prevent="scrollTo('features')">功能特性</a>
        <a href="#showcase" @click.prevent="scrollTo('showcase')">作品展示</a>
      </div>

      <!-- CTA Buttons -->
      <div class="nav-actions">
        <template v-if="authStore.isLogin">
          <n-dropdown :options="userMenuOptions" @select="handleMenuSelect">
            <div class="user-info">
              <n-avatar :src="authStore.user?.avatar" :fallback-src="defaultAvatar" size="small" />
              <span class="username">{{ authStore.user?.username }}</span>
              <n-icon><ChevronDownOutline /></n-icon>
            </div>
          </n-dropdown>
        </template>
        <template v-else>
          <n-button quaternary size="small" @click="$router.push('/login')">登录</n-button>
          <n-button type="primary" size="medium" class="btn-gradient nav-cta-btn" @click="handleStart">
            开始创作
          </n-button>
        </template>
      </div>

      <!-- Mobile Menu Button -->
      <n-button class="mobile-menu-btn" quaternary size="small" @click="mobileMenuOpen = !mobileMenuOpen">
        <template #icon>
          <n-icon><MenuOutline v-if="!mobileMenuOpen" /><CloseOutline v-else /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- Mobile Menu -->
    <div v-show="mobileMenuOpen" class="mobile-menu">
      <a href="#features" @click.prevent="scrollTo('features'); mobileMenuOpen = false">功能特性</a>
      <a href="#showcase" @click.prevent="scrollTo('showcase'); mobileMenuOpen = false">作品展示</a>
      <template v-if="authStore.isLogin">
        <a @click="handleMenuSelect('profile'); mobileMenuOpen = false">个人中心</a>
        <a @click="handleMenuSelect('logout'); mobileMenuOpen = false">退出登录</a>
      </template>
      <template v-else>
        <n-button block type="primary" class="btn-gradient" @click="$router.push('/register'); mobileMenuOpen = false">
          开始创作
        </n-button>
      </template>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ChevronDownOutline, MenuOutline, CloseOutline } from "@vicons/ionicons5";

const router = useRouter();
const authStore = useAuthStore();

const defaultAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";
const isScrolled = ref(false);
const mobileMenuOpen = ref(false);

const userMenuOptions = computed(() => [
  { label: "个人中心", key: "profile" },
  { type: "divider", key: "d1" },
  { label: "退出登录", key: "logout" },
]);

function handleMenuSelect(key: string) {
  switch (key) {
    case "profile":
      router.push("/user/profile");
      break;
    case "logout":
      authStore.logout();
      router.push("/");
      break;
  }
}

function handleStart() {
  if (authStore.isLogin) {
    router.push("/projects");
  } else {
    router.push("/register");
  }
}

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth" });
  }
}

function handleScroll() {
  isScrolled.value = window.scrollY > 50;
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  .username {
    font-size: 14px;
    color: var(--color-text-primary);
  }
}

// 导航栏 CTA 按钮样式
.nav-cta-btn {
  padding: 10px 24px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  height: auto !important;

  :deep(.n-button__content) {
    font-size: 15px;
  }
}
</style>
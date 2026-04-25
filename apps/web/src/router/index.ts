import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { routes } from "./routes";

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    // 每次导航后滚动到顶部
    return { top: 0, left: 0 };
  },
});

// 路由守卫
let authInitialized = false;

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  // 首次访问时初始化认证状态
  if (!authInitialized) {
    await authStore.initAuth();
    authInitialized = true;
  }

  const requiresAuth = to.meta.requiresAuth as boolean;
  const requiresGuest = to.meta.requiresGuest as boolean;
  const requiresAdmin = to.meta.requiresAdmin as boolean;

  // 需要登录但未登录
  if (requiresAuth && !authStore.isLogin) {
    next({ name: "Login", query: { redirect: to.fullPath } });
    return;
  }

  // 需要游客状态但已登录
  if (requiresGuest && authStore.isLogin) {
    next({ name: "Home" });
    return;
  }

  // 需要管理员权限但不是管理员
  if (requiresAdmin && !authStore.isAdmin) {
    next({ name: "Home" });
    return;
  }

  next();
});

export default router;

<template>
  <section id="showcase" class="showcase-section">
    <div class="section-container">
      <!-- Header -->
      <div class="section-header-row">
        <div class="header-left">
          <h2 class="section-title">精选作品</h2>
          <p class="section-desc">探索使用 Pixaura 创作的优秀短剧作品，感受 AI 辅助创作的无限可能</p>
        </div>
        <n-button text type="primary" class="view-all-btn" @click="handleViewAll">
          查看全部作品
          <template #icon>
            <n-icon><ArrowForwardOutline /></n-icon>
          </template>
        </n-button>
      </div>

      <!-- Gallery -->
      <div class="showcase-grid">
        <ShowcaseCard
          cover="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80"
          category="悬疑 · 10分钟"
          title="午夜便利店"
          description="一个关于时间循环的悬疑短剧，在便利店的午夜时分展开..."
        />
        <ShowcaseCard
          cover="https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=800&auto=format&fit=crop&q=80"
          category="爱情 · 8分钟"
          title="雨中的咖啡"
          description="两个陌生人在雨天咖啡馆相遇，一段温暖治愈的故事..."
        />
        <ShowcaseCard
          cover="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80"
          category="科幻 · 15分钟"
          title="记忆碎片"
          description="在未来世界，记忆可以被编辑，一位侦探寻找真相的故事..."
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { ArrowForwardOutline } from "@vicons/ionicons5";
import ShowcaseCard from "./ShowcaseCard.vue";

const router = useRouter();
const authStore = useAuthStore();

function handleViewAll() {
  if (authStore.isLogin) {
    router.push("/projects");
  } else {
    router.push("/login");
  }
}
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>
<template>
  <div class="entry-page">
    <!-- 导航栏 -->
    <EntryNavbar />

    <!-- Hero 区域 -->
    <HeroSection />

    <!-- 功能特性 -->
    <FeaturesSection />

    <!-- 作品展示 -->
    <ShowcaseSection />

    <!-- CTA 区块 -->
    <CTASection />

    <!-- Footer -->
    <EntryFooter />
  </div>
</template>

<script setup lang="ts">
import EntryNavbar from "@/components/entry/EntryNavbar.vue";
import HeroSection from "@/components/entry/HeroSection.vue";
import FeaturesSection from "@/components/entry/FeaturesSection.vue";
import ShowcaseSection from "@/components/entry/ShowcaseSection.vue";
import CTASection from "@/components/entry/CTASection.vue";
import EntryFooter from "@/components/entry/EntryFooter.vue";
</script>

<style scoped lang="scss">
.entry-page {
  min-height: 100vh;
  background: #fafafa; // 参考 bg-secondary
}

// 确保页面滚动流畅
:deep(*) {
  scroll-behavior: smooth;
}
</style>
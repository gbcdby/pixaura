<template>
  <div class="showcase-card">
    <img :src="cover" :alt="title" class="cover-image" />
    <div class="card-overlay">
      <div class="card-category">{{ category }}</div>
      <h3 class="card-title">{{ title }}</h3>
      <p class="card-desc">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  cover: string;
  category: string;
  title: string;
  description: string;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>
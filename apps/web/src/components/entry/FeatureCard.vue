<template>
  <div class="feature-card">
    <div class="icon-wrapper">
      <svg width="28" height="28" viewBox="0 0 512 512" class="icon-svg">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#8b9aff" />
            <stop offset="100%" stop-color="#b56cff" />
          </linearGradient>
        </defs>
        <!-- 根据图标类型渲染不同的 SVG 路径 -->
        <g v-if="icon === 'CreateOutline'" fill="url(#gradient)">
          <path d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h191.5" fill="none" stroke="url(#gradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
          <path d="M459.26 112.56c-8.89-8.9-24.52-8.9-33.41 0L355.5 182.9a10.55 10.55 0 0 0 0 14.92l27.3 27.3a10.55 10.55 0 0 0 14.92 0l70.34-70.05c8.9-8.89 8.9-24.52 0-33.41zM112 368h64v-64H112z"/>
        </g>
        <g v-else-if="icon === 'ImageOutline'" fill="url(#gradient)">
          <rect x="48" y="80" width="416" height="352" rx="48" ry="48" fill="none" stroke="url(#gradient)" stroke-linejoin="round" stroke-width="32"/>
          <circle cx="336" cy="176" r="32" fill="none" stroke="url(#gradient)" stroke-miterlimit="10" stroke-width="32"/>
          <path d="M304 335.79l-90.66-90.49a32 32 0 0 0-43.87-1.3L48 352M416 224l-64-64M416 352l-144-144" fill="none" stroke="url(#gradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
        </g>
        <g v-else-if="icon === 'VideocamOutline'" fill="url(#gradient)">
          <path d="M374.79 308.78L457.5 367a16 16 0 0 0 22.5-14.38V159.38A16 16 0 0 0 457.5 145l-82.71 58.22A16 16 0 0 0 368 216.3v79.4a16 16 0 0 0 6.79 12.88z" fill="none" stroke="url(#gradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
          <path d="M368 128H144a32 32 0 0 0-32 32v192a32 32 0 0 0 32 32h224a32 32 0 0 0 32-32V160a32 32 0 0 0-32-32z" fill="none" stroke="url(#gradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
        </g>
        <g v-else fill="url(#gradient)">
          <path d="M384 224v184a40 40 0 0 1-40 40H104a40 40 0 0 1-40-40V168a40 40 0 0 1 40-40h191.5" fill="none" stroke="url(#gradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="32"/>
          <path d="M459.26 112.56c-8.89-8.9-24.52-8.9-33.41 0L355.5 182.9a10.55 10.55 0 0 0 0 14.92l27.3 27.3a10.55 10.55 0 0 0 14.92 0l70.34-70.05c8.9-8.89 8.9-24.52 0-33.41zM112 368h64v-64H112z"/>
        </g>
      </svg>
    </div>
    <h3 class="card-title">{{ title }}</h3>
    <p class="card-desc">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  title: string;
  description: string;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/entry" as *;
</style>
<template>
  <div class="batch-video-gen-page">
    <n-page-header
      title="批量视频生成"
      subtitle="同时生成多个分镜视频"
      @back="handleBack"
    />

    <n-card class="content-card">
      <BatchVideoGen
        :project-id="projectId"
        :shots="shots"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStoryboardStore } from "@/stores/storyboard";
import { BatchVideoGen } from "@/modules/video-gen/components";
import type { StoryboardListItemDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const storyboardStore = useStoryboardStore();

const projectId = route.params.id as string;
const shots = ref<StoryboardListItemDto[]>([]);

onMounted(async () => {
  const result = await storyboardStore.fetchStoryboards(projectId);
  shots.value = result.items;
});

function handleBack() {
  router.push(`/projects/${projectId}/storyboards`);
}
</script>

<style scoped>
.batch-video-gen-page {
  padding: 24px;
}

.content-card {
  margin-top: 24px;
}
</style>

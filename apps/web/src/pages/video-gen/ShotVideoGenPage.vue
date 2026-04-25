<template>
  <div class="shot-video-gen-page">
    <n-page-header
      title="分镜视频生成"
      :subtitle="`分镜 #${shot?.sequenceNumber || ''}`"
      @back="handleBack"
    />

    <div class="page-content two-column">
      <!-- 左侧：分镜信息 -->
      <div class="shot-info-panel">
        <n-card
          title="分镜信息"
          size="small"
        >
          <n-descriptions
            :column="1"
            size="small"
          >
            <n-descriptions-item label="序号">
              {{ shot?.sequenceNumber }}
            </n-descriptions-item>
            <n-descriptions-item label="场景">
              {{ shot?.sceneName || "未设置" }}
            </n-descriptions-item>
            <n-descriptions-item label="描述">
              {{ shot?.description }}
            </n-descriptions-item>
            <n-descriptions-item label="时长">
              {{ shot?.timing?.duration ?? 3 }}s
            </n-descriptions-item>
            <n-descriptions-item label="景别">
              {{ shot?.shot?.shotType }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>

        <n-card
          title="出镜角色"
          size="small"
          class="assets-card"
        >
          <n-empty
            v-if="!shot?.characters?.length"
            description="暂无角色"
            size="small"
          />
          <n-space
            v-else
            vertical
            size="small"
          >
            <div
              v-for="char in shot.characters"
              :key="char.id"
              class="character-item"
            >
              <n-space
                align="center"
                size="small"
              >
                <n-avatar
                  v-if="char.characterAvatar"
                  :src="char.characterAvatar"
                  size="small"
                />
                <n-text>{{ char.characterName }}</n-text>
                <n-tag
                  v-if="char.emphasis === 'main'"
                  size="tiny"
                  type="primary"
                >
                  主角
                </n-tag>
                <n-tag
                  size="tiny"
                  type="info"
                >
                  {{ char.position }}
                </n-tag>
              </n-space>
            </div>
          </n-space>
        </n-card>
      </div>

      <!-- 右侧：视频生成 -->
      <div class="video-gen-panel">
        <VideoGenerationPanel
          :project-id="projectId"
          :shot-id="shotId"
          :shot-type="shot?.shot?.shotType"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStoryboardStore } from "@/stores/storyboard";
import { VideoGenerationPanel } from "@/modules/video-gen/components";
import type { StoryboardDetailDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const storyboardStore = useStoryboardStore();

const projectId = route.params.id as string;
const shotId = route.params.shotId as string;

const shot = ref<StoryboardDetailDto | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    shot.value = await storyboardStore.fetchStoryboardDetail(shotId);
  } finally {
    loading.value = false;
  }
});

function handleBack() {
  router.push(`/projects/${projectId}/storyboards`);
}
</script>

<style scoped>
.shot-video-gen-page {
  padding: 24px;
}

.page-content {
  display: grid;
  gap: 24px;
  margin-top: 24px;
}

.two-column {
  grid-template-columns: 320px 1fr;
}

.shot-info-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assets-card {
  flex: 1;
}

.character-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--n-border-color);
}

.character-item:last-child {
  border-bottom: none;
}

.video-gen-panel {
  min-height: 600px;
}

@media (max-width: 1024px) {
  .two-column {
    grid-template-columns: 1fr;
  }
}
</style>

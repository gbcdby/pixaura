<script setup lang="ts">
/**
 * 项目详情页
 * 展示项目概览、资产统计、最近剧本
 */
import { computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  NButton,
  NAvatar,
  NEmpty,
  NIcon,
  NTag,
} from "naive-ui";
import {
  Settings,
  ArrowForward,
  DocumentText,
  Person,
  Image,
  Cube,
} from "@vicons/ionicons5";
import { useProjectStore } from "@/stores/project";
import ScriptPreviewCard from "@/components/script/ScriptPreviewCard.vue";

const router = useRouter();
const route = useRoute();
const projectStore = useProjectStore();

const projectId = computed(() => route.params.id as string);
const project = computed(() => projectStore.currentProject);
const collaborators = computed(() => projectStore.collaborators);
const projectStats = computed(() => projectStore.projectStats);
const recentScripts = computed(() => projectStore.recentScripts);
const isOwner = computed(() => projectStore.isOwner);

onMounted(async () => {
  if (projectId.value) {
    await Promise.all([
      projectStore.fetchProjectDetail(projectId.value),
      projectStore.fetchProjectStats(projectId.value),
      projectStore.fetchRecentScripts(projectId.value, 4),
    ]);
  }
});

const navigateTo = (path: string) => router.push(path);

// 4 个统计卡片（剧本、角色、场景、道具）
const statCards = computed(() => [
  {
    label: "剧本",
    count: projectStats.value?.scriptCount || 0,
    icon: DocumentText,
    path: `/projects/${projectId.value}/scripts`,
  },
  {
    label: "角色",
    count: projectStats.value?.characterCount || 0,
    icon: Person,
    path: `/projects/${projectId.value}/characters`,
  },
  {
    label: "场景",
    count: projectStats.value?.sceneCount || 0,
    icon: Image,
    path: `/projects/${projectId.value}/scenes`,
  },
  {
    label: "道具",
    count: projectStats.value?.propCount || 0,
    icon: Cube,
    path: `/projects/${projectId.value}/props`,
  },
]);
</script>

<template>
  <div
    v-if="project"
    class="project-detail-page"
  >
    <!-- 项目信息卡片 -->
    <n-card
      class="project-info-card"
      :bordered="false"
    >
      <!-- 头部：名称 + 状态 + 按钮 -->
      <div class="card-header">
        <div class="title-section">
          <h1 class="project-name">
            {{ project.name }}
          </h1>
          <n-tag
            size="small"
            type="default"
            class="status-tag"
          >
            草稿
          </n-tag>
        </div>
        <div class="action-buttons">
          <n-button
            v-if="isOwner"
            size="small"
            @click="navigateTo(`/projects/${project.id}/settings`)"
          >
            <template #icon>
              <n-icon><Settings /></n-icon>
            </template>
            设置
          </n-button>
        </div>
      </div>

      <!-- 项目描述 -->
      <p
        v-if="project.description"
        class="project-desc"
      >
        {{ project.description }}
      </p>

      <!-- 4 等分统计卡片 -->
      <div class="stats-grid">
        <div
          v-for="stat in statCards"
          :key="stat.label"
          class="stat-card"
          @click="navigateTo(stat.path)"
        >
          <div class="stat-icon">
            <n-icon
              size="24"
              :component="stat.icon"
            />
          </div>
          <span class="stat-value">{{ stat.count }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>

      <!-- 协作者（如果有） -->
      <div
        v-if="collaborators.length > 0"
        class="collaborators-row"
      >
        <span class="collab-label">协作者</span>
        <div class="collab-avatars">
          <n-avatar
            v-for="c in collaborators.slice(0, 4)"
            :key="c.id"
            round
            :size="24"
            :src="c.avatar || undefined"
            :fallback-src="
              'https://api.dicebear.com/7.x/avataaars/svg?seed=' + c.id
            "
            class="collab-avatar"
          />
          <span
            v-if="collaborators.length > 4"
            class="more-collabs"
          >
            +{{ collaborators.length - 4 }}
          </span>
        </div>
      </div>
    </n-card>

    <!-- 最近剧本 -->
    <div class="section-header">
      <h2 class="section-title">
        最近剧本
      </h2>
      <n-button
        text
        type="primary"
        @click="navigateTo(`/projects/${project.id}/scripts`)"
      >
        查看全部
        <template #icon>
          <n-icon><ArrowForward /></n-icon>
        </template>
      </n-button>
    </div>

    <!-- Grid 卡片布局 -->
    <div
      v-if="recentScripts.length > 0"
      class="script-grid-container"
    >
      <script-preview-card
        v-for="script in recentScripts"
        :key="script.id"
        :script="script"
        @click="navigateTo(`/projects/${project.id}/scripts/${script.id}`)"
      />
    </div>

    <!-- 空态 -->
    <n-empty
      v-else
      description="暂无剧本"
    >
      <template #extra>
        <n-button
          type="primary"
          @click="navigateTo(`/projects/${project.id}/scripts/new`)"
        >
          创建第一个剧本
        </n-button>
      </template>
    </n-empty>
  </div>
</template>

<style scoped lang="scss">
.project-detail-page {
  padding: 16px 24px 16px 16px;
}

// 项目信息卡片
.project-info-card {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  margin-bottom: 16px;

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;

    .title-section {
      display: flex;
      align-items: center;
      gap: 10px;

      .project-name {
        font-size: 18px;
        font-weight: 600;
        color: var(--color-text-primary, #1a1a1a);
        margin: 0;
      }

      .status-tag {
        font-size: 11px;
      }
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }
  }

  .project-desc {
    font-size: 13px;
    color: var(--color-text-secondary, #6b6690);
    margin: 0 0 12px;
    line-height: 1.4;
  }

  // 4 等分统计卡片网格
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;

    .stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 20px 16px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.02);
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(157, 138, 231, 0.08);
      }

      .stat-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(157, 138, 231, 0.1);
        color: var(--color-primary, #9d8ae7);
      }

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--color-text-primary, #1a1a1a);
      }

      .stat-label {
        font-size: 13px;
        color: var(--color-text-secondary, #6b6690);
      }
    }
  }

  // 协作者
  .collaborators-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);

    .collab-label {
      font-size: 12px;
      color: var(--color-text-tertiary, #a8a4c8);
    }

    .collab-avatars {
      display: flex;
      align-items: center;

      .collab-avatar {
        border: 2px solid white;
        margin-left: -6px;

        &:first-child {
          margin-left: 0;
        }
      }

      .more-collabs {
        margin-left: 6px;
        font-size: 11px;
        color: var(--color-text-tertiary, #a8a4c8);
      }
    }
  }
}

// 最近剧本区域
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary, #1a1a1a);
    margin: 0;
  }
}

// 剧本卡片布局
.script-grid-container {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

// 暗黑模式适配
[data-theme="dark"] {
  .project-info-card {
    background: rgba(16, 16, 32, 0.7);
    border-color: rgba(157, 78, 221, 0.2);

    .card-header .project-name {
      color: #e0e0e0;
    }

    .stats-grid .stat-card {
      background: rgba(255, 255, 255, 0.03);

      &:hover {
        background: rgba(157, 138, 231, 0.15);
      }

      .stat-icon {
        background: rgba(157, 138, 231, 0.2);
      }

      .stat-value {
        color: #e0e0e0;
      }
    }

    .collaborators-row {
      border-top-color: rgba(255, 255, 255, 0.1);
    }
  }

  .section-header .section-title {
    color: #e0e0e0;
  }
}
</style>

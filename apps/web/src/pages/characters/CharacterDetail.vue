<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCharacterStore } from "@/modules/character/store";
import { storeToRefs } from "pinia";
import {
  NButton,
  NCard,
  NTag,
  NSpin,
  NEmpty,
  NSpace,
  NDescriptions,
  NDescriptionsItem,
  NModal,
  useDialog,
  useMessage,
} from "naive-ui";
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Image as ImageIcon,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const characterStore = useCharacterStore();
const dialog = useDialog();
const message = useMessage();

const { currentCharacter, loading } = storeToRefs(characterStore);

const projectId = route.params.id as string;
const characterId = route.params.characterId as string;

// 图片预览
const previewVisible = ref(false);
const previewImage = ref("");
const activeImageType = ref<string>("front");

const imageTypes = [
  { key: "frontView", label: "正视图", placeholder: "正视图" },
  { key: "sideView", label: "侧视图", placeholder: "侧视图" },
  { key: "backView", label: "背视图", placeholder: "背视图" },
  { key: "angleView", label: "45度视图", placeholder: "45度视图" },
];

onMounted(async () => {
  await characterStore.getCharacter(characterId);
});

function handleBack() {
  router.push(`/projects/${projectId}/characters`);
}

function handleEdit() {
  router.push(`/projects/${projectId}/characters/${characterId}/edit`);
}

function handleDelete() {
  dialog.warning({
    title: "删除角色",
    content: `确定要删除角色 "${currentCharacter.value?.name}" 吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await characterStore.deleteCharacter(characterId);
        message.success("角色已删除");
        router.push(`/projects/${projectId}/characters`);
      } catch {
        message.error("删除失败");
      }
    },
  });
}

function handlePreviewImage(url: string) {
  previewImage.value = url;
  previewVisible.value = true;
}

function getMainImage() {
  if (!currentCharacter.value?.images) return null;
  const images = currentCharacter.value.images;
  return (
    images.frontView?.url ||
    images.sideView?.url ||
    images.backView?.url ||
    images.angleView?.url ||
    null
  );
}

function getImportanceLabel(importance: string) {
  const map: Record<string, string> = {
    protagonist: "主角",
    supporting: "配角",
    minor: "龙套",
  };
  return map[importance] || importance;
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: "草稿",
    active: "已激活",
    archived: "已归档",
  };
  return map[status] || status;
}

function getStatusType(status: string): "default" | "success" | "warning" {
  const map: Record<string, "default" | "success" | "warning"> = {
    draft: "warning",
    active: "success",
    archived: "default",
  };
  return map[status] || "default";
}

function getGenderLabel(gender: string | null) {
  if (!gender) return "未设置";
  const map: Record<string, string> = {
    male: "男",
    female: "女",
    other: "其他",
    unknown: "未知",
  };
  return map[gender] || gender;
}
</script>

<template>
  <div class="character-detail">
    <NSpin :show="loading">
      <template v-if="currentCharacter">
        <!-- 头部 -->
        <div class="header">
          <NButton
            quaternary
            @click="handleBack"
          >
            <template #icon>
              <ArrowLeft :size="18" />
            </template>
            返回
          </NButton>
          <h1>{{ currentCharacter.name }}</h1>
          <NSpace>
            <NButton @click="handleEdit">
              <template #icon>
                <Edit :size="16" />
              </template>
              编辑
            </NButton>
            <NButton
              type="error"
              ghost
              @click="handleDelete"
            >
              <template #icon>
                <Trash2 :size="16" />
              </template>
              删除
            </NButton>
          </NSpace>
        </div>

        <!-- 内容区 -->
        <div class="content">
          <!-- 左侧：图片区域 -->
          <div class="image-section">
            <NCard title="角色参考图">
              <!-- 主图 -->
              <div
                class="main-image"
                @click="getMainImage() && handlePreviewImage(getMainImage()!)"
              >
                <img
                  v-if="getMainImage()"
                  :src="getMainImage()!"
                  :alt="currentCharacter.name"
                >
                <div
                  v-else
                  class="no-image"
                >
                  <User :size="64" />
                  <p>暂无参考图</p>
                </div>
              </div>

              <!-- 缩略图列表 -->
              <div class="thumbnail-list">
                <div
                  v-for="type in imageTypes"
                  :key="type.key"
                  class="thumbnail-item"
                  :class="{ active: activeImageType === type.key }"
                  @click="activeImageType = type.key"
                >
                  <template
                    v-if="(currentCharacter.images as any)?.[type.key]?.url"
                  >
                    <img
                      :src="
                        (currentCharacter.images as any)[type.key]
                          .thumbnailUrl ||
                          (currentCharacter.images as any)[type.key].url
                      "
                      :alt="type.label"
                    >
                    <span class="type-label">{{ type.label }}</span>
                  </template>
                  <template v-else>
                    <div class="placeholder">
                      <ImageIcon :size="20" />
                      <span>{{ type.placeholder }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </NCard>
          </div>

          <!-- 右侧：信息区域 -->
          <div class="info-section">
            <NCard title="基本信息">
              <NSpace
                vertical
                size="large"
              >
                <!-- 状态标签 -->
                <div class="tags">
                  <NTag :type="getStatusType(currentCharacter.status)">
                    {{ getStatusLabel(currentCharacter.status) }}
                  </NTag>
                  <NTag type="info">
                    {{ getImportanceLabel(currentCharacter.importance) }}
                  </NTag>
                </div>

                <!-- 基本信息 -->
                <NDescriptions
                  :columns="2"
                  label-placement="left"
                >
                  <NDescriptionsItem label="性别">
                    {{ getGenderLabel(currentCharacter.gender) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="年龄">
                    {{ currentCharacter.age || "未设置" }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="职业">
                    {{ currentCharacter.occupation || "未设置" }}
                  </NDescriptionsItem>
                </NDescriptions>

                <!-- 角色描述 -->
                <div
                  v-if="currentCharacter.description"
                  class="info-block"
                >
                  <h4>角色描述</h4>
                  <p>{{ currentCharacter.description }}</p>
                </div>

                <!-- 性格特征 -->
                <div
                  v-if="currentCharacter.personality"
                  class="info-block"
                >
                  <h4>性格特征</h4>
                  <p>{{ currentCharacter.personality }}</p>
                </div>

                <!-- 背景故事 -->
                <div
                  v-if="currentCharacter.background"
                  class="info-block"
                >
                  <h4>背景故事</h4>
                  <p>{{ currentCharacter.background }}</p>
                </div>
              </NSpace>
            </NCard>

            <!-- 外观细节 -->
            <NCard
              v-if="currentCharacter.appearance"
              title="外观细节"
              class="appearance-card"
            >
              <NDescriptions
                :columns="2"
                label-placement="left"
              >
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.height"
                  label="身高"
                >
                  {{ currentCharacter.appearance.height }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.bodyType"
                  label="体型"
                >
                  {{ currentCharacter.appearance.bodyType }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.hairColor"
                  label="发色"
                >
                  {{ currentCharacter.appearance.hairColor }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.hairStyle"
                  label="发型"
                >
                  {{ currentCharacter.appearance.hairStyle }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.eyeColor"
                  label="眼色"
                >
                  {{ currentCharacter.appearance.eyeColor }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.skinTone"
                  label="肤色"
                >
                  {{ currentCharacter.appearance.skinTone }}
                </NDescriptionsItem>
                <NDescriptionsItem
                  v-if="currentCharacter.appearance.clothingStyle"
                  label="着装风格"
                >
                  {{ currentCharacter.appearance.clothingStyle }}
                </NDescriptionsItem>
              </NDescriptions>

              <!-- 显著特征 -->
              <div
                v-if="currentCharacter.appearance.distinctiveFeatures?.length"
                class="distinctive-features"
              >
                <h4>显著特征</h4>
                <NSpace>
                  <NTag
                    v-for="feature in currentCharacter.appearance
                      .distinctiveFeatures"
                    :key="feature"
                    type="info"
                  >
                    {{ feature }}
                  </NTag>
                </NSpace>
              </div>
            </NCard>

            <!-- 来源信息 -->
            <NCard
              v-if="currentCharacter.scriptRef || currentCharacter.importInfo"
              title="来源信息"
            >
              <p v-if="currentCharacter.scriptRef">
                从剧本提取
              </p>
              <p v-if="currentCharacter.importInfo">
                从其他项目导入
              </p>
            </NCard>
          </div>
        </div>
      </template>

      <NEmpty
        v-else-if="!loading"
        description="角色不存在或已被删除"
      />
    </NSpin>

    <!-- 图片预览 -->
    <NModal
      v-model:show="previewVisible"
      preset="card"
      style="width: 80%; max-width: 800px"
    >
      <img
        :src="previewImage"
        style="width: 100%; display: block"
      >
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.character-detail {
  padding: 24px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .content {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 24px;

    @media (max-width: 1024px) {
      grid-template-columns: 1fr;
    }
  }

  .image-section {
    .main-image {
      width: 100%;
      height: 400px;
      border-radius: 8px;
      overflow: hidden;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .no-image {
        text-align: center;
        color: #999;

        p {
          margin-top: 12px;
        }
      }
    }

    .thumbnail-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 16px;

      .thumbnail-item {
        aspect-ratio: 1;
        border-radius: 8px;
        overflow: hidden;
        background: #f5f5f5;
        cursor: pointer;
        position: relative;
        border: 2px solid transparent;

        &.active {
          border-color: #18a058;
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .type-label {
          position: absolute;
          bottom: 4px;
          left: 4px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #ccc;
          font-size: 12px;

          span {
            margin-top: 4px;
          }
        }
      }
    }
  }

  .info-section {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .tags {
      display: flex;
      gap: 8px;
    }

    .info-block {
      h4 {
        margin: 0 0 8px;
        font-size: 14px;
        color: #666;
      }

      p {
        margin: 0;
        line-height: 1.6;
        color: #333;
      }
    }

    .appearance-card {
      .distinctive-features {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid #eee;

        h4 {
          margin: 0 0 12px;
          font-size: 14px;
          color: #666;
        }
      }
    }
  }
}
</style>

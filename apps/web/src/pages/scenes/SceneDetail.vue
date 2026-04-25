<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSceneStore } from "@/modules/scene/store";
import { storeToRefs } from "pinia";
import {
  NButton,
  NCard,
  NTag,
  NSpace,
  NDivider,
  NSpin,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  NSelect,
  NUpload,
  NImage,
  NGrid,
  NGridItem,
  useMessage,
} from "naive-ui";
import { ArrowLeft, Edit, Trash2, ImagePlus, Wand2, X } from "lucide-vue-next";
import type { UploadFileInfo } from "naive-ui";
import type {
  GenerateSceneImageDto,
  UploadSceneImageDto,
} from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const sceneStore = useSceneStore();
const message = useMessage();
const { currentScene, loading, generatingImages } = storeToRefs(sceneStore);

const projectId = route.params.id as string;
const sceneId = route.params.sceneId as string;

// 图片生成弹窗
const showGenerateModal = ref(false);
const generateForm = ref<GenerateSceneImageDto>({
  type: "panorama",
});

// 图片上传弹窗
const showUploadModal = ref(false);
const uploadForm = ref<UploadSceneImageDto>({
  type: "panorama",
});
const fileList = ref<UploadFileInfo[]>([]);

const typeOptions = [
  { label: "全景图", value: "panorama" },
  { label: "广角镜头", value: "wide_shot" },
  { label: "细节镜头", value: "detail" },
];

const variantTypeOptions = [
  { label: "时间", value: "time_of_day" },
  { label: "天气", value: "weather" },
];

const timeOfDayOptions = [
  { label: "黎明", value: "dawn" },
  { label: "早晨", value: "morning" },
  { label: "中午", value: "noon" },
  { label: "下午", value: "afternoon" },
  { label: "黄昏", value: "dusk" },
  { label: "夜晚", value: "night" },
];

const weatherOptions = [
  { label: "晴朗", value: "sunny" },
  { label: "多云", value: "cloudy" },
  { label: "雨天", value: "rainy" },
  { label: "雪天", value: "snowy" },
  { label: "雾天", value: "foggy" },
  { label: "暴风雨", value: "stormy" },
];

onMounted(() => {
  loadScene();
});

async function loadScene() {
  await sceneStore.getScene(sceneId);
}

function handleBack() {
  router.push(`/projects/${projectId}/scenes`);
}

function handleEdit() {
  router.push(`/projects/${projectId}/scenes/${sceneId}/edit`);
}

async function handleDelete() {
  await sceneStore.deleteScene(sceneId);
  router.push(`/projects/${projectId}/scenes`);
}

// 生成图片
async function handleGenerateImage() {
  try {
    const result = await sceneStore.generateImage(sceneId, generateForm.value);
    message.success(`图片生成任务已创建，任务ID: ${result.generationTaskId}`);
    showGenerateModal.value = false;
    // 模拟轮询获取结果（实际应该通过 WebSocket）
    setTimeout(() => {
      loadScene();
      message.info("图片生成完成，已刷新场景详情");
    }, 2000);
  } catch (error) {
    message.error("图片生成失败");
  }
}

// 上传图片
async function handleUploadImage() {
  if (fileList.value.length === 0) {
    message.warning("请选择要上传的图片");
    return;
  }
  try {
    const file = fileList.value[0].file;
    if (!file) {
      message.error("文件读取失败");
      return;
    }
    await sceneStore.uploadImage(sceneId, uploadForm.value, file);
    message.success("图片上传成功");
    showUploadModal.value = false;
    fileList.value = [];
    await loadScene();
  } catch (error) {
    message.error("图片上传失败");
  }
}

// 删除图片
async function handleDeleteImage(imageId: string) {
  try {
    await sceneStore.deleteImage(sceneId, imageId);
    message.success("图片删除成功");
    await loadScene();
  } catch (error) {
    message.error("图片删除失败");
  }
}

function getTypeLabel(type: string) {
  const map: Record<string, string> = {
    interior: "室内",
    exterior: "室外",
    both: "混合",
  };
  return map[type] || type;
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
</script>

<template>
  <div class="scene-detail">
    <NSpin :show="loading">
      <template v-if="currentScene">
        <!-- 头部 -->
        <div class="header">
          <NSpace align="center">
            <NButton
              quaternary
              circle
              @click="handleBack"
            >
              <template #icon>
                <ArrowLeft :size="20" />
              </template>
            </NButton>
            <h1>{{ currentScene.name }}</h1>
            <NTag
              :type="getStatusType(currentScene.status)"
              size="small"
            >
              {{ getStatusLabel(currentScene.status) }}
            </NTag>
          </NSpace>
          <NSpace>
            <NButton @click="handleEdit">
              <template #icon>
                <Edit :size="16" />
              </template>
              编辑
            </NButton>
            <NButton
              type="error"
              @click="handleDelete"
            >
              <template #icon>
                <Trash2 :size="16" />
              </template>
              删除
            </NButton>
          </NSpace>
        </div>

        <NDivider />

        <!-- 图片展示区 -->
        <NCard
          title="参考图片"
          class="image-card"
        >
          <template #header-extra>
            <NSpace>
              <NButton
                size="small"
                @click="showGenerateModal = true"
              >
                <template #icon>
                  <Wand2 :size="14" />
                </template>
                AI生成
              </NButton>
              <NButton
                size="small"
                @click="showUploadModal = true"
              >
                <template #icon>
                  <ImagePlus :size="14" />
                </template>
                上传
              </NButton>
            </NSpace>
          </template>

          <!-- 主图（全景图） -->
          <div
            v-if="currentScene.images?.panorama"
            class="main-image-section"
          >
            <h4>全景图</h4>
            <div class="image-wrapper">
              <NImage
                :src="currentScene.images.panorama.url"
                :alt="currentScene.name"
                class="main-image"
              />
              <NButton
                class="delete-btn"
                circle
                type="error"
                size="small"
                @click="handleDeleteImage(currentScene.images.panorama.id)"
              >
                <template #icon>
                  <X :size="14" />
                </template>
              </NButton>
            </div>
          </div>

          <!-- 广角镜头 -->
          <div
            v-if="currentScene.images?.wideShot"
            class="image-section"
          >
            <h4>广角镜头</h4>
            <div class="image-wrapper">
              <NImage
                :src="currentScene.images.wideShot.url"
                :alt="currentScene.name"
                class="sub-image"
              />
              <NButton
                class="delete-btn"
                circle
                type="error"
                size="small"
                @click="handleDeleteImage(currentScene.images.wideShot.id)"
              >
                <template #icon>
                  <X :size="14" />
                </template>
              </NButton>
            </div>
          </div>

          <!-- 细节镜头 -->
          <div
            v-if="currentScene.images?.detailShots?.length"
            class="image-section"
          >
            <h4>细节镜头</h4>
            <NGrid
              cols="2 s:3 m:4"
              :x-gap="12"
              :y-gap="12"
            >
              <NGridItem
                v-for="img in currentScene.images.detailShots"
                :key="img.id"
              >
                <div class="image-wrapper">
                  <NImage
                    :src="img.url"
                    :alt="currentScene.name"
                    class="grid-image"
                  />
                  <NButton
                    class="delete-btn"
                    circle
                    type="error"
                    size="small"
                    @click="handleDeleteImage(img.id)"
                  >
                    <template #icon>
                      <X :size="14" />
                    </template>
                  </NButton>
                </div>
              </NGridItem>
            </NGrid>
          </div>

          <!-- 变体图 -->
          <template v-if="currentScene.images?.variants">
            <div
              v-if="
                Object.keys(currentScene.images.variants.timeOfDay || {}).length
              "
              class="image-section"
            >
              <h4>时间变体</h4>
              <NGrid
                cols="2 s:3 m:4"
                :x-gap="12"
                :y-gap="12"
              >
                <NGridItem
                  v-for="(img, time) in currentScene.images.variants.timeOfDay"
                  :key="img.id"
                >
                  <div class="image-wrapper">
                    <NImage
                      :src="img.url"
                      :alt="String(time)"
                      class="grid-image"
                    />
                    <span class="variant-label">{{ time }}</span>
                    <NButton
                      class="delete-btn"
                      circle
                      type="error"
                      size="small"
                      @click="handleDeleteImage(img.id)"
                    >
                      <template #icon>
                        <X :size="14" />
                      </template>
                    </NButton>
                  </div>
                </NGridItem>
              </NGrid>
            </div>

            <div
              v-if="
                Object.keys(currentScene.images.variants.weather || {}).length
              "
              class="image-section"
            >
              <h4>天气变体</h4>
              <NGrid
                cols="2 s:3 m:4"
                :x-gap="12"
                :y-gap="12"
              >
                <NGridItem
                  v-for="(img, weather) in currentScene.images.variants.weather"
                  :key="img.id"
                >
                  <div class="image-wrapper">
                    <NImage
                      :src="img.url"
                      :alt="String(weather)"
                      class="grid-image"
                    />
                    <span class="variant-label">{{ weather }}</span>
                    <NButton
                      class="delete-btn"
                      circle
                      type="error"
                      size="small"
                      @click="handleDeleteImage(img.id)"
                    >
                      <template #icon>
                        <X :size="14" />
                      </template>
                    </NButton>
                  </div>
                </NGridItem>
              </NGrid>
            </div>
          </template>

          <NEmpty
            v-if="
              !currentScene.images?.panorama &&
                !currentScene.images?.wideShot &&
                !currentScene.images?.detailShots?.length
            "
            description="暂无参考图片"
          />
        </NCard>

        <!-- 基本信息 -->
        <NCard
          title="基本信息"
          class="info-card"
        >
          <div class="info-grid">
            <div class="info-item">
              <span class="label">场景名称：</span>
              <span class="value">{{ currentScene.name }}</span>
            </div>
            <div class="info-item">
              <span class="label">场景类型：</span>
              <span class="value">{{ getTypeLabel(currentScene.type) }}</span>
            </div>
            <div
              v-if="currentScene.description"
              class="info-item full-width"
            >
              <span class="label">场景描述：</span>
              <span class="value">{{ currentScene.description }}</span>
            </div>
          </div>
        </NCard>

        <!-- 空间属性 -->
        <NCard
          v-if="currentScene.space"
          title="空间属性"
          class="info-card"
        >
          <div class="info-grid">
            <div
              v-if="currentScene.space.size"
              class="info-item"
            >
              <span class="label">空间大小：</span>
              <span class="value">{{ currentScene.space.size }}</span>
            </div>
            <div
              v-if="currentScene.space.layout"
              class="info-item full-width"
            >
              <span class="label">布局描述：</span>
              <span class="value">{{ currentScene.space.layout }}</span>
            </div>
            <div
              v-if="currentScene.space.keyAreas?.length"
              class="info-item full-width"
            >
              <span class="label">关键区域：</span>
              <NSpace>
                <NTag
                  v-for="area in currentScene.space.keyAreas"
                  :key="area"
                  size="small"
                >
                  {{ area }}
                </NTag>
              </NSpace>
            </div>
          </div>
        </NCard>

        <!-- 视觉属性 -->
        <NCard
          v-if="currentScene.visuals"
          title="视觉属性"
          class="info-card"
        >
          <div class="info-grid">
            <div
              v-if="currentScene.visuals.primaryColor"
              class="info-item"
            >
              <span class="label">主色调：</span>
              <span class="value">{{ currentScene.visuals.primaryColor }}</span>
            </div>
            <div
              v-if="currentScene.visuals.lighting"
              class="info-item"
            >
              <span class="label">光源类型：</span>
              <span class="value">{{ currentScene.visuals.lighting }}</span>
            </div>
            <div
              v-if="currentScene.visuals.lightingMood"
              class="info-item"
            >
              <span class="label">光线氛围：</span>
              <span class="value">{{ currentScene.visuals.lightingMood }}</span>
            </div>
          </div>
        </NCard>

        <!-- 氛围属性 -->
        <NCard
          v-if="currentScene.atmosphere"
          title="氛围属性"
          class="info-card"
        >
          <div class="info-grid">
            <div
              v-if="currentScene.atmosphere.timeOfDay"
              class="info-item"
            >
              <span class="label">时间：</span>
              <span class="value">{{ currentScene.atmosphere.timeOfDay }}</span>
            </div>
            <div
              v-if="currentScene.atmosphere.weather"
              class="info-item"
            >
              <span class="label">天气：</span>
              <span class="value">{{ currentScene.atmosphere.weather }}</span>
            </div>
            <div
              v-if="currentScene.atmosphere.mood"
              class="info-item"
            >
              <span class="label">氛围：</span>
              <span class="value">{{ currentScene.atmosphere.mood }}</span>
            </div>
          </div>
        </NCard>
      </template>

      <NEmpty
        v-else-if="!loading"
        description="场景不存在"
      />
    </NSpin>

    <!-- 生成图片弹窗 -->
    <NModal
      v-model:show="showGenerateModal"
      title="AI生成参考图"
      preset="card"
      style="width: 500px"
      :mask-closable="false"
    >
      <NForm
        label-placement="left"
        label-width="100"
      >
        <NFormItem
          label="图片类型"
          required
        >
          <NSelect
            v-model:value="generateForm.type"
            :options="typeOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="generateForm.type === 'variant'"
          label="变体类型"
        >
          <NSelect
            v-model:value="generateForm.variantType"
            :options="variantTypeOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="generateForm.variantType === 'time_of_day'"
          label="时间"
        >
          <NSelect
            v-model:value="generateForm.variantValue"
            :options="timeOfDayOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="generateForm.variantType === 'weather'"
          label="天气"
        >
          <NSelect
            v-model:value="generateForm.variantValue"
            :options="weatherOptions"
          />
        </NFormItem>
        <NFormItem label="自定义提示">
          <NInput
            v-model:value="generateForm.customPrompt"
            type="textarea"
            placeholder="可选：添加自定义提示词来指导AI生成"
            :rows="3"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showGenerateModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            :loading="generatingImages"
            @click="handleGenerateImage"
          >
            开始生成
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 上传图片弹窗 -->
    <NModal
      v-model:show="showUploadModal"
      title="上传参考图"
      preset="card"
      style="width: 500px"
      :mask-closable="false"
    >
      <NForm
        label-placement="left"
        label-width="100"
      >
        <NFormItem
          label="图片类型"
          required
        >
          <NSelect
            v-model:value="uploadForm.type"
            :options="typeOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="uploadForm.type === 'variant'"
          label="变体类型"
        >
          <NSelect
            v-model:value="uploadForm.variantType"
            :options="variantTypeOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="uploadForm.variantType === 'time_of_day'"
          label="时间"
        >
          <NSelect
            v-model:value="uploadForm.variantValue"
            :options="timeOfDayOptions"
          />
        </NFormItem>
        <NFormItem
          v-if="uploadForm.variantType === 'weather'"
          label="天气"
        >
          <NSelect
            v-model:value="uploadForm.variantValue"
            :options="weatherOptions"
          />
        </NFormItem>
        <NFormItem
          label="图片文件"
          required
        >
          <NUpload
            v-model:file-list="fileList"
            accept="image/*"
            :max="1"
            :default-upload="false"
          >
            <NButton>选择文件</NButton>
          </NUpload>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showUploadModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            @click="handleUploadImage"
          >
            上传
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.scene-detail {
  padding: 24px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }

  .image-card {
    margin-bottom: 24px;

    .main-image-section {
      margin-bottom: 24px;

      h4 {
        margin: 0 0 12px;
        font-size: 16px;
        color: #333;
      }
    }

    .image-section {
      margin-bottom: 24px;

      h4 {
        margin: 0 0 12px;
        font-size: 14px;
        color: #666;
      }
    }

    .image-wrapper {
      position: relative;
      display: inline-block;

      .main-image {
        max-width: 100%;
        max-height: 400px;
        border-radius: 8px;
      }

      .sub-image {
        max-width: 300px;
        max-height: 200px;
        border-radius: 8px;
      }

      .grid-image {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
      }

      .delete-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover .delete-btn {
        opacity: 1;
      }

      .variant-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        padding: 2px 8px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        font-size: 12px;
        border-radius: 4px;
      }
    }
  }

  .info-card {
    margin-bottom: 16px;

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;

      .info-item {
        display: flex;
        gap: 8px;

        &.full-width {
          grid-column: 1 / -1;
        }

        .label {
          color: #666;
          flex-shrink: 0;
        }

        .value {
          color: #333;
        }
      }
    }
  }
}
</style>

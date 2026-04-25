<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePropStore } from "@/modules/prop/store";
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
  GeneratePropImageDto,
  UploadPropImageDto,
} from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const propStore = usePropStore();
const message = useMessage();
const { currentProp, loading, generatingImages } = storeToRefs(propStore);

const projectId = route.params.id as string;
const propId = route.params.propId as string;

// 图片生成弹窗
const showGenerateModal = ref(false);
const generateForm = ref<GeneratePropImageDto>({
  type: "front_view",
});

// 图片上传弹窗
const showUploadModal = ref(false);
const uploadForm = ref<UploadPropImageDto>({
  type: "front_view",
});
const fileList = ref<UploadFileInfo[]>([]);

const typeOptions = [
  { label: "正视图", value: "front_view" },
  { label: "侧视图", value: "side_view" },
  { label: "俯视图", value: "top_view" },
];

onMounted(() => {
  loadProp();
});

async function loadProp() {
  await propStore.getProp(propId);
}

function handleBack() {
  router.push(`/projects/${projectId}/props`);
}

function handleEdit() {
  router.push(`/projects/${projectId}/props/${propId}/edit`);
}

async function handleDelete() {
  await propStore.deleteProp(propId);
  router.push(`/projects/${projectId}/props`);
}

// 生成图片
async function handleGenerateImage() {
  try {
    const result = await propStore.generateImage(propId, generateForm.value);
    message.success(`图片生成任务已创建，任务ID: ${result.generationTaskId}`);
    showGenerateModal.value = false;
    // 模拟轮询获取结果（实际应该通过 WebSocket）
    setTimeout(() => {
      loadProp();
      message.info("图片生成完成，已刷新道具详情");
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
    await propStore.uploadImage(propId, uploadForm.value, file);
    message.success("图片上传成功");
    showUploadModal.value = false;
    fileList.value = [];
    await loadProp();
  } catch (error) {
    message.error("图片上传失败");
  }
}

// 删除图片
async function handleDeleteImage(imageId: string) {
  try {
    await propStore.deleteImage(propId, imageId);
    message.success("图片删除成功");
    await loadProp();
  } catch (error) {
    message.error("图片删除失败");
  }
}

function getImportanceLabel(importance: string) {
  const map: Record<string, string> = {
    key: "关键",
    secondary: "次要",
    background: "背景",
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

function getImportanceType(
  importance: string,
): "error" | "warning" | "default" {
  const map: Record<string, "error" | "warning" | "default"> = {
    key: "error",
    secondary: "warning",
    background: "default",
  };
  return map[importance] || "default";
}

function getSizeLabel(size: string) {
  const map: Record<string, string> = {
    tiny: "极小",
    small: "小",
    medium: "中",
    large: "大",
    huge: "极大",
  };
  return map[size] || size;
}

function getConditionLabel(condition: string) {
  const map: Record<string, string> = {
    new: "全新",
    worn: "磨损",
    damaged: "损坏",
    ancient: "古老",
  };
  return map[condition] || condition;
}
</script>

<template>
  <div class="prop-detail">
    <NSpin :show="loading">
      <template v-if="currentProp">
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
            <h1>{{ currentProp.name }}</h1>
            <NTag
              :type="getStatusType(currentProp.status)"
              size="small"
            >
              {{ getStatusLabel(currentProp.status) }}
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
          title="三视图参考"
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

          <!-- 三视图 -->
          <NGrid
            cols="1 s:2 m:3"
            :x-gap="16"
            :y-gap="16"
          >
            <!-- 正视图 -->
            <NGridItem>
              <div class="view-section">
                <h4>正视图</h4>
                <div
                  v-if="currentProp.images?.frontView"
                  class="image-wrapper"
                >
                  <NImage
                    :src="currentProp.images.frontView.url"
                    :alt="currentProp.name"
                    class="view-image"
                  />
                  <NButton
                    class="delete-btn"
                    circle
                    type="error"
                    size="small"
                    @click="handleDeleteImage(currentProp.images.frontView.id)"
                  >
                    <template #icon>
                      <X :size="14" />
                    </template>
                  </NButton>
                </div>
                <NEmpty
                  v-else
                  description="暂无正视图"
                />
              </div>
            </NGridItem>

            <!-- 侧视图 -->
            <NGridItem>
              <div class="view-section">
                <h4>侧视图</h4>
                <div
                  v-if="currentProp.images?.sideView"
                  class="image-wrapper"
                >
                  <NImage
                    :src="currentProp.images.sideView.url"
                    :alt="currentProp.name"
                    class="view-image"
                  />
                  <NButton
                    class="delete-btn"
                    circle
                    type="error"
                    size="small"
                    @click="handleDeleteImage(currentProp.images.sideView.id)"
                  >
                    <template #icon>
                      <X :size="14" />
                    </template>
                  </NButton>
                </div>
                <NEmpty
                  v-else
                  description="暂无侧视图"
                />
              </div>
            </NGridItem>

            <!-- 俯视图 -->
            <NGridItem>
              <div class="view-section">
                <h4>俯视图</h4>
                <div
                  v-if="currentProp.images?.topView"
                  class="image-wrapper"
                >
                  <NImage
                    :src="currentProp.images.topView.url"
                    :alt="currentProp.name"
                    class="view-image"
                  />
                  <NButton
                    class="delete-btn"
                    circle
                    type="error"
                    size="small"
                    @click="handleDeleteImage(currentProp.images.topView.id)"
                  >
                    <template #icon>
                      <X :size="14" />
                    </template>
                  </NButton>
                </div>
                <NEmpty
                  v-else
                  description="暂无俯视图"
                />
              </div>
            </NGridItem>
          </NGrid>

          <!-- 额外参考图 -->
          <div
            v-if="currentProp.images?.additional?.length"
            class="additional-section"
          >
            <h4>额外参考图</h4>
            <NGrid
              cols="2 s:3 m:4"
              :x-gap="12"
              :y-gap="12"
            >
              <NGridItem
                v-for="img in currentProp.images.additional"
                :key="img.id"
              >
                <div class="image-wrapper">
                  <NImage
                    :src="img.url"
                    :alt="currentProp.name"
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

          <NEmpty
            v-if="
              !currentProp.images?.frontView &&
                !currentProp.images?.sideView &&
                !currentProp.images?.topView &&
                !currentProp.images?.additional?.length
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
              <span class="label">道具名称：</span>
              <span class="value">{{ currentProp.name }}</span>
            </div>
            <div class="info-item">
              <span class="label">重要性：</span>
              <NTag
                :type="getImportanceType(currentProp.importance)"
                size="small"
              >
                {{ getImportanceLabel(currentProp.importance) }}
              </NTag>
            </div>
            <div
              v-if="currentProp.description"
              class="info-item full-width"
            >
              <span class="label">道具描述：</span>
              <span class="value">{{ currentProp.description }}</span>
            </div>
          </div>
        </NCard>

        <!-- 外观属性 -->
        <NCard
          v-if="currentProp.appearance"
          title="外观属性"
          class="info-card"
        >
          <div class="info-grid">
            <div
              v-if="currentProp.appearance.color"
              class="info-item"
            >
              <span class="label">主要颜色：</span>
              <span class="value">{{ currentProp.appearance.color }}</span>
            </div>
            <div
              v-if="currentProp.appearance.material"
              class="info-item"
            >
              <span class="label">材质：</span>
              <span class="value">{{ currentProp.appearance.material }}</span>
            </div>
            <div
              v-if="currentProp.appearance.size"
              class="info-item"
            >
              <span class="label">大小：</span>
              <span class="value">{{
                getSizeLabel(currentProp.appearance.size)
              }}</span>
            </div>
            <div
              v-if="currentProp.appearance.condition"
              class="info-item"
            >
              <span class="label">新旧程度：</span>
              <span class="value">{{
                getConditionLabel(currentProp.appearance.condition)
              }}</span>
            </div>
            <div
              v-if="currentProp.appearance.distinctiveFeatures?.length"
              class="info-item full-width"
            >
              <span class="label">显著特征：</span>
              <NSpace>
                <NTag
                  v-for="feature in currentProp.appearance.distinctiveFeatures"
                  :key="feature"
                  size="small"
                >
                  {{ feature }}
                </NTag>
              </NSpace>
            </div>
          </div>
        </NCard>

        <!-- 功能描述 -->
        <NCard
          v-if="currentProp.function"
          title="功能描述"
          class="info-card"
        >
          <div class="info-grid">
            <div class="info-item full-width">
              <span class="value">{{ currentProp.function }}</span>
            </div>
          </div>
        </NCard>

        <!-- 导入来源 -->
        <NCard
          v-if="currentProp.importInfo"
          title="导入来源"
          class="info-card"
        >
          <div class="info-grid">
            <div class="info-item">
              <span class="label">来源项目ID：</span>
              <span class="value">{{
                currentProp.importInfo.sourceProjectId
              }}</span>
            </div>
            <div class="info-item">
              <span class="label">来源道具ID：</span>
              <span class="value">{{
                currentProp.importInfo.sourcePropId
              }}</span>
            </div>
            <div class="info-item">
              <span class="label">导入时间：</span>
              <span class="value">{{
                new Date(currentProp.importInfo.importedAt).toLocaleString()
              }}</span>
            </div>
          </div>
        </NCard>
      </template>

      <NEmpty
        v-else-if="!loading"
        description="道具不存在"
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
.prop-detail {
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

    .view-section {
      h4 {
        margin: 0 0 12px;
        font-size: 14px;
        color: #666;
      }
    }

    .additional-section {
      margin-top: 24px;

      h4 {
        margin: 0 0 12px;
        font-size: 14px;
        color: #666;
      }
    }

    .image-wrapper {
      position: relative;
      display: inline-block;

      .view-image {
        width: 100%;
        max-height: 300px;
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

<script setup lang="ts">
/**
 * 资产编辑弹窗组件
 * 用于资产库列表页面编辑资产
 */
import { ref, computed, watch } from "vue";
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NSpace,
  NIcon,
  NUpload,
  NImage,
  NImageGroup,
  NTag,
  useMessage,
  useDialog,
  type UploadFileInfo,
} from "naive-ui";
import {
  Sparkles,
  CloudUploadOutline,
  TrashOutline,
  ImageOutline,
} from "@vicons/ionicons5";

// 资产类型
type AssetType = "character" | "scene" | "prop";

// 资产数据接口（兼容 null 和 undefined）
interface AssetData {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  gender?: string;
  age?: string;
  voiceId?: string;
  images?: {
    frontView?: { url?: string; thumbnailUrl?: string | null; id?: string };
    panorama?: { url?: string; thumbnailUrl?: string | null; id?: string };
    referenceImages?: Array<{
      url?: string;
      thumbnailUrl?: string | null;
      id?: string;
    }>;
  };
}

interface Props {
  show: boolean;
  type: AssetType;
  data: AssetData | null;
  loading?: boolean;
  progress?: number; // 0-100，图片生成进度
  maxReferenceImages?: number; // 最大参考图数量，默认 3
  generating?: boolean; // 是否正在生成图片（单独控制遮罩显示）
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  progress: 0,
  maxReferenceImages: 3,
  generating: false,
});

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "save", data: Partial<AssetData>): void;
  (e: "delete", id: string): void;
  (e: "generateImage", id: string): void;
  (e: "uploadImage", files: File[]): void;
  (e: "deleteImage", imageId: string): void;
  (e: "uploadReference", files: File[]): void;
}>();

const message = useMessage();
const dialog = useDialog();

// 表单数据
const formData = ref({
  name: "",
  description: "",
  gender: "",
  age: null as number | null,
});

// 性别选项
const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
  { label: "未知", value: "unknown" },
];

// 资产类型标签
const typeLabel = computed(() => {
  switch (props.type) {
    case "character":
      return "角色";
    case "scene":
      return "场景";
    case "prop":
      return "道具";
    default:
      return "";
  }
});

// 弹窗标题
const modalTitle = computed(() => {
  const isNew = !props.data?.id;
  if (isNew) {
    return `新建${typeLabel.value}`;
  }
  return formData.value.name
    ? `编辑${typeLabel.value} - ${formData.value.name}`
    : `编辑${typeLabel.value}`;
});

// 主图
const mainImage = computed(() => {
  if (!props.data) return null;
  if (props.type === "scene") {
    return props.data.images?.panorama;
  }
  return props.data.images?.frontView;
});

// 参考图
const referenceImages = computed(() => {
  if (!props.data) return [];
  return props.data.images?.referenceImages || [];
});

// 监听数据变化，同步到表单
watch(
  () => props.data,
  (newData) => {
    if (newData) {
      formData.value = {
        name: newData.name || "",
        description: newData.description || "",
        gender: newData.gender || "",
        age: newData.age ? parseInt(newData.age, 10) : null,
      };
    } else {
      formData.value = {
        name: "",
        description: "",
        gender: "",
        age: null,
      };
    }
  },
  { immediate: true },
);

// 生成状态：0=空闲, 1-99=生成中, 100=完成, -1=失败
const generationStatus = computed(() => {
  if (props.generating) {
    // 生成中：优先使用 progress，如果没有则显示 0%
    if (props.progress > 0 && props.progress < 100) return props.progress;
    return 1; // 刚开始生成，进度还未推送
  }
  if (props.progress > 0 && props.progress < 100) return props.progress;
  if (props.progress >= 100) return 100;
  return 0;
});

// 关闭弹窗
function handleClose() {
  emit("update:show", false);
}

// 保存
function handleSave() {
  if (!formData.value.name.trim()) {
    message.warning("请输入名称");
    return;
  }

  const saveData: Partial<AssetData> = {
    name: formData.value.name,
    description: formData.value.description,
  };

  if (props.type === "character") {
    saveData.gender = formData.value.gender;
    saveData.age =
      formData.value.age !== null
        ? String(formData.value.age)
        : undefined;
  }

  emit("save", saveData);
}

// 删除
function handleDelete() {
  if (!props.data) return;

  dialog.warning({
    title: "确认删除",
    content: `确定要删除${typeLabel.value} "${props.data.name}" 吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("delete", props.data!.id);
      handleClose();
    },
  });
}

// 生成图片
function handleGenerateImage() {
  if (!props.data?.id) {
    message.warning("请先保存后再生成图片");
    return;
  }
  emit("generateImage", props.data.id);
}

// 上传图片（通过 before-upload 拦截获取真实 File 对象）
function handleBeforeUpload({ file }: { file: UploadFileInfo }) {
  if (!props.data?.id) {
    message.warning("请先保存后再上传图片");
    return false;
  }
  const actualFile = file.file;
  if (!actualFile) {
    message.warning("文件读取失败");
    return false;
  }
  emit("uploadImage", [actualFile]);
  return false; // 阻止默认上传
}

// 删除图片
function handleDeleteImage(imageId: string) {
  dialog.warning({
    title: "确认删除",
    content: "确定要删除这张参考图片吗？此操作不可恢复。",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      emit("deleteImage", imageId);
    },
  });
}

// 参考图上传处理
function handleReferenceBeforeUpload({ file }: { file: UploadFileInfo }) {
  if (!props.data?.id) {
    message.warning("请先保存后再上传参考图");
    return false;
  }
  const actualFile = file.file;
  if (!actualFile) {
    message.warning("文件读取失败");
    return false;
  }
  emit("uploadReference", [actualFile]);
  return false; // 阻止默认上传
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="asset-edit-modal"
    style="width: 900px; max-height: 90vh"
    :title="modalTitle"
    :bordered="false"
    :segmented="{ content: 'soft' }"
    @update:show="$emit('update:show', $event)"
  >
    <!-- 内容区域（左右布局） -->
    <div class="modal-content-flex">
      <!-- 左侧图片区域（包裹遮罩层） -->
      <div class="modal-image-wrapper">
        <!-- 生成中遮罩 -->
        <div
          v-if="generationStatus > 0 && generationStatus < 100"
          class="generating-overlay"
        >
          <div class="generating-content">
            <n-icon
              size="40"
              class="generating-icon"
            >
              <Sparkles />
            </n-icon>
            <p class="generating-text">
              图片生成中...
            </p>
            <p class="generating-progress">
              {{ generationStatus }}%
            </p>
          </div>
        </div>

        <!-- 图片操作区域 -->
        <div class="modal-image-section">
        <!-- 主图预览 -->
        <div class="image-preview-wrapper">
          <div class="image-preview">
            <n-image-group v-if="mainImage?.url || mainImage?.thumbnailUrl">
              <n-image
                :src="mainImage.url || mainImage.thumbnailUrl || undefined"
                :alt="data?.name"
                object-fit="contain"
                class="preview-image"
              />
            </n-image-group>
            <div v-else class="image-placeholder">
              <n-icon :size="48" color="#c0c0cc">
                <ImageOutline />
              </n-icon>
              <span class="placeholder-text">暂无图片</span>
            </div>
          </div>
        </div>

        <!-- 图片操作按钮 -->
        <div class="image-actions">
          <n-button
            class="btn-generate"
            type="primary"
            :loading="loading"
            :disabled="generationStatus > 0 && generationStatus < 100"
            @click="handleGenerateImage"
          >
            <template #icon>
              <n-icon><Sparkles /></n-icon>
            </template>
            <template #default>
              <span v-if="generationStatus > 0 && generationStatus < 100">生成中 {{ generationStatus }}%</span>
              <span v-else-if="generationStatus >= 100">生成完成</span>
              <span v-else>AI 生成图片</span>
            </template>
          </n-button>
          <n-upload
            accept="image/*"
            :max="1"
            :show-file-list="false"
            @before-upload="handleBeforeUpload"
          >
            <n-button class="btn-upload" quaternary>
              <template #icon>
                <n-icon><CloudUploadOutline /></n-icon>
              </template>
              本地上传
            </n-button>
          </n-upload>
        </div>

        <!-- 参考图 -->
        <div class="reference-section">
          <!-- 不支持参考图提示 -->
          <div
            v-if="maxReferenceImages === 0"
            class="no-reference-hint"
          >
            <span class="hint-text">当前模型不支持参考图</span>
          </div>
          <!-- 参考图区域 -->
          <template v-else>
            <div class="reference-label">参考图片 ({{ referenceImages.length }}/{{ maxReferenceImages }})</div>
            <div class="reference-list">
            <n-image-group v-if="referenceImages.length > 0">
              <div
                v-for="img in referenceImages"
                :key="img.id"
                class="reference-item"
              >
                <n-image
                  :src="img.thumbnailUrl || img.url"
                  :preview-src="img.url"
                  object-fit="cover"
                  class="reference-thumb"
                />
                <n-button
                  size="tiny"
                  circle
                  type="error"
                  quaternary
                  class="reference-delete-btn"
                  @click="handleDeleteImage(img.id!)"
                >
                  <template #icon>
                    <n-icon><TrashOutline /></n-icon>
                  </template>
                </n-button>
              </div>
            </n-image-group>

            <!-- 上传参考图按钮 -->
            <n-upload
              v-if="referenceImages.length < maxReferenceImages"
              accept="image/*"
              :max="maxReferenceImages - referenceImages.length"
              :show-file-list="false"
              @before-upload="handleReferenceBeforeUpload"
            >
              <n-button quaternary class="btn-upload-ref">
                <template #icon>
                  <n-icon><CloudUploadOutline /></n-icon>
                </template>
                {{ referenceImages.length > 0 ? '继续上传' : '上传参考图' }}
              </n-button>
            </n-upload>
            </div>
          </template>
        </div>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="modal-form-section">
        <!-- 资产类型标签 -->
        <n-tag
          class="asset-type-tag"
          :type="
            type === 'character'
              ? 'primary'
              : type === 'scene'
                ? 'success'
                : 'warning'
          "
          size="small"
          round
        >
          {{ typeLabel }}
        </n-tag>

        <n-form
          class="asset-form"
          label-placement="top"
          label-width="auto"
        >
          <n-form-item label="资产名称">
            <n-input
              v-model:value="formData.name"
              placeholder="请输入资产名称"
              class="form-input"
            />
          </n-form-item>

          <!-- 角色：性别/年龄 -->
          <div v-if="type === 'character'" class="character-fields">
            <n-form-item label="性别">
              <n-select
                v-model:value="formData.gender"
                :options="genderOptions"
                placeholder="选择性别"
                clearable
                class="form-select"
                :consistent-menu-width="false"
              />
            </n-form-item>

            <n-form-item label="年龄">
              <n-input-number
                v-model:value="formData.age"
                placeholder="输入年龄"
                :min="0"
                :max="150"
                class="form-number"
                :show-button="false"
              />
            </n-form-item>
          </div>

          <n-form-item label="描述">
            <n-input
              v-model:value="formData.description"
              type="textarea"
              placeholder="描述资产的外观、特征等（可选）"
              :rows="4"
              class="form-textarea"
              :resizable="false"
            />
          </n-form-item>
        </n-form>
      </div>
    </div>

    <!-- 操作按钮 -->
    <template #action>
      <n-space justify="space-between" align="center">
        <n-button
          type="error"
          quaternary
          class="btn-delete"
          @click="handleDelete"
        >
          <template #icon>
            <n-icon><TrashOutline /></n-icon>
          </template>
          删除
        </n-button>
        <n-space>
          <n-button class="btn-cancel" @click="handleClose">
            取消
          </n-button>
          <n-button
            type="primary"
            class="btn-save"
            :loading="loading"
            @click="handleSave"
          >
            保存
          </n-button>
        </n-space>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped lang="scss">
// 弹窗整体
:deep(.asset-edit-modal.n-card) {
  overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
}

:deep(.n-card-header) {
  padding: 20px 24px 16px;
  font-weight: 600;
  font-size: 17px;
}

:deep(.n-card__content) {
  padding: 0 24px;
}

:deep(.n-card__footer) {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f5;
  background: #fafafc;
}

// 内容区域左右布局容器
.modal-content-flex {
  display: flex;
  gap: 32px;
  max-height: calc(90vh - 180px);
  overflow: hidden;

  // 左侧图片区域包裹层（用于遮罩定位）
  .modal-image-wrapper {
    flex: 0 0 300px;
    min-width: 300px;
    max-width: 300px;
    position: relative;
  }

  // 左侧图片操作区域
  .modal-image-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  // 右侧表单区域
  .modal-form-section {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding-right: 4px;
  }
}

.image-preview-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #f8f9fc 0%, #eef1f8 100%);
  border: 2px solid #e8ebf2;
  transition: border-color 0.25s, box-shadow 0.25s;

  &:hover {
    border-color: #d0d5e0;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  }
}

.image-preview {
  width: 100%;
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  width: 100%;
  height: 100%;

  :deep img {
    height: 100%;
    width: 100%;
  }
}

.image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.placeholder-text {
  color: #999;
  font-size: 14px;
}

// 图片操作按钮
.image-actions {
  display: flex;
  flex-direction: row;
  gap: 8px;
}

.btn-generate {
  border-radius: 3px;
  font-weight: 500;
  height: 40px;
  flex: 1;
  background: linear-gradient(135deg, #2080f0 0%, #3a90ff 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(32, 128, 240, 0.25);
  transition: box-shadow 0.2s, transform 0.15s;

  &:hover {
    box-shadow: 0 4px 16px rgba(32, 128, 240, 0.35);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

.btn-upload {
  border-radius: 3px;
  flex: 1;
  justify-content: center;
  color: #666;
  height: 40px;
  border: 1px dashed #d0d5e0;
  background: #fafafc;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: #2080f0;
    background: #f0f6ff;
    color: #2080f0;
  }
}

// 参考图上传按钮
.btn-upload-ref {
  width: 100%;
  justify-content: flex-start;
  color: #999;
  height: 32px;
  font-size: 12px;
  transition: color 0.2s;

  &:hover {
    color: #2080f0;
  }
}

// 参考图区域
.reference-section {
  padding-top: 16px;
  border-top: 1px solid #f0f0f5;

  // 不支持参考图提示
  .no-reference-hint {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 12px 0;

    .hint-text {
      font-size: 12px;
      color: #999;
      background: #f5f5f5;
      padding: 6px 12px;
      border-radius: 6px;
    }
  }

  .reference-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 10px;
    font-weight: 500;
    letter-spacing: 0.3px;
  }

  .reference-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .reference-item {
    position: relative;

    .reference-thumb {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      border: 1px solid #ebebf0;
      overflow: hidden;
      cursor: pointer;
      transition: box-shadow 0.15s;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
    }

    .reference-delete-btn {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #fff;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }
  }
}

// 右侧表单区域样式已在 .modal-content-flex 内定义

.asset-type-tag {
  align-self: flex-start;
  margin-bottom: 20px;
  padding: 0 14px;
  font-weight: 500;
  font-size: 13px;
}

.asset-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-fields {
  display: flex;
  gap: 16px;

  > * {
    flex: 1;
    min-width: 0;
  }
}

.form-input,
.form-select,
.form-number,
.form-textarea {
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-textarea :deep(.n-input__textarea-el) {
  border-radius: 3px;
}

// 操作按钮
.btn-delete {
  border-radius: 3px;
  font-weight: 500;
  padding: 0 12px;
  height: 36px;
}

.btn-cancel {
  border-radius: 3px;
  height: 36px;
  padding: 0 16px;
}

.btn-save {
  border-radius: 3px;
  height: 36px;
  padding: 0 20px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(32, 128, 240, 0.25);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(32, 128, 240, 0.35);
  }
}

// 暗色模式
[data-theme="dark"] {
  :deep(.n-card__footer) {
    border-top-color: #2a2a35;
    background: #1a1a24;
  }

  .image-preview-wrapper {
    background: linear-gradient(135deg, #1e1e28 0%, #16161f 100%);
    border-color: #2a2a35;

    &:hover {
      border-color: #3a3a48;
    }
  }

  .image-placeholder {
    color: #6a6a8a;
  }

  .placeholder-text {
    color: #6a6a8a;
  }

  .reference-section {
    border-top-color: #2a2a35;
  }

  .reference-item {
    .reference-thumb {
      border-color: #2a2a35;
    }

    .reference-delete-btn {
      background: #1e1e28;
    }
  }

  .btn-upload {
    border-color: #3a3a48;
    background: #1a1a24;

    &:hover {
      border-color: #4a70c0;
      background: #1e2438;
    }
  }

  .btn-upload-ref {
    color: #6a6a8a;

    &:hover {
      color: #4a70c0;
    }
  }
}

// 生成中遮罩
.generating-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 8px;
  backdrop-filter: blur(8px);

  .generating-content {
    text-align: center;
  }

  .generating-icon {
    color: #2080f0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .generating-text {
    margin-top: 12px;
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }

  .generating-progress {
    margin-top: 4px;
    font-size: 20px;
    font-weight: 700;
    color: #2080f0;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}
</style>

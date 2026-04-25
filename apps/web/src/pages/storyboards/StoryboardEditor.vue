<script setup lang="ts">
import { computed, watch, ref } from "vue";
import { useStoryboardStore } from "@/stores/storyboard";
import { storeToRefs } from "pinia";
import {
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NButton,
  NSpace,
  NDivider,
  NGrid,
  NGridItem,
  NSpin,
} from "naive-ui";
import { useRoute } from "vue-router";
import { Save, X, Image as ImageIcon, Wand2 } from "lucide-vue-next";
import type {
  ShotType,
  CameraAngle,
  CameraMovement,
  FocusType,
  TransitionInType,
  TransitionOutType,
  AudioType,
} from "@pixaura/shared-types";

const storyboardStore = useStoryboardStore();
const { editorVisible, currentDetail, currentId, editorLoading } =
  storeToRefs(storyboardStore);
const route = useRoute();
const projectId = route.params.id as string;

// 防止重复填充的标志
const isFormInitialized = ref(false);

// 当前正在编辑的分镜ID（用于确保数据一致性）
const editingStoryboardId = ref<string | null>(null);

// 表单数据
const form = ref({
  description: "",
  shotType: "medium" as ShotType,
  angle: undefined as CameraAngle | undefined,
  movement: undefined as CameraMovement | undefined,
  movementDescription: "",
  focus: undefined as FocusType | undefined,
  duration: 3,
  transitionIn: undefined as TransitionInType | undefined,
  transitionOut: undefined as TransitionOutType | undefined,
  audioType: "silent" as AudioType,
  dialogueText: "",
  dialogueEmotion: "",
  voiceoverText: "",
  soundEffects: [] as string[],
});

// 选项
const shotTypeOptions = [
  { label: "极远景", value: "extreme_wide" },
  { label: "远景", value: "wide" },
  { label: "中景", value: "medium" },
  { label: "近景", value: "close_up" },
  { label: "特写", value: "extreme_close_up" },
];

const angleOptions = [
  { label: "平视", value: "eye_level" },
  { label: "仰视", value: "low" },
  { label: "俯视", value: "high" },
  { label: "荷兰角", value: "dutch" },
  { label: "顶视", value: "overhead" },
];

const movementOptions = [
  { label: "固定", value: "static" },
  { label: "摇镜", value: "pan" },
  { label: "仰俯", value: "tilt" },
  { label: "推镜", value: "dolly_in" },
  { label: "拉镜", value: "dolly_out" },
  { label: "横移", value: "truck" },
  { label: "升降", value: "crane" },
  { label: "手持", value: "handheld" },
];

const focusOptions = [
  { label: "浅景深", value: "shallow" },
  { label: "深景深", value: "deep" },
];

const transitionOptions = [
  { label: "切换", value: "cut" },
  { label: "淡入", value: "fade_in" },
  { label: "淡出", value: "fade_out" },
  { label: "叠化", value: "dissolve" },
  { label: "擦除", value: "wipe" },
  { label: "滑动", value: "slide" },
];

const audioTypeOptions = [
  { label: "静音", value: "silent" },
  { label: "对白", value: "dialogue" },
  { label: "旁白", value: "voiceover" },
  { label: "环境音", value: "ambient" },
];

// 填充表单的辅助函数
function populateForm(detail: typeof currentDetail.value) {
  if (!detail) return;
  form.value = {
    description: detail.description || "",
    shotType: (detail.shot?.shotType || "medium") as ShotType,
    angle: detail.shot?.angle as CameraAngle,
    movement: detail.shot?.movement as CameraMovement,
    movementDescription: detail.shot?.movementDescription || "",
    focus: detail.shot?.focus as FocusType,
    duration: detail.timing?.duration || 3,
    transitionIn: detail.timing?.transitionIn as TransitionInType,
    transitionOut: detail.timing?.transitionOut as TransitionOutType,
    audioType: (detail.audio?.type || "silent") as AudioType,
    dialogueText: detail.audio?.dialogueText || "",
    dialogueEmotion: detail.audio?.dialogueEmotion || "",
    voiceoverText: detail.audio?.voiceoverText || "",
    soundEffects: detail.audio?.soundEffects || [],
  };
}

// 监听编辑器显示状态，在打开编辑器时初始化表单
watch(
  () => editorVisible.value,
  (visible) => {
    if (visible) {
      // 记录当前编辑的分镜ID
      editingStoryboardId.value = currentId.value;
      isFormInitialized.value = false;
      if (!currentId.value) {
        // 新建模式：重置表单
        resetForm();
        isFormInitialized.value = true;
      }
      // 编辑模式：等待 currentDetail 加载完成后再填充（在下面的watch中处理）
    } else {
      // 编辑器关闭时重置
      isFormInitialized.value = false;
      editingStoryboardId.value = null;
    }
  },
);

// 监听详情变化，在数据加载完成后填充表单
watch(
  () => currentDetail.value,
  (detail) => {
    // 只在以下情况填充表单：
    // 1. 编辑器打开
    // 2. 未初始化过
    // 3. 有详情数据
    // 4. 详情数据的ID与当前编辑的ID匹配（确保不是旧数据）
    if (
      editorVisible.value &&
      !isFormInitialized.value &&
      detail &&
      detail.id === editingStoryboardId.value
    ) {
      populateForm(detail);
      isFormInitialized.value = true;
    }
  },
);

function resetForm() {
  form.value = {
    description: "",
    shotType: "medium",
    angle: undefined,
    movement: undefined,
    movementDescription: "",
    focus: undefined,
    duration: 3,
    transitionIn: undefined,
    transitionOut: undefined,
    audioType: "silent",
    dialogueText: "",
    dialogueEmotion: "",
    voiceoverText: "",
    soundEffects: [],
  };
}

const isEditing = computed(() => !!currentDetail.value?.id);
const title = computed(() =>
  isEditing.value
    ? `编辑分镜 #${currentDetail.value?.sequenceNumber}`
    : "新建分镜",
);

function handleClose() {
  isFormInitialized.value = false;
  editingStoryboardId.value = null;
  storyboardStore.closeEditor();
}

async function handleSave() {
  // 确保 duration 是数字类型
  const duration =
    typeof form.value.duration === "string"
      ? parseInt(form.value.duration, 10)
      : form.value.duration;

  const data = {
    description: form.value.description,
    shot: {
      shotType: form.value.shotType,
      angle: form.value.angle,
      movement: form.value.movement,
      movementDescription: form.value.movementDescription || undefined,
      focus: form.value.focus,
    },
    timing: {
      duration: isNaN(duration) ? 3 : duration,
      transitionIn: form.value.transitionIn,
      transitionOut: form.value.transitionOut,
    },
    audio: {
      type: form.value.audioType,
      dialogueText: form.value.dialogueText || undefined,
      dialogueEmotion: form.value.dialogueEmotion || undefined,
      voiceoverText: form.value.voiceoverText || undefined,
      soundEffects:
        form.value.soundEffects.length > 0
          ? form.value.soundEffects
          : undefined,
    },
  };

  if (isEditing.value) {
    await storyboardStore.updateStoryboard(currentDetail.value!.id, data);
  } else {
    await storyboardStore.createStoryboard(projectId, data);
  }
  handleClose();
}

async function handleGenerateImage() {
  if (!currentDetail.value?.id) return;
  await storyboardStore.generateImage(currentDetail.value.id, { count: 1 });
}
</script>

<template>
  <NDrawer
    v-model:show="editorVisible"
    :width="600"
    :mask-closable="false"
    @update:show="(v: boolean) => !v && handleClose()"
  >
    <NDrawerContent
      :title="title"
      closable
      @close="handleClose"
    >
      <NSpin :show="editorLoading">
        <NForm
          label-placement="left"
          label-width="80"
        >
          <!-- 画面描述 -->
          <NFormItem label="画面描述">
            <NInput
              v-model:value="form.description"
              type="textarea"
              :rows="3"
              placeholder="描述分镜画面内容..."
            />
          </NFormItem>

          <!-- 图片区域 -->
          <div
            v-if="isEditing"
            class="image-section"
          >
            <div class="image-preview">
              <div
                v-if="!currentDetail?.images?.length"
                class="no-image"
              >
                <ImageIcon :size="48" />
                <span>暂无预览图</span>
              </div>
              <img
                v-else
                :src="
                  currentDetail.images.find((i) => i.isCurrent)?.url ||
                    currentDetail.images[0].url
                "
                alt="分镜图"
              >
            </div>
            <NButton
              type="primary"
              ghost
              @click="handleGenerateImage"
            >
              <template #icon>
                <Wand2 :size="16" />
              </template>
              生成图片
            </NButton>
          </div>

          <NDivider>镜头设置</NDivider>

          <NGrid
            :cols="2"
            :x-gap="16"
          >
            <NGridItem>
              <NFormItem label="景别">
                <NSelect
                  v-model:value="form.shotType"
                  :options="shotTypeOptions"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem>
              <NFormItem label="角度">
                <NSelect
                  v-model:value="form.angle"
                  :options="angleOptions"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem>
              <NFormItem label="运镜">
                <NSelect
                  v-model:value="form.movement"
                  :options="movementOptions"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem>
              <NFormItem label="景深">
                <NSelect
                  v-model:value="form.focus"
                  :options="focusOptions"
                  clearable
                />
              </NFormItem>
            </NGridItem>
          </NGrid>

          <NFormItem
            v-if="form.movement"
            label="运镜描述"
          >
            <NInput
              v-model:value="form.movementDescription"
              placeholder="描述运镜的具体方式..."
            />
          </NFormItem>

          <NDivider>时间设置</NDivider>

          <NGrid
            :cols="3"
            :x-gap="16"
          >
            <NGridItem>
              <NFormItem label="时长(秒)">
                <NInputNumber
                  v-model:value="form.duration"
                  :min="1"
                  :max="30"
                />
              </NFormItem>
            </NGridItem>
            <NGridItem>
              <NFormItem label="入点转场">
                <NSelect
                  v-model:value="form.transitionIn"
                  :options="transitionOptions"
                  clearable
                />
              </NFormItem>
            </NGridItem>
            <NGridItem>
              <NFormItem label="出点转场">
                <NSelect
                  v-model:value="form.transitionOut"
                  :options="transitionOptions"
                  clearable
                />
              </NFormItem>
            </NGridItem>
          </NGrid>

          <NDivider>声音设计</NDivider>

          <NFormItem label="音频类型">
            <NSelect
              v-model:value="form.audioType"
              :options="audioTypeOptions"
            />
          </NFormItem>

          <template v-if="form.audioType === 'dialogue'">
            <NFormItem label="对白文本">
              <NInput
                v-model:value="form.dialogueText"
                type="textarea"
                :rows="2"
                placeholder="输入对白内容..."
              />
            </NFormItem>
            <NFormItem label="情绪">
              <NInput
                v-model:value="form.dialogueEmotion"
                placeholder="如：激动、平静、愤怒..."
              />
            </NFormItem>
          </template>

          <template v-if="form.audioType === 'voiceover'">
            <NFormItem label="旁白文本">
              <NInput
                v-model:value="form.voiceoverText"
                type="textarea"
                :rows="2"
                placeholder="输入旁白内容..."
              />
            </NFormItem>
          </template>
        </NForm>
      </NSpin>

      <!-- 底部按钮 -->
      <template #footer>
        <NSpace justify="end">
          <NButton @click="handleClose">
            <template #icon>
              <X :size="16" />
            </template>
            取消
          </NButton>
          <NButton
            type="primary"
            @click="handleSave"
          >
            <template #icon>
              <Save :size="16" />
            </template>
            保存
          </NButton>
        </NSpace>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped lang="scss">
.image-section {
  margin-bottom: 24px;
  text-align: center;

  .image-preview {
    width: 100%;
    height: 200px;
    background: #f5f5f5;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;

    .no-image {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #999;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
}
</style>

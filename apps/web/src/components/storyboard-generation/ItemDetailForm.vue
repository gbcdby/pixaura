<template>
  <div class="item-detail-form">
    <div class="form-layout">
      <!-- 左侧预览 -->
      <div class="form-left">
        <div class="preview-section">
          <n-image
            v-if="item.previewImageUrl"
            :src="item.previewImageUrl"
            :preview-src="item.previewImageUrl"
            class="preview-image"
          />
          <div
            v-else
            class="preview-placeholder"
          >
            <n-icon :component="Image" />
            <span>无预览图</span>
          </div>
          <n-button
            v-if="!item.previewImageUrl"
            type="primary"
            ghost
            size="small"
            @click="handleGeneratePreview"
          >
            生成预览图
          </n-button>
        </div>
      </div>

      <!-- 右侧表单 -->
      <div class="form-right">
        <n-form
          ref="formRef"
          :model="formData"
          label-placement="left"
          label-width="80px"
        >
          <!-- 画面描述 -->
          <n-form-item label="画面描述">
            <n-input
              v-model:value="formData.description"
              type="textarea"
              :rows="3"
              placeholder="描述分镜画面内容"
            />
          </n-form-item>

          <!-- 镜头设置 -->
          <n-form-item label="镜头设置">
            <n-space>
              <n-select
                v-model:value="formData.shotType"
                :options="shotTypeOptions"
                placeholder="景别"
                style="width: 100px"
              />
              <n-select
                v-model:value="formData.shotAngle"
                :options="angleOptions"
                placeholder="角度"
                clearable
                style="width: 100px"
              />
              <n-select
                v-model:value="formData.shotMovement"
                :options="movementOptions"
                placeholder="运镜"
                clearable
                style="width: 100px"
              />
            </n-space>
          </n-form-item>

          <!-- 时长和转场 -->
          <n-form-item label="时长">
            <n-input-number
              v-model:value="formData.duration"
              :min="1"
              :max="30"
              style="width: 120px"
            >
              <template #suffix>
                秒
              </template>
            </n-input-number>
          </n-form-item>

          <!-- 角色出镜 -->
          <n-form-item label="角色出镜">
            <div class="characters-list">
              <div
                v-for="(char, index) in formData.characters"
                :key="index"
                class="character-item"
              >
                <n-tag
                  :type="char.isMatched ? 'success' : 'warning'"
                  closable
                  @close="removeCharacter(index)"
                >
                  {{ char.characterName }}
                  <template
                    v-if="!char.isMatched"
                    #icon
                  >
                    <n-icon :component="Warning" />
                  </template>
                </n-tag>
                <n-button
                  v-if="!char.isMatched"
                  text
                  type="primary"
                  size="tiny"
                  @click="handleCorrectCharacter(char)"
                >
                  校正
                </n-button>
              </div>
              <n-button
                dashed
                size="small"
                @click="showAddCharacter = true"
              >
                <n-icon :component="Add" />
                添加角色
              </n-button>
            </div>
          </n-form-item>

          <!-- 场景关联 -->
          <n-form-item label="场景">
            <n-select
              v-model:value="formData.sceneId"
              :options="sceneOptions"
              placeholder="选择场景"
              clearable
              style="width: 200px"
            />
          </n-form-item>

          <!-- 音频设置 -->
          <n-form-item label="音频类型">
            <n-radio-group v-model:value="formData.audio.type">
              <n-radio-button value="dialogue">
                对白
              </n-radio-button>
              <n-radio-button value="voiceover">
                旁白
              </n-radio-button>
              <n-radio-button value="ambient">
                环境音
              </n-radio-button>
              <n-radio-button value="silent">
                静音
              </n-radio-button>
            </n-radio-group>
          </n-form-item>

          <n-form-item
            v-if="formData.audio.type === 'dialogue'"
            label="对白内容"
          >
            <n-input
              v-model:value="formData.audio.dialogue.text"
              type="textarea"
              :rows="2"
              placeholder="输入对白内容"
            />
          </n-form-item>
        </n-form>

        <!-- AI生成信息 -->
        <div class="ai-info">
          <n-divider />
          <div class="info-row">
            <span class="label">置信度:</span>
            <n-progress
              :percentage="Math.round((item.confidenceScore || 0) * 100)"
              :indicator-placement="'inside'"
              style="width: 150px"
              :color="confidenceColor"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="form-actions">
      <n-space>
        <n-button
          type="error"
          ghost
          @click="handleDelete"
        >
          删除分镜
        </n-button>
        <n-button @click="handleRegenerate">
          重新生成
        </n-button>
      </n-space>
      <n-space>
        <n-button @click="handleCancel">
          取消
        </n-button>
        <n-button
          type="primary"
          @click="handleSave"
        >
          保存
        </n-button>
        <n-button
          type="success"
          @click="handleConfirm"
        >
          确认并保存
        </n-button>
      </n-space>
    </div>

    <!-- 添加角色弹窗 -->
    <n-modal
      v-model:show="showAddCharacter"
      title="添加角色"
      preset="card"
      style="width: 400px"
    >
      <n-form>
        <n-form-item label="角色">
          <n-select
            v-model:value="newCharacterId"
            :options="availableCharacterOptions"
            placeholder="选择角色"
          />
        </n-form-item>
        <n-form-item label="位置">
          <n-select
            v-model:value="newCharacterPosition"
            :options="positionOptions"
            placeholder="选择位置"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddCharacter = false">
            取消
          </n-button>
          <n-button
            type="primary"
            @click="confirmAddCharacter"
          >
            添加
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NRadioGroup,
  NRadioButton,
  NButton,
  NSpace,
  NImage,
  NIcon,
  NTag,
  NProgress,
  NDivider,
  NModal,
  useMessage,
} from "naive-ui";
import { Image, Warning, Add } from "@vicons/ionicons5";
import type { GenerationItemDetail } from "@pixaura/shared-types";

const props = defineProps<{
  item: GenerationItemDetail;
}>();

const emit = defineEmits<{
  save: [data: Partial<GenerationItemDetail>];
  confirm: [itemId: string];
  reject: [itemId: string];
  regenerate: [itemId: string];
  delete: [itemId: string];
  cancel: [];
}>();

const message = useMessage();

// 表单数据
const formData = ref({
  description: "",
  shotType: "medium",
  shotAngle: null as string | null,
  shotMovement: null as string | null,
  duration: 3,
  sceneId: null as string | null,
  characters: [] as Array<{
    characterId?: string;
    characterName: string;
    position: string;
    isMatched: boolean;
  }>,
  audio: {
    type: "silent" as "silent" | "dialogue" | "voiceover" | "ambient",
    dialogue: {
      text: "",
      characterId: null as string | null,
      characterName: "",
      emotion: null as string | null,
    },
    voiceover: null as string | null,
    soundEffects: [] as string[],
    musicMood: null as string | null,
  },
});

// 选项数据
const shotTypeOptions = [
  { label: "极远景", value: "extreme_wide" },
  { label: "远景", value: "wide" },
  { label: "中景", value: "medium" },
  { label: "特写", value: "close_up" },
  { label: "极特写", value: "extreme_close_up" },
  { label: "定场", value: "establishing" },
];

const angleOptions = [
  { label: "平视", value: "eye_level" },
  { label: "仰视", value: "low" },
  { label: "俯视", value: "high" },
  { label: "倾斜", value: "dutch" },
  { label: "顶视", value: "overhead" },
  { label: "鸟瞰", value: "bird_eye" },
];

const movementOptions = [
  { label: "静止", value: "static" },
  { label: "摇镜", value: "pan" },
  { label: "俯仰", value: "tilt" },
  { label: "推镜", value: "dolly_in" },
  { label: "拉镜", value: "dolly_out" },
  { label: "横移", value: "truck" },
  { label: "升降", value: "crane" },
  { label: "手持", value: "handheld" },
];

const sceneOptions = ref<{ label: string; value: string }[]>([]);
const availableCharacterOptions = ref<{ label: string; value: string }[]>([]);
const positionOptions = [
  { label: "左侧", value: "left" },
  { label: "中间", value: "center" },
  { label: "右侧", value: "right" },
  { label: "前景", value: "foreground" },
  { label: "背景", value: "background" },
];

// 添加角色弹窗
const showAddCharacter = ref(false);
const newCharacterId = ref<string | null>(null);
const newCharacterPosition = ref("center");

const confidenceColor = computed(() => {
  const score = props.item.confidenceScore || 0;
  if (score >= 0.8) return "#18a058";
  if (score >= 0.6) return "#f0a020";
  return "#d03050";
});

// 初始化表单数据
onMounted(() => {
  formData.value = {
    description: props.item.description,
    shotType: props.item.shotType,
    shotAngle: props.item.shotAngle || null,
    shotMovement: props.item.shotMovement || null,
    duration: props.item.duration,
    sceneId: props.item.sceneId || null,
    characters:
      props.item.characters?.map((char) => ({
        characterId: char.characterId,
        characterName: char.characterName,
        position: char.position,
        isMatched: char.isMatched ?? false,
      })) || [],
    audio: {
      type: props.item.audio?.type || "silent",
      dialogue: {
        text: props.item.audio?.dialogue?.text || "",
        characterId: props.item.audio?.dialogue?.characterId || null,
        characterName: props.item.audio?.dialogue?.characterName || "",
        emotion: props.item.audio?.dialogue?.emotion || null,
      },
      voiceover: null as string | null,
      soundEffects: [] as string[],
      musicMood: null as string | null,
    },
  };
});

function removeCharacter(index: number) {
  formData.value.characters.splice(index, 1);
}

function handleCorrectCharacter(_char: (typeof formData.value.characters)[0]) {
  // TODO: 打开资产映射校正弹窗
  message.info("校正功能开发中");
}

function confirmAddCharacter() {
  if (!newCharacterId.value) {
    message.warning("请选择角色");
    return;
  }
  const char = availableCharacterOptions.value.find(
    (c) => c.value === newCharacterId.value,
  );
  if (char) {
    formData.value.characters.push({
      characterId: newCharacterId.value,
      characterName: char.label,
      position: newCharacterPosition.value,
      isMatched: true,
    });
  }
  showAddCharacter.value = false;
  newCharacterId.value = null;
  newCharacterPosition.value = "center";
}

function handleGeneratePreview() {
  // TODO: 触发生成预览图
  message.info("生成预览图功能开发中");
}

function handleSave() {
  emit("save", {
    description: formData.value.description,
    shotType: formData.value.shotType,
    shotAngle: formData.value.shotAngle ?? undefined,
    shotMovement: formData.value.shotMovement ?? undefined,
    duration: formData.value.duration,
    sceneId: formData.value.sceneId ?? undefined,
    characters: formData.value.characters.map((char) => ({
      characterId: char.characterId,
      characterName: char.characterName,
      position: char.position,
      isMatched: char.isMatched,
    })),
    audio: {
      type: formData.value.audio.type,
      dialogue: formData.value.audio.dialogue?.text
        ? {
            characterId: formData.value.audio.dialogue.characterId ?? undefined,
            characterName: formData.value.audio.dialogue.characterName,
            text: formData.value.audio.dialogue.text,
            emotion: formData.value.audio.dialogue.emotion ?? undefined,
          }
        : undefined,
      voiceover: formData.value.audio.voiceover ?? undefined,
      soundEffects: [],
      musicMood: formData.value.audio.musicMood ?? undefined,
    },
  });
}

function handleConfirm() {
  handleSave();
  emit("confirm", props.item.id);
}

function handleDelete() {
  emit("delete", props.item.id);
}

function handleRegenerate() {
  emit("regenerate", props.item.id);
}

function handleCancel() {
  emit("cancel");
}
</script>

<style scoped lang="scss">
.item-detail-form {
  .form-layout {
    display: flex;
    gap: 24px;
    margin-bottom: 24px;

    .form-left {
      width: 300px;
      flex-shrink: 0;

      .preview-section {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .preview-image {
          width: 100%;
          border-radius: 8px;
        }

        .preview-placeholder {
          width: 100%;
          aspect-ratio: 16 / 9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--fill-color);
          border-radius: 8px;
          color: var(--text-color-3);
          font-size: 48px;
          gap: 8px;

          span {
            font-size: 14px;
          }
        }
      }
    }

    .form-right {
      flex: 1;

      .characters-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;

        .character-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }

      .ai-info {
        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;

          .label {
            font-size: 13px;
            color: var(--text-color-3);
          }
        }
      }
    }
  }

  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid var(--divider-color);
  }
}
</style>

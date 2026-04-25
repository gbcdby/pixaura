<script setup lang="ts">
/**
 * 剧本富文本编辑器组件
 * 支持场景标题、角色名、对话、动作描述、旁白等格式
 */
import { ref, computed, watch, nextTick } from "vue";
import {
  NButton,
  NSpace,
  NIcon,
  NDropdown,
  type DropdownOption,
} from "naive-ui";
import {
  TextOutline,
  PersonOutline,
  ChatbubbleOutline,
  WalkOutline,
  MicOutline,
  Sparkles,
  CutOutline,
} from "@vicons/ionicons5";

// 剧本元素类型
interface SceneElement {
  type: "stage" | "character" | "dialogue" | "action" | "voiceover";
  content: string;
  character?: string;
}

// 用于内部操作的类型（兼容不同的数据结构）
interface Act {
  title: string;
  scenes: Scene[];
  [key: string]: any;
}

interface Scene {
  title: string;
  location?: string;
  time?: string;
  content: SceneElement[];
  [key: string]: any;
}

interface Props {
  modelValue: any;
  readonly?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", value: any): void;
  (e: "change", value: any): void;
  (e: "ai-continue"): void;
  (e: "ai-polish"): void;
}>();

// 当前编辑的内容
const content = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// 当前正在编辑的文本
const editingText = ref("");
const editingElement = ref<{
  actIndex: number;
  sceneIndex: number;
  elementIndex: number;
} | null>(null);

// 格式化工具栏选项
const formatOptions: DropdownOption[] = [
  {
    label: "场景标题",
    key: "stage",
    icon: () => h(NIcon, () => h(TextOutline)),
  },
  {
    label: "角色名",
    key: "character",
    icon: () => h(NIcon, () => h(PersonOutline)),
  },
  {
    label: "对话",
    key: "dialogue",
    icon: () => h(NIcon, () => h(ChatbubbleOutline)),
  },
  {
    label: "动作",
    key: "action",
    icon: () => h(NIcon, () => h(WalkOutline)),
  },
  {
    label: "旁白",
    key: "voiceover",
    icon: () => h(NIcon, () => h(MicOutline)),
  },
];

// 获取元素样式类
const getElementClass = (element: SceneElement): string => {
  const baseClass = "script-element";
  return `${baseClass} ${element.type}`;
};

// 获取元素标签
const getElementLabel = (type: string): string => {
  const labels: Record<string, string> = {
    stage: "场景",
    character: "角色",
    dialogue: "对话",
    action: "动作",
    voiceover: "旁白",
  };
  return labels[type] || type;
};

// 开始编辑元素
const startEdit = (
  actIndex: number,
  sceneIndex: number,
  elementIndex: number,
) => {
  if (props.readonly) return;

  const element =
    content.value.acts[actIndex]?.scenes[sceneIndex]?.content[elementIndex];
  if (!element) return;

  editingElement.value = { actIndex, sceneIndex, elementIndex };
  editingText.value = element.content;

  nextTick(() => {
    const textarea = document.querySelector(
      ".editing-textarea",
    ) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  });
};

// 保存编辑
const saveEdit = () => {
  if (!editingElement.value) return;

  const { actIndex, sceneIndex, elementIndex } = editingElement.value;
  const act = content.value.acts[actIndex];
  if (!act) return;

  const scene = act.scenes[sceneIndex];
  if (!scene) return;

  const element = scene.content[elementIndex];
  if (!element) return;

  element.content = editingText.value;
  emit("change", content.value);

  editingElement.value = null;
  editingText.value = "";
};

// 取消编辑
const cancelEdit = () => {
  editingElement.value = null;
  editingText.value = "";
};

// 添加新元素
const addElement = (
  actIndex: number,
  sceneIndex: number,
  type: SceneElement["type"],
) => {
  const act = content.value.acts[actIndex];
  if (!act) return;

  const scene = act.scenes[sceneIndex];
  if (!scene) return;

  const newElement: SceneElement = {
    type,
    content: type === "character" ? "角色名" : "请输入内容...",
    character: type === "dialogue" ? "" : undefined,
  };

  scene.content.push(newElement);
  emit("change", content.value);

  // 自动开始编辑新元素
  nextTick(() => {
    startEdit(actIndex, sceneIndex, scene.content.length - 1);
  });
};

// 删除元素
const deleteElement = (
  actIndex: number,
  sceneIndex: number,
  elementIndex: number,
) => {
  const act = content.value.acts[actIndex];
  if (!act) return;

  const scene = act.scenes[sceneIndex];
  if (!scene) return;

  scene.content.splice(elementIndex, 1);
  emit("change", content.value);
};

// 添加新场景
const addScene = (actIndex: number) => {
  const act = content.value.acts[actIndex];
  if (!act) return;

  const newScene: Scene = {
    title: `场景 ${act.scenes.length + 1}`,
    content: [{ type: "stage", content: "新场景 - 地点，时间" }],
  };

  act.scenes.push(newScene);
  emit("change", content.value);
};

// 添加新幕
const addAct = () => {
  const newAct: Act = {
    title: `第 ${content.value.acts.length + 1} 幕`,
    scenes: [
      {
        title: "场景 1",
        content: [{ type: "stage", content: "新场景 - 地点，时间" }],
      },
    ],
  };

  content.value.acts.push(newAct);
  emit("change", content.value);
};

// AI 续写
const handleAIContinue = () => {
  emit("ai-continue");
};

// AI 润色
const handleAIPolish = () => {
  emit("ai-polish");
};

// 处理键盘事件
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    cancelEdit();
  }
};

// 监听内容变化
watch(
  () => props.modelValue,
  (newVal) => {
    // 确保内容结构完整
    if (!newVal.acts) {
      newVal.acts = [];
    }
    if (!newVal.characters) {
      newVal.characters = [];
    }
  },
  { immediate: true },
);

import { h } from "vue";
</script>

<template>
  <div
    class="script-editor"
    @keydown="handleKeydown"
  >
    <!-- 工具栏 -->
    <div
      v-if="!readonly"
      class="editor-toolbar"
    >
      <n-space>
        <n-button
          size="small"
          @click="addAct"
        >
          <template #icon>
            <n-icon><CutOutline /></n-icon>
          </template>
          添加幕
        </n-button>
        <n-dropdown
          :options="formatOptions"
          @select="
            (key) => {
              const lastActIndex = content.acts.length - 1;
              if (lastActIndex >= 0) {
                const lastSceneIndex =
                  content.acts[lastActIndex].scenes.length - 1;
                if (lastSceneIndex >= 0) {
                  addElement(
                    lastActIndex,
                    lastSceneIndex,
                    key as SceneElement['type'],
                  );
                }
              }
            }
          "
        >
          <n-button size="small">
            <template #icon>
              <n-icon><TextOutline /></n-icon>
            </template>
            添加元素
          </n-button>
        </n-dropdown>
        <n-button
          size="small"
          @click="handleAIContinue"
        >
          <template #icon>
            <n-icon><Sparkles /></n-icon>
          </template>
          AI 续写
        </n-button>
        <n-button
          size="small"
          @click="handleAIPolish"
        >
          <template #icon>
            <n-icon><Sparkles /></n-icon>
          </template>
          AI 润色
        </n-button>
      </n-space>
    </div>

    <!-- 编辑器内容区 -->
    <div class="editor-content">
      <div
        v-if="!content.acts?.length"
        class="empty-state"
      >
        <p>暂无剧本内容</p>
        <n-button
          v-if="!readonly"
          type="primary"
          size="small"
          @click="addAct"
        >
          开始创作
        </n-button>
      </div>

      <div
        v-else
        class="acts-container"
      >
        <div
          v-for="(act, actIndex) in content.acts"
          :key="actIndex"
          class="act-section"
        >
          <!-- 幕标题 -->
          <div class="act-header">
            <h4 class="act-title">
              {{ act.title || `第 ${actIndex + 1} 幕` }}
            </h4>
            <n-button
              v-if="!readonly"
              text
              size="tiny"
              @click="addScene(actIndex)"
            >
              + 添加场景
            </n-button>
          </div>

          <!-- 场景列表 -->
          <div class="scenes-container">
            <div
              v-for="(scene, sceneIndex) in act.scenes"
              :key="sceneIndex"
              class="scene-section"
            >
              <!-- 场景标题 -->
              <div class="scene-header">
                <h5 class="scene-title">
                  {{ scene.title }}
                </h5>
                <span
                  v-if="scene.location"
                  class="scene-location"
                >
                  {{ scene.location }}
                  <span v-if="scene.time">· {{ scene.time }}</span>
                </span>
              </div>

              <!-- 场景内容 -->
              <div class="scene-content">
                <div
                  v-for="(element, elementIndex) in scene.content"
                  :key="elementIndex"
                  :class="getElementClass(element)"
                  @click="startEdit(actIndex, sceneIndex, elementIndex)"
                >
                  <!-- 编辑模式 -->
                  <template
                    v-if="
                      editingElement?.actIndex === actIndex &&
                        editingElement?.sceneIndex === sceneIndex &&
                        editingElement?.elementIndex === elementIndex
                    "
                  >
                    <div class="element-edit">
                      <textarea
                        v-model="editingText"
                        class="editing-textarea"
                        :rows="element.type === 'dialogue' ? 3 : 2"
                        @blur="saveEdit"
                        @keydown.enter.prevent="saveEdit"
                      />
                      <div class="edit-actions">
                        <n-button
                          size="tiny"
                          type="primary"
                          @click="saveEdit"
                        >
                          保存
                        </n-button>
                        <n-button
                          size="tiny"
                          @click="cancelEdit"
                        >
                          取消
                        </n-button>
                      </div>
                    </div>
                  </template>

                  <!-- 显示模式 -->
                  <template v-else>
                    <span class="element-type-label">{{
                      getElementLabel(element.type)
                    }}</span>
                    <div class="element-content">
                      <template v-if="element.type === 'character'">
                        <strong>{{ element.content }}</strong>
                      </template>
                      <template v-else-if="element.type === 'dialogue'">
                        <span
                          v-if="element.character"
                          class="character-name"
                        >{{ element.character }}：</span>
                        <span>{{ element.content }}</span>
                      </template>
                      <template v-else-if="element.type === 'action'">
                        <em>[{{ element.content }}]</em>
                      </template>
                      <template v-else-if="element.type === 'voiceover'">
                        <span class="voiceover-mark">（画外音）</span>
                        <span>{{ element.content }}</span>
                      </template>
                      <template v-else>
                        {{ element.content }}
                      </template>
                    </div>
                    <div
                      v-if="!readonly"
                      class="element-actions"
                    >
                      <n-dropdown
                        :options="formatOptions"
                        @select="
                          addElement(
                            actIndex,
                            sceneIndex,
                            $event as SceneElement['type'],
                          )
                        "
                      >
                        <n-button
                          text
                          size="tiny"
                        >
                          +
                        </n-button>
                      </n-dropdown>
                      <n-button
                        text
                        size="tiny"
                        type="error"
                        @click.stop="
                          deleteElement(actIndex, sceneIndex, elementIndex)
                        "
                      >
                        ×
                      </n-button>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.script-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 400px;
}

.editor-toolbar {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(157, 138, 231, 0.1);
  background: rgba(255, 255, 255, 0.5);
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-secondary, #6b6690);

  p {
    margin-bottom: 16px;
  }
}

.acts-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.act-section {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  padding: 16px;
}

.act-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(157, 138, 231, 0.1);
}

.act-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0;
}

.scenes-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scene-section {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  padding: 12px;
}

.scene-header {
  margin-bottom: 12px;
}

.scene-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #1a1a1a);
  margin: 0 0 4px;
}

.scene-location {
  font-size: 12px;
  color: var(--color-text-secondary, #6b6690);
}

.scene-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.script-element {
  position: relative;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 8px;

  &:hover {
    background: rgba(157, 138, 231, 0.05);

    .element-actions {
      opacity: 1;
    }
  }

  &.stage {
    background: rgba(157, 138, 231, 0.1);
    font-weight: 500;
  }

  &.character {
    padding-left: 24px;
    color: var(--color-primary, #9d8ae7);
  }

  &.dialogue {
    padding-left: 48px;
  }

  &.action {
    padding-left: 24px;
    color: var(--color-text-secondary, #6b6690);
  }

  &.voiceover {
    padding-left: 24px;
    color: var(--color-text-tertiary, #a8a4c8);
    font-style: italic;
  }
}

.element-type-label {
  font-size: 11px;
  color: var(--color-text-tertiary, #a8a4c8);
  min-width: 40px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.element-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.6;

  .character-name {
    font-weight: 600;
    color: var(--color-primary, #9d8ae7);
  }

  .voiceover-mark {
    color: var(--color-text-tertiary, #a8a4c8);
    margin-right: 8px;
  }
}

.element-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.element-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editing-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-primary, #9d8ae7);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  font-family: inherit;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(157, 138, 231, 0.2);
  }
}

.edit-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

// 暗黑模式适配
[data-theme="dark"] {
  .editor-toolbar {
    background: rgba(16, 16, 32, 0.5);
    border-color: rgba(157, 78, 221, 0.15);
  }

  .act-section {
    background: rgba(16, 16, 32, 0.3);
  }

  .scene-section {
    background: rgba(16, 16, 32, 0.5);
  }

  .script-element {
    &:hover {
      background: rgba(157, 78, 221, 0.1);
    }

    &.stage {
      background: rgba(157, 78, 221, 0.15);
    }
  }

  .editing-textarea {
    background: rgba(16, 16, 32, 0.8);
    border-color: rgba(157, 78, 221, 0.3);
    color: #e0e0e0;
  }
}
</style>

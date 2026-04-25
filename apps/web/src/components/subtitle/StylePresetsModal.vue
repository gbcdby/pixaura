<template>
  <n-modal
    :show="show"
    preset="card"
    title="字幕样式预设"
    style="width: 700px; max-width: 90vw"
    @update:show="$emit('update:show', $event)"
  >
    <n-tabs
      v-model:value="activeTab"
      type="line"
    >
      <n-tab-pane
        name="system"
        tab="系统预设"
      >
        <div class="presets-grid">
          <div
            v-for="preset in systemPresets"
            :key="preset.id"
            class="preset-card"
            :class="{ default: preset.isDefault }"
          >
            <div
              class="preset-preview"
              :style="getPreviewStyle(preset)"
            >
              {{ preset.previewText || "字幕样式预览" }}
            </div>
            <div class="preset-info">
              <div class="preset-name">
                {{ preset.name }}
              </div>
              <div class="preset-desc">
                {{ preset.description }}
              </div>
            </div>
            <div class="preset-actions">
              <n-button
                size="small"
                @click="$emit('apply', preset.id)"
              >
                应用
              </n-button>
            </div>
          </div>
        </div>
      </n-tab-pane>

      <n-tab-pane
        name="user"
        tab="我的预设"
      >
        <div class="presets-grid">
          <div
            v-for="preset in userPresets"
            :key="preset.id"
            class="preset-card"
          >
            <div
              class="preset-preview"
              :style="getPreviewStyle(preset)"
            >
              {{ preset.previewText || "字幕样式预览" }}
            </div>
            <div class="preset-info">
              <div class="preset-name">
                {{ preset.name }}
              </div>
              <div class="preset-desc">
                {{ preset.description }}
              </div>
            </div>
            <div class="preset-actions">
              <n-button
                size="small"
                @click="$emit('apply', preset.id)"
              >
                应用
              </n-button>
              <n-dropdown
                :options="[
                  { label: '编辑', key: 'edit' },
                  { label: '删除', key: 'delete' },
                ]"
                @select="(key: string) => handleAction(key, preset)"
              >
                <n-button
                  size="small"
                  quaternary
                >
                  <template #icon>
                    <n-icon><EllipsisHorizontalOutline /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </div>
          </div>

          <div
            class="preset-card add-card"
            @click="handleCreate"
          >
            <div class="add-icon">
              <n-icon size="32">
                <AddOutline />
              </n-icon>
            </div>
            <div class="add-text">
              创建新预设
            </div>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- 创建/编辑预设模态框 -->
    <n-modal
      v-model:show="showEditModal"
      preset="card"
      :title="editingPreset ? '编辑预设' : '创建预设'"
      style="width: 500px"
    >
      <n-form
        :model="presetForm"
        label-placement="left"
        label-width="80"
      >
        <n-form-item
          label="名称"
          required
        >
          <n-input
            v-model:value="presetForm.name"
            placeholder="预设名称"
          />
        </n-form-item>
        <n-form-item label="描述">
          <n-input
            v-model:value="presetForm.description"
            type="textarea"
            :rows="2"
            placeholder="预设描述"
          />
        </n-form-item>
        <n-form-item label="预览文字">
          <n-input
            v-model:value="presetForm.previewText"
            placeholder="字幕样式预览"
          />
        </n-form-item>
        <n-form-item label="设为默认">
          <n-switch v-model:value="presetForm.isDefault" />
        </n-form-item>

        <n-divider>样式设置</n-divider>

        <n-form-item label="字体">
          <n-select
            v-model:value="presetForm.styleConfig.fontFamily"
            :options="fontOptions"
          />
        </n-form-item>
        <n-form-item label="字号">
          <n-slider
            v-model:value="presetForm.styleConfig.fontSize"
            :min="12"
            :max="72"
          />
        </n-form-item>
        <n-form-item label="颜色">
          <n-color-picker v-model:value="presetForm.styleConfig.color" />
        </n-form-item>
        <n-form-item label="描边">
          <n-space>
            <n-switch v-model:value="presetForm.styleConfig.outlineEnabled" />
            <n-color-picker
              v-if="presetForm.styleConfig.outlineEnabled"
              v-model:value="presetForm.styleConfig.outlineColor"
              size="small"
            />
            <n-input-number
              v-if="presetForm.styleConfig.outlineEnabled"
              v-model:value="presetForm.styleConfig.outlineWidth"
              :min="0"
              :max="5"
              size="small"
            />
          </n-space>
        </n-form-item>
        <n-form-item label="位置">
          <n-radio-group v-model:value="presetForm.styleConfig.position">
            <n-radio-button value="top">
              顶部
            </n-radio-button>
            <n-radio-button value="middle">
              中间
            </n-radio-button>
            <n-radio-button value="bottom">
              底部
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
        <n-form-item label="对齐">
          <n-radio-group v-model:value="presetForm.styleConfig.alignment">
            <n-radio-button value="left">
              左
            </n-radio-button>
            <n-radio-button value="center">
              中
            </n-radio-button>
            <n-radio-button value="right">
              右
            </n-radio-button>
          </n-radio-group>
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            @click="handleSave"
          >
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { AddOutline, EllipsisHorizontalOutline } from "@vicons/ionicons5";
import type {
  SubtitlePresetResponse,
  SubtitleExtendedStyle,
  CreateSubtitlePresetDto,
} from "@pixaura/shared-types";

interface Props {
  show: boolean;
  presets: SubtitlePresetResponse[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  apply: [presetId: string];
  create: [dto: CreateSubtitlePresetDto];
  edit: [presetId: string, dto: Partial<CreateSubtitlePresetDto>];
  delete: [presetId: string];
}>();

const activeTab = ref("system");
const showEditModal = ref(false);
const editingPreset = ref<SubtitlePresetResponse | null>(null);

const systemPresets = computed(() => props.presets.filter((p) => p.isSystem));
const userPresets = computed(() => props.presets.filter((p) => !p.isSystem));

const presetForm = ref<{
  name: string;
  description: string;
  previewText: string;
  isDefault: boolean;
  styleConfig: Partial<SubtitleExtendedStyle>;
}>({
  name: "",
  description: "",
  previewText: "字幕样式预览",
  isDefault: false,
  styleConfig: {
    fontFamily: "Noto Sans SC",
    fontSize: 24,
    color: "#FFFFFF",
    outlineEnabled: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    position: "bottom",
    alignment: "center",
  },
});

const fontOptions = [
  { label: "思源黑体", value: "Noto Sans SC" },
  { label: "微软雅黑", value: "Microsoft YaHei" },
  { label: "宋体", value: "SimSun" },
  { label: "黑体", value: "SimHei" },
  { label: "PingFang SC", value: "PingFang SC" },
];

function getPreviewStyle(preset: SubtitlePresetResponse) {
  const style = preset.styleConfig;
  return {
    fontFamily: style.fontFamily || "Noto Sans SC",
    fontSize: `${style.fontSize || 24}px`,
    color: style.color || "#FFFFFF",
    textShadow: style.outlineEnabled
      ? `${style.outlineColor || "#000"} 0 0 ${style.outlineWidth || 2}px`
      : "none",
    textAlign: (style.alignment || "center") as any,
    padding: "20px",
  };
}

function handleAction(key: string, preset: SubtitlePresetResponse) {
  if (key === "edit") {
    editingPreset.value = preset;
    presetForm.value = {
      name: preset.name,
      description: preset.description || "",
      previewText: (preset as any).previewText || "字幕样式预览",
      isDefault: preset.isDefault,
      styleConfig: { ...preset.styleConfig },
    };
    showEditModal.value = true;
  } else if (key === "delete") {
    emit("delete", preset.id);
  }
}

function handleCreate() {
  editingPreset.value = null;
  presetForm.value = {
    name: "",
    description: "",
    previewText: "字幕样式预览",
    isDefault: false,
    styleConfig: {
      fontFamily: "Noto Sans SC",
      fontSize: 24,
      color: "#FFFFFF",
      outlineEnabled: true,
      outlineColor: "#000000",
      outlineWidth: 2,
      position: "bottom",
      alignment: "center",
    },
  };
  showEditModal.value = true;
}

function handleSave() {
  const dto: CreateSubtitlePresetDto = {
    name: presetForm.value.name,
    description: presetForm.value.description,
    isDefault: presetForm.value.isDefault,
    styleConfig: presetForm.value.styleConfig as SubtitleExtendedStyle,
  };

  if (editingPreset.value) {
    emit("edit", editingPreset.value.id, dto);
  } else {
    emit("create", dto);
  }
  showEditModal.value = false;
}
</script>

<style scoped>
.presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding: 16px 0;
}

.preset-card {
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  background: #252525;
  transition: all 0.2s;
}

.preset-card:hover {
  border-color: #2080f0;
}

.preset-card.default {
  border-color: #f0a020;
}

.preset-preview {
  height: 80px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.preset-info {
  padding: 12px;
}

.preset-name {
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  margin-bottom: 4px;
}

.preset-desc {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-actions {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  border-top: 1px solid #333;
}

.preset-card.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  cursor: pointer;
  border-style: dashed;
}

.preset-card.add-card:hover {
  border-color: #2080f0;
  background: #2a2a2a;
}

.add-icon {
  color: #666;
  margin-bottom: 8px;
}

.add-text {
  font-size: 14px;
  color: #888;
}
</style>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NButton,
  NIcon,
  NImage,
  NTooltip,
  NEmpty,
  NAlert,
  NSelect,
  useDialog,
} from "naive-ui";
import {
  HandLeftOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from "@vicons/ionicons5";
import type {
  DetectedSubject,
  CharacterRegions,
  CharacterRegionConfig,
} from "@pixaura/shared-types";

/**
 * InlineCharacterRegionPanel - 内联角色框选面板组件
 * 直接在 MediaBlock 右侧展开显示，替代原来的弹窗模式
 */

// Bug #2: 角色颜色数组（与 MediaBlock.vue 保持一致）
const CHARACTER_COLORS = [
  "#2080f0", // 蓝色
  "#18a058", // 绿色
  "#f0a020", // 橙色
  "#d03050", // 红色
  "#8b5cf6", // 紫色
  "#06b6d4", // 青色
  "#f43f5e", // 粉红
  "#84cc16", // 黄绿
];

interface CharacterInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Props {
  /** 是否显示面板 */
  show: boolean;
  /** 分镜组 ID */
  shotGroupId: string;
  /** 出镜角色列表 */
  characters: CharacterInfo[];
  /** 检测到的主体列表 */
  detectedSubjects?: DetectedSubject[];
  /** 当前角色框选配置 */
  characterRegions: CharacterRegions;
  /** 检测状态 */
  detectionStatus?: "pending" | "processing" | "completed" | "failed";
  /** 是否正在检测 */
  isDetecting?: boolean;
  /** 是否只读模式 */
  isReadonly?: boolean;
  /** 主图是否存在（用于检测按钮状态） */
  mainImageExists?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  detectionStatus: "pending",
  isDetecting: false,
  isReadonly: false,
  mainImageExists: false,
  detectedSubjects: () => [],
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "trigger-detection", shotGroupId: string): void;
  (
    e: "update-region",
    shotGroupId: string,
    characterId: string,
    config: CharacterRegionConfig,
  ): void;
  // Bug-2 修复：添加 shotGroupId 参数
  (e: "open-manual-select", shotGroupId: string, characterId: string): void;
}>();

// 对话框实例（用于确认弹窗）
const dialog = useDialog();

// 本地状态
const localRegions = ref<CharacterRegions>({});

// 同步外部配置到本地
watch(
  () => props.characterRegions,
  (newRegions) => {
    localRegions.value = { ...newRegions };
  },
  { immediate: true, deep: true },
);

// 计算检测状态
const isDetectionFailed = computed(() => props.detectionStatus === "failed");

// 检测主体选项（用于下拉选择）
const subjectOptions = computed(() => {
  if (!props.detectedSubjects || props.detectedSubjects.length === 0) {
    return [];
  }
  return props.detectedSubjects.map((subject) => ({
    label: `主体 ${subject.index}`,
    value: subject.index,
    disabled: false,
  }));
});

// 获取角色对应的检测主体序号
function getDetectedIndex(characterId: string): number | undefined {
  return getCharacterConfig(characterId).detectedIndex;
}

// 处理主体选择变更
function handleSubjectChange(characterId: string, subjectIndex: number | null) {
  const currentConfig = getCharacterConfig(characterId);
  const newConfig: CharacterRegionConfig = {
    ...currentConfig,
    detectedIndex: subjectIndex || undefined,
    useManual: false,
  };

  // 更新本地状态
  localRegions.value[characterId] = newConfig;

  // 触发更新
  emit("update-region", props.shotGroupId, characterId, newConfig);
}

// 获取角色的框选配置
function getCharacterConfig(characterId: string): CharacterRegionConfig {
  return localRegions.value[characterId] || {};
}

// 处理手动框选
function handleManualSelect(characterId: string) {
  // Bug-2 修复：传递 shotGroupId，让父组件知道是哪个分镜组
  emit("open-manual-select", props.shotGroupId, characterId);
}

// 处理重置（添加确认弹窗）
function handleReset(characterId: string) {
  const character = props.characters.find(c => c.id === characterId);
  const characterName = character?.name || "该角色";

  dialog.warning({
    title: "确认清除",
    content: `确定要清除「${characterName}」的框选配置吗？此操作不可撤销。`,
    positiveText: "清除",
    negativeText: "取消",
    onPositiveClick: () => {
      const newConfig: CharacterRegionConfig = { useManual: false };
      localRegions.value[characterId] = newConfig;
      emit("update-region", props.shotGroupId, characterId, newConfig);
    },
  });
}

// 检查是否已配置（有坐标信息即为已配置）
function isConfigured(characterId: string): boolean {
  const config = getCharacterConfig(characterId);
  return !!(config.manualRegion || config.detectedIndex);
}

// 检查是否使用手动框选
function isUsingManual(characterId: string): boolean {
  return getCharacterConfig(characterId).useManual || false;
}

// Bug #2: 获取角色颜色（根据索引）
function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}

// Bug #2: 获取角色框选区域颜色（已配置时显示对应颜色）
function getCharacterBorderColor(characterId: string, index: number): string {
  if (isConfigured(characterId)) {
    return getCharacterColor(index);
  }
  return "transparent";
}
</script>

<template>
  <!-- 简化后的角色配置面板（无遮罩层，由父组件控制位置） -->
  <div
    v-if="show"
    class="inline-region-panel"
  >
    <!-- 头部 -->
    <div class="panel-header">
      <div class="header-title">
        <span>角色框选</span>
      </div>
      <!-- 头部按钮组：关闭按钮 -->
      <div class="header-actions">
        <!-- Bug-2: 注释掉自动检测按钮，改为关闭按钮 -->
        <!-- <n-button
          v-if="!isReadonly"
          type="primary"
          size="small"
          :disabled="!canDetect"
          :loading="isDetecting"
          @click="handleTriggerDetection"
        >
          <template #icon>
            <n-icon><ScanOutline /></n-icon>
          </template>
          {{ isDetecting ? '检测中...' : '自动检测' }}
        </n-button> -->
        <n-button
          type="default"
          size="small"
          circle
          :bordered="false"
          @click="emit('close')"
        >
          <template #icon>
            <n-icon><CloseCircleOutline /></n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <!-- 检测状态提示 -->
    <n-alert
      v-if="!mainImageExists"
      type="warning"
      class="status-alert"
    >
      请先生成分镜主图
    </n-alert>

    <n-alert
      v-else-if="isDetectionFailed"
      type="error"
      class="status-alert"
    >
      主体检测失败，请重试或使用手动框选
    </n-alert>

    <!-- 角色列表 -->
    <div class="character-list">
      <div
        v-if="characters.length === 0"
        class="empty-state"
      >
        <n-empty description="暂无出镜角色" />
      </div>

      <div
        v-for="(character, index) in characters"
        :key="character.id"
        class="character-item"
      >
        <!-- 角色信息 -->
        <!-- Bug #2: 已配置的角色显示对应颜色的边框 -->
        <div
          class="character-info"
          :style="{ borderLeftColor: getCharacterBorderColor(character.id, index) }"
        >
          <div class="character-avatar">
            <n-image
              v-if="character.avatarUrl"
              :src="character.avatarUrl"
              alt="头像"
              object-fit="cover"
            />
            <span
              v-else
              class="avatar-placeholder"
            >
              {{ character.name.charAt(0) }}
            </span>
          </div>
          <div class="character-name">
            {{ character.name }}
          </div>
          <div
            v-if="isConfigured(character.id)"
            class="configured-badge"
          >
            <n-icon color="#18a058">
              <CheckmarkCircleOutline />
            </n-icon>
            <span v-if="isUsingManual(character.id)">手动</span>
            <span v-else>已配置</span>
          </div>
        </div>

        <!-- 配置区域 -->
        <div class="character-config">
          <!-- 有检测结果时显示选择器 -->
          <template v-if="detectedSubjects && detectedSubjects.length > 0">
            <n-select
              :value="getDetectedIndex(character.id)"
              :options="subjectOptions"
              placeholder="选择主体"
              size="small"
              style="width: 100px"
              :disabled="isReadonly || isUsingManual(character.id)"
              clearable
              @update:value="(val) => handleSubjectChange(character.id, val)"
            />
          </template>

          <!-- 无检测结果时显示提示 -->
          <template v-else>
            <span class="no-subjects-hint">暂无检测</span>
          </template>

          <!-- 重置按钮 -->
          <n-tooltip v-if="isConfigured(character.id)">
            <template #trigger>
              <n-button
                size="small"
                quaternary
                :disabled="isReadonly"
                @click="handleReset(character.id)"
              >
                <template #icon>
                  <n-icon><CloseCircleOutline /></n-icon>
                </template>
              </n-button>
            </template>
            清除配置
          </n-tooltip>

          <!-- 手动框选按钮 -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="small"
                quaternary
                :disabled="isReadonly || !mainImageExists"
                @click="handleManualSelect(character.id)"
              >
                <template #icon>
                  <n-icon><HandLeftOutline /></n-icon>
                </template>
              </n-button>
            </template>
            手动框选
          </n-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// 简化后的面板样式（无固定定位，由父组件控制位置）
.inline-region-panel {
  width: 280px;
  flex-shrink: 0;
  padding: 12px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  // 确保面板不被右侧元素遮挡
  position: relative;
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  gap: 8px;

  .header-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.status-alert {
  padding: 6px 8px;
  font-size: 12px;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fafafa;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
  // Bug #2: 添加左边框用于显示框选颜色
  border-left: 3px solid transparent;
  padding-left: 8px;
  margin-left: -8px;
  transition: border-color 0.2s ease;

  .character-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-placeholder {
      font-size: 11px;
      font-weight: 600;
      color: #666;
    }

    :deep(.n-image) {
      width: 100%;
      height: 100%;
    }
  }

  .character-name {
    font-size: 13px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .configured-badge {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: #18a058;
    flex-shrink: 0;
  }
}

.character-config {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  .no-subjects-hint {
    font-size: 11px;
    color: #999;
  }
}

.empty-state {
  padding: 16px;
  text-align: center;
}
</style>

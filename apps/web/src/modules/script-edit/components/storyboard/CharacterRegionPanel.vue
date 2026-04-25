<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  NButton,
  NIcon,
  NImage,
  NSelect,
  NTooltip,
  NEmpty,
  NSpin,
  NAlert,
  NDivider,
  useDialog,
} from "naive-ui";
import {
  ScanOutline,
  HandLeftOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from "@vicons/ionicons5";
import type {
  DetectedSubject,
  CharacterRegions,
  CharacterRegionConfig,
} from "@pixaura/shared-types";
import RegionOverlay from "./RegionOverlay.vue";

/**
 * CharacterRegionPanel - 角色框选面板
 * 用于配置分镜组中每个角色对应的检测主体
 * 支持自动检测主体预览和手动框选
 */

interface CharacterInfo {
  id: string;
  name: string;
  avatarUrl?: string;
}

interface Props {
  /** 分镜组 ID */
  shotGroupId: string;
  /** 分镜组主图 URL */
  mainImageUrl?: string;
  /** 图片宽高比（如 "16:9"） */
  aspectRatio?: string;
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
  /** 紧凑模式：在分镜图参考中显示时使用简化布局（隐藏主图预览、隐藏使用说明） */
  compactMode?: boolean;
  /** 迷你模式：对话列表中使用，更精简的样式 */
  mini?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  aspectRatio: "16:9",
  detectionStatus: "pending",
  isDetecting: false,
  isReadonly: false,
  compactMode: false,
  mini: false,
});

const emit = defineEmits<{
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

// 计算是否可以自动检测
const canDetect = computed(() => {
  return (
    !props.isReadonly &&
    !props.isDetecting &&
    props.mainImageUrl &&
    props.detectionStatus !== "processing"
  );
});

// 计算检测状态
const isDetectionFailed = computed(() => props.detectionStatus === "failed");

// 获取角色的框选配置
function getCharacterConfig(characterId: string): CharacterRegionConfig {
  return localRegions.value[characterId] || {};
}

// 获取角色使用的框选区域（用于 RegionOverlay 显示）
function getCharacterRegion(characterId: string): { x: number; y: number; width: number; height: number } | undefined {
  const config = getCharacterConfig(characterId);
  if (config.useManual && config.manualRegion) {
    return config.manualRegion;
  }
  // 自动检测：根据 detectedIndex 获取对应主体的区域
  if (config.detectedIndex && props.detectedSubjects) {
    const subject = props.detectedSubjects.find(s => s.index === config.detectedIndex);
    if (subject?.region) {
      return subject.region;
    }
  }
  return undefined;
}

// 获取角色对应的检测主体序号
function getDetectedIndex(characterId: string): number | undefined {
  return getCharacterConfig(characterId).detectedIndex;
}

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

// 处理触发检测
function handleTriggerDetection() {
  emit("trigger-detection", props.shotGroupId);
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

// 处理手动框选
function handleManualSelect(characterId: string) {
  // Bug-2 修复：传递 shotGroupId
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

// 角色颜色数组
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

// 获取角色颜色
function getCharacterColor(index: number): string {
  return CHARACTER_COLORS[index % CHARACTER_COLORS.length];
}
</script>

<template>
  <div
    class="character-region-panel"
    :class="{ 'compact-mode': compactMode, 'mini-mode': mini }"
  >
    <!-- 头部：检测控制（紧凑模式/迷你模式简化标题） -->
    <div class="panel-header">
      <div class="header-title">
        <n-icon size="18">
          <ScanOutline />
        </n-icon>
        <span>{{ '角色框选' }}</span>
      </div>
      <!-- 迷你模式下隐藏检测按钮，紧凑模式显示简化按钮 -->
      <n-button
        v-if="!isReadonly && !mini"
        type="primary"
        size="small"
        :disabled="!canDetect"
        :loading="isDetecting"
        @click="handleTriggerDetection"
      >
        <template #icon>
          <n-icon><ScanOutline /></n-icon>
        </template>
        {{ compactMode ? (isDetecting ? '检测...' : '检测') : (isDetecting ? '检测中...' : '自动检测') }}
      </n-button>
    </div>

    <!-- 检测状态提示（紧凑模式/迷你模式下简化） -->
    <n-alert
      v-if="!mainImageUrl && !compactMode && !mini"
      type="warning"
      title="请先生成分镜主图"
      class="status-alert"
    >
      角色框选需要先生成分镜主图，系统将自动检测图片中的人物主体。
    </n-alert>

    <n-alert
      v-else-if="!mainImageUrl && compactMode"
      type="warning"
      class="status-alert compact-alert"
    >
      请先生成分镜主图
    </n-alert>

    <n-alert
      v-else-if="isDetectionFailed && !mini"
      type="error"
      :title="compactMode ? '' : '检测失败'"
      class="status-alert"
    >
      {{ compactMode ? '检测失败，请重试' : '主体检测失败，请重试或使用手动框选。' }}
    </n-alert>

    <!-- 主图预览（紧凑模式/迷你模式下隐藏，因为分镜图已在上方显示） -->
    <div
      v-if="mainImageUrl && !compactMode && !mini"
      class="main-image-preview"
      :style="{ aspectRatio: aspectRatio }"
    >
      <n-image
        :src="mainImageUrl"
        alt="分镜主图"
        object-fit="cover"
        class="preview-image"
      />
      <!-- 检测到的主体框选区域 -->
      <template v-if="detectedSubjects && detectedSubjects.length > 0">
        <RegionOverlay
          v-for="subject in detectedSubjects"
          :key="subject.index"
          :region="subject.region"
          :is-manual="false"
          :label="`主体 ${subject.index}`"
          :show-label="true"
        />
      </template>
      <!-- 已配置的角色框选区域 -->
      <template v-for="(character, index) in characters" :key="character.id">
        <RegionOverlay
          v-if="getCharacterRegion(character.id)"
          :region="getCharacterRegion(character.id)!"
          :is-manual="isUsingManual(character.id)"
          :label="character.name"
          :show-label="true"
          :color="getCharacterColor(index)"
        />
      </template>
      <div
        v-if="isDetecting"
        class="detecting-overlay"
      >
        <n-spin size="medium" />
        <span>正在检测主体...</span>
      </div>
    </div>

    <!-- 分隔线（紧凑模式/迷你模式下隐藏） -->
    <n-divider v-if="!compactMode && !mini" />

    <!-- 角色列表 -->
    <div
      class="character-list"
      :class="{ 'mini-list': mini }"
    >
      <div
        v-if="characters.length === 0"
        class="empty-state"
      >
        <n-empty description="暂无出镜角色" />
      </div>

      <div
        v-for="character in characters"
        :key="character.id"
        class="character-item"
        :class="{ 'mini-item': mini }"
      >
        <!-- 角色信息 -->
        <div class="character-info">
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
              placeholder="选择检测主体"
              size="small"
              style="width: 140px"
              :disabled="isReadonly || isUsingManual(character.id)"
              clearable
              @update:value="(val) => handleSubjectChange(character.id, val)"
            />
          </template>

          <!-- 无检测结果时显示提示 -->
          <template v-else>
            <span class="no-subjects-hint">暂无检测结果</span>
          </template>

          <!-- 手动框选按钮 -->
          <n-tooltip>
            <template #trigger>
              <n-button
                size="small"
                quaternary
                :disabled="isReadonly || !mainImageUrl"
                @click="handleManualSelect(character.id)"
              >
                <template #icon>
                  <n-icon><HandLeftOutline /></n-icon>
                </template>
                手动框选
              </n-button>
            </template>
            在图片上手动框选角色区域
          </n-tooltip>

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
        </div>

        <!-- 框选区域预览（使用坐标渲染） -->
        <div
          v-if="getCharacterRegion(character.id)"
          class="mask-preview"
        >
          <div class="region-preview-wrapper">
            <n-image
              :src="mainImageUrl"
              alt="分镜图"
              object-fit="cover"
              class="preview-image"
            />
            <RegionOverlay
              :region="getCharacterRegion(character.id)!"
              :is-manual="isUsingManual(character.id)"
              :label="character.name"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 使用说明（紧凑模式/迷你模式下隐藏） -->
    <div
      v-if="!compactMode && !mini"
      class="help-section"
    >
      <h4>使用说明</h4>
      <ol>
        <li>点击"自动检测"按钮，系统将自动识别分镜图中的人物主体</li>
        <li>在下拉菜单中为每个角色选择对应的检测主体</li>
        <li>如果自动检测结果不准确，可使用"手动框选"功能</li>
        <li>配置完成后，生成对口型视频时会使用选择的区域</li>
      </ol>
    </div>
  </div>
</template>

<style scoped lang="scss">
.character-region-panel {
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e8e8e8;

  // 紧凑模式样式
  &.compact-mode {
    padding: 12px;
    border-radius: 8px;

    .panel-header {
      margin-bottom: 12px;

      .header-title {
        font-size: 13px;
      }
    }

    .character-item {
      padding: 8px;
      gap: 8px;
    }

    .character-info {
      min-width: 100px;
    }

    .status-alert.compact-alert {
      margin-bottom: 8px;
      padding: 6px 8px;
      font-size: 12px;
    }
  }

  // 迷你模式样式
  &.mini-mode {
    padding: 8px;
    border-radius: 6px;

    .panel-header {
      margin-bottom: 8px;

      .header-title {
        font-size: 12px;

        .n-icon {
          font-size: 14px;
        }
      }
    }

    .character-list.mini-list {
      gap: 6px;
    }

    .character-item.mini-item {
      padding: 6px;
      gap: 6px;
      background: #f5f5f5;
      border-radius: 4px;

      .character-info {
        min-width: 80px;

        .character-avatar {
          width: 24px;
          height: 24px;

          .avatar-placeholder {
            font-size: 12px;
          }
        }

        .character-name {
          font-size: 12px;
        }

        .configured-badge {
          font-size: 11px;
        }
      }

      .character-config {
        gap: 4px;

        .no-subjects-hint {
          font-size: 11px;
        }
      }

      // 迷你模式下隐藏 Mask 预览
      .mask-preview {
        display: none;
      }
    }
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }
}

.status-alert {
  margin-bottom: 16px;
}

.main-image-preview {
  position: relative;
  width: 100%;
  max-height: 200px;
  // aspect-ratio 由内联 style 动态注入
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .detecting-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    font-size: 14px;
  }
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.character-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fafafa;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 120px;

  .character-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: center;

    .avatar-placeholder {
      font-size: 14px;
      font-weight: 600;
      color: #666;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .character-name {
    font-size: 14px;
    font-weight: 500;
    color: #333;
  }

  .configured-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #18a058;
  }
}

.character-config {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;

  .no-subjects-hint {
    font-size: 13px;
    color: #999;
  }
}

.mask-preview {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  background: #f0f0f0;

  .mask-image {
    width: 100%;
    height: 100%;
  }

  .region-preview-wrapper {
    position: relative;
    width: 100%;
    height: 100%;

    .preview-image {
      width: 100%;
      height: 100%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }
}

.empty-state {
  padding: 24px;
  text-align: center;
}

.help-section {
  margin-top: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;

  h4 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: #666;
  }

  ol {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #888;
    line-height: 1.8;
  }
}
</style>

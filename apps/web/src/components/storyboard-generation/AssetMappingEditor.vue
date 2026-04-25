<template>
  <div class="asset-mapping-editor">
    <!-- 角色映射 -->
    <div
      v-if="mappings.characters.length > 0"
      class="mapping-section"
    >
      <div class="section-title">
        角色映射
      </div>
      <div class="mapping-list">
        <div
          v-for="mapping in mappings.characters"
          :key="mapping.id"
          class="mapping-item"
          :class="{ 'is-corrected': mapping.isCorrected }"
        >
          <div class="mapping-info">
            <div class="detected-name">
              <span class="label">AI识别:</span>
              <span class="name">{{ mapping.detectedName }}</span>
              <n-tag
                v-if="mapping.confidence < 0.7"
                size="tiny"
                type="warning"
              >
                置信度 {{ Math.round(mapping.confidence * 100) }}%
              </n-tag>
            </div>
            <div class="mapped-asset">
              <span class="label">当前映射:</span>
              <span
                v-if="getMappedAsset(mapping)"
                class="asset-name"
              >
                {{ getMappedAsset(mapping)?.name }}
              </span>
              <span
                v-else
                class="unmapped"
              >未映射</span>
            </div>
          </div>
          <n-button
            size="small"
            @click="handleCorrect('character', mapping)"
          >
            {{ getMappedAsset(mapping) ? "修改" : "映射" }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- 场景映射 -->
    <div
      v-if="mappings.scenes.length > 0"
      class="mapping-section"
    >
      <div class="section-title">
        场景映射
      </div>
      <div class="mapping-list">
        <div
          v-for="mapping in mappings.scenes"
          :key="mapping.id"
          class="mapping-item"
          :class="{ 'is-corrected': mapping.isCorrected }"
        >
          <div class="mapping-info">
            <div class="detected-name">
              <span class="label">AI识别:</span>
              <span class="name">{{ mapping.detectedName }}</span>
              <n-tag
                v-if="mapping.confidence < 0.7"
                size="tiny"
                type="warning"
              >
                置信度 {{ Math.round(mapping.confidence * 100) }}%
              </n-tag>
            </div>
            <div class="mapped-asset">
              <span class="label">当前映射:</span>
              <span
                v-if="getMappedAsset(mapping)"
                class="asset-name"
              >
                {{ getMappedAsset(mapping)?.name }}
              </span>
              <span
                v-else
                class="unmapped"
              >未映射</span>
            </div>
          </div>
          <n-button
            size="small"
            @click="handleCorrect('scene', mapping)"
          >
            {{ getMappedAsset(mapping) ? "修改" : "映射" }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- 道具映射 -->
    <div
      v-if="mappings.props.length > 0"
      class="mapping-section"
    >
      <div class="section-title">
        道具映射
      </div>
      <div class="mapping-list">
        <div
          v-for="mapping in mappings.props"
          :key="mapping.id"
          class="mapping-item"
          :class="{ 'is-corrected': mapping.isCorrected }"
        >
          <div class="mapping-info">
            <div class="detected-name">
              <span class="label">AI识别:</span>
              <span class="name">{{ mapping.detectedName }}</span>
              <n-tag
                v-if="mapping.confidence < 0.7"
                size="tiny"
                type="warning"
              >
                置信度 {{ Math.round(mapping.confidence * 100) }}%
              </n-tag>
            </div>
            <div class="mapped-asset">
              <span class="label">当前映射:</span>
              <span
                v-if="getMappedAsset(mapping)"
                class="asset-name"
              >
                {{ getMappedAsset(mapping)?.name }}
              </span>
              <span
                v-else
                class="unmapped"
              >未映射</span>
            </div>
          </div>
          <n-button
            size="small"
            @click="handleCorrect('prop', mapping)"
          >
            {{ getMappedAsset(mapping) ? "修改" : "映射" }}
          </n-button>
        </div>
      </div>
    </div>

    <!-- 校正弹窗 -->
    <n-modal
      v-model:show="showCorrectionModal"
      :title="`校正${correctionTypeName}映射`"
      preset="card"
      style="width: 600px"
    >
      <div
        v-if="currentMapping"
        class="correction-modal"
      >
        <div class="current-mapping-info">
          <div class="info-row">
            <span class="label">识别名称:</span>
            <span class="value">{{ currentMapping.detectedName }}</span>
          </div>
          <div class="info-row">
            <span class="label">置信度:</span>
            <n-progress
              :percentage="Math.round(currentMapping.confidence * 100)"
              :indicator-placement="'inside'"
              style="width: 200px"
            />
          </div>
          <div class="info-row">
            <span class="label">当前映射:</span>
            <span class="value">
              {{ getMappedAsset(currentMapping)?.name || "未映射" }}
            </span>
          </div>
        </div>

        <n-divider />

        <div class="asset-selection">
          <div class="selection-header">
            <span>选择{{ correctionTypeName }}</span>
            <n-input
              v-model:value="searchQuery"
              placeholder="搜索..."
              size="small"
              clearable
              style="width: 200px"
            >
              <template #prefix>
                <n-icon :component="Search" />
              </template>
            </n-input>
          </div>

          <div class="asset-grid">
            <div
              v-for="asset in filteredAssets"
              :key="asset.id"
              class="asset-card"
              :class="{
                'is-selected': selectedAssetId === asset.id,
                'is-current': getMappedAsset(currentMapping)?.id === asset.id,
              }"
              @click="selectedAssetId = asset.id"
            >
              <div class="asset-avatar">
                <n-image
                  v-if="asset.avatar || asset.image_url"
                  :src="asset.avatar || asset.image_url"
                  object-fit="cover"
                />
                <n-icon
                  v-else
                  :component="getAssetIcon()"
                />
              </div>
              <div class="asset-name">
                {{ asset.name }}
              </div>
              <div
                v-if="asset.type"
                class="asset-type"
              >
                {{ asset.type }}
              </div>
            </div>
          </div>

          <n-empty
            v-if="filteredAssets.length === 0"
            description="暂无资产"
          />
        </div>

        <n-divider />

        <div class="correction-reason">
          <span class="label">校正原因（可选）:</span>
          <n-select
            v-model:value="correctionReason"
            :options="reasonOptions"
            placeholder="选择校正原因"
            clearable
          />
        </div>

        <div class="modal-actions">
          <n-button @click="showCorrectionModal = false">
            取消
          </n-button>
          <n-button
            type="error"
            ghost
            @click="handleClearMapping"
          >
            取消映射
          </n-button>
          <n-button
            type="primary"
            :disabled="!selectedAssetId"
            @click="handleConfirmCorrection"
          >
            确认校正
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  NButton,
  NTag,
  NModal,
  NProgress,
  NInput,
  NIcon,
  NDivider,
  NSelect,
  NEmpty,
  NImage,
} from "naive-ui";
import { Search, Person, Location, Cube } from "@vicons/ionicons5";
import type { AssetMapping } from "@pixaura/shared-types";

interface Asset {
  id: string;
  name: string;
  avatar?: string;
  image_url?: string;
  type?: string;
}

const props = defineProps<{
  mappings: {
    characters: AssetMapping[];
    scenes: AssetMapping[];
    props: AssetMapping[];
  };
  availableAssets: {
    characters: Asset[];
    scenes: Asset[];
    props: Asset[];
  };
}>();

const emit = defineEmits<{
  correct: [mappingId: string, assetId: string | null, reason?: string];
}>();

// 校正弹窗状态
const showCorrectionModal = ref(false);
const correctionType = ref<"character" | "scene" | "prop">("character");
const currentMapping = ref<AssetMapping | null>(null);
const selectedAssetId = ref<string | null>(null);
const searchQuery = ref("");
const correctionReason = ref<string | null>(null);

const correctionTypeName = computed(() => {
  const names: Record<string, string> = {
    character: "角色",
    scene: "场景",
    prop: "道具",
  };
  return names[correctionType.value] || "";
});

const filteredAssets = computed(() => {
  const key = `${correctionType.value}s` as keyof typeof props.availableAssets;
  const assets = props.availableAssets[key] || [];
  if (!searchQuery.value) return assets;
  const query = searchQuery.value.toLowerCase();
  return assets.filter(
    (asset) =>
      asset.name.toLowerCase().includes(query) ||
      (asset.type && asset.type.toLowerCase().includes(query)),
  );
});

const reasonOptions = [
  { label: "AI识别错误", value: "ai_error" },
  { label: "资产不存在", value: "asset_not_found" },
  { label: "映射不准确", value: "inaccurate" },
  { label: "其他", value: "other" },
];

function getMappedAsset(mapping: AssetMapping): Asset | null {
  const assetId = mapping.correctedAssetId || mapping.matchedAssetId;
  if (!assetId) return null;

  const typeKey = correctionType.value;
  let assets: Asset[] = [];
  if (typeKey === "character") {
    assets = props.availableAssets.characters;
  } else if (typeKey === "scene") {
    assets = props.availableAssets.scenes;
  } else if (typeKey === "prop") {
    assets = props.availableAssets.props;
  }
  return assets.find((a) => a.id === assetId) || null;
}

function getAssetIcon() {
  switch (correctionType.value) {
    case "character":
      return Person;
    case "scene":
      return Location;
    case "prop":
      return Cube;
    default:
      return Cube;
  }
}

function handleCorrect(
  type: "character" | "scene" | "prop",
  mapping: AssetMapping,
) {
  correctionType.value = type;
  currentMapping.value = mapping;
  selectedAssetId.value =
    mapping.correctedAssetId || mapping.matchedAssetId || null;
  searchQuery.value = "";
  correctionReason.value = null;
  showCorrectionModal.value = true;
}

function handleClearMapping() {
  if (!currentMapping.value) return;
  emit(
    "correct",
    currentMapping.value.id,
    null,
    correctionReason.value || undefined,
  );
  showCorrectionModal.value = false;
}

function handleConfirmCorrection() {
  if (!currentMapping.value || !selectedAssetId.value) return;
  emit(
    "correct",
    currentMapping.value.id,
    selectedAssetId.value,
    correctionReason.value || undefined,
  );
  showCorrectionModal.value = false;
}
</script>

<style scoped lang="scss">
.asset-mapping-editor {
  .mapping-section {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--text-color);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--divider-color);
    }

    .mapping-list {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .mapping-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: var(--fill-color);
        border-radius: 8px;
        border-left: 3px solid transparent;
        transition: all 0.3s;

        &.is-corrected {
          border-left-color: var(--primary-color);
        }

        .mapping-info {
          flex: 1;

          .detected-name,
          .mapped-asset {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;

            &:last-child {
              margin-bottom: 0;
            }

            .label {
              font-size: 12px;
              color: var(--text-color-3);
              min-width: 60px;
            }

            .name {
              font-weight: 500;
              color: var(--text-color);
            }

            .asset-name {
              color: var(--primary-color);
            }

            .unmapped {
              color: var(--text-color-3);
              font-style: italic;
            }
          }
        }
      }
    }
  }
}

.correction-modal {
  .current-mapping-info {
    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }

      .label {
        font-size: 13px;
        color: var(--text-color-3);
        min-width: 80px;
      }

      .value {
        font-weight: 500;
        color: var(--text-color);
      }
    }
  }

  .asset-selection {
    .selection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-weight: 500;
    }

    .asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
      max-height: 300px;
      overflow-y: auto;

      .asset-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px;
        background: var(--fill-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;
        border: 2px solid transparent;

        &:hover {
          background: var(--hover-color);
        }

        &.is-selected {
          border-color: var(--primary-color);
          background: var(--primary-color-fade);
        }

        &.is-current {
          position: relative;

          &::after {
            content: "当前";
            position: absolute;
            top: 4px;
            right: 4px;
            font-size: 10px;
            padding: 2px 6px;
            background: var(--primary-color);
            color: white;
            border-radius: 4px;
          }
        }

        .asset-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--card-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;

          :deep(img) {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .n-icon {
            font-size: 24px;
            color: var(--text-color-3);
          }
        }

        .asset-name {
          font-size: 12px;
          text-align: center;
          color: var(--text-color);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .asset-type {
          font-size: 11px;
          color: var(--text-color-3);
          margin-top: 4px;
        }
      }
    }
  }

  .correction-reason {
    margin-bottom: 16px;

    .label {
      display: block;
      font-size: 13px;
      color: var(--text-color-3);
      margin-bottom: 8px;
    }
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>

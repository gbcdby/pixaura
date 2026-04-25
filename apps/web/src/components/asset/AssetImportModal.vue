<script setup lang="ts">
import { ref, computed, h } from "vue";
import {
  NModal,
  NButton,
  NSpace,
  NIcon,
  NRadioGroup,
  NRadio,
  NAlert,
  NDivider,
  NTag,
  NSpin,
  NList,
  NListItem,
  NThing,
} from "naive-ui";
import {
  WarningOutline,
  CheckmarkCircleOutline,
  InformationCircleOutline,
  PersonOutline,
  ImageOutline,
  CubeOutline,
} from "@vicons/ionicons5";
import type {
  AssetSummaryDto,
  ImportConflictDto,
  ConflictHandling,
  LibraryAssetType,
} from "@pixaura/shared-types";

interface Props {
  show: boolean;
  assets: AssetSummaryDto[];
  conflicts?: ImportConflictDto[];
  targetProjectName?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  conflicts: () => [],
  targetProjectName: "",
  loading: false,
});

const emit = defineEmits<{
  (e: "update:show", show: boolean): void;
  (e: "confirm", conflictHandling: ConflictHandling): void;
  (e: "cancel"): void;
  (e: "close"): void;
}>();

// 冲突处理方式
const conflictHandling = ref<ConflictHandling>("rename");

// 冲突处理选项
const conflictOptions = [
  {
    value: "skip" as ConflictHandling,
    label: "跳过",
    description: "保留现有资产，跳过冲突项",
  },
  {
    value: "rename" as ConflictHandling,
    label: "重命名",
    description: "为新导入的资产自动重命名",
  },
  {
    value: "replace" as ConflictHandling,
    label: "替换",
    description: "用新资产替换现有资产（不可恢复）",
  },
];

// 资产类型映射
const assetTypeMap: Record<
  LibraryAssetType,
  { label: string; icon: ReturnType<typeof h> }
> = {
  character: {
    label: "角色",
    icon: h(NIcon, null, { default: () => h(PersonOutline) }),
  },
  scene: {
    label: "场景",
    icon: h(NIcon, null, { default: () => h(ImageOutline) }),
  },
  prop: {
    label: "道具",
    icon: h(NIcon, null, { default: () => h(CubeOutline) }),
  },
};

// 冲突资产ID集合
const conflictAssetIds = computed(
  () => new Set(props.conflicts.map((c) => c.assetId)),
);

// 是否有冲突
const hasConflicts = computed(() => props.conflicts.length > 0);

// 冲突数量
const conflictCount = computed(() => props.conflicts.length);

// 处理确认导入
const handleConfirm = () => {
  emit("confirm", conflictHandling.value);
};

// 处理取消
const handleCancel = () => {
  emit("update:show", false);
  emit("cancel");
};

// 处理关闭
const handleClose = () => {
  emit("update:show", false);
  emit("close");
};

// 获取冲突信息
const getConflictInfo = (assetId: string) => {
  return props.conflicts.find((c) => c.assetId === assetId);
};
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    class="import-modal"
    title="导入资产"
    style="width: 600px; max-width: 90vw"
    :bordered="false"
    :segmented="{ content: 'soft' }"
    :mask-closable="!loading"
    :closable="!loading"
    @close="handleClose"
    @update:show="handleClose"
  >
    <div class="import-modal-content">
      <!-- 目标项目信息 -->
      <n-alert
        v-if="targetProjectName"
        type="info"
        :show-icon="false"
        class="target-info"
      >
        <template #header>
          <div class="target-header">
            <n-icon size="18">
              <InformationCircleOutline />
            </n-icon>
            <span>导入目标</span>
          </div>
        </template>
        将导入到项目：<strong>{{ targetProjectName }}</strong>
      </n-alert>

      <!-- 冲突警告 -->
      <n-alert
        v-if="hasConflicts"
        type="warning"
        class="conflict-warning"
      >
        <template #header>
          <div class="conflict-header">
            <n-icon size="18">
              <WarningOutline />
            </n-icon>
            <span>检测到 {{ conflictCount }} 个命名冲突</span>
          </div>
        </template>
        以下资产在目标项目中已存在同名项，请选择处理方式
      </n-alert>

      <!-- 冲突处理 -->
      <div
        v-if="hasConflicts"
        class="conflict-options"
      >
        <n-divider title-placement="left">
          冲突处理方式
        </n-divider>

        <n-radio-group
          v-model:value="conflictHandling"
          class="options-group"
        >
          <n-space vertical>
            <n-radio
              v-for="option in conflictOptions"
              :key="option.value"
              :value="option.value"
            >
              <div class="option-content">
                <span class="option-label">{{ option.label }}</span>
                <span class="option-desc">{{ option.description }}</span>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <!-- 资产列表 -->
      <div class="assets-section">
        <n-divider title-placement="left">
          待导入资产 ({{ assets.length }})
        </n-divider>

        <!-- 加载状态 -->
        <div
          v-if="loading"
          class="loading-wrapper"
        >
          <n-spin size="large" />
          <p class="loading-text">
            正在导入中...
          </p>
        </div>

        <!-- 资产列表 -->
        <n-list
          v-else
          class="assets-list"
        >
          <n-list-item
            v-for="asset in assets"
            :key="asset.id"
            class="asset-item"
            :class="{ conflict: conflictAssetIds.has(asset.id) }"
          >
            <n-thing
              :title="asset.name"
              :description="asset.projectName"
            >
              <template #avatar>
                <div
                  class="asset-avatar"
                  :style="
                    asset.thumbnailUrl
                      ? { backgroundImage: `url(${asset.thumbnailUrl})` }
                      : {}
                  "
                >
                  <span v-if="!asset.thumbnailUrl">{{
                    assetTypeMap[asset.type]?.label?.[0] || "?"
                  }}</span>
                </div>
              </template>

              <template #header-extra>
                <n-space>
                  <n-tag
                    size="small"
                    :type="
                      conflictAssetIds.has(asset.id) ? 'warning' : 'success'
                    "
                    round
                  >
                    {{ assetTypeMap[asset.type]?.label || asset.type }}
                  </n-tag>

                  <n-tag
                    v-if="conflictAssetIds.has(asset.id)"
                    size="small"
                    type="warning"
                    round
                  >
                    <template #icon>
                      <n-icon><WarningOutline /></n-icon>
                    </template>
                    冲突
                  </n-tag>
                </n-space>
              </template>

              <template
                v-if="conflictAssetIds.has(asset.id)"
                #description
              >
                <div class="conflict-detail">
                  <n-icon size="14">
                    <WarningOutline />
                  </n-icon>
                  <span>与 "{{ getConflictInfo(asset.id)?.existingAsset.name }}"
                    命名冲突</span>
                </div>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </div>
    </div>

    <template #footer>
      <n-space
        justify="end"
        :size="12"
      >
        <n-button
          class="btn-cancel"
          :disabled="loading"
          @click="handleCancel"
        >
          取消
        </n-button>

        <n-button
          class="btn-confirm"
          type="primary"
          :loading="loading"
          @click="handleConfirm"
        >
          <template #icon>
            <n-icon><CheckmarkCircleOutline /></n-icon>
          </template>
          确认导入 ({{ assets.length }})
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped lang="scss">
// 弹窗整体
:deep(.import-modal.n-card) {
  border-radius: 16px;
  --n-border-radius: 16px !important;
  overflow: hidden;
}

:deep(.import-modal .n-card-header) {
  padding: 20px 24px 16px;
  font-weight: 600;
  font-size: 16px;
}

:deep(.n-card__content) {
  padding: 0 24px 16px;
}

:deep(.n-card__footer) {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f5;
}

.import-modal-content {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: #e0e0e5;
    border-radius: 3px;
  }
}

.target-info {
  margin-bottom: 16px;
  border-radius: 10px;
  overflow: hidden;

  .target-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }
}

.conflict-warning {
  margin-bottom: 16px;
  border-radius: 10px;
  overflow: hidden;

  .conflict-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 14px;
  }
}

.conflict-options {
  margin-bottom: 16px;

  .options-group {
    padding: 0 8px;
  }

  .option-content {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .option-label {
      font-weight: 600;
      font-size: 14px;
      color: #333;
    }

    .option-desc {
      font-size: 12px;
      color: #888;
    }
  }
}

.assets-section {
  .loading-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px 0;

    .loading-text {
      margin-top: 12px;
      color: #999;
      font-size: 14px;
    }
  }
}

.assets-list {
  .asset-item {
    transition: background 0.2s;
    border-radius: 10px;
    margin-bottom: 8px;
    overflow: hidden;

    &:hover {
      background: #fafafc;
    }

    &.conflict {
      background: #fffbf0;

      &:hover {
        background: #fff8e0;
      }
    }

    .asset-avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .conflict-detail {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #f0a020;
      font-size: 12px;
      margin-top: 4px;
    }
  }
}

.btn-cancel {
  border-radius: 10px;
  height: 36px;
  padding: 0 16px;
}

.btn-confirm {
  border-radius: 10px;
  height: 36px;
  padding: 0 20px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(32, 128, 240, 0.25);
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(32, 128, 240, 0.35);
  }
}
</style>

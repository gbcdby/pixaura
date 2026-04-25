<script setup lang="ts">
/**
 * 从项目导入资产弹窗组件
 *
 * 功能：
 * - 资产卡片网格展示（缩略图、名称、描述）
 * - 搜索框（按名称搜索）
 * - 多选批量导入
 * - 已关联资产显示"已关联"标记（灰色禁用）
 * - 确认按钮显示已选数量
 */
import { ref, watch, computed } from "vue";
import {
  NModal,
  NButton,
  NInput,
  NSpin,
  NEmpty,
  NSpace,
  NIcon,
  useMessage,
} from "naive-ui";
import { Search, User, Image as ImageIcon, Box } from "lucide-vue-next";
import { characterApi } from "@/modules/character/api";
import { sceneApi } from "@/modules/scene/api";
import { propApi } from "@/modules/prop/api";
import { useScriptEditStore } from "../store/scriptEdit";
import type { AssetType } from "../store/types";

// Props 定义
interface Props {
  show: boolean;
  projectId: string;
  scriptId: string;
  assetType: AssetType; // 'character' | 'scene' | 'prop'
  // 已关联的资产 ID 列表（用于标记已关联状态）
  linkedAssetIds: string[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "success"): void;
}>();

const message = useMessage();
const scriptEditStore = useScriptEditStore();

// 本地状态
const searchQuery = ref("");
const loading = ref(false);
const importing = ref(false);
const selectedIds = ref<string[]>([]);
const assetList = ref<
  Array<{
    id: string;
    name: string;
    description: string | null;
    coverUrl: string | null;
  }>
>([]);

// 类型标签映射
const typeLabelMap: Record<AssetType, string> = {
  character: "角色",
  scene: "场景",
  prop: "道具",
};

// 标题
const modalTitle = computed(() => `从项目导入${typeLabelMap[props.assetType]}`);

// 监听弹窗显示，加载资产列表
watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      selectedIds.value = [];
      searchQuery.value = "";
      await loadAssets();
    }
  },
);

// 加载项目资产列表
async function loadAssets() {
  loading.value = true;
  try {
    // API 返回类型包含 list 和 pagination，需要正确处理
    interface ApiResponse<T> {
      list: T[];
      pagination: { page: number; pageSize: number; total: number; totalPages: number };
    }

    interface AssetItem {
      id: string;
      name: string;
      description?: string | null;
      images?: Array<{ url: string; thumbnailUrl?: string }>;
      coverUrl?: string | null;
    }

    let assetItems: AssetItem[];
    if (props.assetType === "character") {
      const res = await characterApi.queryCharacters(props.projectId, {
        page: 1,
        pageSize: 50,
        sortBy: "createdAt",
        sortOrder: "desc",
      }) as unknown as ApiResponse<AssetItem>;
      assetItems = res.list;
    } else if (props.assetType === "scene") {
      const res = await sceneApi.queryScenes(props.projectId, {
        page: 1,
        pageSize: 50,
        sortBy: "createdAt",
        sortOrder: "desc",
      }) as unknown as ApiResponse<AssetItem>;
      assetItems = res.list;
    } else {
      const res = await propApi.queryProps(props.projectId, {
        page: 1,
        pageSize: 50,
        sortBy: "createdAt",
        sortOrder: "desc",
      }) as unknown as ApiResponse<AssetItem>;
      assetItems = res.list;
    }

    // 后端 images 是对象（frontView/panorama 等），不是数组，需按类型取主图
    function getCoverImage(item: AssetItem): string | null {
      const images = item.images as Record<string, { thumbnailUrl?: string | null; url?: string } | undefined> | undefined;
      if (!images) return null;

      if (props.assetType === "character") {
        // 角色：优先用正面图
        return images.frontView?.thumbnailUrl || images.frontView?.url || null;
      } else if (props.assetType === "scene") {
        // 场景：优先用全景图
        return images.panorama?.thumbnailUrl || images.wideShot?.thumbnailUrl || null;
      } else {
        // 道具：正面图
        return images.frontView?.thumbnailUrl || null;
      }
    }

    // 转换数据格式
    assetList.value = assetItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description || null,
      coverUrl: getCoverImage(item),
    }));
  } catch (error) {
    console.error("加载资产列表失败:", error);
    message.error("加载资产列表失败");
    assetList.value = [];
  } finally {
    loading.value = false;
  }
}

// 过滤后的资产列表（按搜索词过滤）
const filteredAssets = computed(() => {
  if (!searchQuery.value) return assetList.value;
  const query = searchQuery.value.toLowerCase();
  return assetList.value.filter((asset) =>
    asset.name.toLowerCase().includes(query),
  );
});

// 可选（未关联）的资产数量
const selectableCount = computed(() =>
  filteredAssets.value.filter((a) => !isLinked(a.id)).length,
);

// 是否已全部选中
const isAllSelected = computed(() =>
  selectableCount.value > 0 && selectedIds.value.length === selectableCount.value,
);

// 检查资产是否已关联
function isLinked(assetId: string): boolean {
  return props.linkedAssetIds.includes(assetId);
}

// 切换选中状态
function toggleSelection(assetId: string) {
  // 已关联的资产不允许选择
  if (isLinked(assetId)) return;

  const index = selectedIds.value.indexOf(assetId);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(assetId);
  }
}

// 全选/取消全选（排除已关联的）
function toggleAll() {
  const selectableAssets = filteredAssets.value.filter((a) => !isLinked(a.id));
  if (selectedIds.value.length === selectableAssets.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = selectableAssets.map((a) => a.id);
  }
}

// 执行导入
async function handleImport() {
  if (selectedIds.value.length === 0) {
    message.warning("请选择要导入的资产");
    return;
  }

  importing.value = true;
  try {
    const result = await scriptEditStore.linkExistingAssets(
      props.assetType,
      selectedIds.value,
    );

    // 显示结果提示
    if (result.refs.length > 0) {
      message.success(`成功导入 ${result.refs.length} 个${typeLabelMap[props.assetType]}`);
    }
    if (result.skipped.length > 0) {
      message.info(`${result.skipped.length} 个资产已关联，已跳过`);
    }

    emit("success");
    emit("update:show", false);
  } catch (error) {
    console.error("导入资产失败:", error);
    message.error("导入失败，请重试");
  } finally {
    importing.value = false;
  }
}

// 关闭弹窗
function handleClose() {
  emit("update:show", false);
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="import-asset-modal"
    style="width: 640px; max-width: 90vw"
    :title="modalTitle"
    :bordered="false"
    :segmented="{ content: 'soft' }"
    :closable="true"
    @update:show="$emit('update:show', $event)"
  >
    <NSpin :show="loading">
      <div class="import-asset-content">
        <!-- 搜索栏 -->
        <NInput
          v-model:value="searchQuery"
          placeholder="搜索资产名称"
          clearable
          class="search-input"
        >
          <template #prefix>
            <NIcon :size="16">
              <Search />
            </NIcon>
          </template>
        </NInput>

        <!-- 资产网格 -->
        <div
          v-if="filteredAssets.length > 0"
          class="asset-grid"
        >
          <div
            v-for="asset in filteredAssets"
            :key="asset.id"
            class="asset-item"
            :class="{
              'is-linked': isLinked(asset.id),
              'is-selected': selectedIds.includes(asset.id),
            }"
            @click="toggleSelection(asset.id)"
          >
            <!-- 缩略图 -->
            <div class="asset-cover">
              <img
                v-if="asset.coverUrl"
                :src="asset.coverUrl"
                :alt="asset.name"
              >
              <NIcon
                v-else
                :size="24"
                class="placeholder-icon"
              >
                <User v-if="assetType === 'character'" />
                <ImageIcon v-if="assetType === 'scene'" />
                <Box v-if="assetType === 'prop'" />
              </NIcon>
            </div>

            <!-- 信息 -->
            <div class="asset-info">
              <span class="asset-name">{{ asset.name }}</span>
            </div>

            <!-- 已关联标记 -->
            <span
              v-if="isLinked(asset.id)"
              class="linked-tag"
            >已关联</span>
          </div>
        </div>

        <!-- 空状态 -->
        <NEmpty
          v-else-if="!loading"
          :description="searchQuery ? '未找到匹配的资产' : '该项目暂无资产'"
          class="empty-state"
        />

        <!-- 底部按钮 -->
        <div class="actions">
          <div class="actions-left">
            <span
              v-if="selectableCount > 0"
              class="selection-text"
            >
              已选 {{ selectedIds.length }}/{{ selectableCount }}
            </span>
            <span
              class="toggle-all-btn"
              @click="toggleAll"
            >
              {{ isAllSelected ? "取消全选" : "全选" }}
            </span>
          </div>
          <div class="actions-right">
            <NSpace>
              <NButton class="btn-cancel" @click="handleClose">
                取消
              </NButton>
              <NButton
                type="primary"
                class="btn-import"
                :loading="importing"
                :disabled="selectedIds.length === 0"
                @click="handleImport"
              >
                导入
              </NButton>
            </NSpace>
          </div>
        </div>
      </div>
    </NSpin>
  </NModal>
</template>

<style scoped lang="scss">
:deep(.import-asset-modal .n-card-header) {
  padding: 16px 20px 12px;
  font-weight: 600;
  font-size: 16px;
}

:deep(.n-card__content) {
  padding: 0 20px 16px;
}

.import-asset-content {
  .search-input {
    width: 100%;
    margin-bottom: 16px;
  }

  .asset-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    max-height: 380px;
    overflow-y: auto;
    padding: 2px 0;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #e0e0e5;
      border-radius: 2px;
    }
  }

  .asset-item {
    cursor: pointer;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.15s ease;
    position: relative;
    background: #f7f7f8;

    &:hover:not(.is-linked) {
      border-color: #d0d0d5;
    }

    &.is-selected {
      border-color: #2080f0;
      background: #f0f5ff;
    }

    &.is-linked {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .asset-cover {
      aspect-ratio: 1 / 1;
      background: #eeeef0;
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .placeholder-icon {
        color: #bbb;
      }
    }

    .asset-info {
      padding: 6px 8px;

      .asset-name {
        font-size: 13px;
        font-weight: 500;
        color: #333;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .linked-tag {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 10px;
      color: #999;
      background: rgba(255,255,255,0.9);
      border-radius: 3px;
      padding: 1px 5px;
    }
  }

  .empty-state {
    padding: 40px 0;
    color: #999;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;

    .actions-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .selection-text {
        font-size: 13px;
        color: #666;
      }

      .toggle-all-btn {
        font-size: 13px;
        color: #2080f0;
        cursor: pointer;
        user-select: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .actions-right {
      display: flex;
      gap: 8px;
    }
  }

  .btn-cancel {
    height: 36px;
    padding: 0 16px;
  }

  .btn-import {
    height: 36px;
    padding: 0 20px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(32, 128, 240, 0.25);
    transition: box-shadow 0.2s;

    &:hover {
      box-shadow: 0 4px 12px rgba(32, 128, 240, 0.35);
    }
  }
}
</style>

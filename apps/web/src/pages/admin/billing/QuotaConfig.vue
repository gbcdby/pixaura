<template>
  <div class="quota-config-page">
    <n-h2>额度配置</n-h2>

    <n-card>
      <n-space
        class="toolbar"
        align="center"
      >
        <n-select
          v-model:value="filterTier"
          placeholder="订阅等级"
          clearable
          :options="tierOptions"
          @update:value="handleFilterChange"
        />
        <n-button
          type="info"
          @click="showAddCategoryModal"
        >
          <template #icon>
            <n-icon><add-outline /></n-icon>
          </template>
          添加类别配额
        </n-button>
        <n-button
          type="primary"
          @click="showRefreshConfirm"
        >
          <template #icon>
            <n-icon><refresh-outline /></n-icon>
          </template>
          刷新所有额度
        </n-button>
      </n-space>

      <!-- 空数据提示 -->
      <n-empty
        v-if="!adminBillingStore.loading && allConfigs.length === 0"
        description="暂无额度配置数据"
      >
        <template #extra>
          <n-space
            vertical
            align="center"
          >
            <n-text type="info">
              额度配置需要在<strong>模型配置</strong>模块中创建模型后自动生成
            </n-text>
            <n-button
              type="primary"
              @click="goToModelConfig"
            >
              前往模型配置
            </n-button>
          </n-space>
        </template>
      </n-empty>

      <n-tabs
        v-else
        type="line"
      >
        <n-tab-pane
          v-for="tier in filteredTiers"
          :key="tier"
          :name="tier"
          :tab="tierName(tier)"
        >
          <div
            v-for="cycle in ['small', 'large']"
            :key="cycle"
            class="cycle-section"
          >
            <div class="cycle-header">
              <h4>
                {{ cycle === "small" ? "小周期 (4小时)" : "大周期 (7天)" }}
              </h4>
              <n-text
                depth="3"
                class="cycle-desc"
              >
                {{ cycle === "small" ? "每小时刷新额度" : "每周刷新额度" }}
              </n-text>
            </div>

            <!-- 类别配额表格 -->
            <div class="target-type-section">
              <div class="target-type-header">
                <n-tag
                  type="success"
                  size="small"
                >
                  类别
                </n-tag>
                <n-text depth="3">
                  按功能类别配置的额度限制
                </n-text>
              </div>
              <n-data-table
                :data="getCategoryConfigs(tier, cycle as 'small' | 'large')"
                :columns="columns"
                :loading="adminBillingStore.loading"
                size="small"
                :pagination="false"
                :bordered="true"
              />
              <n-empty
                v-if="
                  getCategoryConfigs(tier, cycle as 'small' | 'large')
                    .length === 0
                "
                description="暂无类别配额配置"
                size="small"
              />
            </div>

            <!-- 模型配额表格 -->
            <div class="target-type-section">
              <div class="target-type-header">
                <n-tag
                  type="info"
                  size="small"
                >
                  模型
                </n-tag>
                <n-text depth="3">
                  按具体模型配置的额度限制
                </n-text>
              </div>
              <n-data-table
                :data="getModelConfigs(tier, cycle as 'small' | 'large')"
                :columns="columns"
                :loading="adminBillingStore.loading"
                size="small"
                :pagination="false"
                :bordered="true"
              />
              <n-empty
                v-if="
                  getModelConfigs(tier, cycle as 'small' | 'large').length === 0
                "
                description="暂无模型配额配置"
                size="small"
              />
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <!-- 添加类别配额对话框 -->
    <n-modal
      v-model:show="addCategoryModalVisible"
      title="添加类别配额"
      preset="card"
      style="width: 450px"
    >
      <n-form
        :model="addCategoryForm"
        label-placement="left"
        label-width="100"
      >
        <n-form-item
          label="订阅等级"
          required
        >
          <n-select
            v-model:value="addCategoryForm.tier"
            :options="tierOptions"
            placeholder="请选择订阅等级"
          />
        </n-form-item>
        <n-form-item
          label="类别"
          required
        >
          <n-select
            v-model:value="addCategoryForm.targetId"
            :options="categoryOptions"
            placeholder="请选择功能类别"
          />
        </n-form-item>
        <n-form-item
          label="小周期额度"
          required
        >
          <n-input-number
            v-model:value="addCategoryForm.smallCycleQuota"
            :min="0"
            style="width: 100%"
            placeholder="请输入小周期(4小时)额度"
          />
        </n-form-item>
        <n-form-item
          label="大周期额度"
          required
        >
          <n-input-number
            v-model:value="addCategoryForm.largeCycleQuota"
            :min="0"
            style="width: 100%"
            placeholder="请输入大周期(7天)额度"
          />
        </n-form-item>
        <n-form-item label="启用状态">
          <n-switch v-model:value="addCategoryForm.isActive" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="addCategoryModalVisible = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="adminBillingStore.loading"
            @click="handleAddCategory"
          >
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 编辑对话框 -->
    <n-modal
      v-model:show="editModalVisible"
      title="编辑额度配置"
      preset="card"
      style="width: 400px"
    >
      <n-form
        v-if="editingConfig"
        label-placement="left"
        label-width="80"
      >
        <n-form-item label="订阅等级">
          <n-input
            :value="tierName(editingConfig.tier)"
            disabled
          />
        </n-form-item>
        <n-form-item label="周期类型">
          <n-input
            :value="
              editingConfig.cycleType === 'small'
                ? '小周期(4小时)'
                : '大周期(7天)'
            "
            disabled
          />
        </n-form-item>
        <n-form-item label="目标类型">
          <n-input
            :value="editingConfig.targetType === 'model' ? '模型' : '类别'"
            disabled
          />
        </n-form-item>
        <n-form-item label="目标">
          <n-input
            v-model:value="editingConfig.targetName"
            disabled
          />
        </n-form-item>
        <n-form-item label="额度值">
          <n-input-number
            v-model:value="editingConfig.quotaValue"
            :min="0"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="启用状态">
          <n-switch v-model:value="editingConfig.isActive" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="editModalVisible = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="adminBillingStore.loading"
            @click="handleSave"
          >
            保存
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from "vue";
import { useRouter } from "vue-router";
import { useDialog, useMessage, NTag, NSwitch, NButton, NIcon } from "naive-ui";
import { RefreshOutline, AddOutline } from "@vicons/ionicons5";
import { useAdminBillingStore } from "@/stores/billing";
import type { QuotaConfig } from "@/types/billing";
import type { DataTableColumns } from "naive-ui";
import {
  FunctionCategoryOptions,
  FunctionCategory,
} from "@pixaura/shared-types/model-config";

const adminBillingStore = useAdminBillingStore();
const dialog = useDialog();
const message = useMessage();
const router = useRouter();

const filterTier = ref<string | null>(null);
const editModalVisible = ref(false);
const editingConfig = ref<QuotaConfig | null>(null);
const addCategoryModalVisible = ref(false);
const addCategoryForm = ref({
  tier: "basic" as string,
  targetId: "",
  smallCycleQuota: 50,
  largeCycleQuota: 1000,
  isActive: true,
});

const tiers = ["basic", "pro"];

// 过滤掉 VOICE_GENERATION 类别（数据库初始化时写入，不可手动添加）
const categoryOptions = FunctionCategoryOptions.filter(
  (opt) => opt.value !== FunctionCategory.VOICE_GENERATION,
);

const tierOptions = [
  { label: "普通订阅", value: "basic" },
  { label: "专业订阅", value: "pro" },
];

const filteredTiers = computed(() => {
  return filterTier.value ? [filterTier.value] : tiers;
});

const allConfigs = computed(() => adminBillingStore.quotaConfigs);

// 表格列定义
const columns: DataTableColumns<QuotaConfig> = [
  {
    title: "名称",
    key: "targetName",
    minWidth: 150,
  },
  {
    title: "额度值",
    key: "quotaValue",
    width: 120,
    render: (row) => h("strong", {}, row.quotaValue),
  },
  {
    title: "状态",
    key: "isActive",
    width: 100,
    render: (row) => {
      return h(NSwitch, {
        value: row.isActive,
        onUpdateValue: (val: boolean) => handleToggleStatus(row, val),
      });
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 100,
    render: (row) => {
      return h(
        NButton,
        {
          text: true,
          type: "primary",
          onClick: () => handleEdit(row),
        },
        { default: () => "编辑" },
      );
    },
  },
];

function tierName(tier: string) {
  const map: Record<string, string> = {
    basic: "普通订阅",
    pro: "专业订阅",
  };
  return map[tier] || tier;
}

function getCategoryConfigs(tier: string, cycle: "small" | "large") {
  const configs = adminBillingStore.quotaConfigs
    .filter(
      (c) =>
        c.tier === tier && c.cycleType === cycle && c.targetType === "category",
    )
    .sort((a, b) => (a.targetName || "").localeCompare(b.targetName || ""));

  // 对结果进行去重处理（避免数据库中存在重复配置）
  const seen = new Set<string>();
  return configs.filter((c) => {
    if (seen.has(c.targetId)) {
      return false;
    }
    seen.add(c.targetId);
    return true;
  });
}

function getModelConfigs(tier: string, cycle: "small" | "large") {
  return adminBillingStore.quotaConfigs
    .filter(
      (c) =>
        c.tier === tier && c.cycleType === cycle && c.targetType === "model",
    )
    .sort((a, b) => (a.targetName || "").localeCompare(b.targetName || ""));
}

function handleFilterChange() {
  adminBillingStore.fetchQuotaConfigs(filterTier.value || undefined);
}

function handleEdit(config: QuotaConfig) {
  editingConfig.value = { ...config };
  editModalVisible.value = true;
}

async function handleSave() {
  if (!editingConfig.value) return;

  try {
    await adminBillingStore.updateQuotaConfig(editingConfig.value.id, {
      quotaValue: editingConfig.value.quotaValue,
      isActive: editingConfig.value.isActive,
    });
    message.success("保存成功");
    editModalVisible.value = false;
  } catch {
    message.error("保存失败");
  }
}

function showAddCategoryModal() {
  addCategoryForm.value = {
    tier: "basic",
    targetId: "",
    smallCycleQuota: 50,
    largeCycleQuota: 1000,
    isActive: true,
  };
  addCategoryModalVisible.value = true;
}

async function handleAddCategory() {
  const { tier, targetId, smallCycleQuota, largeCycleQuota, isActive } =
    addCategoryForm.value;

  if (!targetId) {
    message.error("请选择类别");
    return;
  }

  try {
    await adminBillingStore.createCategoryQuotaConfig({
      tier,
      targetId,
      smallCycleQuota,
      largeCycleQuota,
      isActive,
    });
    message.success("类别配额创建成功");
    addCategoryModalVisible.value = false;
    // 刷新列表
    await adminBillingStore.fetchQuotaConfigs(filterTier.value || undefined);
  } catch {
    message.error("创建失败");
  }
}

async function handleToggleStatus(config: QuotaConfig, isActive: boolean) {
  try {
    await adminBillingStore.updateQuotaConfig(config.id, { isActive });
    message.success("状态已更新");
  } catch {
    message.error("更新失败");
    // 恢复原状态
    const c = adminBillingStore.quotaConfigs.find(
      (item) => item.id === config.id,
    );
    if (c) {
      c.isActive = !isActive;
    }
  }
}

function showRefreshConfirm() {
  dialog.warning({
    title: "刷新所有额度",
    content:
      "此操作将根据当前配置重新计算所有用户的额度，可能会影响正在使用的用户。确定继续吗？",
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await adminBillingStore.refreshAllQuotas();
        message.success("额度刷新成功");
      } catch {
        message.error("刷新失败");
      }
    },
  });
}

function goToModelConfig() {
  router.push("/admin/model-config");
}

onMounted(() => {
  adminBillingStore.fetchQuotaConfigs();
});
</script>

<style scoped lang="scss">
.quota-config-page {
  padding: 24px;
}

.toolbar {
  margin-bottom: 16px;
}

.cycle-section {
  margin-bottom: 32px;

  .cycle-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    h4 {
      margin: 0;
      color: #333;
      font-weight: 600;
    }

    .cycle-desc {
      font-size: 12px;
    }
  }

  .target-type-section {
    margin-bottom: 24px;

    .target-type-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
  }
}
</style>

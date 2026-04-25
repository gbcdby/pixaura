<script setup lang="ts">
import { ref, onMounted, h } from "vue";
import {
  NCard,
  NButton,
  NDataTable,
  NTag,
  NSpace,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  useMessage,
  useDialog,
  NIcon,
  NDivider,
} from "naive-ui";
import { useModelConfigStore } from "@/stores/model-config";
import type {
  ProviderListItemDto,
  CreateProviderDto,
  UpdateProviderDto,
} from "@/types/model-config";
import type { DataTableColumns } from "naive-ui";
import {
  Refresh,
  Add,
  Create,
  Trash,
  CheckmarkCircle,
  CloseCircle,
  HelpCircle,
  Server,
} from "@vicons/ionicons5";

const message = useMessage();
const dialog = useDialog();
const store = useModelConfigStore();

// 表格列定义
const columns: DataTableColumns<ProviderListItemDto> = [
  {
    title: "供应商ID",
    key: "providerId",
    width: 120,
  },
  {
    title: "供应商名称",
    key: "providerName",
    width: 150,
  },
  {
    title: "类型",
    key: "providerType",
    width: 100,
    render(row) {
      const typeMap: Record<string, string> = {
        official: "官方",
        proxy: "代理",
        relay: "中转",
      };
      return typeMap[row.providerType] || row.providerType;
    },
  },
  {
    title: "认证方式",
    key: "authType",
    width: 100,
    render(row) {
      const authMap: Record<string, string> = {
        api_key: "API Key",
        aksk: "AK/SK",
        oauth: "OAuth",
      };
      return authMap[row.authType] || row.authType;
    },
  },
  {
    title: "API Key",
    key: "apiKeyMasked",
    width: 180,
    render(row) {
      if (!row.apiKeyMasked) {
        return h(
          NTag,
          { type: "warning", size: "small" },
          { default: () => "未配置" },
        );
      }
      return h(
        NSpace,
        { align: "center" },
        {
          default: () => [
            h(
              "span",
              { style: "font-family: monospace; color: #9d8ae7;" },
              row.apiKeyMasked ?? "",
            ),
            h(
              NIcon,
              { size: 16, style: "color: #52c41a;" },
              { default: () => h(CheckmarkCircle) },
            ),
          ],
        },
      );
    },
  },
  {
    title: "基础URL",
    key: "baseUrl",
    ellipsis: true,
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      return h(
        NSwitch,
        {
          value: row.status === "enabled",
          onUpdateValue: (val: boolean) => handleStatusChange(row, val),
        },
        {
          checked: () => "启用",
          unchecked: () => "禁用",
        },
      );
    },
  },
  {
    title: "健康状态",
    key: "healthStatus",
    width: 100,
    render(row) {
      const statusMap: Record<
        string,
        { type: "success" | "error" | "default"; text: string; icon: any }
      > = {
        healthy: { type: "success", text: "健康", icon: CheckmarkCircle },
        unhealthy: { type: "error", text: "故障", icon: CloseCircle },
        unknown: { type: "default", text: "未知", icon: HelpCircle },
      };
      const status = statusMap[row.healthStatus] || {
        type: "default",
        text: row.healthStatus,
        icon: HelpCircle,
      };
      return h(
        NTag,
        { type: status.type, size: "small" },
        {
          default: () => status.text,
          icon: () => h(NIcon, null, { default: () => h(status.icon) }),
        },
      );
    },
  },
  {
    title: "模型数",
    key: "modelsCount",
    width: 80,
  },
  {
    title: "操作",
    key: "actions",
    width: 150,
    render(row) {
      return h(
        NSpace,
        {},
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                onClick: () => handleEdit(row),
              },
              {
                default: () => "编辑",
                icon: () => h(NIcon, null, { default: () => h(Create) }),
              },
            ),
            h(
              NButton,
              {
                size: "small",
                quaternary: true,
                type: "error",
                onClick: () => handleDelete(row),
              },
              {
                default: () => "删除",
                icon: () => h(NIcon, null, { default: () => h(Trash) }),
              },
            ),
          ],
        },
      );
    },
  },
];

// 供应商类型选项
const providerTypeOptions = [
  { label: "官方", value: "official" },
  { label: "代理", value: "proxy" },
  { label: "中转", value: "relay" },
];

// 认证类型选项
const authTypeOptions = [
  { label: "API Key", value: "api_key" },
  { label: "AK/SK", value: "aksk" },
  { label: "OAuth", value: "oauth" },
];

// 弹窗状态
const showModal = ref(false);
const isEditing = ref(false);
const currentProvider = ref<ProviderListItemDto | null>(null);

// 表单数据
const formData = ref<CreateProviderDto>({
  providerId: "",
  providerName: "",
  providerType: "official",
  baseUrl: "",
  authType: "api_key",
  apiKey: "",
  apiSecret: "",
});

const formRules = {
  providerId: { required: true, message: "请输入供应商ID", trigger: "blur" },
  providerName: {
    required: true,
    message: "请输入供应商名称",
    trigger: "blur",
  },
  baseUrl: { required: true, message: "请输入基础URL", trigger: "blur" },
};

// 加载数据
onMounted(() => {
  store.fetchProviders();
});

// 处理新增
function handleAdd() {
  isEditing.value = false;
  currentProvider.value = null;
  formData.value = {
    providerId: "",
    providerName: "",
    providerType: "official",
    baseUrl: "",
    authType: "api_key",
    apiKey: "",
    apiSecret: "",
  };
  showModal.value = true;
}

// 处理编辑
function handleEdit(row: ProviderListItemDto) {
  isEditing.value = true;
  currentProvider.value = row;
  formData.value = {
    providerId: row.providerId,
    providerName: row.providerName,
    providerType: row.providerType,
    baseUrl: row.baseUrl,
    authType: row.authType,
    apiKey: row.apiKeyMasked || "",
    apiSecret: "",
  };
  showModal.value = true;
}

// 处理删除
function handleDelete(row: ProviderListItemDto) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除供应商 "${row.providerName}" 吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await store.deleteProvider(row.providerId);
        message.success("删除成功");
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "删除失败";
        message.error(errorMessage);
      }
    },
  });
}

// 处理状态切换
async function handleStatusChange(row: ProviderListItemDto, enabled: boolean) {
  try {
    await store.updateProvider(row.providerId, {
      status: enabled ? "enabled" : "disabled",
    });
    message.success("状态更新成功");
  } catch (error) {
    message.error("状态更新失败");
  }
}

// 提交表单
async function handleSubmit() {
  try {
    if (isEditing.value && currentProvider.value) {
      const updateData: UpdateProviderDto = {};
      if (formData.value.providerName)
        updateData.providerName = formData.value.providerName;
      if (formData.value.baseUrl) updateData.baseUrl = formData.value.baseUrl;
      if (formData.value.authType)
        updateData.authType = formData.value.authType;
      // 如果是编辑模式且 API Key 值为脱敏文本，说明用户没有修改，不提交
      const isMaskedValue =
        currentProvider.value.apiKeyMasked &&
        formData.value.apiKey === currentProvider.value.apiKeyMasked;
      if (formData.value.apiKey && !isMaskedValue) {
        updateData.apiKey = formData.value.apiKey;
      }
      if (formData.value.apiSecret)
        updateData.apiSecret = formData.value.apiSecret;

      await store.updateProvider(currentProvider.value.providerId, updateData);
      message.success("更新成功");
    } else {
      await store.createProvider(formData.value);
      message.success("创建成功");
    }
    showModal.value = false;
  } catch (error) {
    message.error(isEditing.value ? "更新失败" : "创建失败");
  }
}

// 刷新列表
async function handleRefresh() {
  await store.fetchProviders();
  message.success("刷新成功");
}
</script>

<template>
  <div class="provider-list page-container">
    <!-- 页面标题区 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <Server />
        </n-icon>
        <span>供应商管理</span>
      </div>
      <n-space>
        <n-button
          quaternary
          @click="handleRefresh"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
        <n-button
          type="primary"
          @click="handleAdd"
        >
          <template #icon>
            <n-icon><Add /></n-icon>
          </template>
          新增供应商
        </n-button>
      </n-space>
    </div>

    <n-divider class="page-divider" />

    <!-- 数据表格卡片 -->
    <n-card
      class="data-card"
      :bordered="false"
    >
      <n-data-table
        :columns="columns"
        :data="store.providers"
        :loading="store.loading"
        :pagination="{ pageSize: 10 }"
        :bordered="false"
        :single-line="false"
        class="admin-table"
      />
    </n-card>

    <!-- 新增/编辑弹窗 -->
    <n-modal
      v-model:show="showModal"
      :title="isEditing ? '编辑供应商' : '新增供应商'"
      preset="card"
      style="width: 600px"
      :bordered="false"
      class="admin-modal"
    >
      <n-form
        :model="formData"
        :rules="formRules"
        label-width="100"
        label-align="right"
      >
        <n-form-item
          label="供应商ID"
          path="providerId"
        >
          <n-input
            v-model:value="formData.providerId"
            placeholder="请输入供应商ID，如：aliyun"
            :disabled="isEditing"
          />
        </n-form-item>

        <n-form-item
          label="供应商名称"
          path="providerName"
        >
          <n-input
            v-model:value="formData.providerName"
            placeholder="请输入供应商名称"
          />
        </n-form-item>

        <n-form-item
          label="供应商类型"
          path="providerType"
        >
          <n-select
            v-model:value="formData.providerType"
            :options="providerTypeOptions"
          />
        </n-form-item>

        <n-form-item
          label="基础URL"
          path="baseUrl"
        >
          <n-input
            v-model:value="formData.baseUrl"
            placeholder="https://api.example.com"
          />
        </n-form-item>

        <n-form-item
          label="认证方式"
          path="authType"
        >
          <n-select
            v-model:value="formData.authType"
            :options="authTypeOptions"
          />
        </n-form-item>

        <n-form-item
          v-if="formData.authType === 'api_key' || formData.authType === 'aksk'"
          label="API Key"
        >
          <n-input
            v-model:value="formData.apiKey"
            type="password"
            :placeholder="
              isEditing && currentProvider?.apiKeyMasked
                ? `${currentProvider.apiKeyMasked}（留空保持不变）`
                : '请输入 API Key'
            "
            show-password-on="mousedown"
          />
        </n-form-item>

        <n-form-item
          v-if="formData.authType === 'aksk'"
          label="API Secret"
        >
          <n-input
            v-model:value="formData.apiSecret"
            type="password"
            placeholder="请输入API Secret"
            show-password-on="mousedown"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">
            取消
          </n-button>
          <n-button
            type="primary"
            :loading="store.loading"
            @click="handleSubmit"
          >
            确定
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped lang="scss">
.page-container {
  padding: 24px;
  min-height: 100%;
  background: #fff;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
    color: #2d2b4d;

    .title-icon {
      color: #9d8ae7;
    }
  }
}

.page-divider {
  margin: 16px 0 24px;
}

.data-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  :deep(.n-card__content) {
    padding: 0;
  }
}

// 表格样式覆盖
.admin-table {
  :deep(.n-data-table-thead) {
    background: rgba(157, 138, 231, 0.08);

    .n-data-table-th {
      font-weight: 600;
      color: #2d2b4d;
      background: transparent;
      border-bottom: 1px solid rgba(157, 138, 231, 0.15);
    }
  }

  :deep(.n-data-table-tbody) {
    .n-data-table-tr {
      &:hover {
        background: rgba(157, 138, 231, 0.04);
      }
    }

    .n-data-table-td {
      border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    }
  }
}

// 弹窗样式
.admin-modal {
  :deep(.n-card-header) {
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    padding: 20px 24px;

    .n-card-header__main {
      font-size: 18px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }

  :deep(.n-card__content) {
    padding: 24px;
  }

  :deep(.n-card__footer) {
    border-top: 1px solid rgba(157, 138, 231, 0.1);
    padding: 16px 24px;
  }
}
</style>

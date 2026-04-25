<script setup lang="ts">
import { ref, onMounted, h, computed } from "vue";
import { useRouter } from "vue-router";
import {
  NCard,
  NDataTable,
  NInput,
  NSelect,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NPagination,
  NModal,
  NForm,
  NFormItem,
  NInputNumber,
  NSwitch,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  People,
  Search,
  Eye,
  Ban,
  CheckmarkCircle,
  Refresh,
} from "@vicons/ionicons5";
import { useAdminUserStore } from "@/stores/system-admin";
import type { AdminUser } from "@/types/admin";
import type { DataTableColumns } from "naive-ui";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const userStore = useAdminUserStore();

// 从 Store 获取状态
const loading = computed(() => userStore.isLoading);
const users = computed(() => userStore.userList);
const total = computed(() => userStore.userTotal);
const page = computed({
  get: () => userStore.filter.page,
  set: (val) => userStore.setFilter({ page: val }),
});
const pageSize = computed({
  get: () => userStore.filter.pageSize,
  set: (val) => userStore.setFilter({ pageSize: val }),
});
const keyword = ref("");
const isBanned = ref<string>("");

// 封禁弹窗
const banModalVisible = ref(false);
const banningUser = ref<AdminUser | null>(null);
const banForm = ref({
  reason: "",
  durationDays: 7,
  notifyUser: true,
});

// 表格列定义
const columns: DataTableColumns<AdminUser> = [
  {
    title: "用户ID",
    key: "id",
    width: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: "用户名",
    key: "username",
    width: 150,
  },
  {
    title: "手机号",
    key: "phone",
    width: 140,
    render(row) {
      return row.phone || "-";
    },
  },
  {
    title: "订阅等级",
    key: "subscriptionTier",
    width: 120,
    render(row) {
      const tierMap: Record<string, string> = {
        free: "免费",
        basic: "普通",
        pro: "专业",
      };
      const tier = row.subscriptionTier || "free";
      const tierColors: Record<string, string> = {
        free: "default",
        basic: "info",
        pro: "success",
      };
      return h(
        NTag,
        { type: tierColors[tier] as any },
        { default: () => tierMap[tier] || tier },
      );
    },
  },
  {
    title: "余额",
    key: "balance",
    width: 120,
    render(row) {
      const balance =
        typeof row.balance === "string" ? parseFloat(row.balance) : row.balance;
      return `¥${(balance || 0).toFixed(2)}`;
    },
  },
  {
    title: "状态",
    key: "isBanned",
    width: 100,
    render(row) {
      return row.isBanned
        ? h(NTag, { type: "error" }, { default: () => "已封禁" })
        : h(NTag, { type: "success" }, { default: () => "正常" });
    },
  },
  {
    title: "注册时间",
    key: "createdAt",
    width: 180,
    render(row) {
      return formatDate(row.createdAt);
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 180,
    fixed: "right",
    render(row) {
      return h(
        NSpace,
        { size: "small" },
        {
          default: () => [
            h(
              NButton,
              {
                size: "small",
                type: "primary",
                ghost: true,
                onClick: () => viewDetail(row),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(Eye) }),
                default: () => "详情",
              },
            ),
            row.isBanned
              ? h(
                  NButton,
                  {
                    size: "small",
                    type: "success",
                    ghost: true,
                    onClick: () => handleUnban(row),
                  },
                  {
                    icon: () =>
                      h(NIcon, null, { default: () => h(CheckmarkCircle) }),
                    default: () => "解封",
                  },
                )
              : h(
                  NButton,
                  {
                    size: "small",
                    type: "error",
                    ghost: true,
                    onClick: () => openBanModal(row),
                  },
                  {
                    icon: () => h(NIcon, null, { default: () => h(Ban) }),
                    default: () => "封禁",
                  },
                ),
          ],
        },
      );
    },
  },
];

// 状态筛选选项
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "正常", value: "false" },
  { label: "已封禁", value: "true" },
];

// 格式化日期
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 获取用户列表
async function fetchUsers() {
  try {
    const bannedFilter =
      isBanned.value === "" ? undefined : isBanned.value === "true";
    userStore.setFilter({
      keyword: keyword.value,
      isBanned: bannedFilter,
    });
    await userStore.fetchUsers();
  } catch (error) {
    message.error("获取用户列表失败");
  }
}

// 搜索
function handleSearch() {
  userStore.setFilter({ page: 1 });
  fetchUsers();
}

// 重置筛选
function handleReset() {
  keyword.value = "";
  isBanned.value = "";
  userStore.resetFilter();
  fetchUsers();
}

// 查看详情
function viewDetail(user: AdminUser) {
  router.push(`/admin/users/${user.id}`);
}

// 打开封禁弹窗
function openBanModal(user: AdminUser) {
  banningUser.value = user;
  banForm.value = {
    reason: "",
    durationDays: 7,
    notifyUser: true,
  };
  banModalVisible.value = true;
}

// 确认封禁
async function confirmBan() {
  if (!banningUser.value) return;
  if (!banForm.value.reason.trim()) {
    message.error("请输入封禁原因");
    return;
  }

  try {
    await userStore.banUser(banningUser.value.id, {
      reason: banForm.value.reason,
      durationDays: banForm.value.durationDays,
      notifyUser: banForm.value.notifyUser,
    });
    message.success("用户封禁成功");
    banModalVisible.value = false;
    fetchUsers();
  } catch (error) {
    message.error("封禁失败");
  }
}

// 解封用户
function handleUnban(user: AdminUser) {
  dialog.warning({
    title: "确认解封",
    content: `确定要解封用户 "${user.username}" 吗？`,
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await userStore.unbanUser(user.id, { reason: "管理员手动解封" });
        message.success("用户解封成功");
        fetchUsers();
      } catch (error) {
        message.error("解封失败");
      }
    },
  });
}

// 分页变化
function handlePageChange(newPage: number) {
  page.value = newPage;
  fetchUsers();
}

// 每页条数变化
function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize;
  page.value = 1;
  fetchUsers();
}

// 状态筛选变化
function handleStatusChange(value: string) {
  isBanned.value = value;
  userStore.setFilter({ page: 1 });
  fetchUsers();
}

onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-title">
        <n-icon
          size="24"
          class="title-icon"
        >
          <People />
        </n-icon>
        <span>用户管理</span>
      </div>
    </div>

    <!-- 搜索筛选 -->
    <n-card
      class="filter-card"
      :bordered="false"
    >
      <n-space
        align="center"
        :size="16"
      >
        <n-input
          v-model:value="keyword"
          placeholder="搜索用户名/手机号"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <n-icon :component="Search" />
          </template>
        </n-input>
        <n-select
          v-model:value="isBanned"
          :options="statusOptions"
          placeholder="选择状态"
          clearable
          style="width: 140px"
          @update:value="handleStatusChange"
        />
        <n-button
          type="primary"
          @click="handleSearch"
        >
          查询
        </n-button>
        <n-button @click="handleReset">
          <template #icon>
            <n-icon :component="Refresh" />
          </template>
          重置
        </n-button>
      </n-space>
    </n-card>

    <!-- 用户表格 -->
    <n-card
      class="table-card"
      :bordered="false"
    >
      <n-data-table
        :columns="columns"
        :data="users"
        :loading="loading"
        :pagination="false"
        :scroll-x="1200"
        striped
      />

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          show-quick-jumper
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </n-card>

    <!-- 封禁弹窗 -->
    <n-modal
      v-model:show="banModalVisible"
      title="封禁用户"
      preset="dialog"
      positive-text="确认封禁"
      negative-text="取消"
      @positive-click="confirmBan"
    >
      <n-form
        :model="banForm"
        label-placement="left"
        label-width="100px"
      >
        <n-form-item label="用户">
          <span>{{ banningUser?.username }}</span>
        </n-form-item>
        <n-form-item
          label="封禁原因"
          required
        >
          <n-input
            v-model:value="banForm.reason"
            type="textarea"
            placeholder="请输入封禁原因"
            :rows="3"
          />
        </n-form-item>
        <n-form-item label="封禁时长">
          <n-input-number
            v-model:value="banForm.durationDays"
            :min="-1"
            :max="3650"
            style="width: 200px"
          >
            <template #suffix>
              天
            </template>
          </n-input-number>
          <span class="form-tip">-1 表示永久封禁</span>
        </n-form-item>
        <n-form-item label="通知用户">
          <n-switch v-model:value="banForm.notifyUser" />
        </n-form-item>
      </n-form>
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
  margin-bottom: 24px;

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

.filter-card {
  margin-bottom: 16px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
}

.table-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}

.form-tip {
  margin-left: 12px;
  color: #999;
  font-size: 13px;
}
</style>

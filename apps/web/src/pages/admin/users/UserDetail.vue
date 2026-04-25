<script setup lang="ts">
import { ref, onMounted, computed, h } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NCard,
  NButton,
  NSpace,
  NIcon,
  NTag,
  NDescriptions,
  NDescriptionsItem,
  NDataTable,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NEmpty,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  People,
  ArrowBack,
  Ban,
  CheckmarkCircle,
  Shield,
  Time,
  Mail,
  Call,
  Wallet,
} from "@vicons/ionicons5";
import { useAdminUserStore } from "@/stores/system-admin";
import type { BanRecord } from "@/types/admin";
import type { DataTableColumns } from "naive-ui";

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const userStore = useAdminUserStore();

// 用户ID
const userId = computed(() => route.params.id as string);

// 从 Store 获取状态
const userDetail = computed(() => userStore.currentUser);

// 封禁弹窗
const banModalVisible = ref(false);
const banForm = ref({
  reason: "",
  durationDays: 7,
  notifyUser: true,
});

// 封禁记录表格列
const banRecordColumns: DataTableColumns<BanRecord> = [
  {
    title: "封禁时间",
    key: "bannedAt",
    width: 180,
    render(row) {
      return formatDate(row.bannedAt);
    },
  },
  {
    title: "封禁原因",
    key: "reason",
    ellipsis: { tooltip: true },
  },
  {
    title: "封禁时长",
    key: "durationDays",
    width: 120,
    render(row) {
      return row.durationDays === -1 ? "永久" : `${row.durationDays} 天`;
    },
  },
  {
    title: "解封时间",
    key: "unbannedAt",
    width: 180,
    render(row) {
      return row.unbannedAt ? formatDate(row.unbannedAt) : "-";
    },
  },
  {
    title: "解封原因",
    key: "unbanReason",
    ellipsis: { tooltip: true },
    render(row) {
      return row.unbanReason || "-";
    },
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      const isActive = !row.unbannedAt;
      return isActive
        ? h(NTag, { type: "error" }, { default: () => "生效中" })
        : h(NTag, { type: "success" }, { default: () => "已解封" });
    },
  },
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

// 获取用户详情
async function fetchUserDetail() {
  try {
    await userStore.fetchUserDetail(userId.value);
  } catch (error) {
    message.error("获取用户详情失败");
  }
}

// 返回列表
function goBack() {
  router.push("/admin/users");
}

// 打开封禁弹窗
function openBanModal() {
  banForm.value = {
    reason: "",
    durationDays: 7,
    notifyUser: true,
  };
  banModalVisible.value = true;
}

// 确认封禁
async function confirmBan() {
  if (!banForm.value.reason.trim()) {
    message.error("请输入封禁原因");
    return;
  }

  try {
    await userStore.banUser(userId.value, {
      reason: banForm.value.reason,
      durationDays: banForm.value.durationDays,
      notifyUser: banForm.value.notifyUser,
    });
    message.success("用户封禁成功");
    banModalVisible.value = false;
    fetchUserDetail();
  } catch (error) {
    message.error("封禁失败");
  }
}

// 解封用户
function handleUnban() {
  if (!userDetail.value) return;

  dialog.warning({
    title: "确认解封",
    content: `确定要解封用户 "${userDetail.value.user.username}" 吗？`,
    positiveText: "确认",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await userStore.unbanUser(userId.value, {
          reason: "管理员手动解封",
        });
        message.success("用户解封成功");
        fetchUserDetail();
      } catch (error) {
        message.error("解封失败");
      }
    },
  });
}

// 复制到剪贴板
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  message.success("已复制");
}

onMounted(() => {
  fetchUserDetail();
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
        <span>用户详情</span>
      </div>
      <n-space>
        <n-button @click="goBack">
          <template #icon>
            <n-icon><ArrowBack /></n-icon>
          </template>
          返回列表
        </n-button>
        <template v-if="userDetail">
          <n-button
            v-if="!userDetail.user.isBanned"
            type="error"
            @click="openBanModal"
          >
            <template #icon>
              <n-icon><Ban /></n-icon>
            </template>
            封禁用户
          </n-button>
          <n-button
            v-else
            type="success"
            @click="handleUnban"
          >
            <template #icon>
              <n-icon><CheckmarkCircle /></n-icon>
            </template>
            解封用户
          </n-button>
        </template>
      </n-space>
    </div>

    <!-- 用户信息卡片 -->
    <n-card
      v-if="userDetail"
      class="info-card"
      :bordered="false"
      title="基本信息"
    >
      <n-descriptions
        :column="3"
        bordered
      >
        <n-descriptions-item label="用户ID">
          <n-space align="center">
            <span
              class="copyable"
              @click="copyToClipboard(userDetail.user.id)"
            >
              {{ userDetail.user.id }}
            </span>
          </n-space>
        </n-descriptions-item>
        <n-descriptions-item label="用户名">
          {{ userDetail.user.username }}
        </n-descriptions-item>
        <n-descriptions-item label="状态">
          <n-tag
            v-if="userDetail.user.isBanned"
            type="error"
          >
            已封禁
          </n-tag>
          <n-tag
            v-else
            type="success"
          >
            正常
          </n-tag>
        </n-descriptions-item>

        <n-descriptions-item label="手机号">
          <n-space
            align="center"
            :size="4"
          >
            <n-icon
              size="16"
              color="#9D8AE7"
            >
              <Call />
            </n-icon>
            {{ userDetail.user.phone || "-" }}
          </n-space>
        </n-descriptions-item>
        <n-descriptions-item label="邮箱">
          <n-space
            align="center"
            :size="4"
          >
            <n-icon
              size="16"
              color="#9D8AE7"
            >
              <Mail />
            </n-icon>
            {{ userDetail.user.email || "-" }}
            <n-tag
              v-if="userDetail.user.emailVerified"
              size="small"
              type="success"
            >
              已验证
            </n-tag>
          </n-space>
        </n-descriptions-item>
        <n-descriptions-item label="权限等级">
          <n-space
            align="center"
            :size="4"
          >
            <n-icon
              size="16"
              color="#9D8AE7"
            >
              <Shield />
            </n-icon>
            {{
              userDetail.user.perms === 3
                ? "超级管理员"
                : userDetail.user.perms === 1
                  ? "管理员"
                  : "普通用户"
            }}
          </n-space>
        </n-descriptions-item>

        <n-descriptions-item label="订阅等级">
          <n-tag
            :type="
              userDetail.user.subscriptionTier === 'pro'
                ? 'success'
                : userDetail.user.subscriptionTier === 'basic'
                  ? 'info'
                  : 'default'
            "
          >
            {{
              userDetail.user.subscriptionTier === "pro"
                ? "专业版"
                : userDetail.user.subscriptionTier === "basic"
                  ? "普通版"
                  : "免费版"
            }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="订阅有效期">
          {{ formatDate(userDetail.user.subscriptionExpiresAt) }}
        </n-descriptions-item>
        <n-descriptions-item label="账户余额">
          <n-space
            align="center"
            :size="4"
          >
            <n-icon
              size="16"
              color="#9D8AE7"
            >
              <Wallet />
            </n-icon>
            <span style="color: #18a058; font-weight: 600">¥{{
              (parseFloat(String(userDetail.user.balance)) || 0).toFixed(2)
            }}</span>
          </n-space>
        </n-descriptions-item>

        <n-descriptions-item label="注册时间">
          <n-space
            align="center"
            :size="4"
          >
            <n-icon
              size="16"
              color="#9D8AE7"
            >
              <Time />
            </n-icon>
            {{ formatDate(userDetail.user.createdAt) }}
          </n-space>
        </n-descriptions-item>
        <n-descriptions-item label="最后登录">
          {{ formatDate(userDetail.user.lastLoginAt) }}
        </n-descriptions-item>
        <n-descriptions-item label="信息更新时间">
          {{ formatDate(userDetail.user.updatedAt) }}
        </n-descriptions-item>
      </n-descriptions>

      <!-- 封禁信息 -->
      <template v-if="userDetail.user.isBanned">
        <div class="ban-info">
          <n-descriptions
            :column="1"
            bordered
            class="ban-descriptions"
          >
            <n-descriptions-item label="封禁原因">
              <span style="color: #d03050">{{
                userDetail.user.bannedReason
              }}</span>
            </n-descriptions-item>
            <n-descriptions-item label="封禁时间">
              {{ formatDate(userDetail.user.bannedAt) }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </template>
    </n-card>

    <!-- 封禁记录 -->
    <n-card
      v-if="userDetail"
      class="record-card"
      :bordered="false"
      title="封禁记录"
    >
      <n-data-table
        v-if="userDetail.banRecords.length > 0"
        :columns="banRecordColumns"
        :data="userDetail.banRecords"
        :pagination="false"
        size="small"
      />
      <n-empty
        v-else
        description="暂无封禁记录"
      />
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
          <span>{{ userDetail?.user.username }}</span>
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

.info-card {
  margin-bottom: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  .ban-info {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px dashed rgba(208, 48, 80, 0.2);

    .ban-descriptions {
      background: rgba(208, 48, 80, 0.05);
    }
  }
}

.record-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
}

.copyable {
  cursor: pointer;
  color: #2080f0;
  text-decoration: underline;
  text-decoration-style: dashed;
  text-underline-offset: 3px;

  &:hover {
    color: #4098f7;
  }
}

.form-tip {
  margin-left: 12px;
  color: #999;
  font-size: 13px;
}
</style>

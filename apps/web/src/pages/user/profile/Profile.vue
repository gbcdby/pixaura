<template>
  <div class="profile-page">
    <n-layout>
      <!-- 顶部导航 -->
      <n-layout-header bordered class="header">
        <div class="header-content">
          <div class="logo" @click="$router.push('/')">
            <h2>Pixaura</h2>
          </div>
          <n-space>
            <n-button quaternary @click="$router.push('/')">返回首页</n-button>
            <n-button quaternary type="error" @click="handleLogout">退出登录</n-button>
          </n-space>
        </div>
      </n-layout-header>

      <n-layout-content class="main-content">
        <div class="profile-container">
          <!-- 左侧边栏 -->
          <n-card class="sidebar-card">
            <div class="user-brief">
              <n-avatar
                :src="userStore.profile?.avatar"
                :fallback-src="defaultAvatar"
                :size="80"
                class="user-avatar"
                @click="showAvatarUpload = true"
              />
              <h3 class="username">{{ userStore.profile?.username }}</h3>
              <n-button text size="tiny" type="primary" @click="showChangeUsernameModal = true">修改用户名</n-button>
              <n-text depth="3" class="greeting">{{ randomGreeting }}</n-text>
            </div>

            <n-divider />

            <div class="user-info-list">
              <div class="info-item">
                <n-text depth="3" class="info-label">手机号</n-text>
                <div class="info-value-row">
                  <n-text>{{ maskPhone(userStore.profile?.phone || "") }}</n-text>
                  <n-button text size="tiny" type="primary" @click="showChangePhoneModal = true">修改</n-button>
                </div>
              </div>

              <div class="info-item">
                <n-text depth="3" class="info-label">邮箱</n-text>
                <div class="info-value-row">
                  <n-text>{{ userStore.profile?.email || "未设置" }}</n-text>
                  <n-button text size="tiny" type="primary" @click="showChangeEmailModal = true">修改</n-button>
                  <n-tag
                    v-if="userStore.profile?.email"
                    :type="userStore.profile?.emailVerified ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ userStore.profile?.emailVerified ? "已验证" : "未验证" }}
                  </n-tag>
                </div>
              </div>

              <div class="info-item">
                <n-text depth="3" class="info-label">密码</n-text>
                <div class="info-value-row">
                  <n-text>••••••••</n-text>
                  <n-button text size="tiny" type="primary" @click="showChangePasswordModal = true">修改</n-button>
                </div>
              </div>
            </div>

            <n-divider />

            <n-menu
              v-model:value="activeMenu"
              :options="menuOptions"
              @update:value="handleMenuSelect"
            />
          </n-card>

          <!-- 右侧内容 -->
          <div class="content-area">
            <!-- 订阅与额度卡片 -->
            <n-card title="订阅与额度" class="subscription-card">
              <!-- 订阅状态行 -->
              <div class="subscription-header">
                <n-tag :type="getTierType(userStore.profile?.subscriptionTier)">
                  {{ getTierLabel(userStore.profile?.subscriptionTier) }}
                </n-tag>
                <n-text depth="3">
                  有效期至 {{ formatDateOnly(userStore.profile?.subscriptionExpiresAt) }}
                  <span v-if="daysRemaining > 0">（剩余 {{ daysRemaining }} 天）</span>
                </n-text>
              </div>

              <!-- 余额行 -->
              <div class="balance-row">
                <n-statistic label="账户余额" :value="billingStore.balance.toFixed(2)">
                  <template #suffix>元</template>
                </n-statistic>
                <n-space>
                  <n-button size="small" type="primary" @click="showRechargeModal = true">充值</n-button>
                  <n-button size="small" @click="$router.push('/billing/history')">消费记录</n-button>
                </n-space>
              </div>

              <!-- 预扣额度汇总 -->
              <div v-if="!authStore.isAdmin && totalPendingTokens > 0" class="pending-summary">
                <n-tag type="info" size="small" class="pending-tag">预扣中: {{ totalPendingTokens }} 点</n-tag>
                <n-text depth="3" style="margin-left: 8px">（生成完成后结算，多退少补）</n-text>
              </div>

              <!-- 额度详情（非管理员，展平显示） -->
              <div v-if="!authStore.isAdmin && categoryQuotaGroups.length" class="quota-detail">
                <div class="quota-detail-header">
                  <n-text depth="3">额度详情</n-text>
                  <n-button text size="small" type="primary" @click="$router.push('/billing/subscription')">
                    {{ userStore.profile?.subscriptionTier === 'free' ? '立即订阅' : '升级订阅' }} →
                  </n-button>
                </div>

                <!-- 展平显示各类别额度 -->
                <div class="quota-flat-list">
                  <div v-for="cat in categoryQuotaGroups" :key="cat.category" class="quota-flat-item">
                    <div class="quota-category-header">
                      <n-icon :color="getCategoryColor(cat.category)" size="18">
                        <component :is="getCategoryIcon(cat.category)" />
                      </n-icon>
                      <span class="category-name">{{ cat.categoryName }}</span>
                    </div>

                    <!-- 小周期 -->
                    <div class="quota-cycle-section">
                      <div class="cycle-header">
                        <n-text depth="3" class="cycle-label">小周期</n-text>
                        <n-text depth="3" class="cycle-refresh">4小时刷新</n-text>
                      </div>
                      <div class="cycle-stats">
                        <div class="stat-row">
                          <span class="stat-label">总额度</span>
                          <span class="stat-value">{{ cat.smallCycle.total }}</span>
                        </div>
                        <div class="stat-row">
                          <span class="stat-label">已使用</span>
                          <span class="stat-value used">{{ cat.smallCycle.used }}</span>
                        </div>
                        <div v-if="hasPendingQuota(cat.category)" class="stat-row pending">
                          <span class="stat-label">预扣中</span>
                          <span class="stat-value pending">{{ getPendingTokens(cat.category) }}</span>
                        </div>
                        <div class="stat-row">
                          <span class="stat-label">可用</span>
                          <span class="stat-value available">{{ cat.smallCycle.remaining }}</span>
                        </div>
                      </div>
                      <n-progress
                        type="line"
                        :percentage="getCategoryPercent(cat)"
                        :status="getCategoryStatus(cat)"
                        :stroke-width="8"
                        :height="8"
                        :show-indicator="false"
                      />
                    </div>

                    <!-- 大周期 -->
                    <div class="quota-cycle-section">
                      <div class="cycle-header">
                        <n-text depth="3" class="cycle-label">大周期</n-text>
                        <n-text depth="3" class="cycle-refresh">7天刷新</n-text>
                      </div>
                      <div class="cycle-stats">
                        <div class="stat-row">
                          <span class="stat-label">总额度</span>
                          <span class="stat-value">{{ cat.largeCycle.total }}</span>
                        </div>
                        <div class="stat-row">
                          <span class="stat-label">已使用</span>
                          <span class="stat-value used">{{ cat.largeCycle.used }}</span>
                        </div>
                        <div v-if="hasPendingQuota(cat.category)" class="stat-row pending">
                          <span class="stat-label">预扣中</span>
                          <span class="stat-value pending">{{ getPendingTokens(cat.category) }}</span>
                        </div>
                        <div class="stat-row">
                          <span class="stat-label">可用</span>
                          <span class="stat-value available">{{ cat.largeCycle.remaining }}</span>
                        </div>
                      </div>
                      <n-progress
                        type="line"
                        :percentage="Math.round(((cat.largeCycle.total - cat.largeCycle.remaining) / cat.largeCycle.total) * 100) || 0"
                        :status="cat.largeCycle.remaining / cat.largeCycle.total > 0.2 ? 'success' : cat.largeCycle.remaining / cat.largeCycle.total > 0.1 ? 'warning' : 'error'"
                        :stroke-width="8"
                        :height="8"
                        :show-indicator="false"
                      />
                    </div>

                    <!-- 模型级别额度 -->
                    <div v-if="getModelsByCategory(cat.category).length" class="model-quota-section">
                      <div class="model-header">
                        <n-text depth="3" class="model-label">模型限额</n-text>
                      </div>
                      <div class="model-list">
                        <div v-for="model in getModelsByCategory(cat.category)" :key="model.modelId" class="model-item">
                          <div class="model-name">{{ model.modelName }}</div>
                          <div class="model-cycles">
                            <span class="cycle-tag small">小: {{ model.smallCycle.remaining }}/{{ model.smallCycle.total }}</span>
                            <span class="cycle-tag large">大: {{ model.largeCycle.remaining }}/{{ model.largeCycle.total }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 管理员提示 -->
              <n-alert v-if="authStore.isAdmin" type="success" class="mt-3">
                管理员账户无额度限制，可无限使用所有功能
              </n-alert>
            </n-card>
          </div>
        </div>
      </n-layout-content>
    </n-layout>

    <!-- 头像上传弹窗 -->
    <n-modal v-model:show="showAvatarUpload" title="上传头像" preset="card" style="width: 400px">
      <n-upload accept="image/*" :max-size="1024 * 1024" :custom-request="handleAvatarUpload" @before-upload="beforeAvatarUpload">
        <n-upload-dragger>
          <div style="margin-bottom: 12px">
            <n-icon size="48" :depth="3"><ImageOutline /></n-icon>
          </div>
          <n-text style="font-size: 16px">点击或拖拽文件到此处上传</n-text>
          <n-p depth="3" style="margin-top: 8px">支持 JPG、PNG 格式，文件大小不超过 1MB</n-p>
        </n-upload-dragger>
      </n-upload>
    </n-modal>

    <!-- 充值弹窗 -->
    <RechargeModal v-model:visible="showRechargeModal" />

    <!-- 修改密码弹窗 -->
    <ChangePasswordModal v-model:visible="showChangePasswordModal" />

    <!-- 修改手机号弹窗 -->
    <ChangePhoneModal v-model:visible="showChangePhoneModal" />

    <!-- 修改邮箱弹窗 -->
    <ChangeEmailModal v-model:visible="showChangeEmailModal" />

    <!-- 修改用户名弹窗 -->
    <ChangeUsernameModal v-model:visible="showChangeUsernameModal" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui";
import type { MenuOption } from "naive-ui";
import { useUserStore } from "@/stores/user";
import { useBillingStore } from "@/stores/billing";
import { useAuthStore } from "@/stores/auth";
import { ImageOutline, VideocamOutline, MusicalNotesOutline, MicOutline, TextOutline, ChatboxOutline } from "@vicons/ionicons5";
import type { CategoryQuota as ApiCategoryQuota, QuotaInfo as ApiQuotaInfo } from "@/types/billing";
import RechargeModal from "@/components/RechargeModal.vue";
import ChangePasswordModal from "@/components/ChangePasswordModal.vue";
import ChangePhoneModal from "@/components/ChangePhoneModal.vue";
import ChangeEmailModal from "@/components/ChangeEmailModal.vue";
import ChangeUsernameModal from "@/components/ChangeUsernameModal.vue";

// 聚合后的类别额度类型
interface CategoryQuotaGroup {
  category: string;
  categoryName: string;
  smallCycle: { total: number; used: number; remaining: number };
  largeCycle: { total: number; used: number; remaining: number };
  canUseSubscription: boolean;
}

const router = useRouter();
const message = useMessage();
const userStore = useUserStore();
const billingStore = useBillingStore();
const authStore = useAuthStore();

const defaultAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix";

// 随机招呼语预设
const greetings = [
  "今天也是创作的一天",
  "准备好开始创作了吗？",
  "让创意在此绽放",
  "你的故事，从这里开始",
  "灵感无处不在，捕捉它",
  "期待你的精彩作品",
  "创作之路，步履不停",
  "每个故事都值得被讲述",
  "今天的灵感是什么呢？",
  "用 AI 点亮你的创意",
  "每一次点击都是新的开始",
  "把想象变成现实",
  "创作不止，灵感不息",
  "愿你今日灵感满满",
  "故事正在等待你来书写",
];

const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
const activeMenu = ref("profile");
const showAvatarUpload = ref(false);
const showRechargeModal = ref(false);
const showChangePasswordModal = ref(false);
const showChangePhoneModal = ref(false);
const showChangeEmailModal = ref(false);
const showChangeUsernameModal = ref(false);

const menuOptions: MenuOption[] = [
  { label: "个人中心", key: "profile" },
  { label: "默认模型设置", key: "default-models" },
];

// 类别颜色配置
const categoryColors: Record<string, string> = {
  TEXT_GENERATION: "#1890ff",
  IMAGE_GENERATION: "#722ed1",
  VIDEO_GENERATION: "#eb2f96",
  VOICE_GENERATION: "#13c2c2",
  AUDIO_GENERATION: "#13c2c2",
  LIP_SYNC: "#fa8c16",
};

// 类别图标
const categoryIcons: Record<string, typeof TextOutline> = {
  TEXT_GENERATION: TextOutline,
  IMAGE_GENERATION: ImageOutline,
  VIDEO_GENERATION: VideocamOutline,
  VOICE_GENERATION: MicOutline,
  AUDIO_GENERATION: MusicalNotesOutline,
  LIP_SYNC: ChatboxOutline,
};

// 计算订阅剩余天数
const daysRemaining = computed(() => {
  const expiresAt = userStore.profile?.subscriptionExpiresAt;
  if (!expiresAt) return 0;
  const expires = new Date(expiresAt);
  const now = new Date();
  const diff = expires.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
});

// 按类别聚合额度数据（新结构）
const categoryQuotaGroups = computed<CategoryQuotaGroup[]>(() => {
  if (!billingStore.quota?.quotas.categories) return [];

  const grouped: Record<string, CategoryQuotaGroup> = {};

  for (const quota of billingStore.quota.quotas.categories as ApiCategoryQuota[]) {
    const categoryKey = quota.categoryId;
    if (!grouped[categoryKey]) {
      grouped[categoryKey] = {
        category: categoryKey,
        categoryName: quota.categoryName,
        smallCycle: { total: 0, used: 0, remaining: 0 },
        largeCycle: { total: 0, used: 0, remaining: 0 },
        canUseSubscription: quota.canUseSubscription,
      };
    }

    // 直接使用 smallCycle 和 largeCycle 对象
    if (quota.smallCycle) {
      grouped[categoryKey].smallCycle = {
        total: quota.smallCycle.total,
        used: quota.smallCycle.used,
        remaining: quota.smallCycle.remaining,
      };
    }
    if (quota.largeCycle) {
      grouped[categoryKey].largeCycle = {
        total: quota.largeCycle.total,
        used: quota.largeCycle.used,
        remaining: quota.largeCycle.remaining,
      };
    }
  }

  return Object.values(grouped);
});

// 模型额度数据
const modelQuotas = computed<ApiQuotaInfo[]>(() => {
  if (!billingStore.quota?.quotas.models) return [];
  return billingStore.quota.quotas.models as ApiQuotaInfo[];
});

// 按类别获取模型列表（使用后端返回的 category 字段）
function getModelsByCategory(category: string): ApiQuotaInfo[] {
  return modelQuotas.value.filter(m => m.category === category);
}

// 获取类别使用百分比（小周期）
function getCategoryPercent(cat: CategoryQuotaGroup): number {
  if (cat.smallCycle.total === 0) return 0;
  return Math.round(((cat.smallCycle.total - cat.smallCycle.remaining) / cat.smallCycle.total) * 100);
}

// 获取额度状态
function getCategoryStatus(cat: CategoryQuotaGroup): "success" | "warning" | "error" {
  if (cat.smallCycle.total === 0) return "success";
  const remainingPercent = cat.smallCycle.remaining / cat.smallCycle.total;
  if (remainingPercent > 0.2) return "success";
  if (remainingPercent > 0.1) return "warning";
  return "error";
}

// 获取类别颜色
function getCategoryColor(category: string): string {
  return categoryColors[category] || "#1890ff";
}

// 获取类别图标组件
function getCategoryIcon(category: string) {
  return categoryIcons[category] || TextOutline;
}

// 仅格式化日期（不含时间）
function formatDateOnly(date?: string): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("zh-CN");
}

// ==================== 预扣额度相关 ====================

function hasPendingQuota(category: string): boolean {
  if (!billingStore.pendingQuota?.categories) return false;
  return billingStore.pendingQuota.categories.some((c) => c.category === category);
}

function getPendingTokens(category: string): number {
  if (!billingStore.pendingQuota?.categories) return 0;
  const found = billingStore.pendingQuota.categories.find((c) => c.category === category);
  return found?.pendingTokens || 0;
}

const totalPendingTokens = computed(() => {
  if (!billingStore.pendingQuota?.categories) return 0;
  return billingStore.pendingQuota.categories.reduce((sum, c) => sum + c.pendingTokens, 0);
});

// ==================== 菜单处理 ====================

onMounted(async () => {
  try {
    await userStore.fetchProfile();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "获取用户信息失败";
    message.error(errorMessage);
  }

  try {
    await Promise.all([
      billingStore.fetchQuota(),
      billingStore.fetchPendingQuota(),
      billingStore.fetchSubscription(),
    ]);
  } catch {
    // 额度数据加载失败不影响页面展示
  }
});

function handleMenuSelect(key: string) {
  switch (key) {
    case "profile":
      break;
    case "default-models":
      router.push("/user/default-models");
      break;
  }
}

// 退出登录
async function handleLogout() {
  await authStore.logout();
  router.push("/login");
}

// ==================== 头像上传 ====================

function beforeAvatarUpload({ file }: { file: { type?: string } }) {
  const isImage = file.type?.startsWith("image/");
  if (!isImage) {
    message.error("只能上传图片文件");
    return false;
  }
  return true;
}

async function handleAvatarUpload({ file }: { file: { file: File } }) {
  try {
    await userStore.uploadAvatar(file.file);
    message.success("头像上传成功");
    showAvatarUpload.value = false;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "上传失败";
    message.error(errorMessage);
  }
}

// ==================== 工具方法 ====================

function maskPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function getTierType(tier?: string): "default" | "primary" | "success" {
  switch (tier) {
    case "pro": return "success";
    case "basic": return "primary";
    default: return "default";
  }
}

function getTierLabel(tier?: string): string {
  switch (tier) {
    case "pro": return "专业版";
    case "basic": return "基础版";
    default: return "免费版";
  }
}
</script>

<style scoped lang="scss">
.profile-page {
  min-height: 100vh;
  background: var(--color-bg-base);
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
}

.logo {
  cursor: pointer;

  h2 {
    margin: 0;
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  min-height: calc(100vh - 64px);
}

.profile-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  min-height: calc(100vh - 64px - 48px);
}

.sidebar-card {
  height: fit-content;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);

  .user-brief {
    text-align: center;
    padding: 16px 0;

    .user-avatar {
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover { opacity: 0.8; }
    }

    .username {
      margin: 12px 0 4px;
      font-size: 18px;
      font-weight: 500;
      color: var(--color-text-primary);
    }

    .greeting {
      font-size: 13px;
      margin-top: 8px;
      display: block;
    }
  }

  .user-info-list {
    padding: 0 16px;

    .info-item {
      margin-bottom: 12px;

      &:last-child { margin-bottom: 0; }

      .info-label {
        font-size: 12px;
        display: block;
        margin-bottom: 4px;
      }

      .info-value-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
    }
  }
}

.content-area {
  .mt-3 { margin-top: 12px; }
}

// 右侧内容区卡片统一样式
.content-area > .n-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-md);
}

// 订阅与额度卡片
.subscription-card {
  .subscription-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .balance-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
}

// 预扣额度汇总
.pending-summary {
  margin-top: 12px;
  padding: 8px 12px;
  background: #f0faff;
  border-radius: 8px;
  border-left: 3px solid #1890ff;
}

// 额度详情
.quota-detail {
  margin-top: 16px;

  .quota-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
}

// 展平额度列表
.quota-flat-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.quota-flat-item {
  padding: 12px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);

  .quota-category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .category-name {
      font-weight: 500;
      font-size: 14px;
    }
  }

  .quota-cycle-section {
    padding: 8px 0;
    border-top: 1px dashed var(--color-border);

    &:first-of-type {
      border-top: none;
      padding-top: 0;
    }

    .cycle-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;

      .cycle-label {
        font-size: 12px;
        font-weight: 500;
      }

      .cycle-refresh {
        font-size: 11px;
        color: var(--color-text-disabled);
      }
    }

    .cycle-stats {
      margin-bottom: 6px;

      .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;

        .stat-label {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .stat-value {
          font-size: 12px;
          font-weight: 500;

          &.used {
            color: var(--color-text-secondary);
          }

          &.pending {
            color: var(--color-primary);
          }

          &.available {
            color: var(--color-success);
          }
        }

        &.pending {
          background: rgba(24, 144, 255, 0.1);
          border-radius: 4px;
          padding: 2px 4px;
          margin: 2px -4px;
        }
      }
    }
  }

  .model-quota-section {
    padding: 8px 0;
    border-top: 1px dashed var(--color-border);

    .model-header {
      margin-bottom: 6px;

      .model-label {
        font-size: 12px;
        font-weight: 500;
      }
    }

    .model-list {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .model-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 6px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 6px;

        .model-name {
          font-size: 11px;
          color: var(--color-text-secondary);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .model-cycles {
          display: flex;
          gap: 6px;

          .cycle-tag {
            font-size: 10px;
            padding: 2px 4px;
            border-radius: 4px;

            &.small {
              background: rgba(24, 144, 255, 0.1);
              color: #1890ff;
            }

            &.large {
              background: rgba(82, 196, 26, 0.1);
              color: #52c41a;
            }
          }
        }
      }
    }
  }
}

// 预扣额度区域
.pending-quota-section {
  padding: 8px 12px;
  background: #f0faff;
  border-radius: 8px;
  border-left: 3px solid #1890ff;
}

.pending-tag {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.02); }
}

// 额度详情 Tooltip
.quota-tooltip {
  min-width: 260px;
  padding: 4px 0;
}

.tooltip-title {
  font-weight: bold;
  font-size: 13px;
  padding: 4px 12px;
  color: #333;
}

.tooltip-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 6px 0;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 12px;
  font-size: 12px;
}

.tooltip-label { color: #666; }
.tooltip-value { color: #333; font-weight: 500; }
.tooltip-value.pending-highlight { color: #52c41a; animation: pulse 2s ease-in-out infinite; }

@media (max-width: 768px) {
  .profile-container { grid-template-columns: 1fr; }
}
</style>

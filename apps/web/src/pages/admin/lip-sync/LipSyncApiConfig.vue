<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  NCard,
  NButton,
  NSpace,
  NIcon,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NAlert,
  NDivider,
  NGrid,
  NGi,
  useMessage,
} from "naive-ui";
import { Save, Refresh, CheckmarkCircle, CloseCircle } from "@vicons/ionicons5";
import { adminConfigApi } from "@/api/admin";

interface LipSyncServiceConfig {
  enabled: boolean;
  costPerSecond: number;
  pricePerSecond: number;
}

interface SubjectDetectionConfig {
  enabled: boolean;
  costPerRequest: number;
  pricePerRequest: number;
}

interface LipSyncConfig {
  accessKey: string;
  secretKey: string;
  baseUrl: string;
  enabled: boolean;
  hasCredentials: boolean;
  subjectDetection: SubjectDetectionConfig;
  lipSync: LipSyncServiceConfig;
}

const message = useMessage();

// 状态
const loading = ref(false);
const saving = ref(false);

// 表单数据
const formData = ref({
  accessKey: "",
  secretKey: "",
  baseUrl: "https://open.volcengineapi.com",
  enabled: true,
  subjectDetection: {
    enabled: true,
    costPerRequest: 0.02,
    pricePerRequest: 0.05,
  },
  lipSync: {
    enabled: true,
    costPerSecond: 0.1,
    pricePerSecond: 0.2,
  },
});

// 原始配置（用于判断是否已配置）
const hasCredentials = ref(false);
const maskedAccessKey = ref("");
const maskedSecretKey = ref("");

// 是否显示密钥（明文）
const showAccessKey = ref(false);
const showSecretKey = ref(false);

// 获取配置
async function fetchConfig() {
  loading.value = true;
  try {
    const config =
      (await adminConfigApi.getLipSyncApiConfig()) as LipSyncConfig;
    if (config) {
      formData.value.baseUrl =
        config.baseUrl || "https://open.volcengineapi.com";
      formData.value.enabled = config.enabled ?? true;
      hasCredentials.value = config.hasCredentials ?? false;
      maskedAccessKey.value = config.accessKey || "";
      maskedSecretKey.value = config.secretKey || "";

      // 加载服务配置
      if (config.subjectDetection) {
        formData.value.subjectDetection = { ...config.subjectDetection };
      }
      if (config.lipSync) {
        formData.value.lipSync = { ...config.lipSync };
      }

      // 如果已有凭证，清空输入框
      if (config.hasCredentials) {
        formData.value.accessKey = "";
        formData.value.secretKey = "";
      }
    }
  } catch (error) {
    message.error("获取对口型配置失败");
  } finally {
    loading.value = false;
  }
}

// 保存配置
async function saveConfig() {
  // 如果没有输入新的凭证，且原来没有配置过
  if (
    !formData.value.accessKey &&
    !formData.value.secretKey &&
    !hasCredentials.value
  ) {
    message.warning("请输入 Access Key 和 Secret Key");
    return;
  }

  // 如果只输入了一个密钥
  if (
    (formData.value.accessKey && !formData.value.secretKey) ||
    (!formData.value.accessKey && formData.value.secretKey)
  ) {
    message.warning("Access Key 和 Secret Key 必须同时填写");
    return;
  }

  saving.value = true;
  try {
    const payload: {
      accessKey?: string;
      secretKey?: string;
      baseUrl?: string;
      enabled?: boolean;
      subjectDetection?: SubjectDetectionConfig;
      lipSync?: LipSyncServiceConfig;
    } = {
      baseUrl: formData.value.baseUrl,
      enabled: formData.value.enabled,
      subjectDetection: { ...formData.value.subjectDetection },
      lipSync: { ...formData.value.lipSync },
    };

    // 如果用户输入了新的凭证，使用新值
    if (formData.value.accessKey && formData.value.secretKey) {
      payload.accessKey = formData.value.accessKey;
      payload.secretKey = formData.value.secretKey;
    }

    const result = (await adminConfigApi.updateLipSyncApiConfig(
      payload,
    )) as LipSyncConfig;
    hasCredentials.value = result.hasCredentials ?? true;
    maskedAccessKey.value = result.accessKey || "";
    maskedSecretKey.value = result.secretKey || "";
    formData.value.accessKey = ""; // 清空输入框
    formData.value.secretKey = "";
    showAccessKey.value = false;
    showSecretKey.value = false;
    message.success("对口型配置保存成功");
  } catch (error) {
    message.error("保存失败");
  } finally {
    saving.value = false;
  }
}

// 切换 Access Key 显示
function toggleShowAccessKey() {
  showAccessKey.value = !showAccessKey.value;
}

// 切换 Secret Key 显示
function toggleShowSecretKey() {
  showSecretKey.value = !showSecretKey.value;
}

// 格式化价格显示（¥/次）
function formatPricePerRequest(price: number): string {
  return price.toFixed(4);
}

// 格式化价格显示（¥/秒）
function formatPricePerSecond(price: number): string {
  return price.toFixed(4);
}

onMounted(() => {
  fetchConfig();
});
</script>

<template>
  <div class="page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-title">
        <span>对口型 API 配置</span>
      </div>
      <n-space>
        <n-button
          :loading="loading"
          @click="fetchConfig"
        >
          <template #icon>
            <n-icon><Refresh /></n-icon>
          </template>
          刷新
        </n-button>
      </n-space>
    </div>

    <!-- 配置卡片 -->
    <n-card
      class="config-card"
      :bordered="false"
    >
      <!-- 状态提示 -->
      <n-alert
        :type="hasCredentials && formData.enabled ? 'success' : 'warning'"
        :title="
          hasCredentials && formData.enabled
            ? '对口型服务已配置'
            : '对口型服务未配置'
        "
        class="status-alert"
      >
        <template #icon>
          <n-icon>
            <CheckmarkCircle v-if="hasCredentials && formData.enabled" />
            <CloseCircle v-else />
          </n-icon>
        </template>
        <template v-if="hasCredentials && formData.enabled">
          对口型服务已启用，可以正常使用角色对口型视频生成功能。
        </template>
        <template v-else-if="hasCredentials && !formData.enabled">
          对口型 API 已配置但未启用，请在下方开启。
        </template>
        <template v-else>
          请配置火山引擎 Access Key 和 Secret Key 以启用对口型服务。
        </template>
      </n-alert>

      <n-divider />

      <n-form
        :model="formData"
        label-placement="left"
        label-width="120px"
        class="config-form"
      >
        <!-- 启用开关 -->
        <n-form-item label="启用服务">
          <div class="switch-row">
            <n-switch v-model:value="formData.enabled" />
            <span class="switch-status">
              {{ formData.enabled ? "已启用" : "已禁用" }}
            </span>
          </div>
        </n-form-item>

        <n-divider />

        <!-- Access Key -->
        <n-form-item label="Access Key">
          <div class="key-section">
            <div class="key-input">
              <n-input
                v-if="showAccessKey || !hasCredentials"
                v-model:value="formData.accessKey"
                type="password"
                show-password-on="click"
                placeholder="输入新的 Access Key"
                style="width: 360px"
              />
              <n-input
                v-else
                :value="maskedAccessKey"
                disabled
                style="width: 360px"
              />
              <n-button
                v-if="hasCredentials"
                quaternary
                size="small"
                @click="toggleShowAccessKey"
              >
                {{ showAccessKey ? "取消" : "修改" }}
              </n-button>
            </div>
            <div class="field-tip">
              火山引擎 Access Key，可在火山引擎控制台获取
            </div>
          </div>
        </n-form-item>

        <!-- Secret Key -->
        <n-form-item label="Secret Key">
          <div class="key-section">
            <div class="key-input">
              <n-input
                v-if="showSecretKey || !hasCredentials"
                v-model:value="formData.secretKey"
                type="password"
                show-password-on="click"
                placeholder="输入新的 Secret Key"
                style="width: 360px"
              />
              <n-input
                v-else
                :value="maskedSecretKey"
                disabled
                style="width: 360px"
              />
              <n-button
                v-if="hasCredentials"
                quaternary
                size="small"
                @click="toggleShowSecretKey"
              >
                {{ showSecretKey ? "取消" : "修改" }}
              </n-button>
            </div>
            <div class="field-tip">
              火山引擎 Secret Key，与 Access Key 配对使用
            </div>
          </div>
        </n-form-item>

        <!-- Base URL -->
        <n-form-item label="API 端点">
          <div class="field-section">
            <n-input
              v-model:value="formData.baseUrl"
              placeholder="https://open.volcengineapi.com"
              style="width: 360px"
            />
            <div class="field-tip">
              默认使用火山引擎开放平台端点，一般无需修改
            </div>
          </div>
        </n-form-item>
      </n-form>
    </n-card>

    <!-- 服务价格配置卡片 -->
    <n-card
      class="price-card"
      :bordered="false"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title">服务价格配置</span>
          <span class="card-subtitle">计费单位：¥/次 或 ¥/秒</span>
        </div>
      </template>

      <n-grid
        :cols="2"
        :x-gap="24"
      >
        <!-- 主体检测服务 -->
        <n-gi>
          <div class="service-section">
            <div class="service-header">
              <div class="service-name">
                主体检测服务
              </div>
              <n-switch
                v-model:value="formData.subjectDetection.enabled"
                size="small"
              />
            </div>
            <div class="service-desc">
              检测分镜图中的人物主体位置，用于角色框选对口型
            </div>
            <div class="price-row">
              <div class="price-item">
                <span class="price-label">成本</span>
                <n-input-number
                  v-model:value="formData.subjectDetection.costPerRequest"
                  :min="0"
                  :step="0.01"
                  :precision="4"
                  :disabled="!formData.subjectDetection.enabled"
                >
                  <template #suffix>
                    ¥/次
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerRequest(
                      formData.subjectDetection.costPerRequest,
                    )
                  }}/次
                </span>
              </div>
              <div class="price-item">
                <span class="price-label">售价</span>
                <n-input-number
                  v-model:value="formData.subjectDetection.pricePerRequest"
                  :min="0"
                  :step="0.01"
                  :precision="4"
                  :disabled="!formData.subjectDetection.enabled"
                >
                  <template #suffix>
                    ¥/次
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerRequest(
                      formData.subjectDetection.pricePerRequest,
                    )
                  }}/次
                </span>
              </div>
            </div>
          </div>
        </n-gi>

        <!-- 对口型服务 -->
        <n-gi>
          <div class="service-section">
            <div class="service-header">
              <div class="service-name">
                对口型服务
              </div>
              <n-switch
                v-model:value="formData.lipSync.enabled"
                size="small"
              />
            </div>
            <div class="service-desc">
              火山引擎 OmniHuman1.5，根据音频生成对口型视频
            </div>
            <div class="price-row">
              <div class="price-item">
                <span class="price-label">成本</span>
                <n-input-number
                  v-model:value="formData.lipSync.costPerSecond"
                  :min="0"
                  :step="0.01"
                  :precision="4"
                  :disabled="!formData.lipSync.enabled"
                >
                  <template #suffix>
                    ¥/秒
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerSecond(formData.lipSync.costPerSecond)
                  }}/秒
                </span>
              </div>
              <div class="price-item">
                <span class="price-label">售价</span>
                <n-input-number
                  v-model:value="formData.lipSync.pricePerSecond"
                  :min="0"
                  :step="0.01"
                  :precision="4"
                  :disabled="!formData.lipSync.enabled"
                >
                  <template #suffix>
                    ¥/秒
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerSecond(formData.lipSync.pricePerSecond)
                  }}/秒
                </span>
              </div>
            </div>
          </div>
        </n-gi>
      </n-grid>

      <div class="form-actions">
        <n-button
          type="primary"
          size="large"
          :loading="saving"
          @click="saveConfig"
        >
          <template #icon>
            <n-icon><Save /></n-icon>
          </template>
          保存配置
        </n-button>
      </div>
    </n-card>

    <!-- 使用说明 -->
    <n-card
      class="help-card"
      :bordered="false"
    >
      <h3 class="help-title">
        使用说明
      </h3>
      <ol class="help-list">
        <li>
          前往
          <a
            href="https://console.volcengine.com/"
            target="_blank"
          >火山引擎控制台</a>
          获取 Access Key 和 Secret Key
        </li>
        <li>确保已开通主体检测服务和 OmniHuman1.5 对口型服务</li>
        <li>将凭证填入上方配置项并保存</li>
        <li>在剧本编辑页面即可使用角色对口型视频生成功能</li>
      </ol>
    </n-card>
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

.config-card,
.price-card,
.help-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
  margin-bottom: 24px;
}

.status-alert {
  margin-bottom: 16px;
}

.config-form {
  .switch-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .switch-status {
      color: #666;
      font-size: 14px;
    }
  }

  .key-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .key-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .field-tip {
    color: #999;
    font-size: 13px;
    line-height: 1.5;
  }
}

.price-card {
  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;

    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
    }

    .card-subtitle {
      font-size: 13px;
      color: #999;
    }
  }

  .service-section {
    padding: 16px;
    border: 1px solid rgba(157, 138, 231, 0.15);
    border-radius: 8px;
    background: rgba(157, 138, 231, 0.03);

    .service-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .service-name {
        font-size: 15px;
        font-weight: 600;
        color: #2d2b4d;
      }
    }

    .service-desc {
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
    }

    .price-row {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .price-item {
      display: flex;
      align-items: center;
      gap: 12px;

      .price-label {
        width: 40px;
        font-size: 13px;
        color: #666;
      }

      .price-hint {
        font-size: 12px;
        color: #999;
      }
    }
  }
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(157, 138, 231, 0.1);
}

.help-card {
  .help-title {
    font-size: 16px;
    font-weight: 600;
    color: #2d2b4d;
    margin: 0 0 16px;
  }

  .help-list {
    margin: 0;
    padding-left: 20px;
    color: #666;
    font-size: 14px;
    line-height: 2;

    a {
      color: #9d8ae7;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>

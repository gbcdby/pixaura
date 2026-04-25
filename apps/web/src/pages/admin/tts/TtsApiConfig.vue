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

interface TTSModelPrice {
  enabled: boolean;
  costPerChar: number;
  pricePerChar: number;
}

interface TTSConfig {
  apiKey: string;
  baseUrl: string;
  enabled: boolean;
  hasApiKey: boolean;
  models: {
    flash: TTSModelPrice;
    instructFlash: TTSModelPrice;
  };
}

const message = useMessage();

// 状态
const loading = ref(false);
const saving = ref(false);

// 表单数据
const formData = ref({
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com",
  enabled: true,
  models: {
    flash: {
      enabled: true,
      costPerChar: 0.00002,
      pricePerChar: 0.00005,
    },
    instructFlash: {
      enabled: true,
      costPerChar: 0.00003,
      pricePerChar: 0.00008,
    },
  },
});

// 原始配置（用于判断是否已配置）
const hasApiKey = ref(false);
const maskedApiKey = ref("");

// 是否显示 API Key（明文）
const showApiKey = ref(false);

// 获取配置
async function fetchConfig() {
  loading.value = true;
  try {
    const config = (await adminConfigApi.getTTSApiConfig()) as TTSConfig;
    if (config) {
      formData.value.baseUrl =
        config.baseUrl || "https://dashscope.aliyuncs.com";
      formData.value.enabled = config.enabled ?? true;
      hasApiKey.value = config.hasApiKey ?? false;
      maskedApiKey.value = config.apiKey || "";

      // 加载模型配置
      if (config.models) {
        if (config.models.flash) {
          formData.value.models.flash = { ...config.models.flash };
        }
        if (config.models.instructFlash) {
          formData.value.models.instructFlash = {
            ...config.models.instructFlash,
          };
        }
      }

      // 如果已有 API Key，显示掩码值
      if (config.hasApiKey) {
        formData.value.apiKey = "";
      }
    }
  } catch (error) {
    message.error("获取 TTS 配置失败");
  } finally {
    loading.value = false;
  }
}

// 保存配置
async function saveConfig() {
  // 如果没有输入新的 API Key，且原来没有配置过
  if (!formData.value.apiKey && !hasApiKey.value) {
    message.warning("请输入 API Key");
    return;
  }

  saving.value = true;
  try {
    const payload: {
      apiKey?: string;
      baseUrl?: string;
      enabled?: boolean;
      models?: {
        flash?: TTSModelPrice;
        instructFlash?: TTSModelPrice;
      };
    } = {
      baseUrl: formData.value.baseUrl,
      enabled: formData.value.enabled,
      models: {
        flash: { ...formData.value.models.flash },
        instructFlash: { ...formData.value.models.instructFlash },
      },
    };

    // 如果用户输入了新的 API Key，使用新值
    if (formData.value.apiKey) {
      payload.apiKey = formData.value.apiKey;
    }

    const result = (await adminConfigApi.updateTTSApiConfig(
      payload,
    )) as TTSConfig;
    hasApiKey.value = result.hasApiKey ?? true;
    maskedApiKey.value = result.apiKey || "";
    formData.value.apiKey = ""; // 清空输入框
    showApiKey.value = false;
    message.success("TTS 配置保存成功");
  } catch (error) {
    message.error("保存失败");
  } finally {
    saving.value = false;
  }
}

// 切换 API Key 显示
function toggleShowApiKey() {
  showApiKey.value = !showApiKey.value;
}

// 格式化价格显示（¥/千字）
function formatPricePerThousand(price: number): string {
  return (price * 1000).toFixed(4);
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
        <span>基础配置</span>
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
        :type="hasApiKey && formData.enabled ? 'success' : 'warning'"
        :title="
          hasApiKey && formData.enabled ? 'TTS 服务已配置' : 'TTS 服务未配置'
        "
        class="status-alert"
      >
        <template #icon>
          <n-icon>
            <CheckmarkCircle v-if="hasApiKey && formData.enabled" />
            <CloseCircle v-else />
          </n-icon>
        </template>
        <template v-if="hasApiKey && formData.enabled">
          TTS 服务已启用，可以正常使用语音合成功能。
        </template>
        <template v-else-if="hasApiKey && !formData.enabled">
          TTS API 已配置但未启用，请在下方开启。
        </template>
        <template v-else>
          请配置阿里云 DashScope API Key 以启用 TTS 服务。
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

        <!-- API Key -->
        <n-form-item label="API Key">
          <div class="api-key-section">
            <div class="api-key-input">
              <n-input
                v-if="showApiKey || !hasApiKey"
                v-model:value="formData.apiKey"
                type="password"
                show-password-on="click"
                placeholder="输入新的 API Key"
                style="width: 360px"
              />
              <n-input
                v-else
                :value="maskedApiKey"
                disabled
                style="width: 360px"
              />
              <n-button
                v-if="hasApiKey"
                quaternary
                size="small"
                @click="toggleShowApiKey"
              >
                {{ showApiKey ? "取消" : "修改" }}
              </n-button>
            </div>
            <div class="field-tip">
              阿里云 DashScope API Key，用于千问 TTS 语音合成服务
            </div>
          </div>
        </n-form-item>

        <!-- Base URL -->
        <n-form-item label="API 端点">
          <div class="field-section">
            <n-input
              v-model:value="formData.baseUrl"
              placeholder="https://dashscope.aliyuncs.com"
              style="width: 360px"
            />
            <div class="field-tip">
              默认使用阿里云 DashScope 端点，一般无需修改
            </div>
          </div>
        </n-form-item>
      </n-form>
    </n-card>

    <!-- 模型价格配置卡片 -->
    <n-card
      class="price-card"
      :bordered="false"
    >
      <template #header>
        <div class="card-header">
          <span class="card-title">模型价格配置</span>
          <span class="card-subtitle">计费单位：¥/千字</span>
        </div>
      </template>

      <n-grid
        :cols="2"
        :x-gap="24"
      >
        <!-- Flash 模型 -->
        <n-gi>
          <div class="model-section">
            <div class="model-header">
              <div class="model-name">
                千问 TTS Flash
              </div>
              <n-switch
                v-model:value="formData.models.flash.enabled"
                size="small"
              />
            </div>
            <div class="model-desc">
              基础版，支持多音色语音合成
            </div>
            <div class="price-row">
              <div class="price-item">
                <span class="price-label">成本</span>
                <n-input-number
                  v-model:value="formData.models.flash.costPerChar"
                  :min="0"
                  :step="0.00001"
                  :precision="5"
                  :disabled="!formData.models.flash.enabled"
                >
                  <template #suffix>
                    ¥/字
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerThousand(formData.models.flash.costPerChar)
                  }}/千字
                </span>
              </div>
              <div class="price-item">
                <span class="price-label">售价</span>
                <n-input-number
                  v-model:value="formData.models.flash.pricePerChar"
                  :min="0"
                  :step="0.00001"
                  :precision="5"
                  :disabled="!formData.models.flash.enabled"
                >
                  <template #suffix>
                    ¥/字
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerThousand(formData.models.flash.pricePerChar)
                  }}/千字
                </span>
              </div>
            </div>
          </div>
        </n-gi>

        <!-- Instruct Flash 模型 -->
        <n-gi>
          <div class="model-section">
            <div class="model-header">
              <div class="model-name">
                千问 TTS Instruct Flash
              </div>
              <n-switch
                v-model:value="formData.models.instructFlash.enabled"
                size="small"
              />
            </div>
            <div class="model-desc">
              高级版，支持指令控制情绪、语速、风格
            </div>
            <div class="price-row">
              <div class="price-item">
                <span class="price-label">成本</span>
                <n-input-number
                  v-model:value="formData.models.instructFlash.costPerChar"
                  :min="0"
                  :step="0.00001"
                  :precision="5"
                  :disabled="!formData.models.instructFlash.enabled"
                >
                  <template #suffix>
                    ¥/字
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerThousand(
                      formData.models.instructFlash.costPerChar,
                    )
                  }}/千字
                </span>
              </div>
              <div class="price-item">
                <span class="price-label">售价</span>
                <n-input-number
                  v-model:value="formData.models.instructFlash.pricePerChar"
                  :min="0"
                  :step="0.00001"
                  :precision="5"
                  :disabled="!formData.models.instructFlash.enabled"
                >
                  <template #suffix>
                    ¥/字
                  </template>
                </n-input-number>
                <span class="price-hint">
                  ≈ ¥{{
                    formatPricePerThousand(
                      formData.models.instructFlash.pricePerChar,
                    )
                  }}/千字
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
            href="https://dashscope.console.aliyun.com/"
            target="_blank"
          >阿里云 DashScope 控制台</a>
          获取 API Key
        </li>
        <li>确保已开通千问 TTS 服务</li>
        <li>将 API Key 填入上方配置项并保存</li>
        <li>在剧本编辑页面即可使用语音合成功能</li>
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

  .api-key-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .api-key-input {
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

  .model-section {
    padding: 16px;
    border: 1px solid rgba(157, 138, 231, 0.15);
    border-radius: 8px;
    background: rgba(157, 138, 231, 0.03);

    .model-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;

      .model-name {
        font-size: 15px;
        font-weight: 600;
        color: #2d2b4d;
      }
    }

    .model-desc {
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

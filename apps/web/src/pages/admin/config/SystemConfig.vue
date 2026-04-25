<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
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
  NTabs,
  NTabPane,
  NDivider,
  NTag,
  useMessage,
} from "naive-ui";
import {
  Settings,
  CloudUpload,
  ShieldCheckmark,
  Save,
  Refresh,
  Add,
} from "@vicons/ionicons5";
import { useAdminConfigStore } from "@/stores/system-admin";

const message = useMessage();
const configStore = useAdminConfigStore();

// 从 Store 获取状态
const loading = computed(() => configStore.isLoading);
const saving = computed(() => configStore.isSaving);
const config = computed(() => configStore.config);
const activeTab = ref("fileupload");

// 临时IP输入
const newIp = ref("");

// 文件类型输入本地状态
const avatarFileTypes = ref("");
const referenceFileTypes = ref("");

// 格式化文件大小
function formatFileSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb} MB`;
}

// 获取配置
async function fetchConfig() {
  try {
    await configStore.fetchConfig();
    // 同步本地文件类型输入状态
    avatarFileTypes.value =
      config.value.fileUpload.avatar?.allowedTypes?.join(", ") ?? "";
    referenceFileTypes.value =
      config.value.fileUpload.reference?.allowedTypes?.join(", ") ?? "";
  } catch (error) {
    message.error("获取配置失败");
  }
}

// 校验文件类型格式
function validateFileTypes(types: string[]): boolean {
  for (const type of types) {
    // 检查是否包含非法字符（只允许小写字母和数字）
    if (!/^[a-z0-9]+$/.test(type)) {
      message.error(`文件格式 "${type}" 包含非法字符，只能使用小写字母和数字`);
      return false;
    }
  }
  return true;
}

// 保存文件上传配置
async function saveFileUploadConfig() {
  try {
    // 使用本地输入状态更新 config
    const avatarTypes = avatarFileTypes.value
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const referenceTypes = referenceFileTypes.value
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    // 校验文件类型格式
    if (!validateFileTypes(avatarTypes)) return;
    if (!validateFileTypes(referenceTypes)) return;

    config.value.fileUpload.avatar!.allowedTypes = avatarTypes;
    config.value.fileUpload.reference!.allowedTypes = referenceTypes;

    await configStore.updateFileUploadConfig(config.value.fileUpload);
    // 保存成功后同步本地状态（以防后端返回的数据有变化）
    avatarFileTypes.value =
      config.value.fileUpload.avatar?.allowedTypes?.join(", ") ?? "";
    referenceFileTypes.value =
      config.value.fileUpload.reference?.allowedTypes?.join(", ") ?? "";
    message.success("文件上传配置保存成功");
  } catch (error) {
    message.error("保存失败");
  }
}

// 保存限流配置
async function saveRateLimitConfig() {
  try {
    await configStore.updateRateLimitConfig(config.value.rateLimit);
    message.success("限流配置保存成功");
  } catch (error) {
    message.error("保存失败");
  }
}

// 添加IP白名单
function addWhitelistIp() {
  const ip = newIp.value.trim();
  if (!ip) {
    message.warning("请输入IP地址");
    return;
  }

  // 简单IP格式验证
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  if (!ipRegex.test(ip)) {
    message.error("IP格式不正确");
    return;
  }

  if (configStore.config.rateLimit.whitelistIps?.includes(ip)) {
    message.warning("该IP已存在");
    return;
  }

  configStore.addWhitelistIp(ip);
  newIp.value = "";
}

// 移除IP白名单
function removeWhitelistIp(ip: string) {
  configStore.removeWhitelistIp(ip);
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
        <n-icon
          size="24"
          class="title-icon"
        >
          <Settings />
        </n-icon>
        <span>系统配置</span>
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

    <!-- 配置标签页 -->
    <n-card
      class="config-card"
      :bordered="false"
    >
      <n-tabs
        v-model:value="activeTab"
        type="line"
        animated
      >
        <!-- 文件上传配置 -->
        <n-tab-pane
          name="fileupload"
          tab="文件上传"
        >
          <template #tab>
            <n-space
              align="center"
              :size="6"
            >
              <n-icon size="18">
                <CloudUpload />
              </n-icon>
              <span>文件上传</span>
            </n-space>
          </template>

          <n-form
            :model="config.fileUpload"
            label-placement="left"
            label-width="140px"
            class="config-form"
          >
            <!-- 头像配置 -->
            <div class="config-section">
              <h3 class="section-title">
                头像上传配置
              </h3>
              <n-divider />

              <n-form-item label="最大文件大小">
                <n-input-number
                  v-model:value="config.fileUpload.avatar!.maxSize"
                  :min="0.1"
                  :max="50"
                  :precision="1"
                  style="width: 200px"
                >
                  <template #suffix>
                    MB
                  </template>
                </n-input-number>
                <span class="form-tip">
                  建议 1-5 MB，当前约
                  {{ formatFileSize(config.fileUpload.avatar!.maxSize || 1) }}
                </span>
              </n-form-item>

              <n-form-item label="允许的文件格式">
                <n-input
                  v-model:value="avatarFileTypes"
                  placeholder="jpg, png, webp"
                  style="width: 300px"
                />
                <span class="form-tip">使用逗号分隔多个格式</span>
              </n-form-item>

              <n-form-item label="每日上传限制">
                <n-input-number
                  v-model:value="config.fileUpload.avatar!.dailyLimit"
                  :min="1"
                  :max="100"
                  style="width: 200px"
                >
                  <template #suffix>
                    次
                  </template>
                </n-input-number>
              </n-form-item>
            </div>

            <!-- 参考图配置 -->
            <div class="config-section">
              <h3 class="section-title">
                参考图上传配置
              </h3>
              <n-divider />

              <n-form-item label="最大文件大小">
                <n-input-number
                  v-model:value="config.fileUpload.reference!.maxSize"
                  :min="1"
                  :max="100"
                  :precision="0"
                  style="width: 200px"
                >
                  <template #suffix>
                    MB
                  </template>
                </n-input-number>
                <span class="form-tip"> 建议 5-20 MB </span>
              </n-form-item>

              <n-form-item label="允许的文件格式">
                <n-input
                  v-model:value="referenceFileTypes"
                  placeholder="jpg, png, webp"
                  style="width: 300px"
                />
              </n-form-item>
            </div>

            <!-- 项目文件配置 -->
            <div class="config-section">
              <h3 class="section-title">
                项目文件配置
              </h3>
              <n-divider />

              <n-form-item label="最大文件大小">
                <n-input-number
                  v-model:value="config.fileUpload.project!.maxSize"
                  :min="10"
                  :max="500"
                  :precision="0"
                  style="width: 200px"
                >
                  <template #suffix>
                    MB
                  </template>
                </n-input-number>
                <span class="form-tip">
                  项目文件（如剧本、分镜等）的大小限制
                </span>
              </n-form-item>
            </div>

            <div class="form-actions">
              <n-button
                type="primary"
                size="large"
                :loading="saving"
                @click="saveFileUploadConfig"
              >
                <template #icon>
                  <n-icon><Save /></n-icon>
                </template>
                保存文件上传配置
              </n-button>
            </div>
          </n-form>
        </n-tab-pane>

        <!-- 限流配置 -->
        <n-tab-pane
          name="ratelimit"
          tab="限流配置"
        >
          <template #tab>
            <n-space
              align="center"
              :size="6"
            >
              <n-icon size="18">
                <ShieldCheckmark />
              </n-icon>
              <span>限流配置</span>
            </n-space>
          </template>

          <n-form
            :model="config.rateLimit"
            label-placement="left"
            label-width="140px"
            class="config-form"
          >
            <n-form-item label="限流开关">
              <n-switch v-model:value="config.rateLimit.enabled" />
              <span class="form-tip">
                {{ config.rateLimit.enabled ? "已启用限流保护" : "限流已关闭" }}
              </span>
            </n-form-item>

            <template v-if="config.rateLimit.enabled">
              <n-divider />

              <n-form-item label="统计窗口">
                <n-input-number
                  v-model:value="config.rateLimit.windowSeconds"
                  :min="10"
                  :max="3600"
                  style="width: 200px"
                >
                  <template #suffix>
                    秒
                  </template>
                </n-input-number>
                <span class="form-tip"> 在此时间窗口内统计请求次数 </span>
              </n-form-item>

              <n-form-item label="最大请求数">
                <n-input-number
                  v-model:value="config.rateLimit.maxRequests"
                  :min="1"
                  :max="10000"
                  style="width: 200px"
                >
                  <template #suffix>
                    次
                  </template>
                </n-input-number>
                <span class="form-tip"> 每个窗口内允许的最大请求数 </span>
              </n-form-item>

              <n-form-item label="封禁时长">
                <n-input-number
                  v-model:value="config.rateLimit.banDurationSeconds"
                  :min="0"
                  :max="86400"
                  style="width: 200px"
                >
                  <template #suffix>
                    秒
                  </template>
                </n-input-number>
                <span class="form-tip">
                  超出限制后封禁的时长（0表示不封禁）
                </span>
              </n-form-item>

              <n-divider />

              <n-form-item label="IP白名单">
                <div class="ip-whitelist">
                  <n-space
                    vertical
                    :size="12"
                    style="width: 100%"
                  >
                    <n-space>
                      <n-input
                        v-model:value="newIp"
                        placeholder="输入IP地址，如 127.0.0.1"
                        style="width: 220px"
                        @keyup.enter="addWhitelistIp"
                      />
                      <n-button @click="addWhitelistIp">
                        <template #icon>
                          <n-icon><Add /></n-icon>
                        </template>
                        添加
                      </n-button>
                    </n-space>

                    <div class="ip-tags">
                      <n-tag
                        v-for="ip in config.rateLimit.whitelistIps"
                        :key="ip"
                        closable
                        @close="removeWhitelistIp(ip)"
                      >
                        {{ ip }}
                      </n-tag>
                      <n-text
                        v-if="!config.rateLimit.whitelistIps?.length"
                        depth="3"
                      >
                        暂无白名单IP
                      </n-text>
                    </div>

                    <n-text
                      depth="3"
                      style="font-size: 12px"
                    >
                      白名单中的IP不受限流限制，支持CIDR格式（如 10.0.0.0/8）
                    </n-text>
                  </n-space>
                </div>
              </n-form-item>
            </template>

            <div class="form-actions">
              <n-button
                type="primary"
                size="large"
                :loading="saving"
                @click="saveRateLimitConfig"
              >
                <template #icon>
                  <n-icon><Save /></n-icon>
                </template>
                保存限流配置
              </n-button>
            </div>
          </n-form>
        </n-tab-pane>
      </n-tabs>
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

.config-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);

  :deep(.n-tabs-nav) {
    border-bottom: 1px solid rgba(157, 138, 231, 0.1);
    margin-bottom: 24px;
  }
}

.config-form {
  max-width: 800px;

  .config-section {
    margin-bottom: 32px;

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #2d2b4d;
      margin: 0 0 8px;
    }
  }

  .form-tip {
    margin-left: 12px;
    color: #999;
    font-size: 13px;
  }

  .form-actions {
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid rgba(157, 138, 231, 0.1);
  }

  .ip-whitelist {
    .ip-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px;
      background: rgba(157, 138, 231, 0.05);
      border-radius: 8px;
      min-height: 44px;
    }
  }
}
</style>

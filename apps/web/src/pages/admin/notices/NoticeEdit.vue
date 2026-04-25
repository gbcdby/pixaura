<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDatePicker,
  NRadioGroup,
  NRadio,
  NSwitch,
  NButton,
  NSpace,
  NIcon,
  NModal,
  useMessage,
  NCheckbox,
} from "naive-ui";
import { ArrowBack, Save, Eye, Megaphone } from "@vicons/ionicons5";
import { useSystemNoticeStore } from "@/stores/system-notice";
import type { NoticeType, NoticePriority } from "@/api/system-notice";

const router = useRouter();
const route = useRoute();
const message = useMessage();
const noticeStore = useSystemNoticeStore();

// 判断是创建还是编辑
const isEdit = computed(() => !!route.params.id);
const noticeId = computed(() => route.params.id as string);

// 表单数据
const formData = ref({
  title: "",
  content: "",
  type: "other" as NoticeType,
  priority: "medium" as NoticePriority,
  status: "draft" as "draft" | "published",
  startAt: null as number | null,
  endAt: null as number | null,
  isTop: false,
  isPermanent: false,
});

// 表单验证规则
const formRules = {
  title: {
    required: true,
    message: "请输入公告标题",
    trigger: "blur",
  },
  content: {
    required: true,
    message: "请输入公告内容",
    trigger: "blur",
  },
  type: {
    required: true,
    message: "请选择公告类型",
    trigger: "change",
  },
  priority: {
    required: true,
    message: "请选择优先级",
    trigger: "change",
  },
  startAt: {
    required: true,
    message: "请选择开始时间",
    trigger: "change",
    validator: (_rule: any, value: number | null) => {
      if (!value) return new Error("请选择开始时间");
      return true;
    },
  },
};

const formRef = ref<InstanceType<typeof NForm> | null>(null);

// 预览弹窗
const previewVisible = ref(false);

// 类型选项
const typeOptions = [
  { label: "系统维护", value: "maintenance" },
  { label: "新功能", value: "feature" },
  { label: "重要通知", value: "important" },
  { label: "其他", value: "other" },
];

// 优先级选项
const priorityOptions = [
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
];

// 格式化日期为 ISO 字符串
function formatDateToISO(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString();
}

// 加载公告数据
async function loadNoticeData() {
  if (!isEdit.value) return;

  try {
    const notice = await noticeStore.fetchNoticeDetail(noticeId.value);
    formData.value = {
      title: notice.title,
      content: notice.content,
      type: notice.type,
      priority: notice.priority,
      status: notice.status === "published" ? "published" : "draft",
      startAt: new Date(notice.startAt).getTime(),
      endAt: notice.endAt ? new Date(notice.endAt).getTime() : null,
      isTop: notice.isTop,
      isPermanent: !notice.endAt,
    };
  } catch (error) {
    message.error("加载公告数据失败");
    router.push("/admin/notices");
  }
}

// 返回列表
function handleBack() {
  router.push("/admin/notices");
}

// 预览
function handlePreview() {
  previewVisible.value = true;
}

// 保存
async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch (error) {
    return;
  }

  try {
    const data = {
      title: formData.value.title,
      content: formData.value.content,
      type: formData.value.type,
      priority: formData.value.priority,
      status: formData.value.status,
      startAt: formatDateToISO(formData.value.startAt),
      endAt: formData.value.isPermanent
        ? null
        : formatDateToISO(formData.value.endAt),
      isTop: formData.value.isTop,
    };

    if (isEdit.value) {
      await noticeStore.updateNotice(noticeId.value, data);
      message.success("公告更新成功");
    } else {
      await noticeStore.createNotice(data);
      message.success("公告创建成功");
    }

    router.push("/admin/notices");
  } catch (error: any) {
    message.error(error.message || "保存失败");
  }
}

// 格式化日期显示
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 类型标签
function getTypeLabel(type: NoticeType): string {
  const map: Record<NoticeType, string> = {
    maintenance: "系统维护",
    feature: "新功能",
    important: "重要通知",
    other: "其他",
  };
  return map[type];
}

// 优先级标签
function getPriorityLabel(priority: NoticePriority): string {
  const map: Record<NoticePriority, string> = {
    high: "高",
    medium: "中",
    low: "低",
  };
  return map[priority];
}

onMounted(() => {
  loadNoticeData();
});
</script>

<template>
  <div class="page-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="page-title">
        <n-button
          quaternary
          @click="handleBack"
        >
          <template #icon>
            <n-icon><ArrowBack /></n-icon>
          </template>
          返回列表
        </n-button>
        <span class="title-text">{{ isEdit ? "编辑公告" : "创建公告" }}</span>
      </div>
    </div>

    <!-- 表单卡片 -->
    <n-card
      class="form-card"
      :bordered="false"
    >
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="100px"
        require-mark-placement="right-hanging"
      >
        <!-- 公告标题 -->
        <n-form-item
          label="公告标题"
          path="title"
        >
          <n-input
            v-model:value="formData.title"
            placeholder="请输入公告标题，1-200字符"
            maxlength="200"
            show-count
            clearable
          />
        </n-form-item>

        <!-- 公告类型和优先级 -->
        <n-form-item
          label="公告类型"
          path="type"
        >
          <n-space
            align="center"
            :size="24"
          >
            <n-select
              v-model:value="formData.type"
              :options="typeOptions"
              placeholder="选择类型"
              style="width: 200px"
            />
            <div class="form-item-inline">
              <span class="inline-label">优先级：</span>
              <n-select
                v-model:value="formData.priority"
                :options="priorityOptions"
                placeholder="选择优先级"
                style="width: 120px"
              />
            </div>
          </n-space>
        </n-form-item>

        <!-- 显示时间 -->
        <n-form-item
          label="显示时间"
          path="startAt"
        >
          <n-space
            align="center"
            :size="16"
            wrap
          >
            <n-date-picker
              v-model:value="formData.startAt"
              type="datetime"
              placeholder="选择开始时间"
              clearable
              style="width: 220px"
            />
            <span>至</span>
            <n-date-picker
              v-model:value="formData.endAt"
              type="datetime"
              placeholder="选择结束时间（可选）"
              clearable
              :disabled="formData.isPermanent"
              style="width: 220px"
            />
            <n-checkbox v-model:checked="formData.isPermanent">
              永久有效
            </n-checkbox>
          </n-space>
        </n-form-item>

        <!-- 置顶显示 -->
        <n-form-item label="置顶显示">
          <n-switch v-model:value="formData.isTop">
            <template #checked>
              置顶
            </template>
            <template #unchecked>
              不置顶
            </template>
          </n-switch>
          <span class="form-tip">高优先级公告将自动置顶显示</span>
        </n-form-item>

        <!-- 公告内容 -->
        <n-form-item
          label="公告内容"
          path="content"
        >
          <n-input
            v-model:value="formData.content"
            type="textarea"
            placeholder="请输入公告内容，支持富文本（HTML），最多10000字符"
            :rows="12"
            maxlength="10000"
            show-count
          />
        </n-form-item>

        <!-- 发布设置 -->
        <n-form-item label="发布设置">
          <n-radio-group v-model:value="formData.status">
            <n-space direction="vertical">
              <n-radio value="draft">
                保存为草稿
              </n-radio>
              <n-radio value="published">
                立即发布
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>

        <!-- 操作按钮 -->
        <n-form-item>
          <n-space>
            <n-button @click="handlePreview">
              <template #icon>
                <n-icon><Eye /></n-icon>
              </template>
              预览
            </n-button>
            <n-button @click="handleBack">
              取消
            </n-button>
            <n-button
              type="primary"
              @click="handleSave"
            >
              <template #icon>
                <n-icon><Save /></n-icon>
              </template>
              保存
            </n-button>
          </n-space>
        </n-form-item>
      </n-form>
    </n-card>

    <!-- 预览弹窗 -->
    <n-modal
      v-model:show="previewVisible"
      title="公告预览"
      preset="card"
      style="width: 600px"
      :bordered="false"
    >
      <div class="preview-content">
        <div class="preview-header">
          <div class="preview-title">
            <n-icon
              size="20"
              color="#f5222d"
            >
              <Megaphone />
            </n-icon>
            <span>{{ formData.title || "公告标题" }}</span>
            <n-tag
              v-if="formData.isTop"
              type="error"
              size="small"
            >
              置顶
            </n-tag>
          </div>
          <div class="preview-meta">
            <span>类型：{{ getTypeLabel(formData.type) }}</span>
            <span>优先级：{{ getPriorityLabel(formData.priority) }}</span>
            <span v-if="formData.startAt">开始时间：{{
              formatDate(formatDateToISO(formData.startAt))
            }}</span>
          </div>
        </div>
        <div
          class="preview-body"
          v-html="formData.content || '<p>公告内容...</p>'"
        />
      </div>
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
    gap: 16px;

    .title-text {
      font-size: 20px;
      font-weight: 600;
      color: #2d2b4d;
    }
  }
}

.form-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.04);
  border: 1px solid rgba(157, 138, 231, 0.1);
  max-width: 900px;
}

.form-item-inline {
  display: flex;
  align-items: center;
  gap: 8px;

  .inline-label {
    color: #666;
    font-size: 14px;
  }
}

.form-tip {
  margin-left: 12px;
  color: #999;
  font-size: 13px;
}

.preview-content {
  .preview-header {
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    margin-bottom: 16px;

    .preview-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: #2d2b4d;
      margin-bottom: 8px;
    }

    .preview-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #666;
    }
  }

  .preview-body {
    font-size: 14px;
    line-height: 1.8;
    color: #333;

    :deep(p) {
      margin-bottom: 12px;
    }

    :deep(ul),
    :deep(ol) {
      margin-bottom: 12px;
      padding-left: 24px;
    }

    :deep(li) {
      margin-bottom: 4px;
    }

    :deep(h1),
    :deep(h2),
    :deep(h3) {
      margin-bottom: 12px;
      font-weight: 600;
    }

    :deep(a) {
      color: #9d8ae7;
    }
  }
}
</style>

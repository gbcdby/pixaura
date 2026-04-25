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
  useMessage,
  NPopconfirm,
} from "naive-ui";
import {
  Megaphone,
  Search,
  Add,
  Create,
  Trash,
  CheckmarkCircle,
  CloseCircle,
  Refresh,
} from "@vicons/ionicons5";
import { useSystemNoticeStore } from "@/stores/system-notice";
import type {
  AdminNoticeItem,
  NoticeType,
  NoticeStatus,
  NoticePriority,
} from "@/api/system-notice";
import type { DataTableColumns } from "naive-ui";

const router = useRouter();
const message = useMessage();
const noticeStore = useSystemNoticeStore();

// 从 Store 获取状态
const loading = computed(() => noticeStore.loading);
const notices = computed(() => noticeStore.adminNotices);
const total = computed(() => noticeStore.total);
const page = computed({
  get: () => noticeStore.currentPage,
  set: (val) => noticeStore.setFilter({ page: val }),
});
const pageSize = computed({
  get: () => noticeStore.pageSize,
  set: (val) => noticeStore.setFilter({ pageSize: val }),
});

// 筛选条件
const keyword = ref("");
const typeFilter = ref<NoticeType | "">("");
const statusFilter = ref<NoticeStatus | "">("");
const priorityFilter = ref<NoticePriority | "">("");

// 类型映射
const typeMap: Record<NoticeType, { label: string; type: string }> = {
  maintenance: { label: "系统维护", type: "error" },
  feature: { label: "新功能", type: "info" },
  important: { label: "重要通知", type: "warning" },
  other: { label: "其他", type: "default" },
};

// 优先级映射
const priorityMap: Record<NoticePriority, { label: string; type: string }> = {
  high: { label: "高", type: "error" },
  medium: { label: "中", type: "warning" },
  low: { label: "低", type: "success" },
};

// 状态映射
const statusMap: Record<NoticeStatus, { label: string; type: string }> = {
  draft: { label: "草稿", type: "default" },
  published: { label: "已发布", type: "success" },
  unpublished: { label: "已下架", type: "error" },
};

// 表格列定义
const columns: DataTableColumns<AdminNoticeItem> = [
  {
    title: "标题",
    key: "title",
    width: 280,
    ellipsis: { tooltip: true },
    render(row) {
      return h(
        NSpace,
        { align: "center", size: 4 },
        {
          default: () => [
            row.isTop
              ? h(
                  NTag,
                  { type: "error", size: "small" },
                  { default: () => "置顶" },
                )
              : null,
            h("span", row.title),
          ],
        },
      );
    },
  },
  {
    title: "类型",
    key: "type",
    width: 120,
    render(row) {
      const type = typeMap[row.type];
      return h(
        NTag,
        { type: type.type as any, size: "small" },
        { default: () => type.label },
      );
    },
  },
  {
    title: "优先级",
    key: "priority",
    width: 100,
    render(row) {
      const priority = priorityMap[row.priority];
      return h(
        NTag,
        { type: priority.type as any, size: "small" },
        { default: () => priority.label },
      );
    },
  },
  {
    title: "状态",
    key: "status",
    width: 100,
    render(row) {
      const status = statusMap[row.status];
      return h(
        NTag,
        { type: status.type as any, size: "small" },
        { default: () => status.label },
      );
    },
  },
  {
    title: "浏览量",
    key: "viewCount",
    width: 100,
  },
  {
    title: "创建人",
    key: "creatorName",
    width: 120,
  },
  {
    title: "开始时间",
    key: "startAt",
    width: 180,
    render(row) {
      return formatDate(row.startAt);
    },
  },
  {
    title: "操作",
    key: "actions",
    width: 220,
    fixed: "right",
    render(row) {
      const buttons: any[] = [
        h(
          NButton,
          {
            size: "small",
            type: "primary",
            ghost: true,
            onClick: () => handleEdit(row),
          },
          {
            icon: () => h(NIcon, null, { default: () => h(Create) }),
            default: () => "编辑",
          },
        ),
      ];

      // 根据状态显示不同操作按钮
      if (row.status === "draft") {
        buttons.push(
          h(
            NButton,
            {
              size: "small",
              type: "success",
              ghost: true,
              onClick: () => handlePublish(row),
            },
            {
              icon: () => h(NIcon, null, { default: () => h(CheckmarkCircle) }),
              default: () => "发布",
            },
          ),
          h(
            NPopconfirm,
            {
              onPositiveClick: () => handleDelete(row),
            },
            {
              trigger: () =>
                h(
                  NButton,
                  {
                    size: "small",
                    type: "error",
                    ghost: true,
                  },
                  {
                    icon: () => h(NIcon, null, { default: () => h(Trash) }),
                    default: () => "删除",
                  },
                ),
              default: () => "确定要删除该公告吗？",
            },
          ),
        );
      } else if (row.status === "published") {
        buttons.push(
          h(
            NPopconfirm,
            {
              onPositiveClick: () => handleUnpublish(row),
            },
            {
              trigger: () =>
                h(
                  NButton,
                  {
                    size: "small",
                    type: "warning",
                    ghost: true,
                  },
                  {
                    icon: () =>
                      h(NIcon, null, { default: () => h(CloseCircle) }),
                    default: () => "下架",
                  },
                ),
              default: () => "确定要下架该公告吗？",
            },
          ),
        );
      } else if (row.status === "unpublished") {
        buttons.push(
          h(
            NButton,
            {
              size: "small",
              type: "success",
              ghost: true,
              onClick: () => handlePublish(row),
            },
            {
              icon: () => h(NIcon, null, { default: () => h(CheckmarkCircle) }),
              default: () => "重新发布",
            },
          ),
          h(
            NPopconfirm,
            {
              onPositiveClick: () => handleDelete(row),
            },
            {
              trigger: () =>
                h(
                  NButton,
                  {
                    size: "small",
                    type: "error",
                    ghost: true,
                  },
                  {
                    icon: () => h(NIcon, null, { default: () => h(Trash) }),
                    default: () => "删除",
                  },
                ),
              default: () => "确定要删除该公告吗？",
            },
          ),
        );
      }

      return h(NSpace, { size: "small" }, { default: () => buttons });
    },
  },
];

// 类型筛选选项
const typeOptions = [
  { label: "全部类型", value: "" },
  { label: "系统维护", value: "maintenance" },
  { label: "新功能", value: "feature" },
  { label: "重要通知", value: "important" },
  { label: "其他", value: "other" },
];

// 状态筛选选项
const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "草稿", value: "draft" },
  { label: "已发布", value: "published" },
  { label: "已下架", value: "unpublished" },
];

// 优先级筛选选项
const priorityOptions = [
  { label: "全部优先级", value: "" },
  { label: "高", value: "high" },
  { label: "中", value: "medium" },
  { label: "低", value: "low" },
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

// 获取公告列表
async function fetchNotices() {
  try {
    await noticeStore.fetchAdminNotices({
      keyword: keyword.value || undefined,
      type: (typeFilter.value as NoticeType) || undefined,
      status: (statusFilter.value as NoticeStatus) || undefined,
      priority: (priorityFilter.value as NoticePriority) || undefined,
    });
  } catch (error) {
    message.error("获取公告列表失败");
  }
}

// 搜索
function handleSearch() {
  noticeStore.setFilter({ page: 1 });
  fetchNotices();
}

// 重置筛选
function handleReset() {
  keyword.value = "";
  typeFilter.value = "";
  statusFilter.value = "";
  priorityFilter.value = "";
  noticeStore.resetFilter();
  fetchNotices();
}

// 新建公告
function handleCreate() {
  router.push("/admin/notices/create");
}

// 编辑公告
function handleEdit(notice: AdminNoticeItem) {
  router.push(`/admin/notices/${notice.id}/edit`);
}

// 发布公告
async function handlePublish(notice: AdminNoticeItem) {
  try {
    await noticeStore.updateNoticeStatus(notice.id, "published");
    message.success("公告发布成功");
    fetchNotices();
  } catch (error) {
    message.error("发布失败");
  }
}

// 下架公告
async function handleUnpublish(notice: AdminNoticeItem) {
  try {
    await noticeStore.updateNoticeStatus(notice.id, "unpublished");
    message.success("公告已下架");
    fetchNotices();
  } catch (error) {
    message.error("下架失败");
  }
}

// 删除公告
async function handleDelete(notice: AdminNoticeItem) {
  try {
    await noticeStore.deleteNotice(notice.id);
    message.success("公告删除成功");
    fetchNotices();
  } catch (error) {
    message.error("删除失败");
  }
}

// 分页变化
function handlePageChange(newPage: number) {
  page.value = newPage;
  fetchNotices();
}

// 每页条数变化
function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize;
  page.value = 1;
  fetchNotices();
}

onMounted(() => {
  fetchNotices();
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
          <Megaphone />
        </n-icon>
        <span>系统公告管理</span>
      </div>
      <n-button
        type="primary"
        @click="handleCreate"
      >
        <template #icon>
          <n-icon><Add /></n-icon>
        </template>
        新建公告
      </n-button>
    </div>

    <!-- 搜索筛选 -->
    <n-card
      class="filter-card"
      :bordered="false"
    >
      <n-space
        align="center"
        :size="16"
        wrap
      >
        <n-input
          v-model:value="keyword"
          placeholder="搜索公告标题"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <n-icon :component="Search" />
          </template>
        </n-input>
        <n-select
          v-model:value="typeFilter"
          :options="typeOptions"
          placeholder="选择类型"
          clearable
          style="width: 140px"
          @update:value="handleSearch"
        />
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="选择状态"
          clearable
          style="width: 140px"
          @update:value="handleSearch"
        />
        <n-select
          v-model:value="priorityFilter"
          :options="priorityOptions"
          placeholder="选择优先级"
          clearable
          style="width: 140px"
          @update:value="handleSearch"
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

    <!-- 公告表格 -->
    <n-card
      class="table-card"
      :bordered="false"
    >
      <n-data-table
        :columns="columns"
        :data="notices"
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
</style>

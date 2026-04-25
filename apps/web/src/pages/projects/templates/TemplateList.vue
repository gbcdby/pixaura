<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NTabs,
  NTabPane,
  NGrid,
  NGridItem,
  NInput,
  NButton,
  NEmpty,
  NPagination,
  NIcon,
  useMessage,
  useDialog,
} from "naive-ui";
import { Search, Add } from "@vicons/ionicons5";
import TemplateCard from "@/components/template/TemplateCard.vue";
import CreateProjectModal from "@/components/project/CreateProjectModal.vue";
import { useTemplateStore } from "@/stores/template";
import { useUserStore } from "@/stores/user";
import type { TemplateListItem } from "@/api/template";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const templateStore = useTemplateStore();
const userStore = useUserStore();

// 当前标签页
const activeTab = ref<"system" | "user">("system");

// 搜索关键词
const searchKeyword = ref("");

// 加载状态
const loading = computed(() => templateStore.loading);

// 模板列表
const templates = computed(() => {
  if (activeTab.value === "system") {
    return templateStore.systemTemplates;
  }
  return templateStore.myTemplates;
});

// 分页
const pagination = computed(() => templateStore.pagination);

// 加载模板列表
const loadTemplates = async () => {
  if (activeTab.value === "system") {
    await templateStore.fetchSystemTemplates(50);
  } else {
    await templateStore.fetchMyTemplates();
  }
};

// 切换标签页
const handleTabChange = (tab: string) => {
  activeTab.value = tab as "system" | "user";
  loadTemplates();
};

// 搜索
const handleSearch = () => {
  // TODO: 实现搜索功能
  message.info("搜索功能开发中");
};

// 点击模板卡片
const handleTemplateClick = (template: TemplateListItem) => {
  router.push(`/projects/templates/${template.id}`);
};

// 使用模板
const handleUseTemplate = (template: TemplateListItem) => {
  router.push(`/projects/templates/${template.id}/create`);
};

// 删除模板
const handleDeleteTemplate = (templateId: string) => {
  const d = dialog.warning({
    title: "确认删除",
    content: "删除后无法恢复，是否继续？",
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      d.loading = true;
      try {
        await templateStore.deleteTemplate(templateId);
        message.success("模板已删除");
      } catch (error) {
        message.error("删除失败");
      } finally {
        d.loading = false;
      }
    },
  });
};

// 检查是否可以删除
const canDelete = (template: TemplateListItem): boolean => {
  return (
    template.type === "user" && template.creator?.id === userStore.profile?.id
  );
};

// 创建项目弹窗
const showCreateModal = ref(false);

const handleCreateSuccess = () => {
  router.push("/projects");
};

onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <div class="template-list-page">
    <n-layout class="main-layout">
      <!-- 顶部栏 -->
      <n-layout-header
        class="header"
        bordered
      >
        <div class="header-content">
          <h1 class="page-title">
            项目模板
          </h1>
          <n-button
            type="primary"
            @click="showCreateModal = true"
          >
            <template #icon>
              <n-icon><Add /></n-icon>
            </template>
            新建项目
          </n-button>
        </div>
      </n-layout-header>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <n-input
          v-model:value="searchKeyword"
          placeholder="搜索模板"
          clearable
          style="width: 240px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <n-icon><Search /></n-icon>
          </template>
        </n-input>
      </div>

      <!-- 内容区 -->
      <n-layout-content class="content">
        <n-tabs
          v-model:value="activeTab"
          type="line"
          @update:value="handleTabChange"
        >
          <n-tab-pane
            name="system"
            tab="系统模板"
          >
            <!-- 系统模板列表 -->
            <n-empty
              v-if="!loading && templates.length === 0"
              description="暂无系统模板"
              class="empty-state"
            />
            <n-grid
              v-else
              :cols="4"
              :x-gap="20"
              :y-gap="20"
              responsive="screen"
              item-responsive
            >
              <n-grid-item
                v-for="template in templates"
                :key="template.id"
                span="2 s:2 m:1 l:1 xl:1"
              >
                <TemplateCard
                  :template="template"
                  @click="handleTemplateClick(template)"
                  @use="handleUseTemplate(template)"
                />
              </n-grid-item>
            </n-grid>
          </n-tab-pane>

          <n-tab-pane
            name="user"
            tab="我的模板"
          >
            <!-- 我的模板列表 -->
            <n-empty
              v-if="!loading && templates.length === 0"
              description="暂无我的模板，可以从项目保存"
              class="empty-state"
            >
              <template #extra>
                <n-button @click="$router.push('/projects')">
                  去保存模板
                </n-button>
              </template>
            </n-empty>
            <n-grid
              v-else
              :cols="4"
              :x-gap="20"
              :y-gap="20"
              responsive="screen"
              item-responsive
            >
              <n-grid-item
                v-for="template in templates"
                :key="template.id"
                span="2 s:2 m:1 l:1 xl:1"
              >
                <TemplateCard
                  :template="template"
                  :can-delete="canDelete(template)"
                  @click="handleTemplateClick(template)"
                  @use="handleUseTemplate(template)"
                  @delete="handleDeleteTemplate(template.id)"
                />
              </n-grid-item>
            </n-grid>
          </n-tab-pane>
        </n-tabs>

        <!-- 分页 -->
        <div
          v-if="pagination.totalPages > 1"
          class="pagination"
        >
          <n-pagination
            :page="pagination.page"
            :page-count="pagination.totalPages"
            :page-size="pagination.pageSize"
            @update:page="
              (page) => {
                pagination.page = page;
                loadTemplates();
              }
            "
          />
        </div>
      </n-layout-content>
    </n-layout>

    <!-- 创建项目弹窗 -->
    <CreateProjectModal
      v-model:show="showCreateModal"
      @success="handleCreateSuccess"
    />
  </div>
</template>

<style scoped lang="scss">
.template-list-page {
  min-height: calc(100vh - 56px);
  background: #f5f7fa;
}

.main-layout {
  min-height: calc(100vh - 56px);
  background: transparent;
}

.header {
  background: #fff;
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0;
    }
  }
}

.filter-bar {
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.content {
  padding: 24px;
  background: #f5f7fa;

  :deep(.n-tabs) {
    background: #fff;
    padding: 16px 24px;
    border-radius: 8px;
  }

  .empty-state {
    padding: 80px 0;
  }

  .pagination {
    display: flex;
    justify-content: center;
    margin-top: 24px;
    padding: 16px;
    background: #fff;
    border-radius: 8px;
  }
}
</style>

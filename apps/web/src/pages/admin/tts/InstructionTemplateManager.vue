<script setup lang="ts">
/**
 * TTS 指令模板管理页面
 * 管理千问 TTS 指令模板，支持分类管理和 CRUD 操作
 */
import { ref, computed, onMounted, h } from "vue";
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
  NIcon,
  useMessage,
  useDialog,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import { Refresh, Add, Create, Trash, Search } from "@vicons/ionicons5";
import { ttsApi, ttsAdminApi, type TTSInstructionTemplateDto } from "@/api/tts";

const message = useMessage();
const dialog = useDialog();

// 模板列表
const templates = ref<TTSInstructionTemplateDto[]>([]);
const loading = ref(false);

// 搜索关键词
const searchQuery = ref("");

// 分类筛选
const categoryFilter = ref<string | undefined>(undefined);

// 编辑弹窗
const showEditModal = ref(false);
const editingTemplate = ref<TTSInstructionTemplateDto | null>(null);
const editForm = ref({
  name: "",
  description: "",
  category: "emotion",
  content: "",
  isSystem: false,
});

// 新增弹窗
const showAddModal = ref(false);
const addForm = ref({
  name: "",
  description: "",
  category: "emotion",
  content: "",
});

// 分类选项
const categoryOptions = [
  { label: "情感", value: "emotion" },
  { label: "风格", value: "style" },
  { label: "场景", value: "scene" },
  { label: "语速", value: "speed" },
];

// 过滤后的模板列表
const filteredTemplates = computed(() => {
  let list = templates.value;
  if (categoryFilter.value) {
    list = list.filter((t) => t.category === categoryFilter.value);
  }
  if (searchQuery.value.trim()) {
    const keyword = searchQuery.value.toLowerCase();
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(keyword) ||
        t.description?.toLowerCase().includes(keyword) ||
        t.content.toLowerCase().includes(keyword),
    );
  }
  return list;
});

// 表格列配置
const columns: DataTableColumns<TTSInstructionTemplateDto> = [
  {
    title: "名称",
    key: "name",
    width: 150,
  },
  {
    title: "描述",
    key: "description",
    width: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: "分类",
    key: "category",
    width: 100,
    render: (row) => {
      const label =
        categoryOptions.find((o) => o.value === row.category)?.label ||
        row.category;
      const type = row.category === "emotion" ? "error" : "info";
      return h(NTag, { type, size: "small" }, () => label);
    },
  },
  {
    title: "指令内容",
    key: "content",
    ellipsis: { tooltip: true },
  },
  {
    title: "类型",
    key: "isSystem",
    width: 80,
    render: (row) =>
      h(NTag, { type: row.isSystem ? "info" : "default", size: "small" }, () =>
        row.isSystem ? "系统" : "自定义",
      ),
  },
  {
    title: "操作",
    key: "actions",
    width: 120,
    render: (row) =>
      h(NSpace, null, () => [
        h(
          NButton,
          {
            text: true,
            type: "primary",
            onClick: () => handleEdit(row),
          },
          { icon: () => h(NIcon, null, () => h(Create)) },
        ),
        !row.isSystem &&
          h(
            NButton,
            {
              text: true,
              type: "error",
              onClick: () => handleDelete(row),
            },
            { icon: () => h(NIcon, null, () => h(Trash)) },
          ),
      ]),
  },
];

// 加载模板列表
async function loadTemplates() {
  loading.value = true;
  try {
    templates.value = await ttsApi.getInstructionTemplates();
  } catch (error: any) {
    message.error(error.message || "加载模板列表失败");
  } finally {
    loading.value = false;
  }
}

// 打开编辑弹窗
function handleEdit(template: TTSInstructionTemplateDto) {
  editingTemplate.value = template;
  editForm.value = {
    name: template.name,
    description: template.description || "",
    category: template.category || "emotion",
    content: template.content,
    isSystem: template.isSystem,
  };
  showEditModal.value = true;
}

// 打开新增弹窗
function handleAdd() {
  addForm.value = {
    name: "",
    description: "",
    category: "emotion",
    content: "",
  };
  showAddModal.value = true;
}

// 删除模板
async function handleDelete(template: TTSInstructionTemplateDto) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除模板 "${template.name}" 吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await ttsAdminApi.deleteInstructionTemplate(template.id);
        const index = templates.value.findIndex((t) => t.id === template.id);
        if (index > -1) {
          templates.value.splice(index, 1);
        }
        message.success("删除成功");
      } catch (error: any) {
        message.error(error.message || "删除失败");
      }
    },
  });
}

// 保存编辑
async function handleSaveEdit() {
  if (!editingTemplate.value) return;

  try {
    const updated = await ttsAdminApi.updateInstructionTemplate(
      editingTemplate.value.id,
      {
        name: editForm.value.name,
        description: editForm.value.description || undefined,
        category: editForm.value.category,
        content: editForm.value.content,
      },
    );
    // 更新本地数据
    Object.assign(editingTemplate.value, updated);
    message.success("保存成功");
    showEditModal.value = false;
  } catch (error: any) {
    message.error(error.message || "保存失败");
  }
}

// 保存新增
async function handleSaveAdd() {
  if (!addForm.value.name || !addForm.value.content) {
    message.error("请填写必填项");
    return;
  }

  try {
    const newTemplate = await ttsAdminApi.createInstructionTemplate({
      name: addForm.value.name,
      description: addForm.value.description || undefined,
      category: addForm.value.category,
      content: addForm.value.content,
    });
    templates.value.push(newTemplate);
    message.success("添加成功");
    showAddModal.value = false;
  } catch (error: any) {
    message.error(error.message || "添加失败");
  }
}

onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <div class="template-manager">
    <NCard title="指令模板管理">
      <template #header-extra>
        <NSpace>
          <NButton
            :loading="loading"
            @click="loadTemplates"
          >
            <template #icon>
              <NIcon><Refresh /></NIcon>
            </template>
            刷新
          </NButton>
          <NButton
            type="primary"
            @click="handleAdd"
          >
            <template #icon>
              <NIcon><Add /></NIcon>
            </template>
            添加模板
          </NButton>
        </NSpace>
      </template>

      <!-- 搜索和筛选 -->
      <NSpace
        class="filter-bar"
        :size="12"
      >
        <NInput
          v-model:value="searchQuery"
          placeholder="搜索模板名称或内容..."
          clearable
          style="width: 200px"
        >
          <template #prefix>
            <NIcon><Search /></NIcon>
          </template>
        </NInput>
        <NSelect
          v-model:value="categoryFilter"
          :options="[{ label: '全部分类', value: '' }, ...categoryOptions]"
          placeholder="分类筛选"
          clearable
          style="width: 120px"
        />
      </NSpace>

      <!-- 数据表格 -->
      <NDataTable
        :columns="columns"
        :data="filteredTemplates"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :row-key="(row: TTSInstructionTemplateDto) => row.id"
        class="data-table"
      />
    </NCard>

    <!-- 编辑弹窗 -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑指令模板"
      style="width: 500px"
    >
      <NForm
        :model="editForm"
        label-placement="left"
        label-width="80"
      >
        <NFormItem
          label="名称"
          required
        >
          <NInput v-model:value="editForm.name" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="editForm.description" />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect
            v-model:value="editForm.category"
            :options="categoryOptions"
          />
        </NFormItem>
        <NFormItem
          label="指令内容"
          required
        >
          <NInput
            v-model:value="editForm.content"
            type="textarea"
            :rows="3"
            placeholder="输入指令内容..."
          />
        </NFormItem>
        <NFormItem
          v-if="editForm.isSystem"
          label="类型"
        >
          <NTag type="info">
            系统模板不可删除
          </NTag>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showEditModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            @click="handleSaveEdit"
          >
            保存
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 新增弹窗 -->
    <NModal
      v-model:show="showAddModal"
      preset="card"
      title="添加指令模板"
      style="width: 500px"
    >
      <NForm
        :model="addForm"
        label-placement="left"
        label-width="80"
      >
        <NFormItem
          label="名称"
          required
        >
          <NInput
            v-model:value="addForm.name"
            placeholder="模板名称"
          />
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="addForm.description"
            placeholder="模板描述"
          />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect
            v-model:value="addForm.category"
            :options="categoryOptions"
          />
        </NFormItem>
        <NFormItem
          label="指令内容"
          required
        >
          <NInput
            v-model:value="addForm.content"
            type="textarea"
            :rows="3"
            placeholder="输入指令内容，如：语调温柔，语速稍慢"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showAddModal = false">
            取消
          </NButton>
          <NButton
            type="primary"
            @click="handleSaveAdd"
          >
            添加
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
.template-manager {
  .filter-bar {
    margin-bottom: 16px;
  }

  .data-table {
    margin-top: 16px;
  }
}
</style>

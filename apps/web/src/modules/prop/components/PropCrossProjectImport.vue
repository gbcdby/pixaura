<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { usePropStore } from "../store";
import { storeToRefs } from "pinia";
import {
  NModal,
  NButton,
  NSelect,
  NInput,
  NList,
  NListItem,
  NCheckbox,
  NSpin,
  NEmpty,
  NSpace,
  NTag,
  useMessage,
} from "naive-ui";
import { Search, Box } from "lucide-vue-next";

const props = defineProps<{
  show: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "success"): void;
}>();

const propStore = usePropStore();
const message = useMessage();

const { importableProps, loading, selectedProps } = storeToRefs(propStore);

const sourceProjectId = ref<string | null>(null);
const searchQuery = ref("");
const importing = ref(false);
const userProjects = ref<Array<{ id: string; name: string }>>([]);

// 监听弹窗显示，加载用户项目列表
watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      selectedProps.value = [];
      sourceProjectId.value = null;
      searchQuery.value = "";
      await loadUserProjects();
    }
  },
);

// 监听源项目选择，加载可导入道具
watch(sourceProjectId, async (projectId) => {
  if (projectId) {
    await propStore.queryImportableProps(projectId);
  }
});

async function loadUserProjects() {
  try {
    // 调用API获取用户参与的项目列表（排除当前项目）
    const response = await fetch("/api/projects?page=1&limit=100", {
      credentials: "include",
    });
    const data = await response.json();
    if (data.code === 0) {
      userProjects.value = data.data.list
        .filter((p: { id: string }) => p.id !== props.projectId)
        .map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
        }));
    }
  } catch {
    message.error("加载项目列表失败");
  }
}

const filteredProps = computed(() => {
  if (!searchQuery.value) return importableProps.value;
  const query = searchQuery.value.toLowerCase();
  return importableProps.value.filter((p) =>
    p.name.toLowerCase().includes(query),
  );
});

function toggleProp(propId: string) {
  const index = selectedProps.value.indexOf(propId);
  if (index > -1) {
    selectedProps.value.splice(index, 1);
  } else {
    selectedProps.value.push(propId);
  }
}

function selectAll() {
  if (selectedProps.value.length === filteredProps.value.length) {
    selectedProps.value = [];
  } else {
    selectedProps.value = filteredProps.value.map((p) => p.id);
  }
}

async function handleImport() {
  if (!sourceProjectId.value || selectedProps.value.length === 0) {
    message.warning("请选择源项目和要导入的道具");
    return;
  }

  importing.value = true;
  try {
    await propStore.importProps(props.projectId, {
      sourceProjectId: sourceProjectId.value,
      sourcePropIds: selectedProps.value,
    });
    message.success(`成功导入 ${selectedProps.value.length} 个道具`);
    emit("success");
    emit("update:show", false);
  } catch {
    message.error("导入失败，请重试");
  } finally {
    importing.value = false;
  }
}

function getImportanceLabel(importance: string) {
  const map: Record<string, string> = {
    key: "关键",
    secondary: "次要",
    background: "背景",
  };
  return map[importance] || importance;
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="从其他项目导入道具"
    style="width: 600px; max-width: 90vw"
    @update:show="$emit('update:show', $event)"
  >
    <NSpin :show="loading">
      <div class="cross-project-import">
        <!-- 源项目选择 -->
        <div class="source-select">
          <label>选择源项目</label>
          <NSelect
            v-model:value="sourceProjectId"
            :options="userProjects.map((p) => ({ label: p.name, value: p.id }))"
            placeholder="请选择要导入的项目"
            clearable
          />
        </div>

        <!-- 道具列表 -->
        <template v-if="sourceProjectId">
          <div class="prop-list-header">
            <NInput
              v-model:value="searchQuery"
              placeholder="搜索道具名称"
              clearable
              style="width: 200px"
            >
              <template #prefix>
                <Search :size="16" />
              </template>
            </NInput>
            <NButton
              text
              @click="selectAll"
            >
              {{
                selectedProps.length === filteredProps.length
                  ? "取消全选"
                  : "全选"
              }}
            </NButton>
          </div>

          <div
            v-if="filteredProps.length > 0"
            class="prop-list"
          >
            <NList
              hoverable
              clickable
            >
              <NListItem
                v-for="prop in filteredProps"
                :key="prop.id"
                @click="toggleProp(prop.id)"
              >
                <div class="prop-item">
                  <NCheckbox
                    :checked="selectedProps.includes(prop.id)"
                    @click.stop
                    @update:checked="toggleProp(prop.id)"
                  />
                  <div class="prop-info">
                    <div class="icon">
                      <Box :size="32" />
                    </div>
                    <div class="info">
                      <div class="name">
                        {{ prop.name }}
                      </div>
                      <div class="meta">
                        <NTag
                          size="small"
                          type="info"
                        >
                          {{ getImportanceLabel(prop.importance) }}
                        </NTag>
                        <span v-if="prop.status">{{
                          prop.status === "active" ? "已激活" : "草稿"
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </NListItem>
            </NList>
          </div>

          <NEmpty
            v-else
            description="该项目暂无道具"
          />

          <!-- 已选择数量 -->
          <div
            v-if="selectedProps.length > 0"
            class="selected-count"
          >
            已选择 {{ selectedProps.length }} 个道具
          </div>
        </template>

        <NEmpty
          v-else-if="userProjects.length === 0"
          description="暂无可导入的其他项目"
        />

        <!-- 底部按钮 -->
        <div class="actions">
          <NSpace>
            <NButton @click="$emit('update:show', false)">
              取消
            </NButton>
            <NButton
              type="primary"
              :loading="importing"
              :disabled="selectedProps.length === 0"
              @click="handleImport"
            >
              导入 ({{ selectedProps.length }})
            </NButton>
          </NSpace>
        </div>
      </div>
    </NSpin>
  </NModal>
</template>

<style scoped lang="scss">
.cross-project-import {
  .source-select {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
    }
  }

  .prop-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .prop-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius: 8px;

    .prop-item {
      display: flex;
      align-items: center;
      gap: 12px;

      .prop-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;

        .icon {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          overflow: hidden;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;

          svg {
            color: #999;
          }
        }

        .info {
          flex: 1;

          .name {
            font-weight: 500;
            margin-bottom: 4px;
          }

          .meta {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #999;
          }
        }
      }
    }
  }

  .selected-count {
    margin-top: 12px;
    padding: 12px;
    background: #f0f9f4;
    border-radius: 8px;
    text-align: center;
    color: #18a058;
    font-size: 14px;
  }

  .actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>

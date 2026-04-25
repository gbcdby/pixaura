<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useCharacterStore } from "../store";
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
import { Search, User } from "lucide-vue-next";

const props = defineProps<{
  show: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
  (e: "success"): void;
}>();

const characterStore = useCharacterStore();
const message = useMessage();

const { importableCharacters, loading, selectedCharacters } =
  storeToRefs(characterStore);

const sourceProjectId = ref<string | null>(null);
const searchQuery = ref("");
const importing = ref(false);
const userProjects = ref<Array<{ id: string; name: string }>>([]);

// 监听弹窗显示，加载用户项目列表
watch(
  () => props.show,
  async (visible) => {
    if (visible) {
      selectedCharacters.value = [];
      sourceProjectId.value = null;
      searchQuery.value = "";
      await loadUserProjects();
    }
  },
);

// 监听源项目选择，加载可导入角色
watch(sourceProjectId, async (projectId) => {
  if (projectId) {
    await characterStore.queryImportableCharacters(projectId);
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

const filteredCharacters = computed(() => {
  if (!searchQuery.value) return importableCharacters.value;
  const query = searchQuery.value.toLowerCase();
  return importableCharacters.value.filter((c) =>
    c.name.toLowerCase().includes(query),
  );
});

function toggleCharacter(characterId: string) {
  const index = selectedCharacters.value.indexOf(characterId);
  if (index > -1) {
    selectedCharacters.value.splice(index, 1);
  } else {
    selectedCharacters.value.push(characterId);
  }
}

function selectAll() {
  if (selectedCharacters.value.length === filteredCharacters.value.length) {
    selectedCharacters.value = [];
  } else {
    selectedCharacters.value = filteredCharacters.value.map((c) => c.id);
  }
}

async function handleImport() {
  if (!sourceProjectId.value || selectedCharacters.value.length === 0) {
    message.warning("请选择源项目和要导入的角色");
    return;
  }

  importing.value = true;
  try {
    await characterStore.importCharacters(props.projectId, {
      sourceProjectId: sourceProjectId.value,
      sourceCharacterIds: selectedCharacters.value,
    });
    message.success(`成功导入 ${selectedCharacters.value.length} 个角色`);
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
    protagonist: "主角",
    supporting: "配角",
    minor: "龙套",
  };
  return map[importance] || importance;
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    title="从其他项目导入角色"
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

        <!-- 角色列表 -->
        <template v-if="sourceProjectId">
          <div class="character-list-header">
            <NInput
              v-model:value="searchQuery"
              placeholder="搜索角色名称"
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
                selectedCharacters.length === filteredCharacters.length
                  ? "取消全选"
                  : "全选"
              }}
            </NButton>
          </div>

          <div
            v-if="filteredCharacters.length > 0"
            class="character-list"
          >
            <NList
              hoverable
              clickable
            >
              <NListItem
                v-for="character in filteredCharacters"
                :key="character.id"
                @click="toggleCharacter(character.id)"
              >
                <div class="character-item">
                  <NCheckbox
                    :checked="selectedCharacters.includes(character.id)"
                    @click.stop
                    @update:checked="toggleCharacter(character.id)"
                  />
                  <div class="character-info">
                    <div class="avatar">
                      <img
                        v-if="character.images?.frontView?.thumbnailUrl"
                        :src="character.images.frontView.thumbnailUrl"
                        :alt="character.name"
                      >
                      <User
                        v-else
                        :size="32"
                      />
                    </div>
                    <div class="info">
                      <div class="name">
                        {{ character.name }}
                      </div>
                      <div class="meta">
                        <NTag
                          size="small"
                          type="info"
                        >
                          {{ getImportanceLabel(character.importance) }}
                        </NTag>
                        <span v-if="character.age">{{ character.age }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </NListItem>
            </NList>
          </div>

          <NEmpty
            v-else
            description="该项目暂无角色"
          />

          <!-- 已选择数量 -->
          <div
            v-if="selectedCharacters.length > 0"
            class="selected-count"
          >
            已选择 {{ selectedCharacters.length }} 个角色
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
              :disabled="selectedCharacters.length === 0"
              @click="handleImport"
            >
              导入 ({{ selectedCharacters.length }})
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

  .character-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .character-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #eee;
    border-radius: 8px;

    .character-item {
      display: flex;
      align-items: center;
      gap: 12px;

      .character-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;

        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: #f5f5f5;
          display: flex;
          align-items: center;
          justify-content: center;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

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

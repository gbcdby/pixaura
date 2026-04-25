<script setup lang="ts">
/**
 * TTS 音色管理页面
 * 管理千问 TTS 音色列表，支持启用/禁用、编辑等操作
 */
import { ref, computed, onMounted, onUnmounted, h } from "vue";
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
  NSwitch,
  NIcon,
  useMessage,
  useDialog,
} from "naive-ui";
import type { DataTableColumns } from "naive-ui";
import {
  Refresh,
  Add,
  Create,
  VolumeHigh,
  Search,
  Trash,
  Pause,
  Play,
} from "@vicons/ionicons5";
import { ttsAdminApi, type TTSVoiceDto, type VoiceGender } from "@/api/tts";

const message = useMessage();
const dialog = useDialog();

// 音色列表
const voices = ref<TTSVoiceDto[]>([]);
const loading = ref(false);

// 搜索关键词
const searchQuery = ref("");

// 性别筛选
const genderFilter = ref<string | undefined>(undefined);

// 编辑弹窗
const showEditModal = ref(false);
const editingVoice = ref<TTSVoiceDto | null>(null);
const editForm = ref({
  voiceId: "",
  name: "",
  gender: "female" as VoiceGender,
  category: "standard" as "standard" | "dialect",
  style: "",
  previewAudioUrl: "",
  isActive: true,
});

// 新增弹窗
const showAddModal = ref(false);
const addForm = ref({
  voiceId: "",
  name: "",
  gender: "female" as VoiceGender,
  category: "standard" as "standard" | "dialect",
  style: "",
  previewAudioUrl: "",
});

// 性别选项
const genderOptions = [
  { label: "女声", value: "female" },
  { label: "男声", value: "male" },
  { label: "童声", value: "child" },
];

// 分类选项
const categoryOptions = [
  { label: "标准", value: "standard" },
  { label: "方言", value: "dialect" },
];

// 试听播放状态管理
const currentAudio = ref<HTMLAudioElement | null>(null);
const playingVoiceId = ref<string | null>(null);

// 过滤后的音色列表
const filteredVoices = computed(() => {
  let list = voices.value;
  if (genderFilter.value) {
    if (genderFilter.value === "dialect") {
      list = list.filter((v) => v.category === "dialect");
    } else {
      list = list.filter(
        (v) => v.gender === genderFilter.value && v.category !== "dialect",
      );
    }
  }
  if (searchQuery.value.trim()) {
    const keyword = searchQuery.value.toLowerCase();
    list = list.filter(
      (v) =>
        v.name.toLowerCase().includes(keyword) ||
        v.voiceId.toLowerCase().includes(keyword),
    );
  }
  return list;
});

// 表格列配置
const columns: DataTableColumns<TTSVoiceDto> = [
  {
    title: "音色 ID",
    key: "voiceId",
    width: 120,
  },
  {
    title: "名称",
    key: "name",
    width: 120,
  },
  {
    title: "性别",
    key: "gender",
    width: 80,
    render: (row) => {
      const label =
        row.category === "dialect"
          ? "方言"
          : row.gender === "female"
            ? "女声"
            : row.gender === "male"
              ? "男声"
              : "童声";
      const type =
        row.category === "dialect"
          ? "success"
          : row.gender === "female"
            ? "error"
            : row.gender === "male"
              ? "info"
              : "warning";
      return h(NTag, { type, size: "small" }, () => label);
    },
  },
  {
    title: "风格",
    key: "style",
    width: 120,
    render: (row) =>
      row.style
        ? h(NTag, { type: "default", size: "small" }, () => row.style)
        : null,
  },
  {
    title: "试听",
    key: "preview",
    width: 100,
    render: (row) =>
      row.previewAudioUrl
        ? h(
            NButton,
            {
              text: true,
              type: "primary",
              onClick: () => togglePreview(row),
            },
            {
              icon: () =>
                h(NIcon, null, () =>
                  h(playingVoiceId.value === row.id ? Pause : VolumeHigh),
                ),
              default: () =>
                playingVoiceId.value === row.id ? "停止" : "试听",
            },
          )
        : null,
  },
  {
    title: "状态",
    key: "isActive",
    width: 80,
    render: (row) =>
      h(
        NTag,
        { type: row.isActive ? "success" : "default", size: "small" },
        () => (row.isActive ? "启用" : "禁用"),
      ),
  },
  {
    title: "操作",
    key: "actions",
    width: 200,
    render: (row) =>
      h(NSpace, null, () => [
        h(
          NButton,
          {
            text: true,
            type: "primary",
            onClick: () => handleEdit(row),
          },
          {
            icon: () => h(NIcon, null, () => h(Create)),
            default: () => "编辑",
          },
        ),
        h(
          NButton,
          {
            text: true,
            type: row.isActive ? "warning" : "success",
            onClick: () => handleToggleActive(row),
          },
          {
            icon: () => h(NIcon, null, () => h(row.isActive ? Pause : Play)),
            default: () => (row.isActive ? "禁用" : "启用"),
          },
        ),
        h(
          NButton,
          {
            text: true,
            type: "error",
            onClick: () => handleDelete(row),
          },
          {
            icon: () => h(NIcon, null, () => h(Trash)),
            default: () => "删除",
          },
        ),
      ]),
  },
];

// 加载音色列表
async function loadVoices() {
  loading.value = true;
  try {
    voices.value = await ttsAdminApi.getAllVoices();
  } catch (error: any) {
    message.error(error.message || "加载音色列表失败");
  } finally {
    loading.value = false;
  }
}

// 播放/暂停试听
async function togglePreview(voice: TTSVoiceDto) {
  if (playingVoiceId.value === voice.id && currentAudio.value) {
    // 当前正在播放，暂停
    currentAudio.value.pause();
    playingVoiceId.value = null;
  } else {
    // 播放新的或继续播放
    if (currentAudio.value) {
      currentAudio.value.pause();
    }
    // 使用后端代理接口解决跨域问题
    // 添加时间戳参数防止浏览器缓存错误响应
    const proxyUrl = `/api/tts/voices/${voice.id}/preview-audio?t=${Date.now()}`;
    try {
      // 使用 fetch 获取音频数据，绕过 Vite 代理对流式响应的处理问题
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`获取音频失败: ${response.status}`);
      }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      currentAudio.value = new Audio(audioUrl);
      currentAudio.value.onended = () => {
        playingVoiceId.value = null;
        URL.revokeObjectURL(audioUrl);
      };
      currentAudio.value.onerror = () => {
        playingVoiceId.value = null;
        URL.revokeObjectURL(audioUrl);
        message.error("试听音频加载失败");
      };
      currentAudio.value.play();
      playingVoiceId.value = voice.id;
    } catch (error) {
      console.error("播放试听音频失败:", error);
      playingVoiceId.value = null;
      message.error("试听音频加载失败");
    }
  }
}

// 打开编辑弹窗
function handleEdit(voice: TTSVoiceDto) {
  editingVoice.value = voice;
  editForm.value = {
    voiceId: voice.voiceId,
    name: voice.name,
    gender: voice.gender,
    category: voice.category || "standard",
    style: voice.style || "",
    previewAudioUrl: voice.previewAudioUrl || "",
    isActive: voice.isActive,
  };
  showEditModal.value = true;
}

// 切换启用状态
async function handleToggleActive(voice: TTSVoiceDto) {
  dialog.warning({
    title: "确认操作",
    content: `确定要${voice.isActive ? "禁用" : "启用"}音色 ${voice.name} 吗？`,
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        const updated = await ttsAdminApi.toggleVoiceActive(voice.id);
        voice.isActive = updated.isActive;
        message.success(`${voice.name} 已${voice.isActive ? "启用" : "禁用"}`);
      } catch (error: any) {
        message.error(error.message || "操作失败");
      }
    },
  });
}

// 保存编辑
async function handleSaveEdit() {
  if (!editingVoice.value) return;

  try {
    const updated = await ttsAdminApi.updateVoice(editingVoice.value.id, {
      name: editForm.value.name,
      gender: editForm.value.gender,
      category: editForm.value.category,
      style: editForm.value.style || undefined,
      previewAudioUrl: editForm.value.previewAudioUrl || undefined,
    });
    // 更新本地数据
    Object.assign(editingVoice.value, updated);
    message.success("保存成功");
    showEditModal.value = false;
  } catch (error: any) {
    message.error(error.message || "保存失败");
  }
}

// 打开新增弹窗
function handleAdd() {
  addForm.value = {
    voiceId: "",
    name: "",
    gender: "female",
    category: "standard",
    style: "",
    previewAudioUrl: "",
  };
  showAddModal.value = true;
}

// 保存新增
async function handleSaveAdd() {
  if (!addForm.value.voiceId || !addForm.value.name) {
    message.warning("音色 ID 和名称必填");
    return;
  }

  try {
    const newVoice = await ttsAdminApi.createVoice({
      voiceId: addForm.value.voiceId,
      name: addForm.value.name,
      gender: addForm.value.gender,
      category: addForm.value.category,
      style: addForm.value.style || undefined,
      previewAudioUrl: addForm.value.previewAudioUrl || undefined,
    });
    voices.value.push(newVoice);
    message.success("添加成功");
    showAddModal.value = false;
  } catch (error: any) {
    message.error(error.message || "添加失败");
  }
}

// 删除音色
async function handleDelete(voice: TTSVoiceDto) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除音色 ${voice.name} 吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await ttsAdminApi.deleteVoice(voice.id);
        voices.value = voices.value.filter((v) => v.id !== voice.id);
        message.success("删除成功");
      } catch (error: any) {
        message.error(error.message || "删除失败");
      }
    },
  });
}

onMounted(() => {
  loadVoices();
});

// 组件卸载时清理音频实例
onUnmounted(() => {
  if (currentAudio.value) {
    currentAudio.value.pause();
    currentAudio.value = null;
    playingVoiceId.value = null;
  }
});
</script>

<template>
  <div class="voice-manager">
    <NCard title="音色管理">
      <template #header-extra>
        <NSpace>
          <NButton
            :loading="loading"
            @click="loadVoices"
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
            添加音色
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
          placeholder="搜索音色名称或 ID..."
          clearable
          style="width: 200px"
        >
          <template #prefix>
            <NIcon><Search /></NIcon>
          </template>
        </NInput>
        <NSelect
          v-model:value="genderFilter"
          :options="[
            { label: '全部', value: '' },
            { label: '女声', value: 'female' },
            { label: '男声', value: 'male' },
            { label: '童声', value: 'child' },
            { label: '方言', value: 'dialect' },
          ]"
          placeholder="性别筛选"
          clearable
          style="width: 120px"
        />
      </NSpace>

      <!-- 数据表格 -->
      <NDataTable
        :columns="columns"
        :data="filteredVoices"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :row-key="(row: TTSVoiceDto) => row.id"
        class="data-table"
      />
    </NCard>

    <!-- 编辑弹窗 -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑音色"
      style="width: 500px"
    >
      <NForm
        :model="editForm"
        label-placement="left"
        label-width="80"
      >
        <NFormItem label="音色 ID">
          <NInput
            v-model:value="editForm.voiceId"
            disabled
          />
        </NFormItem>
        <NFormItem label="中文名">
          <NInput v-model:value="editForm.name" />
        </NFormItem>
        <NFormItem label="性别">
          <NSelect
            v-model:value="editForm.gender"
            :options="genderOptions"
          />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect
            v-model:value="editForm.category"
            :options="categoryOptions"
          />
        </NFormItem>
        <NFormItem label="风格">
          <NInput v-model:value="editForm.style" />
        </NFormItem>
        <NFormItem label="试听音频">
          <NInput
            v-model:value="editForm.previewAudioUrl"
            placeholder="音频 URL"
          />
        </NFormItem>
        <NFormItem label="状态">
          <NSwitch v-model:value="editForm.isActive">
            <template #checked>
              启用
            </template>
            <template #unchecked>
              禁用
            </template>
          </NSwitch>
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
      title="添加音色"
      style="width: 500px"
    >
      <NForm
        :model="addForm"
        label-placement="left"
        label-width="80"
      >
        <NFormItem
          label="音色 ID"
          required
        >
          <NInput
            v-model:value="addForm.voiceId"
            placeholder="如：chelsie, zhimia"
          />
        </NFormItem>
        <NFormItem
          label="中文名"
          required
        >
          <NInput
            v-model:value="addForm.name"
            placeholder="如：Chelsie, 知淼"
          />
        </NFormItem>
        <NFormItem label="性别">
          <NSelect
            v-model:value="addForm.gender"
            :options="genderOptions"
          />
        </NFormItem>
        <NFormItem label="分类">
          <NSelect
            v-model:value="addForm.category"
            :options="categoryOptions"
          />
        </NFormItem>
        <NFormItem label="风格">
          <NInput
            v-model:value="addForm.style"
            placeholder="如：温柔甜美"
          />
        </NFormItem>
        <NFormItem label="试听音频">
          <NInput
            v-model:value="addForm.previewAudioUrl"
            placeholder="音频 URL"
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
.voice-manager {
  .filter-bar {
    margin-bottom: 16px;
  }

  .data-table {
    margin-top: 16px;
  }
}
</style>

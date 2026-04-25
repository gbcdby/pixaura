<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePropStore } from "@/modules/prop/store";
import { storeToRefs } from "pinia";
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NDynamicTags,
  NSpin,
  NTabs,
  NTabPane,
} from "naive-ui";
import { ArrowLeft, Save } from "lucide-vue-next";
import PropImageManager from "@/components/prop/PropImageManager.vue";
import type { UpdatePropDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const propStore = usePropStore();
const { currentProp, loading } = storeToRefs(propStore);

const projectId = route.params.id as string;
const propId = route.params.propId as string;
const saving = ref(false);

const form = reactive({
  name: "",
  description: "",
  importance: "background" as "key" | "secondary" | "background",
  appearance: {
    color: "",
    material: "",
    size: undefined as
      | "tiny"
      | "small"
      | "medium"
      | "large"
      | "huge"
      | undefined,
    condition: undefined as "new" | "worn" | "damaged" | "ancient" | undefined,
    distinctiveFeatures: [] as string[],
  },
  function: "",
});

const importanceOptions = [
  { label: "背景", value: "background" },
  { label: "次要", value: "secondary" },
  { label: "关键", value: "key" },
];

const sizeOptions = [
  { label: "极小", value: "tiny" },
  { label: "小", value: "small" },
  { label: "中", value: "medium" },
  { label: "大", value: "large" },
  { label: "极大", value: "huge" },
];

const conditionOptions = [
  { label: "全新", value: "new" },
  { label: "磨损", value: "worn" },
  { label: "损坏", value: "damaged" },
  { label: "古老", value: "ancient" },
];

// 重置表单函数
function resetForm() {
  form.name = "";
  form.description = "";
  form.importance = "background";
  form.appearance = {
    color: "",
    material: "",
    size: undefined,
    condition: undefined,
    distinctiveFeatures: [],
  };
  form.function = "";
}

onMounted(async () => {
  // 先重置表单，避免残留数据
  resetForm();
  await propStore.getProp(propId);
  if (currentProp.value) {
    form.name = currentProp.value.name;
    form.description = currentProp.value.description || "";
    form.importance = currentProp.value.importance;
    form.appearance = {
      color: currentProp.value.appearance?.color || "",
      material: currentProp.value.appearance?.material || "",
      size: currentProp.value.appearance?.size,
      condition: currentProp.value.appearance?.condition,
      distinctiveFeatures:
        currentProp.value.appearance?.distinctiveFeatures || [],
    };
    form.function = currentProp.value.function || "";
  }
});

function handleBack() {
  router.push(`/projects/${projectId}/props/${propId}`);
}

async function handleSubmit() {
  saving.value = true;
  try {
    const data: UpdatePropDto = {
      name: form.name,
      description: form.description || undefined,
      importance: form.importance,
    };

    if (
      form.appearance?.color ||
      form.appearance?.material ||
      form.appearance?.size ||
      form.appearance?.condition ||
      form.appearance?.distinctiveFeatures?.length
    ) {
      data.appearance = {
        color: form.appearance.color || undefined,
        material: form.appearance.material || undefined,
        size: form.appearance.size,
        condition: form.appearance.condition,
        distinctiveFeatures: form.appearance.distinctiveFeatures?.length
          ? form.appearance.distinctiveFeatures
          : undefined,
      };
    }

    if (form.function) {
      data.function = form.function;
    }

    await propStore.updateProp(propId, data);
    router.push(`/projects/${projectId}/props/${propId}`);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="prop-edit">
    <!-- 头部 -->
    <div class="header">
      <NSpace align="center">
        <NButton
          quaternary
          circle
          @click="handleBack"
        >
          <template #icon>
            <ArrowLeft :size="20" />
          </template>
        </NButton>
        <h1>编辑道具</h1>
      </NSpace>
      <NButton
        type="primary"
        :loading="saving"
        @click="handleSubmit"
      >
        <template #icon>
          <Save :size="16" />
        </template>
        保存
      </NButton>
    </div>

    <!-- 表单 -->
    <NSpin :show="loading">
      <template v-if="currentProp">
        <NTabs
          type="line"
          animated
        >
          <NTabPane
            name="basic"
            tab="基本信息"
          >
            <NCard>
              <NForm
                label-placement="left"
                label-width="100"
              >
                <h3>基本信息</h3>
                <NFormItem
                  label="道具名称"
                  required
                >
                  <NInput
                    v-model:value="form.name"
                    placeholder="请输入道具名称"
                    maxlength="50"
                    show-count
                  />
                </NFormItem>

                <NFormItem label="重要性">
                  <NSelect
                    v-model:value="form.importance"
                    :options="importanceOptions"
                  />
                </NFormItem>

                <NFormItem label="道具描述">
                  <NInput
                    v-model:value="form.description"
                    type="textarea"
                    placeholder="请输入道具描述"
                    maxlength="1000"
                    show-count
                    :rows="4"
                  />
                </NFormItem>

                <h3>外观属性</h3>
                <NFormItem label="主要颜色">
                  <NInput
                    v-model:value="form.appearance.color"
                    placeholder="如：红色、金色"
                  />
                </NFormItem>

                <NFormItem label="材质">
                  <NInput
                    v-model:value="form.appearance.material"
                    placeholder="如：木头、金属、陶瓷"
                  />
                </NFormItem>

                <NFormItem label="大小">
                  <NSelect
                    v-model:value="form.appearance.size"
                    :options="sizeOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="新旧程度">
                  <NSelect
                    v-model:value="form.appearance.condition"
                    :options="conditionOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="显著特征">
                  <NDynamicTags
                    v-model:value="form.appearance.distinctiveFeatures"
                    placeholder="输入特征后按回车"
                  />
                </NFormItem>

                <h3>功能描述</h3>
                <NFormItem label="功能/用途">
                  <NInput
                    v-model:value="form.function"
                    type="textarea"
                    placeholder="描述道具的功能或用途"
                    maxlength="200"
                    show-count
                    :rows="3"
                  />
                </NFormItem>
              </NForm>
            </NCard>
          </NTabPane>

          <NTabPane
            name="images"
            tab="参考图"
          >
            <PropImageManager
              :prop="currentProp"
              :project-id="projectId"
              @refresh="propStore.getProp(propId)"
            />
          </NTabPane>
        </NTabs>
      </template>

      <NEmpty
        v-else-if="!loading"
        description="道具不存在"
      />
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.prop-edit {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }

  h3 {
    margin: 24px 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid #eee;
    font-size: 16px;
    font-weight: 600;

    &:first-child {
      margin-top: 0;
    }
  }
}
</style>

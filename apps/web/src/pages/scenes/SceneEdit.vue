<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSceneStore } from "@/modules/scene/store";
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
import SceneImageManager from "@/components/scene/SceneImageManager.vue";
import type { UpdateSceneDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const sceneStore = useSceneStore();
const { currentScene, loading } = storeToRefs(sceneStore);

const projectId = route.params.id as string;
const sceneId = route.params.sceneId as string;
const saving = ref(false);

const form = reactive({
  name: "",
  description: "",
  type: "interior" as "interior" | "exterior" | "both",
  space: {
    size: undefined as "small" | "medium" | "large" | "huge" | undefined,
    layout: "",
    keyAreas: [] as string[],
  },
  visuals: {
    primaryColor: "",
    lighting: undefined as "natural" | "artificial" | "mixed" | undefined,
    lightingMood: undefined as
      | "bright"
      | "dim"
      | "dramatic"
      | "soft"
      | undefined,
  },
  atmosphere: {
    timeOfDay: undefined as
      | "dawn"
      | "morning"
      | "noon"
      | "afternoon"
      | "dusk"
      | "night"
      | undefined,
    weather: undefined as
      | "sunny"
      | "cloudy"
      | "rainy"
      | "snowy"
      | "foggy"
      | "stormy"
      | undefined,
    mood: "",
  },
});

const typeOptions = [
  { label: "室内", value: "interior" },
  { label: "室外", value: "exterior" },
  { label: "混合", value: "both" },
];

const sizeOptions = [
  { label: "小", value: "small" },
  { label: "中", value: "medium" },
  { label: "大", value: "large" },
  { label: "超大", value: "huge" },
];

const lightingOptions = [
  { label: "自然光", value: "natural" },
  { label: "人工光", value: "artificial" },
  { label: "混合", value: "mixed" },
];

const lightingMoodOptions = [
  { label: "明亮", value: "bright" },
  { label: "昏暗", value: "dim" },
  { label: "戏剧性", value: "dramatic" },
  { label: "柔和", value: "soft" },
];

const timeOfDayOptions = [
  { label: "黎明", value: "dawn" },
  { label: "早晨", value: "morning" },
  { label: "中午", value: "noon" },
  { label: "下午", value: "afternoon" },
  { label: "黄昏", value: "dusk" },
  { label: "夜晚", value: "night" },
];

const weatherOptions = [
  { label: "晴朗", value: "sunny" },
  { label: "多云", value: "cloudy" },
  { label: "雨天", value: "rainy" },
  { label: "雪天", value: "snowy" },
  { label: "雾天", value: "foggy" },
  { label: "暴风雨", value: "stormy" },
];

onMounted(async () => {
  await sceneStore.getScene(sceneId);
  if (currentScene.value) {
    form.name = currentScene.value.name;
    form.description = currentScene.value.description || "";
    form.type = currentScene.value.type;
    form.space = {
      size: currentScene.value.space?.size,
      layout: currentScene.value.space?.layout || "",
      keyAreas: currentScene.value.space?.keyAreas || [],
    };
    form.visuals = {
      primaryColor: currentScene.value.visuals?.primaryColor || "",
      lighting: currentScene.value.visuals?.lighting,
      lightingMood: currentScene.value.visuals?.lightingMood,
    };
    form.atmosphere = {
      timeOfDay: currentScene.value.atmosphere?.timeOfDay,
      weather: currentScene.value.atmosphere?.weather,
      mood: currentScene.value.atmosphere?.mood || "",
    };
  }
});

function handleBack() {
  router.push(`/projects/${projectId}/scenes/${sceneId}`);
}

async function handleSubmit() {
  saving.value = true;
  try {
    const data: UpdateSceneDto = {
      name: form.name,
      description: form.description || undefined,
      type: form.type,
    };

    if (
      form.space?.size ||
      form.space?.layout ||
      form.space?.keyAreas?.length
    ) {
      data.space = {
        size: form.space.size,
        layout: form.space.layout || undefined,
        keyAreas: form.space.keyAreas?.length ? form.space.keyAreas : undefined,
      };
    }

    if (
      form.visuals?.primaryColor ||
      form.visuals?.lighting ||
      form.visuals?.lightingMood
    ) {
      data.visuals = {
        primaryColor: form.visuals.primaryColor || undefined,
        lighting: form.visuals.lighting,
        lightingMood: form.visuals.lightingMood,
      };
    }

    if (
      form.atmosphere?.timeOfDay ||
      form.atmosphere?.weather ||
      form.atmosphere?.mood
    ) {
      data.atmosphere = {
        timeOfDay: form.atmosphere.timeOfDay,
        weather: form.atmosphere.weather,
        mood: form.atmosphere.mood || undefined,
      };
    }

    await sceneStore.updateScene(sceneId, data);
    router.push(`/projects/${projectId}/scenes/${sceneId}`);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="scene-edit">
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
        <h1>编辑场景</h1>
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
      <template v-if="currentScene">
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
                  label="场景名称"
                  required
                >
                  <NInput
                    v-model:value="form.name"
                    placeholder="请输入场景名称"
                    maxlength="50"
                    show-count
                  />
                </NFormItem>

                <NFormItem label="场景类型">
                  <NSelect
                    v-model:value="form.type"
                    :options="typeOptions"
                  />
                </NFormItem>

                <NFormItem label="场景描述">
                  <NInput
                    v-model:value="form.description"
                    type="textarea"
                    placeholder="请输入场景描述"
                    maxlength="2000"
                    show-count
                    :rows="4"
                  />
                </NFormItem>

                <h3>空间属性</h3>
                <NFormItem label="空间大小">
                  <NSelect
                    v-model:value="form.space.size"
                    :options="sizeOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="布局描述">
                  <NInput
                    v-model:value="form.space.layout"
                    type="textarea"
                    placeholder="描述场景的空间布局"
                    :rows="3"
                  />
                </NFormItem>

                <NFormItem label="关键区域">
                  <NDynamicTags
                    v-model:value="form.space.keyAreas"
                    placeholder="输入关键区域后按回车"
                  />
                </NFormItem>

                <h3>视觉属性</h3>
                <NFormItem label="主色调">
                  <NInput
                    v-model:value="form.visuals.primaryColor"
                    placeholder="如：暖黄色、冷灰色"
                  />
                </NFormItem>

                <NFormItem label="光源类型">
                  <NSelect
                    v-model:value="form.visuals.lighting"
                    :options="lightingOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="光线氛围">
                  <NSelect
                    v-model:value="form.visuals.lightingMood"
                    :options="lightingMoodOptions"
                    clearable
                  />
                </NFormItem>

                <h3>氛围属性</h3>
                <NFormItem label="时间">
                  <NSelect
                    v-model:value="form.atmosphere.timeOfDay"
                    :options="timeOfDayOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="天气">
                  <NSelect
                    v-model:value="form.atmosphere.weather"
                    :options="weatherOptions"
                    clearable
                  />
                </NFormItem>

                <NFormItem label="氛围描述">
                  <NInput
                    v-model:value="form.atmosphere.mood"
                    placeholder="描述整体氛围感觉"
                  />
                </NFormItem>
              </NForm>
            </NCard>
          </NTabPane>

          <NTabPane
            name="images"
            tab="参考图"
          >
            <SceneImageManager
              :scene="currentScene"
              :project-id="projectId"
              @refresh="sceneStore.getScene(sceneId)"
            />
          </NTabPane>
        </NTabs>
      </template>

      <NEmpty
        v-else-if="!loading"
        description="场景不存在"
      />
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.scene-edit {
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

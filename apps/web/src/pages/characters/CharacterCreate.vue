<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCharacterStore } from "@/modules/character/store";
import {
  NButton,
  NInput,
  NForm,
  NFormItem,
  NSelect,
  NDynamicTags,
  NCard,
} from "naive-ui";
import { ArrowLeft, Save } from "lucide-vue-next";
import type { CreateCharacterDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const characterStore = useCharacterStore();

const projectId = route.params.id as string;
const loading = ref(false);

const form = ref<CreateCharacterDto>({
  name: "",
  description: "",
  personality: "",
  age: "",
  gender: undefined,
  occupation: "",
  background: "",
  appearance: {
    height: "",
    bodyType: "",
    hairColor: "",
    hairStyle: "",
    eyeColor: "",
    skinTone: "",
    clothingStyle: "",
    distinctiveFeatures: [],
  },
  importance: "minor",
});

const importanceOptions = [
  { label: "主角", value: "protagonist" },
  { label: "配角", value: "supporting" },
  { label: "龙套", value: "minor" },
];

const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
  { label: "其他", value: "other" },
  { label: "未知", value: "unknown" },
];

async function handleSubmit() {
  if (!form.value.name) {
    return;
  }

  loading.value = true;
  try {
    await characterStore.createCharacter(projectId, form.value);
    router.push(`/projects/${projectId}/characters`);
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.back();
}
</script>

<template>
  <div class="character-create">
    <!-- 头部 -->
    <div class="header">
      <NButton
        quaternary
        @click="handleBack"
      >
        <template #icon>
          <ArrowLeft :size="18" />
        </template>
        返回
      </NButton>
      <h1>新建角色</h1>
      <NButton
        type="primary"
        :loading="loading"
        @click="handleSubmit"
      >
        <template #icon>
          <Save :size="16" />
        </template>
        保存
      </NButton>
    </div>

    <!-- 表单 -->
    <NCard class="form-card">
      <NForm
        label-placement="left"
        label-width="100"
      >
        <NFormItem
          label="角色名称"
          required
        >
          <NInput
            v-model:value="form.name"
            placeholder="请输入角色名称"
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

        <NFormItem label="性别">
          <NSelect
            v-model:value="form.gender"
            :options="genderOptions"
            clearable
            placeholder="请选择性别"
          />
        </NFormItem>

        <NFormItem label="年龄">
          <NInput
            v-model:value="form.age"
            placeholder="如：25岁、中年"
            maxlength="20"
          />
        </NFormItem>

        <NFormItem label="职业">
          <NInput
            v-model:value="form.occupation"
            placeholder="请输入职业"
            maxlength="50"
          />
        </NFormItem>

        <NFormItem label="角色描述">
          <NInput
            v-model:value="form.description"
            type="textarea"
            placeholder="描述角色的外貌、性格等"
            :rows="4"
            maxlength="2000"
            show-count
          />
        </NFormItem>

        <NFormItem label="性格特征">
          <NInput
            v-model:value="form.personality"
            placeholder="如：开朗、内向、冷酷"
            maxlength="200"
          />
        </NFormItem>

        <NFormItem label="背景故事">
          <NInput
            v-model:value="form.background"
            type="textarea"
            placeholder="角色的背景故事"
            :rows="4"
          />
        </NFormItem>

        <h3 class="section-title">
          外观细节
        </h3>

        <NFormItem label="身高">
          <NInput
            v-model:value="form.appearance!.height"
            placeholder="如：175cm"
          />
        </NFormItem>

        <NFormItem label="体型">
          <NInput
            v-model:value="form.appearance!.bodyType"
            placeholder="如：苗条、健壮"
          />
        </NFormItem>

        <NFormItem label="发色">
          <NInput
            v-model:value="form.appearance!.hairColor"
            placeholder="如：黑色、金色"
          />
        </NFormItem>

        <NFormItem label="发型">
          <NInput
            v-model:value="form.appearance!.hairStyle"
            placeholder="如：短发、长发"
          />
        </NFormItem>

        <NFormItem label="眼色">
          <NInput
            v-model:value="form.appearance!.eyeColor"
            placeholder="如：棕色、蓝色"
          />
        </NFormItem>

        <NFormItem label="肤色">
          <NInput
            v-model:value="form.appearance!.skinTone"
            placeholder="如：白皙、黝黑"
          />
        </NFormItem>

        <NFormItem label="着装风格">
          <NInput
            v-model:value="form.appearance!.clothingStyle"
            placeholder="如：休闲、正式"
          />
        </NFormItem>

        <NFormItem label="显著特征">
          <NDynamicTags
            v-model:value="form.appearance!.distinctiveFeatures"
            placeholder="添加特征（如疤痕、纹身）"
          />
        </NFormItem>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped lang="scss">
.character-create {
  padding: 24px;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .form-card {
    max-width: 800px;

    .section-title {
      margin: 24px 0 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #eee;
      font-size: 16px;
      font-weight: 600;
    }
  }
}
</style>

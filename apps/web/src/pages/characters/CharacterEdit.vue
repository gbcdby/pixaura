<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useCharacterStore } from "@/modules/character/store";
import { storeToRefs } from "pinia";
import {
  NButton,
  NInput,
  NForm,
  NFormItem,
  NSelect,
  NDynamicTags,
  NCard,
  NSpin,
  NEmpty,
  useMessage,
  NSpace,
  NTabs,
  NTabPane,
} from "naive-ui";
import { ArrowLeft, Save } from "lucide-vue-next";
import CharacterImageManager from "@/components/character/CharacterImageManager.vue";
import type { UpdateCharacterDto } from "@pixaura/shared-types";

const route = useRoute();
const router = useRouter();
const characterStore = useCharacterStore();
const message = useMessage();

const { currentCharacter, loading } = storeToRefs(characterStore);

const projectId = route.params.id as string;
const characterId = route.params.characterId as string;

const form = ref<UpdateCharacterDto>({
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
});
const saving = ref(false);

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

onMounted(async () => {
  await characterStore.getCharacter(characterId);
  if (currentCharacter.value) {
    // 初始化表单数据
    form.value = {
      name: currentCharacter.value.name,
      description: currentCharacter.value.description || "",
      personality: currentCharacter.value.personality || "",
      age: currentCharacter.value.age || "",
      gender: currentCharacter.value.gender || undefined,
      occupation: currentCharacter.value.occupation || "",
      background: currentCharacter.value.background || "",
      appearance: {
        height: currentCharacter.value.appearance?.height || "",
        bodyType: currentCharacter.value.appearance?.bodyType || "",
        hairColor: currentCharacter.value.appearance?.hairColor || "",
        hairStyle: currentCharacter.value.appearance?.hairStyle || "",
        eyeColor: currentCharacter.value.appearance?.eyeColor || "",
        skinTone: currentCharacter.value.appearance?.skinTone || "",
        clothingStyle: currentCharacter.value.appearance?.clothingStyle || "",
        distinctiveFeatures:
          currentCharacter.value.appearance?.distinctiveFeatures || [],
      },
      importance: currentCharacter.value.importance,
    };
  }
});

async function handleSubmit() {
  if (!form.value.name) {
    message.warning("请输入角色名称");
    return;
  }

  saving.value = true;
  try {
    await characterStore.updateCharacter(characterId, form.value);
    message.success("角色更新成功");
    router.push(`/projects/${projectId}/characters/${characterId}`);
  } catch (error) {
    message.error("更新失败，请重试");
  } finally {
    saving.value = false;
  }
}

function handleBack() {
  router.back();
}

function handleCancel() {
  router.push(`/projects/${projectId}/characters/${characterId}`);
}
</script>

<template>
  <div class="character-edit">
    <NSpin :show="loading">
      <template v-if="currentCharacter">
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
          <h1>编辑角色</h1>
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

        <!-- 标签页 -->
        <NTabs
          type="line"
          animated
        >
          <NTabPane
            name="basic"
            tab="基本信息"
          >
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

              <!-- 底部按钮 -->
              <div class="form-actions">
                <NSpace>
                  <NButton @click="handleCancel">
                    取消
                  </NButton>
                  <NButton
                    type="primary"
                    :loading="saving"
                    @click="handleSubmit"
                  >
                    保存
                  </NButton>
                </NSpace>
              </div>
            </NCard>
          </NTabPane>

          <!-- 参考图标签页 -->
          <NTabPane
            name="images"
            tab="参考图"
          >
            <CharacterImageManager
              :character="currentCharacter"
              :project-id="projectId"
              @refresh="characterStore.getCharacter(characterId)"
            />
          </NTabPane>
        </NTabs>

        <NEmpty
          v-if="!currentCharacter && !loading"
          description="角色不存在或已被删除"
        />
      </template>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
.character-edit {
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

    .form-actions {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: center;
    }
  }
}
</style>

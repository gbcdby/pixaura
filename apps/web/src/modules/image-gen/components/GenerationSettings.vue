<template>
  <div class="generation-settings">
    <n-form
      ref="formRef"
      :model="config"
      :rules="rules"
    >
      <!-- 模型选择 -->
      <n-form-item
        label="生成模型"
        path="modelId"
      >
        <n-select
          v-model:value="config.modelId"
          :options="modelOptions"
          :loading="modelsLoading"
          placeholder="选择生成模型"
        />
        <template #feedback>
          默认使用项目配置的模型，可手动切换
        </template>
      </n-form-item>

      <!-- 正向提示词 -->
      <n-form-item
        label="描述"
        path="prompt"
      >
        <n-input
          v-model:value="config.prompt"
          type="textarea"
          :rows="4"
          placeholder="描述你想要的画面..."
          maxlength="1000"
          show-count
        />
      </n-form-item>

      <!-- 负面提示词 -->
      <n-form-item
        label="不想出现的内容"
        path="negativePrompt"
      >
        <n-input
          v-model:value="config.negativePrompt"
          type="textarea"
          :rows="2"
          placeholder="描述你不想要的元素..."
          maxlength="500"
          show-count
        />
      </n-form-item>

      <!-- 尺寸选择 -->
      <n-form-item
        label="图片尺寸"
        path="size"
      >
        <n-radio-group v-model:value="selectedSize">
          <n-radio-button
            v-for="size in sizeOptions"
            :key="size.value"
            :value="size.value"
          >
            {{ size.label }}
          </n-radio-button>
        </n-radio-group>
      </n-form-item>

      <!-- 参考图（可选） -->
      <n-form-item
        label="参考图"
        path="referenceImageUrl"
      >
        <n-upload
          v-model:file-list="referenceImageList"
          list-type="image-card"
          :max="1"
          accept="image/*"
          @change="handleImageChange"
        >
          <n-button>上传参考图</n-button>
        </n-upload>
        <template #feedback>
          上传参考图将启用图生图模式，不上传则使用文生图模式
        </template>
      </n-form-item>

      <!-- 控制强度（仅图生图模式显示） -->
      <n-form-item
        v-if="config.referenceImageUrl"
        label="控制强度"
        path="strength"
      >
        <n-slider
          v-model:value="config.strength"
          :min="0"
          :max="1"
          :step="0.05"
        />
        <span class="slider-value">{{ (config.strength * 100).toFixed(0) }}%</span>
        <template #feedback>
          控制参考图对生成结果的影响程度，值越大参考图影响越大
        </template>
      </n-form-item>

      <!-- 高级设置 -->
      <n-collapse>
        <n-collapse-item title="高级设置">
          <n-form-item
            label="随机种子"
            path="seed"
          >
            <n-input-number
              v-model:value="config.seed"
              :min="0"
              :max="2147483647"
              placeholder="随机"
            />
            <n-button
              text
              @click="randomSeed"
            >
              随机
            </n-button>
          </n-form-item>

          <n-form-item
            label="风格"
            path="style"
          >
            <n-select
              v-model:value="config.style"
              :options="styleOptions"
              clearable
              placeholder="选择风格"
            />
          </n-form-item>
        </n-collapse-item>
      </n-collapse>
    </n-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  NForm,
  NFormItem,
  NSelect,
  NInput,
  NInputNumber,
  NRadioGroup,
  NRadioButton,
  NCollapse,
  NCollapseItem,
  NSlider,
  NButton,
  NUpload,
  type FormRules,
  type UploadFileInfo,
} from "naive-ui";
import type { UnifiedImageGenerationConfig } from "@pixaura/shared-types";

type ConfigType = UnifiedImageGenerationConfig;

const props = defineProps<{
  modelValue: ConfigType;
  modelsLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [config: ConfigType];
  validate: [valid: boolean];
}>();

const formRef = ref<InstanceType<typeof NForm>>();
const config = ref<ConfigType>({ ...props.modelValue });
const referenceImageList = ref<UploadFileInfo[]>([]);

// 尺寸选项
const sizeOptions = [
  { value: "1024x1024", label: "1:1 (1024x1024)", width: 1024, height: 1024 },
  { value: "768x1344", label: "9:16 (768x1344)", width: 768, height: 1344 },
  { value: "1344x768", label: "16:9 (1344x768)", width: 1344, height: 768 },
  { value: "768x1024", label: "3:4 (768x1024)", width: 768, height: 1024 },
  { value: "1024x768", label: "4:3 (1024x768)", width: 1024, height: 768 },
];

// 计算当前选中的尺寸
const selectedSize = computed({
  get: () => {
    const { width, height } = config.value;
    const found = sizeOptions.find(
      (s) => s.width === width && s.height === height,
    );
    return found?.value || "1024x1024";
  },
  set: (val: string) => {
    const size = sizeOptions.find((s) => s.value === val);
    if (size) {
      config.value.width = size.width;
      config.value.height = size.height;
    }
  },
});

// 模型选项（待从 model-config 获取）
const modelOptions = ref([
  { label: "SD XL", value: "sd-xl" },
  { label: "SD 1.5", value: "sd-1.5" },
  { label: "Midjourney", value: "midjourney" },
]);

// 风格选项
const styleOptions = [
  { label: "写实", value: "realistic" },
  { label: "动漫", value: "anime" },
  { label: "油画", value: "oil-painting" },
  { label: "水彩", value: "watercolor" },
  { label: "素描", value: "sketch" },
];

// 表单验证规则
const rules: FormRules = {
  modelId: { required: true, message: "请选择模型", trigger: "change" },
  prompt: { required: true, message: "请输入描述", trigger: "blur", max: 1000 },
  negativePrompt: { max: 500, message: "最多 500 字符", trigger: "blur" },
  referenceImageUrl: {
    required: false,
    message: "请上传参考图",
    trigger: "change",
  },
};

// 监听配置变化并同步到父组件
watch(
  () => config.value,
  (val) => {
    emit("update:modelValue", val);
    // 验证表单
    formRef.value
      ?.validate()
      .then(() => {
        emit("validate", true);
      })
      .catch(() => {
        emit("validate", false);
      });
  },
  { deep: true },
);

// 监听父组件传入的配置
watch(
  () => props.modelValue,
  (val) => {
    if (JSON.stringify(val) !== JSON.stringify(config.value)) {
      config.value = { ...val };
    }
  },
  { deep: true },
);

// 随机种子
function randomSeed() {
  config.value.seed = Math.floor(Math.random() * 2147483647);
}

// 处理参考图变化
function handleImageChange(data: { fileList: UploadFileInfo[] }) {
  referenceImageList.value = data.fileList;
  if (data.fileList.length > 0 && data.fileList[0].url) {
    // 将 url 转换为 referenceImageUrl
    config.value.referenceImageUrl = data.fileList[0].url;
  } else {
    // 清除参考图
    config.value.referenceImageUrl = undefined;
  }
}

// 暴露验证方法
async function validate() {
  try {
    await formRef.value?.validate();
    return true;
  } catch {
    return false;
  }
}

defineExpose({ validate });
</script>

<style scoped lang="scss">
.generation-settings {
  padding: 16px;
}

.slider-value {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-color-3);
}
</style>

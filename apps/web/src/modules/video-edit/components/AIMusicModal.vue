<script setup lang="ts">
/**
 * AI 配乐弹窗组件
 * 使用 naive-ui Modal
 * 配色调整为暗色调风格
 */

import { ref, computed, watch } from 'vue';
import {
  NModal,
  NSelect,
  NInputNumber,
  NButton,
  NSpace,
  NInput,
} from 'naive-ui';

// Props
interface Props {
  visible: boolean;
  totalDuration: number;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'generate': [style: string, duration: number, customDescription?: string];
  'close': [];
}>();

// 配乐参数
const selectedStyle = ref<string | null>(null);
const durationInput = ref(props.totalDuration);
const customDescription = ref('');

// 监听 totalDuration 变化
watch(
  () => props.totalDuration,
  (val) => {
    durationInput.value = val;
  },
);

// 音乐风格选项（分组结构）
// 注意：naive-ui 分组使用 children 字段，不是 options
const styleOptions = [
  {
    type: 'group',
    label: '赛博朋克 / 合成器浪潮',
    key: 'Cyberpunk',
    children: [
      { label: '暗黑疾走风', value: 'Cyberpunk, dark synthwave, heavy bass, futuristic, atmospheric, dystopian' },
      { label: '复古霓虹风', value: 'Retrowave, 80s synth pop, neon lights, driving beat, romantic cyberpunk' },
    ],
  },
  {
    type: 'group',
    label: '史诗 / 影视配乐',
    key: 'Epic',
    children: [
      { label: '奇幻战斗', value: 'Epic orchestral, cinematic, heavy brass, choir, intense battle music, Hans Zimmer style' },
      { label: '空灵宏大', value: 'Cinematic ambient, ethereal vocals, sweeping strings, majestic, slow build up' },
    ],
  },
  {
    type: 'group',
    label: '现代流行 / 氛围 R&B',
    key: 'Pop',
    children: [
      { label: '忧伤深夜流行', value: 'Melancholic pop, emotional vocal, ambient R&B, lo-fi elements, sad vibes, late night' },
      { label: '清新欢快风', value: 'Upbeat indie pop, acoustic guitar, bright synths, catchy melody, sweet vocal, summer vibe' },
    ],
  },
  {
    type: 'group',
    label: '二次元 / 日系摇滚',
    key: 'Anime',
    children: [
      { label: '热血动漫 OP', value: 'J-pop, anime opening, fast tempo, energetic rock, female vocal, electric guitar solo, upbeat' },
      { label: '日系伤感抒情', value: 'J-ballad, emotional anime soundtrack, soft piano, gentle vocal, heartbreaking, beautiful melody' },
    ],
  },
  {
    type: 'group',
    label: '新中式 / 武侠 / 国风',
    key: 'Chinese',
    children: [
      { label: '武侠大气风', value: 'Chinese traditional folk, Guzheng, Erhu, epic martial arts, cinematic, majestic, powerful beats' },
      { label: '婉约古风', value: 'Chinese ambient pop, traditional instruments, soft female vocal, poetic, melancholic, pentatonic scale' },
    ],
  },
  {
    type: 'group',
    label: '特殊小众 / 实验性',
    key: 'Experimental',
    children: [
      { label: '治愈白噪音风', value: 'Foley percussion, ambient post-rock, soft acoustic, nature sounds, healing, sleepy' },
      { label: '心理恐怖风', value: 'Dark ambient, industrial, glitch, unsettling, horror movie soundtrack, no drum' },
    ],
  },
];

// 关闭弹窗
function handleClose(): void {
  emit('update:visible', false);
  emit('close');
}

// 开始生成
function handleGenerate(): void {
  const duration = durationInput.value ?? props.totalDuration;
  emit('generate', selectedStyle.value || '', duration, customDescription.value || undefined);
  handleClose();
}

// Modal 显示状态
const showModal = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
});
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :style="{
      width: '420px',
      maxWidth: '90vw',
      background: 'var(--bg-surface, #18181d)',
      border: '1px solid var(--border, #2a2a30)',
    }"
    :mask-closable="true"
    :bordered="false"
    @close="handleClose"
  >
    <template #header>
      <div class="modal-header">
        <i class="fa-solid fa-wand-magic-sparkles header-icon"></i>
        <span>AI 智能配乐</span>
      </div>
    </template>

    <NSpace vertical :size="14">
      <div class="form-item">
        <label class="form-label">音乐风格</label>
        <NSelect
          v-model:value="selectedStyle"
          :options="styleOptions"
          placeholder="请选择音乐风格"
          :menu-props="{ class: 'ai-music-select-dropdown' }"
        />
      </div>

      <div class="form-item">
        <label class="form-label">时长（秒）</label>
        <NInputNumber
          v-model:value="durationInput"
          :min="0.5"
          :max="999"
          :step="0.1"
          :disabled="true"
          placeholder="时长"
        />
        <span class="form-hint">时长自动锁定为总时长</span>
      </div>

      <div class="form-item">
        <label class="form-label">自定义描述（可选）</label>
        <NInput
          v-model:value="customDescription"
          type="textarea"
          placeholder="输入额外的音乐描述，如情绪、节奏等..."
          :rows="2"
          :maxlength="200"
          show-count
        />
      </div>
    </NSpace>

    <template #footer>
      <NSpace justify="end">
        <NButton quaternary class="n-button--cancel" @click="handleClose">取消</NButton>
        <NButton type="primary" @click="handleGenerate" :disabled="!selectedStyle">
          开始生成
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.modal-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #eaeaef);
}

.header-icon {
  color: var(--accent, #00d4aa);
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  color: var(--text-secondary, #8888a0);
  font-weight: 500;
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted, #55556a);
}

/* 调整 NSelect/NInputNumber/NInput 的暗色主题 */
:deep(.n-base-selection) {
  background: #2a2a32 !important;
  border: 1px solid #3a3a45 !important;
  border-radius: 6px !important;
}

:deep(.n-base-selection:hover) {
  border-color: #4a4a55 !important;
}

:deep(.n-base-selection-label) {
  color: #eaeaef !important;
  background: #2a2a32 !important;
}

:deep(.n-base-selection-input) {
  color: #eaeaef !important;
}

:deep(.n-base-selection-placeholder__inner) {
  color: #a0a0b0 !important;
}

/* 选择框激活/聚焦状态 */
:deep(.n-base-selection--active) {
  border-color: var(--accent, #00d4aa) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.15) !important;
}

/* 选择框 - 更深层的选择器 */
:deep(.n-select) {
  --n-color: #2a2a32 !important;
  --n-border-color: #3a3a45 !important;
}

:deep(.n-select .n-base-selection) {
  background-color: #2a2a32 !important;
}

/* 选择框选中状态 - 标签样式 */
:deep(.n-base-selection-tag) {
  background: rgba(0, 212, 170, 0.15) !important;
  color: var(--accent, #00d4aa) !important;
}

:deep(.n-base-selection-tag__content) {
  color: var(--accent, #00d4aa) !important;
}

:deep(.n-input-number) {
  background: #2a2a32 !important;
  border: 1px solid #3a3a45 !important;
  border-radius: 6px !important;
}

:deep(.n-input-number:hover) {
  border-color: #4a4a55 !important;
}

:deep(.n-input-number-input) {
  color: #eaeaef !important;
  background: transparent !important;
}

:deep(.n-input__suffix) {
  color: #ffffff !important;
}

:deep(.n-input__suffix .n-button) {
  color: #ffffff !important;
}

:deep(.n-input__suffix .n-icon) {
  color: #ffffff !important;
}

:deep(.n-input-number--focused) {
  border-color: var(--accent, #00d4aa) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.15) !important;
}

:deep(.n-input) {
  background: #2a2a32 !important;
  border: 1px solid #3a3a45 !important;
  border-radius: 6px !important;
}

:deep(.n-input:hover) {
  border-color: #4a4a55 !important;
}

:deep(.n-input:focus-within) {
  border-color: var(--accent, #00d4aa) !important;
  box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.15) !important;
}

:deep(.n-input__textarea-el) {
  color: #eaeaef !important;
  background: transparent !important;
}

:deep(.n-input__placeholder) {
  color: #66667a !important;
}

/* 取消按钮 hover 效果 */
:deep(.n-button.n-button--cancel) {
  color: #a8a8b8 !important;
  border: 1px solid transparent !important;
  transition: all 0.2s ease !important;
}

:deep(.n-button.n-button--cancel:hover) {
  background: rgba(255, 255, 255, 0.12) !important;
  border-color: #6a6a7a !important;
  color: #ffffff !important;
}

:deep(.n-button.n-button--cancel:active) {
  background: rgba(255, 255, 255, 0.18) !important;
}

/* Primary 按钮 */
:deep(.n-button.n-button--primary-type) {
  background: var(--accent, #00d4aa) !important;
  border-color: var(--accent, #00d4aa) !important;
}

:deep(.n-button.n-button--primary-type:hover) {
  background: rgba(0, 212, 170, 0.85) !important;
}

/* 下拉菜单全局样式 - 只针对 ai-music-select-dropdown 类 */
:global(.ai-music-select-dropdown) {
  background: #2a2a32 !important;
  border: 1px solid #1f1f24 !important;
  border-radius: 6px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}

:global(.ai-music-select-dropdown .n-base-select-option) {
  color: #eaeaef !important;
  background: transparent !important;
}

:global(.ai-music-select-dropdown .n-base-select-option::before) {
  background: transparent !important;
}

:global(.ai-music-select-dropdown .n-base-select-option--selected) {
  background: rgba(0, 212, 170, 0.12) !important;
  color: var(--accent, #00d4aa) !important;
  font-weight: 500 !important;
}

:global(.ai-music-select-dropdown .n-base-select-option--pending) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #ffffff !important;
}

:global(.ai-music-select-dropdown .n-base-select-option--selected.n-base-select-option--pending) {
  background: rgba(0, 212, 170, 0.18) !important;
  color: var(--accent, #00d4aa) !important;
}

:global(.ai-music-select-dropdown .n-base-select-group-header) {
  color: #8888a0 !important;
  font-weight: 600 !important;
}

:global(.ai-music-select-dropdown .n-base-select-group-divider) {
  background: #1f1f24 !important;
}
</style>
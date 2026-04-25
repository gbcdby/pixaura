# Input Number 数字输入

只能输入数字的输入框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number \| null | undefined | 值（受控） |
| default-value | number \| null | null | 默认值 |
| min | number | undefined | 最小值 |
| max | number | undefined | 最大值 |
| step | number | 1 | 步长 |
| precision | number | undefined | 精度 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| disabled | boolean | false | 是否禁用 |
| placeholder | string | undefined | 占位符 |
| clearable | boolean | false | 是否可清除 |
| readonly | boolean | false | 是否只读 |
| show-button | boolean | true | 是否显示按钮 |
| button-placement | 'right' \| 'both' | 'right' | 按钮位置 |
| status | 'success' \| 'warning' \| 'error' | undefined | 验证状态 |
| on-update:value | (value: number \| null) => void | undefined | 值变化回调 |
| on-blur | () => void | undefined | 失焦回调 |
| on-focus | () => void | undefined | 聚焦回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-input-number v-model:value="value" />
  
  <!-- 范围限制 -->
  <n-input-number v-model:value="value" :min="0" :max="100" />
  
  <!-- 步长 -->
  <n-input-number v-model:value="value" :step="10" />
  
  <!-- 精度 -->
  <n-input-number v-model:value="value" :precision="2" />
  
  <!-- 不显示按钮 -->
  <n-input-number v-model:value="value" :show-button="false" />
</template>

<script setup>
const value = ref(0)
</script>
```

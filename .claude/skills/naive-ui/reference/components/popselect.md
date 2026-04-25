# Popselect 弹出选择

弹出选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number \| Array | undefined | 值（受控） |
| default-value | string \| number \| Array | null | 默认值 |
| options | Array | [] | 选项列表 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| multiple | boolean | false | 是否多选 |
| disabled | boolean | false | 是否禁用 |
| scrollable | boolean | false | 是否可滚动 |
| on-update:value | (value: string \| number \| Array) => void | undefined | 值变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-popselect v-model:value="value" :options="options">
    <n-button>{{ value || '请选择' }}</n-button>
  </n-popselect>
  
  <!-- 多选 -->
  <n-popselect v-model:value="values" :options="options" multiple>
    <n-button>选择</n-button>
  </n-popselect>
</template>

<script setup>
const value = ref(null)
const values = ref([])

const options = [
  { label: '选项1', value: '1' },
  { label: '选项2', value: '2' },
  { label: '选项3', value: '3' }
]
</script>
```

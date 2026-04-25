# AutoComplete 自动填充

输入框自动完成功能。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 值（受控） |
| default-value | string \| null | null | 默认值 |
| options | Array | [] | 选项列表 |
| placeholder | string | undefined | 占位符 |
| disabled | boolean | false | 是否禁用 |
| clearable | boolean | false | 是否可清除 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| blur-after-select | boolean | false | 选择后是否失焦 |
| clear-after-select | boolean | false | 选择后是否清空 |
| append | boolean | false | 选择后是否追加 |
| get-show | (value: string) => boolean | undefined | 是否显示菜单判断 |
| render-option | (info: object) => VNode | undefined | 自定义选项渲染 |
| on-update:value | (value: string) => void | undefined | 值变化回调 |
| on-select | (value: string) => void | undefined | 选择回调 |
| on-search | (value: string) => void | undefined | 搜索回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-auto-complete v-model:value="value" :options="options" />
  
  <!-- 选择后追加 -->
  <n-auto-complete v-model:value="value" :options="options" append />
  
  <!-- 选择后清空 -->
  <n-auto-complete v-model:value="value" :options="options" clear-after-select />
</template>

<script setup>
const options = [
  { label: 'gmail.com', value: 'gmail.com' },
  { label: 'qq.com', value: 'qq.com' },
  { label: '163.com', value: '163.com' }
]
</script>
```

# Mention 提及

提及某人或某物的输入组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 值（受控） |
| default-value | string | '' | 默认值 |
| options | Array | [] | 选项列表 |
| prefix | string \| string[] | '@' | 触发前缀 |
| separator | string | ' ' | 分隔符 |
| placeholder | string | undefined | 占位符 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| on-update:value | (value: string) => void | undefined | 值变化回调 |
| on-search | (pattern: string, prefix: string) => void | undefined | 搜索回调 |
| on-select | (option: object, prefix: string) => void | undefined | 选择回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-mention v-model:value="value" :options="options" />
  
  <!-- 自定义前缀 -->
  <n-mention v-model:value="value" :options="options" prefix="#" />
  
  <!-- 多个前缀 -->
  <n-mention v-model:value="value" :options="options" :prefix="['@', '#']" />
  
  <!-- 远程搜索 -->
  <n-mention v-model:value="value" :options="options" @search="handleSearch" />
</template>

<script setup>
const value = ref('')
const options = ref([
  { label: '张三', value: 'zhangsan' },
  { label: '李四', value: 'lisi' }
])

const handleSearch = (pattern, prefix) => {
  // 远程搜索逻辑
}
</script>
```

# Tree Select 树型选择

树形结构的选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number \| Array | undefined | 值（受控） |
| default-value | string \| number \| Array \| null | null | 默认值 |
| options | Array | [] | 选项列表 |
| placeholder | string | '请选择' | 占位符 |
| multiple | boolean | false | 是否多选 |
| checkable | boolean | false | 是否可选中 |
| cascade | boolean | true | 是否级联 |
| check-strategy | 'all' \| 'parent' \| 'child' | 'all' | 勾选策略 |
| filterable | boolean | false | 是否可过滤 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| clearable | boolean | false | 是否可清除 |
| default-expand-all | boolean | false | 是否默认展开所有 |
| on-update:value | (value: string \| number \| Array, option: object) => void | undefined | 值变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-tree-select v-model:value="value" :options="options" />
  
  <!-- 多选 -->
  <n-tree-select v-model:value="values" :options="options" multiple />
  
  <!-- 可勾选 -->
  <n-tree-select v-model:value="values" :options="options" checkable />
  
  <!-- 可过滤 -->
  <n-tree-select v-model:value="value" :options="options" filterable />
</template>

<script setup>
const value = ref(null)
const values = ref([])

const options = [
  {
    label: '北京',
    key: 'beijing',
    children: [
      { label: '朝阳区', key: 'chaoyang' },
      { label: '海淀区', key: 'haidian' }
    ]
  }
]
</script>
```

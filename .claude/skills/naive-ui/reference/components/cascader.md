# Cascader 级联选择

级联选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number \| Array | undefined | 值（受控） |
| default-value | string \| number \| Array \| null | null | 默认值 |
| options | Array | [] | 选项列表 |
| placeholder | string | '请选择' | 占位符 |
| multiple | boolean | false | 是否多选 |
| checkable | boolean | false | 是否可选中 |
| filterable | boolean | false | 是否可过滤 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| clearable | boolean | true | 是否可清除 |
| separator | string | ' / ' | 分隔符 |
| label-field | string | 'label' | 标签字段 |
| value-field | string | 'value' | 值字段 |
| children-field | string | 'children' | 子节点字段 |
| show-path | boolean | true | 是否显示路径 |
| check-strategy | 'all' \| 'parent' \| 'child' | 'all' | 勾选策略 |
| filter | (pattern: string, option: object, path: Array) => boolean | undefined | 过滤函数 |
| on-update:value | (value: string \| number \| Array, option: object) => void | undefined | 值变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-cascader v-model:value="value" :options="options" />
  
  <!-- 多选 -->
  <n-cascader v-model:value="values" :options="options" multiple />
  
  <!-- 可过滤 -->
  <n-cascader v-model:value="value" :options="options" filterable />
</template>

<script setup>
const options = [
  {
    label: '北京',
    value: 'beijing',
    children: [
      { label: '朝阳区', value: 'chaoyang' },
      { label: '海淀区', value: 'haidian' }
    ]
  },
  {
    label: '上海',
    value: 'shanghai',
    children: [
      { label: '浦东新区', value: 'pudong' },
      { label: '徐汇区', value: 'xuhui' }
    ]
  }
]
</script>
```

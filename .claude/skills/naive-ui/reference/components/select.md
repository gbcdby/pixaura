# Select 选择器

下拉选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number \| Array | undefined | 值（受控） |
| default-value | string \| number \| Array \| null | null | 默认值 |
| options | Array | [] | 选项列表 |
| placeholder | string | '请选择' | 占位符 |
| multiple | boolean | false | 是否多选 |
| clearable | boolean | false | 是否可清除 |
| filterable | boolean | false | 是否可过滤 |
| tag | boolean | false | 是否允许创建标签 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| disabled | boolean | false | 是否禁用 |
| loading | boolean | false | 是否加载中 |
| remote | boolean | false | 是否远程搜索 |
| clear-filter-after-select | boolean | true | 选择后是否清除过滤 |
| render-label | (option: object) => VNode | undefined | 自定义选项渲染 |
| render-tag | (props: object) => VNode | undefined | 自定义标签渲染 |
| render-option | (props: object) => VNode | undefined | 自定义选项渲染 |
| menu-props | object | undefined | 下拉菜单 props |
| status | 'success' \| 'warning' \| 'error' | undefined | 验证状态 |
| show-arrow | boolean | true | 是否显示箭头 |
| max-tag-count | number \| 'responsive' | undefined | 最大标签数 |
| consistent-menu-width | boolean | true | 菜单宽度是否一致 |

## Events

- `@update:value`: (value: string \| number \| Array) => void
- `@update:show`: (value: boolean) => void
- `@blur`: () => void
- `@focus`: () => void
- `@search`: (query: string) => void

## Methods

- `focus()`: 聚焦
- `blur()`: 失焦

## Slots

- `empty`: 空状态
- `action`: 操作区域
- `arrow`: 箭头
- `header`: 头部
- `footer`: 底部

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-select v-model:value="value" :options="options" />
  
  <!-- 多选 -->
  <n-select v-model:value="values" :options="options" multiple />
  
  <!-- 可过滤 -->
  <n-select v-model:value="value" :options="options" filterable />
  
  <!-- 远程搜索 -->
  <n-select 
    v-model:value="value" 
    :options="options" 
    filterable 
    remote 
    @search="handleSearch" 
  />
</template>
```

# Pagination 分页

分页组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | number | undefined | 当前页（受控） |
| default-page | number | 1 | 默认页 |
| page-count | number | undefined | 总页数 |
| page-size | number | undefined | 每页条数 |
| default-page-size | number | 10 | 默认每页条数 |
| page-sizes | Array | [10, 20, 30, 40] | 每页条数选项 |
| show-size-picker | boolean | false | 是否显示每页条数选择 |
| show-quick-jumper | boolean | false | 是否显示快速跳转 |
| disabled | boolean | false | 是否禁用 |
| simple | boolean | false | 是否简洁模式 |
| prev | () => VNode | undefined | 自定义上一页 |
| next | () => VNode | undefined | 自定义下一页 |
| goto | () => VNode | undefined | 自定义跳转 |
| prefix | (info: object) => VNode | undefined | 自定义前缀 |
| suffix | (info: object) => VNode | undefined | 自定义后缀 |
| label | (info: object) => VNode | undefined | 自定义标签 |
| on-update:page | (page: number) => void | undefined | 页码变化回调 |
| on-update:page-size | (pageSize: number) => void | undefined | 每页条数变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-pagination v-model:page="page" :page-count="100" />
  
  <!-- 带每页条数选择 -->
  <n-pagination 
    v-model:page="page" 
    v-model:page-size="pageSize"
    :page-count="100" 
    show-size-picker 
  />
  
  <!-- 带快速跳转 -->
  <n-pagination 
    v-model:page="page" 
    :page-count="100" 
    show-quick-jumper 
  />
  
  <!-- 简洁模式 -->
  <n-pagination v-model:page="page" :page-count="100" simple />
</template>
```

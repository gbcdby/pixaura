# Breadcrumb 面包屑

显示当前页面路径。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| separator | string | '/' | 分隔符 |

## BreadcrumbItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| href | string | undefined | 链接 |
| clickable | boolean | true | 是否可点击 |
| on-click | (e: MouseEvent) => void | undefined | 点击回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-breadcrumb>
    <n-breadcrumb-item>首页</n-breadcrumb-item>
    <n-breadcrumb-item>用户管理</n-breadcrumb-item>
    <n-breadcrumb-item>用户列表</n-breadcrumb-item>
  </n-breadcrumb>
  
  <!-- 带链接 -->
  <n-breadcrumb>
    <n-breadcrumb-item href="/">首页</n-breadcrumb-item>
    <n-breadcrumb-item href="/user">用户管理</n-breadcrumb-item>
    <n-breadcrumb-item>用户列表</n-breadcrumb-item>
  </n-breadcrumb>
  
  <!-- 自定义分隔符 -->
  <n-breadcrumb separator=">">
    <n-breadcrumb-item>首页</n-breadcrumb-item>
    <n-breadcrumb-item>用户管理</n-breadcrumb-item>
  </n-breadcrumb>
</template>
```

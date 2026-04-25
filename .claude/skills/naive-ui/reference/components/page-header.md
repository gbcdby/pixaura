# PageHeader 页头

页头组件，用于展示页面标题和导航信息。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| subtitle | string | undefined | 副标题 |
| back | boolean | false | 是否显示返回按钮 |
| on-back | () => void | undefined | 返回按钮点击回调 |

## Slots

- `default`: 额外内容
- `title`: 自定义标题
- `subtitle`: 自定义副标题
- `back`: 自定义返回按钮

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-page-header title="页面标题" />
  
  <!-- 带副标题 -->
  <n-page-header title="页面标题" subtitle="副标题" />
  
  <!-- 带返回按钮 -->
  <n-page-header title="页面标题" back @back="handleBack" />
  
  <!-- 自定义内容 -->
  <n-page-header title="页面标题">
    <template #extra>
      <n-button>操作</n-button>
    </template>
  </n-page-header>
</template>
```

# Divider 分割线

区隔内容的分割线。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title-placement | 'left' \| 'right' \| 'center' | 'center' | 标题位置 |
| dashed | boolean | false | 是否虚线 |
| vertical | boolean | false | 是否垂直 |

## Slots

- `default`: 标题内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-divider />
  
  <!-- 带文字 -->
  <n-divider>分割线</n-divider>
  
  <!-- 虚线 -->
  <n-divider dashed />
  
  <!-- 文字左对齐 -->
  <n-divider title-placement="left">左对齐</n-divider>
  
  <!-- 垂直分割线 -->
  <n-divider vertical />
</template>
```

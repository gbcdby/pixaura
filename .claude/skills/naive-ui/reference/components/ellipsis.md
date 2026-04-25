# Ellipsis 文本省略

文本过长时自动省略。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| expand-trigger | 'click' | undefined | 展开的触发方式 |
| line-clamp | number \| string | undefined | 最大行数 |
| tooltip | boolean \| TooltipProps | true | Tooltip 的属性 |

## Slots

- `default`: 文本省略的内容
- `tooltip`: tooltip 的内容

## PerformantEllipsis Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| expand-trigger | 'click' | undefined | 展开的触发方式 |
| line-clamp | number \| string | undefined | 最大行数 |
| tooltip | boolean \| TooltipProps | true | Tooltip 的属性 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-ellipsis>
    这是一段很长的文本，当超出容器宽度时会自动省略显示。
  </n-ellipsis>
  
  <!-- 多行省略 -->
  <n-ellipsis :line-clamp="2">
    这是一段很长的文本，当超出两行时会自动省略显示。
  </n-ellipsis>
  
  <!-- 点击展开 -->
  <n-ellipsis expand-trigger="click" :line-clamp="2">
    点击这段文本可以展开查看完整内容。
  </n-ellipsis>
  
  <!-- 高性能省略 -->
  <n-performant-ellipsis :line-clamp="2">
    在大量渲染的情况下使用，具备更好的性能。
  </n-performant-ellipsis>
</template>
```

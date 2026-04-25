# Image 图像

图片展示。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| src | string | undefined | 图片地址 |
| alt | string | undefined | 替代文本 |
| width | string \| number | undefined | 宽度 |
| height | string \| number | undefined | 高度 |
| object-fit | 'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down' | 'fill' | 填充模式 |
| preview-src | string | undefined | 预览图片地址 |
| preview-disabled | boolean | false | 是否禁用预览 |
| lazy | boolean | false | 是否懒加载 |
| intersection-observer-options | object | undefined | 懒加载配置 |
| fallback-src | string | undefined | 加载失败时显示的图片 |
| on-load | (e: Event) => void | undefined | 加载完成回调 |
| on-error | (e: Event) => void | undefined | 加载失败回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-image src="image.jpg" />
  
  <!-- 自定义尺寸 -->
  <n-image src="image.jpg" width="100" height="100" />
  
  <!-- 填充模式 -->
  <n-image src="image.jpg" object-fit="cover" />
  
  <!-- 可预览 -->
  <n-image src="image.jpg" preview-src="large-image.jpg" />
  
  <!-- 懒加载 -->
  <n-image src="image.jpg" lazy />
</template>
```

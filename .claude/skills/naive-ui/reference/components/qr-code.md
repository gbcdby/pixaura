# QR Code 二维码

二维码生成组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 二维码内容 |
| size | number | 128 | 二维码大小 |
| color | string | '#000' | 二维码颜色 |
| bg-color | string | '#fff' | 背景颜色 |
| icon | string | undefined | 图标地址 |
| icon-size | number | 32 | 图标大小 |
| error-correction-level | 'L' \| 'M' \| 'Q' \| 'H' | 'M' | 纠错级别 |
| padding | number \| string | undefined | 内边距 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-qr-code value="https://www.naiveui.com" />
  
  <!-- 自定义大小 -->
  <n-qr-code value="https://www.naiveui.com" :size="256" />
  
  <!-- 带图标 -->
  <n-qr-code value="https://www.naiveui.com" icon="/logo.png" />
  
  <!-- 自定义颜色 -->
  <n-qr-code value="https://www.naiveui.com" color="#18a058" />
</template>
```

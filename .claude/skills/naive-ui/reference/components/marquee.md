# Marquee 跑马灯

跑马灯组件，用于滚动展示内容。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| auto-fill | boolean | false | 是否自动填充 |
| speed | number | 50 | 滚动速度（像素/秒） |
| direction | 'left' \| 'right' | 'left' | 滚动方向 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-marquee>
    <div>滚动内容</div>
  </n-marquee>
  
  <!-- 自定义速度 -->
  <n-marquee :speed="100">
    <div>快速滚动</div>
  </n-marquee>
  
  <!-- 向右滚动 -->
  <n-marquee direction="right">
    <div>向右滚动</div>
  </n-marquee>
  
  <!-- 自动填充 -->
  <n-marquee auto-fill>
    <div>自动填充内容</div>
  </n-marquee>
</template>
```

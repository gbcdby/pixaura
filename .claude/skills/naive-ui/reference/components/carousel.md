# Carousel 轮播图

循环播放同一类型的图片、文字内容。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| current-index | number | undefined | 当前索引（受控） |
| default-index | number | 0 | 默认索引 |
| autoplay | boolean | false | 是否自动播放 |
| interval | number | 5000 | 自动播放间隔 |
| loop | boolean | true | 是否循环 |
| dot-type | 'dot' \| 'line' | 'dot' | 指示器类型 |
| dot-placement | 'top' \| 'bottom' \| 'left' \| 'right' | 'bottom' | 指示器位置 |
| show-arrow | boolean | false | 是否显示箭头 |
| draggable | boolean | false | 是否可拖拽 |
| keyboard | boolean | false | 是否支持键盘 |
| effect | 'slide' \| 'fade' \| 'card' | 'slide' | 切换效果 |
| on-update:current-index | (index: number) => void | undefined | 索引变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-carousel>
    <img src="image1.jpg">
    <img src="image2.jpg">
    <img src="image3.jpg">
  </n-carousel>
  
  <!-- 自动播放 -->
  <n-carousel autoplay>
    <img src="image1.jpg">
    <img src="image2.jpg">
  </n-carousel>
  
  <!-- 显示箭头 -->
  <n-carousel show-arrow>
    <img src="image1.jpg">
    <img src="image2.jpg">
  </n-carousel>
  
  <!-- 淡入淡出效果 -->
  <n-carousel effect="fade">
    <img src="image1.jpg">
    <img src="image2.jpg">
  </n-carousel>
</template>
```

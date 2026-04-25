# Skeleton 骨架屏

在需要等待加载内容的位置提供一个占位图形。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | boolean | false | 是否显示文本占位 |
| round | boolean | false | 是否圆角 |
| circle | boolean | false | 是否圆形 |
| height | string \| number | undefined | 高度 |
| width | string \| number | undefined | 宽度 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| animated | boolean | true | 是否动画 |
| repeat | number | 1 | 重复次数 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-skeleton text :repeat="3" />
  
  <!-- 圆形 -->
  <n-skeleton circle size="medium" />
  
  <!-- 自定义尺寸 -->
  <n-skeleton :width="200" :height="100" />
  
  <!-- 组合使用 -->
  <n-space vertical>
    <n-skeleton circle size="large" />
    <n-skeleton text :repeat="2" />
  </n-space>
</template>
```

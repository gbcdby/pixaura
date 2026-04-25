# Avatar 头像

在互联网上，没有人知道你是 *** 。

## 演示

- 尺寸
- 颜色
- 图标
- 加载失败时显示的图像
- 懒加载
- 形状
- 标记
- 字号
- 头像组

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| src | string | undefined | 头像图片地址 |
| round | boolean | true | 是否为圆形 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| color | string | undefined | 背景色 |
| fallback-src | string | undefined | 加载失败时显示的图片 |
| lazy | boolean | false | 是否懒加载 |
| intersection-observer-options | object | undefined | 懒加载配置 |
| render-fallback | () => VNode | undefined | 自定义加载失败内容 |
| render-placeholder | () => VNode | undefined | 自定义占位内容 |
| on-error | (e: Event) => void | undefined | 加载失败回调 |

## AvatarGroup Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| max | number | undefined | 最大显示数量 |
| max-style | object | undefined | 超出部分的样式 |
| options | Array | [] | 头像配置数组 |
| vertical | boolean | false | 是否垂直排列 |

## Slots

- `default`: 自定义头像内容
- `fallback`: 加载失败时显示的内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-avatar src="https://example.com/avatar.jpg" />
  
  <!-- 尺寸 -->
  <n-avatar size="small" src="..." />
  <n-avatar size="medium" src="..." />
  <n-avatar size="large" src="..." />
  
  <!-- 自定义尺寸 -->
  <n-avatar :size="48" src="..." />
  
  <!-- 头像组 -->
  <n-avatar-group :options="options" :max="3" />
</template>
```

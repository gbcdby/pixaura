# Anchor 侧边导航

用于跳转到页面指定位置。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| affix | boolean | false | 是否固定 |
| top | number | undefined | 固定时的顶部距离 |
| bound | number | 0 | 边界距离 |
| ignore-gap | boolean | false | 是否忽略间隙 |
| type | 'default' \| 'block' | 'default' | 类型 |
| offset-target | string \| HTMLElement \| Window \| Document | 'body' | 偏移目标 |
| show-rail | boolean | true | 是否显示轨道 |
| show-background | boolean | true | 是否显示背景 |

## AnchorLink Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| href | string | undefined | 链接 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-anchor>
    <n-anchor-link title="基础用法" href="#basic" />
    <n-anchor-link title="固定模式" href="#affix" />
    <n-anchor-link title="API" href="#api" />
  </n-anchor>
  
  <!-- 固定模式 -->
  <n-anchor affix :top="80">
    <n-anchor-link title="基础用法" href="#basic" />
    <n-anchor-link title="固定模式" href="#affix" />
  </n-anchor>
</template>
```

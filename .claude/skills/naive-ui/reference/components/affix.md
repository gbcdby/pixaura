# Affix 固钉

将页面元素钉在可视范围。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| top | number | undefined | 距离视口顶部距离 |
| bottom | number | undefined | 距离视口底部距离 |
| trigger-top | number | undefined | 触发固定的顶部距离 |
| trigger-bottom | number | undefined | 触发固定的底部距离 |
| position | 'fix' \| 'absolute' | 'fix' | 定位方式 |
| listen-to | string \| HTMLElement \| Window \| Document | 'body' | 监听滚动的元素 |
| on-change | (value: boolean) => void | undefined | 固定状态变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-affix :top="20">
    <n-button>固定在顶部 20px</n-button>
  </n-affix>
  
  <!-- 固定在底部 -->
  <n-affix :bottom="20">
    <n-button>固定在底部 20px</n-button>
  </n-affix>
  
  <!-- 自定义触发距离 -->
  <n-affix :top="20" :trigger-top="100">
    <n-button>滚动 100px 后固定</n-button>
  </n-affix>
</template>
```

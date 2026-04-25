# Icon 图标

用于展示图标。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| size | number \| string | undefined | 图标大小 |
| color | string | undefined | 图标颜色 |
| depth | number | undefined | 图标深度（1-5） |

## Slots

- `default`: 图标内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-icon>
    <CashOutline />
  </n-icon>
  
  <!-- 自定义尺寸 -->
  <n-icon :size="24">
    <CashOutline />
  </n-icon>
  
  <!-- 自定义颜色 -->
  <n-icon color="#FF0000">
    <CashOutline />
  </n-icon>
  
  <!-- 深度 -->
  <n-icon :depth="3">
    <CashOutline />
  </n-icon>
</template>

<script setup>
import { CashOutline } from '@vicons/ionicons5'
</script>
```

注意：Naive UI 建议使用 [xicons](https://www.xicons.org) 作为图标库。

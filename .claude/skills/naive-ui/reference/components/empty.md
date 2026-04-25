# Empty 无内容

空状态时的展示占位图。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| description | string | undefined | 描述 |
| show-description | boolean | true | 是否显示描述 |
| show-icon | boolean | true | 是否显示图标 |
| size | 'small' \| 'medium' \| 'large' \| 'huge' | 'medium' | 尺寸 |

## Slots

- `default`: 自定义内容
- `icon`: 自定义图标
- `extra`: 额外内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-empty description="暂无数据" />
  
  <!-- 大尺寸 -->
  <n-empty description="暂无数据" size="large" />
  
  <!-- 自定义内容 -->
  <n-empty description="暂无数据">
    <template #extra>
      <n-button>去添加</n-button>
    </template>
  </n-empty>
</template>
```

# Tag 标签

用于标记和选择。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| round | boolean | false | 是否为圆角 |
| closable | boolean | false | 是否可关闭 |
| disabled | boolean | false | 是否禁用 |
| strong | boolean | false | 是否加粗 |
| bordered | boolean | true | 是否有边框 |
| checkable | boolean | false | 是否可选中 |
| checked | boolean | undefined | 是否已选中（受控） |
| default-checked | boolean | false | 默认是否选中 |
| on-close | (e: MouseEvent) => void | undefined | 关闭回调 |
| on-update:checked | (value: boolean) => void | undefined | 选中状态变化回调 |

## Slots

- `default`: 标签内容
- `icon`: 图标
- `avatar`: 头像

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-tag>标签</n-tag>
  
  <!-- 类型 -->
  <n-tag type="primary">主要</n-tag>
  <n-tag type="success">成功</n-tag>
  <n-tag type="warning">警告</n-tag>
  <n-tag type="error">错误</n-tag>
  
  <!-- 可关闭 -->
  <n-tag closable @close="handleClose">可关闭</n-tag>
  
  <!-- 可选中 -->
  <n-tag checkable v-model:checked="checked">可选中</n-tag>
</template>
```

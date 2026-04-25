# Alert 警告信息

警告提示组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| title | string | undefined | 标题 |
| closable | boolean | false | 是否可关闭 |
| on-close | () => void | undefined | 关闭回调 |
| on-after-leave | () => void | undefined | 离开动画结束回调 |
| on-mouseenter | (e: MouseEvent) => void | undefined | 鼠标进入回调 |
| on-mouseleave | (e: MouseEvent) => void | undefined | 鼠标离开回调 |

## Slots

- `default`: 内容
- `icon`: 图标
- `header`: 头部

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-alert title="提示" type="info">
    这是一条普通提示
  </n-alert>
  
  <!-- 不同类型 -->
  <n-alert title="成功" type="success">操作成功</n-alert>
  <n-alert title="警告" type="warning">请注意</n-alert>
  <n-alert title="错误" type="error">操作失败</n-alert>
  
  <!-- 可关闭 -->
  <n-alert title="提示" type="info" closable>
    点击可关闭
  </n-alert>
</template>
```

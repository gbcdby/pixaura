# BackTop 回到顶部

返回页面顶部的操作按钮。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| right | number | 40 | 右边距 |
| bottom | number | 40 | 下边距 |
| visibility-height | number | 180 | 可见高度阈值 |
| to | string | 'body' | 挂载位置 |

## Slots

- `default`: 自定义内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-back-top />
  
  <!-- 自定义位置 -->
  <n-back-top :right="100" :bottom="100" />
  
  <!-- 自定义可见高度 -->
  <n-back-top :visibility-height="300" />
  
  <!-- 自定义内容 -->
  <n-back-top>
    <n-button circle>
      <n-icon><ArrowUpIcon /></n-icon>
    </n-button>
  </n-back-top>
</template>
```

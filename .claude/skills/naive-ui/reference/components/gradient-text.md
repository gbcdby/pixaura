# Gradient Text 渐变文字

创建渐变效果的文字。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| gradient | string \| { from: string, to: string, deg: number \| string } | undefined | 文字渐变色参数 |
| size | number \| string | undefined | 文字大小（当不指定单位时，默认单位: px） |
| type | 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'primary' | 渐变文字的类型 |

## Slots

- `default`: 渐变文字的内容

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-gradient-text type="primary">渐变文字</n-gradient-text>
  <n-gradient-text type="info">信息</n-gradient-text>
  <n-gradient-text type="success">成功</n-gradient-text>
  <n-gradient-text type="warning">警告</n-gradient-text>
  <n-gradient-text type="error">错误</n-gradient-text>
  
  <!-- 自定义渐变 -->
  <n-gradient-text :gradient="{ from: '#FF0000', to: '#00FF00', deg: 90 }">
    自定义渐变
  </n-gradient-text>
  
  <!-- 自定义尺寸 -->
  <n-gradient-text size="24">24px 文字</n-gradient-text>
  <n-gradient-text :size="32">32px 文字</n-gradient-text>
</template>
```

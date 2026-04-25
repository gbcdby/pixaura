# Typography 排印

文本排版组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| code | boolean | false | 是否为代码样式 |
| delete | boolean | false | 是否为删除线样式 |
| strong | boolean | false | 是否为加粗样式 |
| italic | boolean | false | 是否为斜体样式 |
| underline | boolean | false | 是否为下划线样式 |
| depth | number \| string | undefined | 文本深度 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-typography>普通文本</n-typography>
  
  <!-- 不同类型 -->
  <n-typography type="info">信息文本</n-typography>
  <n-typography type="success">成功文本</n-typography>
  <n-typography type="warning">警告文本</n-typography>
  <n-typography type="error">错误文本</n-typography>
  
  <!-- 代码样式 -->
  <n-typography code>code</n-typography>
  
  <!-- 删除线 -->
  <n-typography delete>删除线文本</n-typography>
  
  <!-- 加粗 -->
  <n-typography strong>加粗文本</n-typography>
  
  <!-- 斜体 -->
  <n-typography italic>斜体文本</n-typography>
  
  <!-- 下划线 -->
  <n-typography underline>下划线文本</n-typography>
</template>
```

# Log 日志
n
日志展示组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| log | string | undefined | 日志内容 |
| loading | boolean | false | 是否加载中 |
| trim | boolean | false | 是否去除首尾空白 |
| language | string | undefined | 语言 |
| rows | number | undefined | 行数 |
| line-height | number | undefined | 行高 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-log log="2024-01-01 12:00:00 INFO Application started" />
  
  <!-- 加载中 -->
  <n-log :log="log" loading />
  
  <!-- 限制行数 -->
  <n-log :log="log" :rows="10" />
</template>

<script setup>
const log = `2024-01-01 12:00:00 INFO Application started
2024-01-01 12:00:01 DEBUG Loading configuration
2024-01-01 12:00:02 INFO Server listening on port 3000`
</script>
```

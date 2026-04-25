# Time 时间

时间展示组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| time | number \| Date | undefined | 时间 |
| format | string | 'yyyy-MM-dd HH:mm:ss' | 格式 |
| unix | boolean | false | 是否为 Unix 时间戳 |
| type | 'relative' \| 'date' \| 'datetime' | 'datetime' | 类型 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-time :time="Date.now()" />
  
  <!-- 相对时间 -->
  <n-time :time="Date.now() - 60000" type="relative" />
  
  <!-- 自定义格式 -->
  <n-time :time="Date.now()" format="yyyy-MM-dd" />
  
  <!-- Unix 时间戳 -->
  <n-time :time="1704067200" unix />
</template>
```

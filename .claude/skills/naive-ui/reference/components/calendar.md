# Calendar 日历

日历组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number | undefined | 值（受控） |
| default-value | number | 当前时间戳 | 默认值 |
| is-date-disabled | (timestamp: number) => boolean | undefined | 禁用日期判断 |
| on-update:value | (value: number, time: { year: number, month: number, date: number }) => void | undefined | 值变化回调 |
| on-panel-change | (info: { year: number, month: number }) => void | undefined | 面板变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-calendar v-model:value="timestamp" />
  
  <!-- 禁用特定日期 -->
  <n-calendar v-model:value="timestamp" :is-date-disabled="isDateDisabled" />
</template>

<script setup>
const timestamp = ref(Date.now())

const isDateDisabled = (timestamp) => {
  // 禁用周末
  const date = new Date(timestamp)
  const day = date.getDay()
  return day === 0 || day === 6
}
</script>
```

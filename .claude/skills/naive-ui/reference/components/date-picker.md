# DatePicker 日期选择器

选择日期。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number \| Array | undefined | 值（受控） |
| default-value | number \| Array \| null | null | 默认值 |
| type | 'date' \| 'datetime' \| 'daterange' \| 'datetimerange' \| 'month' \| 'monthrange' \| 'year' \| 'quarter' \| 'week' | 'date' | 类型 |
| format | string | 'yyyy-MM-dd' | 格式 |
| placeholder | string | '选择日期' | 占位符 |
| start-placeholder | string | '开始日期' | 开始占位符 |
| end-placeholder | string | '结束日期' | 结束占位符 |
| disabled | boolean | false | 是否禁用 |
| clearable | boolean | true | 是否可清除 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| first-day-of-week | 0 \| 1 \| 2 \| 3 \| 4 \| 5 \| 6 | 0 | 每周第一天 |
| is-date-disabled | (timestamp: number) => boolean | undefined | 禁用日期判断 |
| is-time-disabled | (current: number) => object | undefined | 禁用时间判断 |
| close-on-select | boolean | true | 选择后是否关闭 |
| actions | Array | ['clear', 'now', 'confirm'] | 操作按钮 |
| status | 'success' \| 'warning' \| 'error' | undefined | 验证状态 |

## Events

- `@update:value`: (value: number \| Array) => void
- `@blur`: () => void
- `@focus`: () => void
- `@confirm`: (value: number \| Array) => void
- `@clear`: () => void

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-date-picker v-model:value="timestamp" type="date" />
  
  <!-- 日期时间 -->
  <n-date-picker v-model:value="timestamp" type="datetime" />
  
  <!-- 日期范围 -->
  <n-date-picker v-model:value="range" type="daterange" />
  
  <!-- 月份选择 -->
  <n-date-picker v-model:value="timestamp" type="month" />
  
  <!-- 年份选择 -->
  <n-date-picker v-model:value="timestamp" type="year" />
</template>
```

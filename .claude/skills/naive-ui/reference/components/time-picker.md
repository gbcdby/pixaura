# TimePicker 时间选择器

选择时间。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number \| Array | undefined | 值（受控） |
| default-value | number \| Array \| null | null | 默认值 |
| format | string | 'HH:mm:ss' | 格式 |
| placeholder | string | '选择时间' | 占位符 |
| start-placeholder | string | '开始时间' | 开始占位符 |
| end-placeholder | string | '结束时间' | 结束占位符 |
| disabled | boolean | false | 是否禁用 |
| clearable | boolean | true | 是否可清除 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| is-hour-disabled | (hour: number) => boolean | undefined | 禁用小时判断 |
| is-minute-disabled | (minute: number, hour: number) => boolean | undefined | 禁用分钟判断 |
| is-second-disabled | (second: number, minute: number, hour: number) => boolean | undefined | 禁用秒判断 |
| actions | Array | ['clear', 'now', 'confirm'] | 操作按钮 |
| status | 'success' \| 'warning' \| 'error' | undefined | 验证状态 |

## Events

- `@update:value`: (value: number \| Array) => void
- `@blur`: () => void
- `@focus`: () => void
- `@confirm`: (value: number \| Array) => void

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-time-picker v-model:value="timestamp" />
  
  <!-- 时间范围 -->
  <n-time-picker v-model:value="range" :is-range="true" />
  
  <!-- 自定义格式 -->
  <n-time-picker v-model:value="timestamp" format="HH:mm" />
</template>
```

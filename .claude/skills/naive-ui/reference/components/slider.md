# Slider 滑动选择

滑动输入器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | number \| Array | undefined | 值（受控） |
| default-value | number \| Array | 0 | 默认值 |
| min | number | 0 | 最小值 |
| max | number | 100 | 最大值 |
| step | number | 1 | 步长 |
| disabled | boolean | false | 是否禁用 |
| range | boolean | false | 是否范围选择 |
| reverse | boolean | false | 是否反向 |
| vertical | boolean | false | 是否垂直 |
| tooltip | boolean | true | 是否显示提示 |
| placement | string | 'top' | 提示位置 |
| format-tooltip | (value: number) => string \| number | undefined | 格式化提示 |
| on-update:value | (value: number \| Array) => void | undefined | 值变化回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-slider v-model:value="value" />
  
  <!-- 范围选择 -->
  <n-slider v-model:value="range" range />
  
  <!-- 自定义范围 -->
  <n-slider v-model:value="value" :min="0" :max="200" :step="10" />
  
  <!-- 格式化提示 -->
  <n-slider v-model:value="value" :format-tooltip="v => `${v}%`" />
</template>
```

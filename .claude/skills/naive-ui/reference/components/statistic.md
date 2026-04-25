# Statistic 统计数据

展示统计数据。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number | undefined | 值 |
| label | string | undefined | 标签 |
| precision | number | 0 | 精度 |
| prefix | string | undefined | 前缀 |
| suffix | string | undefined | 后缀 |
| value-style | object | undefined | 值样式 |
| tabular-nums | boolean | false | 是否使用等宽数字 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-statistic label="用户数" :value="12345" />
  
  <!-- 带前缀 -->
  <n-statistic label="金额" :value="12345" prefix="¥" />
  
  <!-- 带后缀 -->
  <n-statistic label="增长率" :value="12.5" suffix="%" />
  
  <!-- 精度 -->
  <n-statistic label="精度" :value="12.3456" :precision="2" />
</template>
```

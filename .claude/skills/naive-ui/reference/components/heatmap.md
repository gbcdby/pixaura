# Heatmap 热力图

热力图组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | Array | [] | 数据 |
| start-date | number \| Date | undefined | 开始日期 |
| end-date | number \| Date | undefined | 结束日期 |
| cell-size | number | 12 | 单元格大小 |
| cell-gap | number | 2 | 单元格间距 |
| cell-radius | number | 2 | 单元格圆角 |
| week-labels | Array | ['日', '一', '二', '三', '四', '五', '六'] | 星期标签 |
| month-labels | Array | ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'] | 月份标签 |
| colors | Array | undefined | 颜色数组 |
| on-update:range | (range: { start: Date, end: Date }) => void | undefined | 范围变化回调 |
| on-update:select | (date: Date, value: number) => void | undefined | 选择回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-heatmap :value="data" />
  
  <!-- 自定义日期范围 -->
  <n-heatmap 
    :value="data" 
    :start-date="new Date('2024-01-01')"
    :end-date="new Date('2024-12-31')"
  />
  
  <!-- 自定义颜色 -->
  <n-heatmap :value="data" :colors="['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127']" />
</template>

<script setup>
const data = [
  { date: '2024-01-01', value: 5 },
  { date: '2024-01-02', value: 3 },
  // ...
]
</script>
```

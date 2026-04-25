# Grid 栅格

24 栅格系统。

## Row Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| gutter | number \| Array \| object | 0 | 栅格间隔 |
| align-items | 'flex-start' \| 'flex-end' \| 'center' \| 'stretch' \| 'baseline' | 'stretch' | 垂直对齐 |
| justify | 'start' \| 'end' \| 'center' \| 'space-around' \| 'space-between' | 'start' | 水平对齐 |

## Col Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| span | number | 1 | 占据列数 |
| offset | number | 0 | 偏移列数 |
| push | number | 0 | 向右移动 |
| pull | number | 0 | 向左移动 |
| order | number | 0 | 排序 |
| xs | number \| object | undefined | <576px |
| sm | number \| object | undefined | >=576px |
| md | number \| object | undefined | >=768px |
| lg | number \| object | undefined | >=992px |
| xl | number \| object | undefined | >=1200px |
| xxl | number \| object | undefined | >=1600px |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-row :gutter="24">
    <n-col :span="12">
      <div>左侧</div>
    </n-col>
    <n-col :span="12">
      <div>右侧</div>
    </n-col>
  </n-row>
  
  <!-- 响应式 -->
  <n-row>
    <n-col :xs="24" :sm="12" :md="8" :lg="6">
      <div>响应式列</div>
    </n-col>
  </n-row>
  
  <!-- 偏移 -->
  <n-row>
    <n-col :span="6" :offset="6">
      <div>偏移 6 列</div>
    </n-col>
  </n-row>
</template>
```

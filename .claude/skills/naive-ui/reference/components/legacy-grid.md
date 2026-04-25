# Legacy Grid 旧版栅格

旧版 24 栅格系统。

## Row Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| gutter | number \| Array \| object | 0 | 栅格间隔 |
| align | 'top' \| 'middle' \| 'bottom' | undefined | 垂直对齐 |
| justify | 'start' \| 'end' \| 'center' \| 'space-around' \| 'space-between' | undefined | 水平对齐 |

## Col Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| span | number | 24 | 占据列数 |
| offset | number | 0 | 偏移列数 |
| push | number | 0 | 向右移动 |
| pull | number | 0 | 向左移动 |
| xs | number \| object | undefined | <576px |
| sm | number \| object | undefined | >=576px |
| md | number \| object | undefined | >=768px |
| lg | number \| object | undefined | >=992px |
| xl | number \| object | undefined | >=1200px |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-row>
    <n-col :span="12">
      <div>左侧</div>
    </n-col>
    <n-col :span="12">
      <div>右侧</div>
    </n-col>
  </n-row>
  
  <!-- 带间隔 -->
  <n-row :gutter="16">
    <n-col :span="8">
      <div>Item 1</div>
    </n-col>
    <n-col :span="8">
      <div>Item 2</div>
    </n-col>
    <n-col :span="8">
      <div>Item 3</div>
    </n-col>
  </n-row>
  
  <!-- 响应式 -->
  <n-row>
    <n-col :xs="24" :sm="12" :md="8">
      <div>响应式列</div>
    </n-col>
  </n-row>
</template>
```

注意：这是旧版栅格系统，推荐使用新的 Grid 组件。

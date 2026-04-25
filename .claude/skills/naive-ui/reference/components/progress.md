# Progress 进度

展示操作进度。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'line' \| 'circle' \| 'multiple-circle' \| 'dashboard' | 'line' | 类型 |
| percentage | number \| Array | 0 | 百分比 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| status | 'default' \| 'success' \| 'error' \| 'warning' \| 'info' | 'default' | 状态 |
| indicator-placement | 'inside' \| 'outside' | 'outside' | 指示器位置 |
| processing | boolean | false | 是否进行中 |
| show-indicator | boolean | true | 是否显示指示器 |
| rail-color | string \| Array | undefined | 轨道颜色 |
| fill-color | string \| Array | undefined | 填充颜色 |
| border-radius | number \| string | undefined | 圆角 |
| height | number \| string | undefined | 高度 |
| gap-offset | number | undefined | 间隙偏移 |
| gap-degree | number | undefined | 间隙角度 |
| unit | string | '%' | 单位 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-progress :percentage="50" />
  
  <!-- 不同类型 -->
  <n-progress type="circle" :percentage="50" />
  <n-progress type="dashboard" :percentage="50" />
  
  <!-- 不同状态 -->
  <n-progress :percentage="50" status="success" />
  <n-progress :percentage="50" status="error" />
  
  <!-- 进行中 -->
  <n-progress :percentage="50" processing />
</template>
```

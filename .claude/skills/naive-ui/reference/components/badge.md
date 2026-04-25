# Badge 标记

图标右上角的数字或状态标记。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number | undefined | 值 |
| max | number | undefined | 最大值 |
| dot | boolean | false | 是否显示为圆点 |
| show-zero | boolean | false | 是否显示 0 |
| processing | boolean | false | 是否处理中 |
| color | string | undefined | 颜色 |
| offset | Array | undefined | 偏移 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-badge :value="10">
    <n-avatar src="..." />
  </n-badge>
  
  <!-- 圆点 -->
  <n-badge dot>
    <n-avatar src="..." />
  </n-badge>
  
  <!-- 处理中 -->
  <n-badge processing :value="10">
    <n-avatar src="..." />
  </n-badge>
  
  <!-- 最大值 -->
  <n-badge :value="200" :max="99">
    <n-avatar src="..." />
  </n-badge>
</template>
```

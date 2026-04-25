# Number Animation 数值动画

数值动画组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| from | number | 0 | 起始值 |
| to | number | undefined | 目标值 |
| duration | number | 1000 | 动画时长（毫秒） |
| precision | number | 0 | 精度 |
| show-separator | boolean | false | 是否显示千分位分隔符 |
| separator | string | ',' | 分隔符 |
| active | boolean | true | 是否激活动画 |
| on-finish | () => void | undefined | 动画结束回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-number-animation :from="0" :to="1000" />
  
  <!-- 自定义时长 -->
  <n-number-animation :from="0" :to="1000" :duration="2000" />
  
  <!-- 显示千分位 -->
  <n-number-animation :from="0" :to="1000000" show-separator />
  
  <!-- 精度 -->
  <n-number-animation :from="0" :to="100.123" :precision="2" />
</template>
```

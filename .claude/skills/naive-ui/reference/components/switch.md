# Switch 开关

开关选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | boolean | undefined | 值（受控） |
| default-value | boolean | false | 默认值 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| checked-value | string \| boolean \| number | true | 选中时的值 |
| unchecked-value | string \| boolean \| number | false | 未选中时的值 |
| checked-color | string | undefined | 选中时的颜色 |
| unchecked-color | string | undefined | 未选中时的颜色 |
| rail-style | object | undefined | 轨道样式 |
| loading | boolean | false | 是否加载中 |

## Events

- `@update:value`: (value: boolean) => void

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-switch v-model:value="active" />
  
  <!-- 自定义值 -->
  <n-switch 
    v-model:value="value" 
    :checked-value="1" 
    :unchecked-value="0" 
  />
  
  <!-- 不同尺寸 -->
  <n-switch size="small" />
  <n-switch size="medium" />
  <n-switch size="large" />
</template>
```

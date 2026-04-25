# ColorPicker 颜色选择器

颜色选择器。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 值（受控） |
| default-value | string | 'rgba(0, 0, 0, 1)' | 默认值 |
| modes | Array | ['rgb', 'hex', 'hsl', 'hsv'] | 可选模式 |
| show-alpha | boolean | true | 是否显示透明度 |
| actions | Array | [] | 操作按钮 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| swatches | Array | undefined | 预设颜色 |
| on-update:value | (value: string) => void | undefined | 值变化回调 |
| on-confirm | (value: string) => void | undefined | 确认回调 |
| on-clear | () => void | undefined | 清除回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-color-picker v-model:value="color" />
  
  <!-- 不显示透明度 -->
  <n-color-picker v-model:value="color" :show-alpha="false" />
  
  <!-- 预设颜色 -->
  <n-color-picker 
    v-model:value="color" 
    :swatches="['#FF0000', '#00FF00', '#0000FF']" 
  />
  
  <!-- 可清除 -->
  <n-color-picker v-model:value="color" :actions="['clear']" />
</template>
```

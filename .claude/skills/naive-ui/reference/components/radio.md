# Radio 单选

单选框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| checked | boolean | undefined | 是否选中（受控） |
| default-checked | boolean | false | 默认是否选中 |
| value | string \| number | undefined | 在 RadioGroup 中使用的值 |
| label | string | undefined | 标签 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |

## Events

- `@update:checked`: (value: boolean) => void

## RadioGroup Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string \| number | undefined | 值（受控） |
| default-value | string \| number \| null | null | 默认值 |
| options | Array | [] | 选项列表 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| name | string | undefined | 名称 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-radio v-model:checked="checked">单选框</n-radio>
  
  <!-- 单选框组 -->
  <n-radio-group v-model:value="value">
    <n-radio value="beijing">北京</n-radio>
    <n-radio value="shanghai">上海</n-radio>
    <n-radio value="guangzhou">广州</n-radio>
  </n-radio-group>
</template>
```

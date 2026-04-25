# Checkbox 复选框

多选框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| checked | boolean | undefined | 是否选中（受控） |
| default-checked | boolean | false | 默认是否选中 |
| value | string \| number | undefined | 在 CheckboxGroup 中使用的值 |
| label | string | undefined | 标签 |
| disabled | boolean | false | 是否禁用 |
| indeterminate | boolean | false | 是否部分选中 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| focusable | boolean | true | 是否可聚焦 |
| checked-value | string \| boolean \| number | true | 选中时的值 |
| unchecked-value | string \| boolean \| number | false | 未选中时的值 |

## Events

- `@update:checked`: (value: boolean) => void

## Methods

- `focus()`: 聚焦
- `blur()`: 失焦

## CheckboxGroup Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | Array | undefined | 值（受控） |
| default-value | Array | [] | 默认值 |
| options | Array | [] | 选项列表 |
| disabled | boolean | false | 是否禁用 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| max | number | undefined | 最大可选数量 |
| min | number | undefined | 最小可选数量 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-checkbox v-model:checked="checked">复选框</n-checkbox>
  
  <!-- 复选框组 -->
  <n-checkbox-group v-model:value="values">
    <n-checkbox value="beijing">北京</n-checkbox>
    <n-checkbox value="shanghai">上海</n-checkbox>
    <n-checkbox value="guangzhou">广州</n-checkbox>
  </n-checkbox-group>
  
  <!-- 部分选中 -->
  <n-checkbox indeterminate>部分选中</n-checkbox>
</template>
```

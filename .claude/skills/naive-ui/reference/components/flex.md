# Flex 弹性布局

Flex 布局组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| vertical | boolean | false | 是否垂直排列 |
| wrap | 'wrap' \| 'nowrap' \| 'wrap-reverse' | undefined | 换行 |
| justify | 'flex-start' \| 'flex-end' \| 'center' \| 'space-between' \| 'space-around' \| 'space-evenly' | undefined | 水平对齐 |
| align | 'flex-start' \| 'flex-end' \| 'center' \| 'stretch' \| 'baseline' | undefined | 垂直对齐 |
| gap | number \| string \| Array | undefined | 间距 |
| inline | boolean | false | 是否为行内元素 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-flex>
    <div>Item 1</div>
    <div>Item 2</div>
    <div>Item 3</div>
  </n-flex>
  
  <!-- 垂直排列 -->
  <n-flex vertical>
    <div>Item 1</div>
    <div>Item 2</div>
  </n-flex>
  
  <!-- 居中对齐 -->
  <n-flex justify="center" align="center">
    <div>Item 1</div>
    <div>Item 2</div>
  </n-flex>
  
  <!-- 间距 -->
  <n-flex :gap="16">
    <div>Item 1</div>
    <div>Item 2</div>
  </n-flex>
</template>
```

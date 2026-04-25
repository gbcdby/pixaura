# Highlight 高亮文本

文本高亮组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| text | string | undefined | 原文本 |
| pattern | string \| RegExp | undefined | 高亮模式 |
| highlight-class | string | undefined | 高亮类名 |
| highlight-style | object | undefined | 高亮样式 |
| case-sensitive | boolean | false | 是否区分大小写 |
| auto-escape | boolean | true | 是否自动转义 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-highlight text="Hello World" pattern="World" />
  
  <!-- 自定义样式 -->
  <n-highlight 
    text="Hello World" 
    pattern="World"
    highlight-style="{ backgroundColor: 'yellow' }"
  />
  
  <!-- 正则表达式 -->
  <n-highlight text="Hello World" pattern="/W\w+/" />
</template>
```

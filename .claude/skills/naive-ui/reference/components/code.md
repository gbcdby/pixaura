# Code 代码

代码展示组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| code | string | undefined | 代码内容 |
| language | string | undefined | 代码语言 |
| trim | boolean | true | 是否去除首尾空白 |
| inline | boolean | false | 是否为行内代码 |
| word-wrap | boolean | false | 是否自动换行 |
| show-line-numbers | boolean | false | 是否显示行号 |
| highlight | (code: string, language: string) => string | undefined | 高亮函数 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-code code="console.log('Hello World')" language="javascript" />
  
  <!-- 行内代码 -->
  <n-code code="const a = 1" inline />
  
  <!-- 显示行号 -->
  <n-code :code="code" language="typescript" show-line-numbers />
  
  <!-- 自动换行 -->
  <n-code :code="longCode" language="javascript" word-wrap />
</template>

<script setup>
const code = `const greeting = 'Hello World'
console.log(greeting)`

const longCode = `const veryLongVariableName = 'This is a very long string that would normally overflow the container'`
</script>
```

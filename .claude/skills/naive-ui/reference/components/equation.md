# Equation 公式

数学公式展示组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | LaTeX 公式 |
| katex | object | undefined | KaTeX 配置 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-equation value="E = mc^2" />
  
  <!-- 复杂公式 -->
  <n-equation value="\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n" />
  
  <!-- 分数 -->
  <n-equation value="\\frac{a}{b}" />
</template>
```

注意：使用此组件需要安装 KaTeX 依赖。

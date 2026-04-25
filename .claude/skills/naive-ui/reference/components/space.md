# Space 间距

设置组件之间的间距。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| vertical | boolean | false | 是否垂直 |
| size | 'small' \| 'medium' \| 'large' \| number \| Array | 'medium' | 间距大小 |
| wrap | boolean | true | 是否换行 |
| align | 'stretch' \| 'baseline' \| 'start' \| 'end' \| 'center' | undefined | 对齐方式 |
| justify | 'start' \| 'end' \| 'center' \| 'space-around' \| 'space-between' \| 'space-evenly' | undefined | 水平对齐 |
| item-style | string \| object | undefined | 子元素样式 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-space>
    <n-button>按钮1</n-button>
    <n-button>按钮2</n-button>
    <n-button>按钮3</n-button>
  </n-space>
  
  <!-- 垂直 -->
  <n-space vertical>
    <n-input />
    <n-input />
  </n-space>
  
  <!-- 自定义间距 -->
  <n-space :size="32">
    <n-button>按钮1</n-button>
    <n-button>按钮2</n-button>
  </n-space>
  
  <!-- 不同间距 -->
  <n-space :size="[16, 32]">
    <n-button>按钮1</n-button>
    <n-button>按钮2</n-button>
  </n-space>
</template>
```

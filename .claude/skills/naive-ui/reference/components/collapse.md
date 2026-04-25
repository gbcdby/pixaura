# Collapse 折叠面板

可以折叠/展开的内容区域。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| expanded-names | string \| number \| Array | undefined | 展开的项（受控） |
| default-expanded-names | string \| number \| Array | [] | 默认展开的项 |
| accordion | boolean | false | 是否手风琴模式 |
| display-directive | 'if' \| 'show' | 'if' | 显示指令 |
| on-update:expanded-names | (names: Array) => void | undefined | 展开项变化回调 |

## CollapseItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| name | string \| number | undefined | 标识 |
| title | string | undefined | 标题 |
| disabled | boolean | false | 是否禁用 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-collapse>
    <n-collapse-item title="标题1" name="1">
      内容1
    </n-collapse-item>
    <n-collapse-item title="标题2" name="2">
      内容2
    </n-collapse-item>
  </n-collapse>
  
  <!-- 手风琴模式 -->
  <n-collapse accordion>
    <n-collapse-item title="标题1" name="1">内容1</n-collapse-item>
    <n-collapse-item title="标题2" name="2">内容2</n-collapse-item>
  </n-collapse>
  
  <!-- 默认展开 -->
  <n-collapse :default-expanded-names="['1']">
    <n-collapse-item title="标题1" name="1">内容1</n-collapse-item>
    <n-collapse-item title="标题2" name="2">内容2</n-collapse-item>
  </n-collapse>
</template>
```

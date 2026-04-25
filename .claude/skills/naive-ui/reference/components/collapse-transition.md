# Collapse Transition 折叠渐变

折叠动画过渡组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| show | boolean | undefined | 是否显示（受控） |
| appear | boolean | false | 是否初始动画 |
| collapsed-size | number | 0 | 折叠时的大小 |

## Events

- `@before-enter`: 进入动画开始前
- `@enter`: 进入动画开始
- `@after-enter`: 进入动画结束
- `@before-leave`: 离开动画开始前
- `@leave`: 离开动画开始
- `@after-leave`: 离开动画结束

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-collapse-transition :show="show">
    <div>折叠内容</div>
  </n-collapse-transition>
  
  <!-- 初始动画 -->
  <n-collapse-transition :show="show" appear>
    <div>折叠内容</div>
  </n-collapse-transition>
</template>

<script setup>
const show = ref(true)
</script>
```

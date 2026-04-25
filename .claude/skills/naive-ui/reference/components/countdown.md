# Countdown 倒计时

倒计时组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| duration | number | undefined | 倒计时时长（毫秒） |
| active | boolean | true | 是否开始倒计时 |
| precision | number | 0 | 精度（小数位数） |
| render | (props: { hours: number, minutes: number, seconds: number, milliseconds: number }) => VNode | undefined | 自定义渲染 |
| on-finish | () => void | undefined | 倒计时结束回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-countdown :duration="86400000" />
  
  <!-- 自定义渲染 -->
  <n-countdown :duration="3600000" :render="renderCountdown" />
  
  <!-- 控制开始/暂停 -->
  <n-countdown :duration="60000" :active="active" @finish="handleFinish" />
</template>

<script setup>
const active = ref(true)

const renderCountdown = ({ hours, minutes, seconds }) => {
  return `${hours}小时${minutes}分${seconds}秒`
}

const handleFinish = () => {
  console.log('倒计时结束')
}
</script>
```

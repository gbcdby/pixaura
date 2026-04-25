# Input OTP 验证码

验证码输入组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 值（受控） |
| default-value | string | '' | 默认值 |
| length | number | 6 | 验证码长度 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| disabled | boolean | false | 是否禁用 |
| placeholder | string | undefined | 占位符 |
| separator | string | undefined | 分隔符 |
| on-update:value | (value: string) => void | undefined | 值变化回调 |
| on-finish | (value: string) => void | undefined | 输入完成回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-input-otp v-model:value="otp" />
  
  <!-- 自定义长度 -->
  <n-input-otp v-model:value="otp" :length="4" />
  
  <!-- 带分隔符 -->
  <n-input-otp v-model:value="otp" separator="-" />
  
  <!-- 输入完成回调 -->
  <n-input-otp v-model:value="otp" @finish="handleFinish" />
</template>

<script setup>
const otp = ref('')

const handleFinish = (value) => {
  console.log('输入完成:', value)
}
</script>
```

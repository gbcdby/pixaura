# Form 表单

表单验证和提交。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| model | object | {} | 表单数据 |
| rules | object | {} | 验证规则 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| label-width | number \| string \| 'auto' | 'auto' | 标签宽度 |
| label-align | 'left' \| 'right' | 'left' | 标签对齐 |
| label-placement | 'left' \| 'top' | 'top' | 标签位置 |
| show-require-mark | boolean | true | 是否显示必填标记 |
| require-mark-placement | 'left' \| 'right' \| 'right-hanging' | 'right' | 必填标记位置 |
| inline | boolean | false | 是否行内表单 |
| disabled | boolean | false | 是否禁用 |
| show-feedback | boolean | true | 是否显示反馈 |
| on-submit | (e: Event) => void | undefined | 提交回调 |
| on-reset | (e: Event) => void | undefined | 重置回调 |

## Methods

- `validate(validateCallback?, rule?)`: 验证表单
- `restoreValidation()`: 重置验证状态

## FormItem Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| label | string | undefined | 标签 |
| path | string | undefined | 字段路径 |
| rule | object \| array | undefined | 验证规则 |
| required | boolean | false | 是否必填 |
| show-require-mark | boolean | undefined | 是否显示必填标记 |
| label-width | number \| string | undefined | 标签宽度 |
| label-align | 'left' \| 'right' | undefined | 标签对齐 |
| label-placement | 'left' \| 'top' | undefined | 标签位置 |
| show-feedback | boolean | undefined | 是否显示反馈 |
| first | boolean | false | 是否只显示第一条错误 |
| ignore-path-change | boolean | false | 是否忽略路径变化 |
| validation-status | 'error' \| 'success' \| 'warning' | undefined | 验证状态 |
| feedback | string | undefined | 反馈信息 |
| show-label | boolean | true | 是否显示标签 |

## Slots

- `default`: 表单内容
- `label`: 自定义标签
- `feedback`: 自定义反馈

## 用法

```vue
<template>
  <n-form :model="formValue" :rules="rules" ref="formRef">
    <n-form-item label="用户名" path="username">
      <n-input v-model:value="formValue.username" />
    </n-form-item>
    <n-form-item label="密码" path="password">
      <n-input type="password" v-model:value="formValue.password" />
    </n-form-item>
    <n-form-item>
      <n-button type="primary" @click="handleSubmit">提交</n-button>
    </n-form-item>
  </n-form>
</template>

<script setup>
import { ref } from 'vue'

const formRef = ref(null)
const formValue = ref({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleSubmit = () => {
  formRef.value?.validate((errors) => {
    if (!errors) {
      // 验证通过
    }
  })
}
</script>
```

# Input 文本输入

文本输入框。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| value | string | undefined | 值（受控） |
| default-value | string | '' | 默认值 |
| placeholder | string | undefined | 占位符 |
| type | 'text' \| 'password' \| 'textarea' | 'text' | 类型 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| disabled | boolean | false | 是否禁用 |
| readonly | boolean | false | 是否只读 |
| clearable | boolean | false | 是否可清除 |
| round | boolean | false | 是否为圆角 |
| maxlength | number | undefined | 最大长度 |
| minlength | number | undefined | 最小长度 |
| show-count | boolean | false | 是否显示计数 |
| autosize | boolean \| object | false | 自适应高度 |
| pair | boolean | false | 是否成对输入 |
| separator | string | undefined | 分隔符 |
| passively-activated | boolean | false | 是否被动激活 |
| status | 'success' \| 'warning' \| 'error' | undefined | 验证状态 |
| loading | boolean | false | 是否加载中 |
| rows | number | 3 | textarea 行数 |

## Events

- `@update:value`: (value: string) => void
- `@blur`: () => void
- `@focus`: () => void
- `@input`: (value: string) => void
- `@change`: (value: string) => void
- `@keydown`: (e: KeyboardEvent) => void
- `@keyup`: (e: KeyboardEvent) => void

## Methods

- `focus()`: 聚焦
- `blur()`: 失焦
- `select()`: 选中文本

## Slots

- `prefix`: 前缀
- `suffix`: 后缀
- `addon-prefix`: 前置标签
- `addon-suffix`: 后置标签

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-input v-model:value="value" placeholder="请输入" />
  
  <!-- 密码输入 -->
  <n-input type="password" placeholder="请输入密码" />
  
  <!-- 文本域 -->
  <n-input type="textarea" placeholder="请输入" />
  
  <!-- 自适应高度 -->
  <n-input type="textarea" autosize />
  
  <!-- 可清除 -->
  <n-input clearable />
  
  <!-- 带前后缀 -->
  <n-input>
    <template #prefix>
      <n-icon><UserIcon /></n-icon>
    </template>
    <template #suffix>
      @gmail.com
    </template>
  </n-input>
</template>
```

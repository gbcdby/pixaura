# 常见问题

## 1. @update:xxx 和 on-update:xxx 的区别

### 情况 1

如果你没有在同一个组件上同时使用 `v-model:xxx` 和 `on-update:xxx`，`@update:xxx` 和 `on-update:xxx` 在模版中使用时没有任何区别。

在 Naive UI 中，全部的 API 文档使用 `on-update:xxx` 格式，因为 `@` 只是 Vue 提供的一种简写。

- 如果你偏爱 camelCase，可以使用 `onUpdate:xxx`
- 如果你在使用 JSX，可以使用 `onUpdateXxx`（所有的 `onUpdate:xxx` 都有一个 `onUpdateXxx` 的对等实现）

### 情况 2

如果你在一个组件上使用了 `v-model:xxx`，你应该使用 `@update:xxx`。

✅ 正确示例：
```vue
<n-input v-model:value="xxx" @update:value="yyy" />
```

❌ 错误示例：
```vue
<n-input v-model:value="xxx" :on-update:value="yyy" />
```

这是因为 `v-model:value="xxx"` 会被转化为 `:onUpdate:value="xxx"`。如果你同时使用了 `@update:value="yyy"`，他们会被转化为 `:onUpdate:value="[xxx, yyy]"`，然后 Naive UI 会来处理这种情况。

然而如果你使用了 `on-update:value="yyy"`，Vue 会生成类似于 `:onUpdate:value="xxx" :on-update:value="yyy"` 的代码，然后第二个属性会在运行时覆盖掉第一个，`v-model:value` 会崩掉。

## 2. 如何在单文件组件（SFC）中使用？

详见 [SKILL.md](../SKILL.md) 中的"在 SFC 中使用"部分。

## 3. 如何配置字体？

Naive UI 可以和 [vfonts](https://github.com/07akioni/vfonts) 配合：

```js
// 你 App 的入口 js 文件
import 'vfonts/Lato.css'      // 通用字体
import 'vfonts/FiraCode.css'  // 等宽字体
```

注意：不同 vfonts 字体提供的字重不同，在使用 `Lato`、`OpenSans` 的时候你需要全局调整 naive-ui 的字重配置：

```vue
<n-config-provider :theme-overrides="{ common: { fontWeightStrong: '600' } }">
  <app />
</n-config-provider>
```

## 4. 如何调整主题？

使用 `n-config-provider` 的 `theme-overrides` 属性：

```vue
<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <app />
  </n-config-provider>
</template>

<script setup>
const themeOverrides = {
  common: {
    primaryColor: '#FF0000'
  }
}
</script>
```

更多详情请参考 [theme.md](./theme.md)。

## 5. 如何使用暗色主题？

```vue
<template>
  <n-config-provider :theme="darkTheme">
    <app />
  </n-config-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'
</script>
```

## 6. 如何国际化？

```vue
<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <app />
  </n-config-provider>
</template>

<script setup>
import { zhCN, dateZhCN } from 'naive-ui'
</script>
```

## 7. SSR 配置失败怎么办？

确保满足以下条件：

1. `@css-render/*` 和 `css-render` 包版本 >= 0.15.14
2. 没有重复的包版本

可以在 lock file 中搜索 `css-render` 检查是否有重复。

如果因为这个原因遇到问题，你可以通过 `package.json` 中的 `resolution` 字段来让所有相关包指向同一个版本。

更多详情请参考 [ssr.md](./ssr.md)。

## 8. 如何处理样式冲突？

### 控制样式插入位置

在 `<head>` 中加入 meta 标签：

```html
<head>
  <meta name="naive-ui-style" />
  <meta name="vueuc-style" />
</head>
```

### 禁用 preflight 样式

```vue
<n-config-provider preflight-style-disabled>
  <your-app />
</n-config-provider>
```

## 9. 如何使用图标？

Naive UI 建议使用 [xicons](https://www.xicons.org) 作为图标库。

安装：

```bash
npm i -D @vicons/ionicons5
```

使用：

```vue
<template>
  <n-icon>
    <CashOutline />
  </n-icon>
</template>

<script setup>
import { CashOutline } from '@vicons/ionicons5'
</script>
```

## 10. 如何使用虚拟列表？

以下组件支持虚拟列表：

- Select
- Tree
- Transfer
- Table
- Cascader

启用虚拟列表：

```vue
<!-- Select -->
<n-select :options="options" virtual-scroll />

<!-- Table -->
<n-data-table :columns="columns" :data="data" :scroll-y="400" />

<!-- Tree -->
<n-tree :data="data" virtual-scroll />
```

## 11. 如何自定义组件渲染？

使用 `render-*` 属性或插槽：

```vue
<!-- Select 自定义选项渲染 -->
<n-select :options="options" :render-label="renderLabel" />

<!-- Table 自定义单元格渲染 -->
<n-data-table :columns="columns" :data="data" />

<!-- 在 columns 中定义 -->
<script setup>
const columns = [
  {
    title: '名称',
    key: 'name',
    render(row) {
      return h('span', row.name)
    }
  }
]
</script>
```

## 12. 如何使用表单验证？

```vue
<template>
  <n-form :model="formValue" :rules="rules" ref="formRef">
    <n-form-item label="用户名" path="username">
      <n-input v-model:value="formValue.username" />
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
  username: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
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

## 13. 如何使用 Dialog/Message/Notification？

```vue
<script setup>
import { useDialog, useMessage, useNotification } from 'naive-ui'

const dialog = useDialog()
const message = useMessage()
const notification = useNotification()

// Dialog
dialog.success({
  title: '成功',
  content: '操作成功完成'
})

// Message
message.success('操作成功')

// Notification
notification.success({
  title: '成功',
  content: '操作成功完成'
})
</script>
```

注意：这些 hooks 必须在 `n-dialog-provider`、`n-message-provider`、`n-notification-provider` 的后代组件中使用。

## 14. 如何设置组件的 size？

大部分组件都有 `size` 属性：

```vue
<n-button size="small">小按钮</n-button>
<n-button size="medium">中按钮</n-button>
<n-button size="large">大按钮</n-button>

<n-input size="small" />
<n-select size="large" />
```

也可以通过 `n-config-provider` 全局设置：

```vue
<n-config-provider :theme-overrides="{ common: { fontSize: '16px' } }">
  <app />
</n-config-provider>
```

## 15. 如何禁用组件的动画？

大部分动画无法单独禁用，但可以通过 CSS 覆盖：

```css
/* 禁用所有过渡动画 */
.n-base-selection {
  transition: none !important;
}
```

## 16. 如何获取组件的 ref？

```vue
<template>
  <n-input ref="inputRef" />
  <n-button @click="focusInput">聚焦</n-button>
</template>

<script setup>
import { ref } from 'vue'

const inputRef = ref(null)

const focusInput = () => {
  inputRef.value?.focus()
}
</script>
```

## 17. 如何处理组件的事件？

```vue
<template>
  <n-input 
    v-model:value="value"
    @blur="handleBlur"
    @focus="handleFocus"
    @keydown="handleKeydown"
  />
</template>
```

## 18. 如何使用受控组件？

```vue
<template>
  <n-input 
    :value="value"
    @update:value="handleUpdate"
  />
</template>

<script setup>
import { ref } from 'vue'

const value = ref('')

const handleUpdate = (newValue) => {
  // 可以在这里进行拦截或处理
  value.value = newValue
}
</script>
```

## 19. 如何使用非受控组件？

```vue
<template>
  <n-input 
    default-value="默认值"
    @update:value="handleUpdate"
  />
</template>
```

## 20. 如何清空组件的值？

在 naive-ui 中，只要 `value` 是 `undefined` 或根本没传，组件就是非受控的。清空建议使用 `null`：

```vue
<template>
  <n-input v-model:value="value" />
  <n-button @click="clear">清空</n-button>
</template>

<script setup>
import { ref } from 'vue'

const value = ref('')

const clear = () => {
  value.value = null // 不要使用 undefined
}
</script>
```

# Dialog 对话框

对话框组件，用于显示重要信息或确认操作。

## useDialog

```ts
import { useDialog } from 'naive-ui'

const dialog = useDialog()

// 方法
dialog.create(options: DialogOptions)
dialog.info(options: DialogOptions)
dialog.success(options: DialogOptions)
dialog.warning(options: DialogOptions)
dialog.error(options: DialogOptions)

// 销毁
dialog.destroyAll()
```

## DialogOptions

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| type | 'default' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 类型 |
| title | string | undefined | 标题 |
| content | string | undefined | 内容 |
| positive-text | string | undefined | 确认按钮文本 |
| negative-text | string | undefined | 取消按钮文本 |
| positive-button-type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'primary' | 确认按钮类型 |
| negative-button-type | 'default' \| 'primary' \| 'info' \| 'success' \| 'warning' \| 'error' | 'default' | 取消按钮类型 |
| loading | boolean | false | 是否加载中 |
| closable | boolean | true | 是否可关闭 |
| mask-closable | boolean | true | 点击遮罩是否关闭 |
| on-positive-click | () => boolean \| Promise<boolean> | undefined | 确认回调 |
| on-negative-click | () => boolean \| Promise<boolean> | undefined | 取消回调 |
| on-close | () => void | undefined | 关闭回调 |

## 用法

```vue
<script setup>
import { useDialog } from 'naive-ui'

const dialog = useDialog()

// 信息对话框
dialog.info({
  title: '提示',
  content: '这是一条信息',
  positiveText: '确定'
})

// 确认对话框
dialog.warning({
  title: '确认删除',
  content: '确定要删除这条记录吗？',
  positiveText: '确定',
  negativeText: '取消',
  onPositiveClick: () => {
    // 执行删除
    return true
  }
})

// 成功提示
dialog.success({
  title: '成功',
  content: '操作成功完成'
})

// 错误提示
dialog.error({
  title: '错误',
  content: '操作失败'
})
</script>
```

注意：useDialog 必须在 `n-dialog-provider` 的后代组件中使用。

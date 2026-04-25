# Discrete API 独立 API

独立使用 API 组件，无需包裹在 Provider 中。

## 用法

```vue
<script setup>
import { createDiscreteApi } from 'naive-ui'

// 创建独立的 API
const { message, notification, dialog, loadingBar } = createDiscreteApi([
  'message',
  'notification',
  'dialog',
  'loadingBar'
])

// 使用
message.info('这是一条消息')
notification.success({
  title: '成功',
  content: '操作成功'
})
dialog.warning({
  title: '警告',
  content: '确定要执行此操作吗？'
})
loadingBar.start()
</script>
```

## createDiscreteApi 参数

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| apis | Array | [] | 需要创建的 API 列表 |
| config | object | {} | 配置项 |

## config 配置

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| messageProviderProps | object | {} | MessageProvider 属性 |
| notificationProviderProps | object | {} | NotificationProvider 属性 |
| dialogProviderProps | object | {} | DialogProvider 属性 |
| loadingBarProviderProps | object | {} | LoadingBarProvider 属性 |

## 示例

```vue
<script setup>
import { createDiscreteApi } from 'naive-ui'

const { message } = createDiscreteApi(['message'], {
  messageProviderProps: {
    placement: 'top-right',
    max: 3
  }
})
</script>
```

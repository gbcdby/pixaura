# Notification 通知

全局通知提示。

## useNotification

```ts
import { useNotification } from 'naive-ui'

const notification = useNotification()

// 方法
notification.create(options: NotificationOptions)
notification.info(options: NotificationOptions)
notification.success(options: NotificationOptions)
notification.warning(options: NotificationOptions)
notification.error(options: NotificationOptions)

// 销毁
notification.destroyAll()
```

## NotificationOptions

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 标题 |
| content | string | undefined | 内容 |
| description | string | undefined | 描述 |
| meta | string | undefined | 元信息 |
| avatar | () => VNode | undefined | 头像 |
| duration | number | 4500 | 持续时间 |
| closable | boolean | true | 是否可关闭 |
| keep-alive-on-hover | boolean | true | 悬停是否保持 |
| placement | 'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right' | 'top-right' | 位置 |

## 用法

```vue
<script setup>
import { useNotification } from 'naive-ui'

const notification = useNotification()

// 显示通知
notification.success({
  title: '成功',
  content: '操作成功完成'
})

notification.error({
  title: '错误',
  content: '操作失败',
  duration: 5000
})
</script>
```

注意：useNotification 必须在 `n-notification-provider` 的后代组件中使用。

## 全局配置

```vue
<template>
  <n-notification-provider :max="5" :placement="'top-right'">
    <app />
  </n-notification-provider>
</template>
```

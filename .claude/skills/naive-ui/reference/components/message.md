# Message 消息

全局消息提示。

## useMessage

```ts
import { useMessage } from 'naive-ui'

const message = useMessage()

// 方法
message.info(content: string, options?: MessageOptions)
message.success(content: string, options?: MessageOptions)
message.warning(content: string, options?: MessageOptions)
message.error(content: string, options?: MessageOptions)
message.loading(content: string, options?: MessageOptions)

// 销毁
message.destroyAll()
```

## MessageOptions

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| closable | boolean | false | 是否可关闭 |
| duration | number | 3000 | 持续时间 |
| keep-alive-on-hover | boolean | false | 悬停是否保持 |
| on-after-leave | () => void | undefined | 离开动画结束回调 |
| on-close | () => void | undefined | 关闭回调 |
| on-leave | () => void | undefined | 离开回调 |
| on-mouse-enter | (e: MouseEvent) => void | undefined | 鼠标进入回调 |
| on-mouse-leave | (e: MouseEvent) => void | undefined | 鼠标离开回调 |

## 用法

```vue
<script setup>
import { useMessage } from 'naive-ui'

const message = useMessage()

// 显示消息
message.success('操作成功')
message.error('操作失败')
message.warning('警告信息')
message.info('提示信息')

// 加载中
const loadingMessage = message.loading('加载中...')
// 关闭加载消息
loadingMessage.destroy()
</script>
```

注意：useMessage 必须在 `n-message-provider` 的后代组件中使用。

## 全局配置

```vue
<template>
  <n-message-provider :max="3" :placement="'top'">
    <app />
  </n-message-provider>
</template>
```

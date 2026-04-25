# Loading Bar 加载条

页面顶部的加载进度条。

## useLoadingBar

```ts
import { useLoadingBar } from 'naive-ui'

const loadingBar = useLoadingBar()

// 方法
loadingBar.start()
loadingBar.finish()
loadingBar.error()
```

## 用法

```vue
<template>
  <n-loading-bar-provider>
    <app />
  </n-loading-bar-provider>
</template>

<script setup>
import { useLoadingBar } from 'naive-ui'

const loadingBar = useLoadingBar()

// 开始加载
loadingBar.start()

// 完成加载
loadingBar.finish()

// 加载错误
loadingBar.error()
</script>
```

注意：useLoadingBar 必须在 `n-loading-bar-provider` 的后代组件中使用。

## 全局配置

```vue
<template>
  <n-loading-bar-provider :to="'#loading-bar-container'">
    <app />
  </n-loading-bar-provider>
</template>
```

# Upload 上传

文件上传组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| action | string | undefined | 上传地址 |
| headers | object | undefined | 请求头 |
| data | object \| function | undefined | 附加数据 |
| file-list | Array | undefined | 文件列表（受控） |
| default-file-list | Array | [] | 默认文件列表 |
| multiple | boolean | false | 是否多选 |
| accept | string | undefined | 接受的文件类型 |
| disabled | boolean | false | 是否禁用 |
| show-file-list | boolean | true | 是否显示文件列表 |
| show-trigger | boolean | true | 是否显示触发器 |
| show-preview-button | boolean | true | 是否显示预览按钮 |
| show-remove-button | boolean | true | 是否显示删除按钮 |
| show-download-button | boolean | false | 是否显示下载按钮 |
| show-retry-button | boolean | true | 是否显示重试按钮 |
| show-cancel-button | boolean | true | 是否显示取消按钮 |
| abstract | boolean | false | 是否抽象模式 |
| list-type | 'text' \| 'image' \| 'image-card' | 'text' | 列表类型 |
| create-thumbnail-url | (file: File) => Promise<string> | undefined | 创建缩略图 |
| max | number | undefined | 最大文件数 |
| method | string | 'POST' | 请求方法 |
| with-credentials | boolean | false | 是否携带凭证 |
| response-type | string | 'text' | 响应类型 |
| name | string | 'file' | 文件字段名 |
| on-change | (options: object) => void | undefined | 文件变化回调 |
| on-remove | (options: object) => Promise<boolean> \| boolean | undefined | 文件移除回调 |
| on-finish | (options: object) => void | undefined | 上传完成回调 |
| on-error | (options: object) => void | undefined | 上传错误回调 |
| on-before-upload | (options: object) => Promise<boolean> \| boolean | undefined | 上传前回调 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-upload action="https://example.com/upload">
    <n-button>上传文件</n-button>
  </n-upload>
  
  <!-- 多选 -->
  <n-upload action="https://example.com/upload" multiple>
    <n-button>上传多个文件</n-button>
  </n-upload>
  
  <!-- 图片卡片 -->
  <n-upload action="https://example.com/upload" list-type="image-card">
    <n-button>上传图片</n-button>
  </n-upload>
  
  <!-- 图片列表 -->
  <n-upload action="https://example.com/upload" list-type="image">
    <n-button>上传图片</n-button>
  </n-upload>
</template>
```

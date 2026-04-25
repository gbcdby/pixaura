# Data Table 数据表格

高级数据表格组件。

## Props

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| data | Array | [] | 表格数据 |
| columns | Array | [] | 列配置 |
| loading | boolean | false | 是否加载中 |
| pagination | object \| boolean | false | 分页配置 |
| row-key | (row: object) => string \| number | undefined | 行唯一标识 |
| scroll-x | number \| string | undefined | 横向滚动宽度 |
| scroll-y | number \| string | undefined | 纵向滚动高度 |
| striped | boolean | false | 是否斑马纹 |
| single-line | boolean | true | 是否单行显示 |
| single-column | boolean | false | 是否单列显示 |
| size | 'small' \| 'medium' \| 'large' | 'medium' | 尺寸 |
| remote | boolean | false | 是否远程加载 |
| default-expanded-row-keys | Array | [] | 默认展开的行 |
| expanded-row-keys | Array | undefined | 展开的行（受控） |
| default-expand-all | boolean | false | 是否默认展开所有 |
| virtual-scroll | boolean | false | 是否虚拟滚动 |

## Column 配置

| 名称 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | undefined | 列标题 |
| key | string | undefined | 列标识 |
| width | number \| string | undefined | 列宽 |
| min-width | number \| string | undefined | 最小列宽 |
| max-width | number \| string | undefined | 最大列宽 |
| fixed | 'left' \| 'right' | undefined | 固定列 |
| ellipsis | boolean \| object | false | 是否省略 |
| align | 'left' \| 'center' \| 'right' | 'left' | 对齐方式 |
| class-name | string | undefined | 列类名 |
| type | 'selection' \| 'expand' | undefined | 列类型 |
| selectable | (row: object) => boolean | undefined | 是否可选 |
| disabled | (row: object) => boolean | undefined | 是否禁用 |
| render | (rowData, rowIndex) => VNode | undefined | 自定义渲染 |
| render-expand | (rowData, rowIndex) => VNode | undefined | 展开内容渲染 |
| children | Array | undefined | 子列 |
| sorter | boolean \| function \| 'default' | false | 排序 |
| default-sort-order | 'ascend' \| 'descend' \| false | false | 默认排序 |
| sort-order | 'ascend' \| 'descend' \| false | undefined | 排序（受控） |
| filter | boolean \| Array \| function | false | 过滤 |
| filter-option-value | string \| number \| Array | undefined | 过滤值（受控） |
| filter-multiple | boolean | true | 是否多选过滤 |

## 用法

```vue
<template>
  <!-- 基础用法 -->
  <n-data-table :columns="columns" :data="data" />
  
  <!-- 虚拟滚动 -->
  <n-data-table :columns="columns" :data="data" virtual-scroll :scroll-y="400" />
  
  <!-- 带分页 -->
  <n-data-table :columns="columns" :data="data" :pagination="pagination" />
</template>

<script setup>
const columns = [
  {
    title: '姓名',
    key: 'name'
  },
  {
    title: '年龄',
    key: 'age',
    sorter: true
  },
  {
    title: '操作',
    key: 'actions',
    render(row) {
      return h(NButton, { size: 'small' }, { default: () => '编辑' })
    }
  }
]

const data = [
  { id: 1, name: '张三', age: 20 },
  { id: 2, name: '李四', age: 25 }
]

const pagination = {
  page: 1,
  pageSize: 10,
  itemCount: 100
}
</script>
```

## 特点
- 解决了elementUI select下拉框无虚拟列表的困境
- 对旧项目进行改造时十分方便，只需将el-select 全局替换成 VSelect 即可

## 问题
- 可能存在未知场景没有覆盖全面(即 之前el-select支持的 当前组件不支持。)
- 如有问题请及时提issues，我会尽快解决

## 特别参数说明(可传递)
```js
listItemHeight: 每一项item的高度 默认34px
itemCount: 下拉列表最多渲染个数 默认15条数据
```

## 使用示例
```
npm install v-select-element
```
```js
import VSelect from 'v-select-element'  
```

```vue 
<VSelect
        v-model="value"
        placeholder="请选择文章标签">
      <el-option
          v-for="item in options"
          :key="item.value"
          :label="item.label"
          :value="item.value">
        <span style="float: left">{{ item.label }}</span>
        <span style="float: right; color: #8492a6; font-size: 13px">{{ item.value }}</span>
      </el-option>
    </VSelect>
```

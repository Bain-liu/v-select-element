<template>
  <div>
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
  </div>
</template>

<script>
import VSelect from '../packages/v-select'

export default {
  name: 'App',
  components: {
    VSelect,
  },
  data(){
    return{
      options: [],
      value: 100
    }
  },
  created() {
    for (let i = 0; i < 10000; i++) {
      const label = `${i.toString(36)}${i}`;
      this.options.push({
        value:i,
        label,
      });
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
ul,li{
  list-style: none;
  padding: 0;
  margin: 0;
}
li{
  width: 100%;
}
</style>

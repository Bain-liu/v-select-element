import VSelect from './v-select'

const components = [
    VSelect
]

const install = (Vue)=>{
    if(install.installed) return;
    components.map(component => Vue.component(component.name, component))
}
if(typeof window !=='undefined' && window.Vue){
    install(window.Vue)
}

export default {
    install,
    VSelect
}

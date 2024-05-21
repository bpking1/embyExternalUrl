
// 只使用 strm 文件配置模板,即标准 strm 内部只有远程链接,不存在/开头的相对路径
// 不需要挂载功能,不显示依赖 alist,strm 内部为任意直链
// export constant allocation

// 必填项,根据实际情况修改下面的设置

// 指定需要获取符号链接真实路径的规则,优先级在 xxxMountPath 和 routeRule 之间
// 注意前提条件是此程序或容器必须挂载或具有对应目录的读取权限,否则将跳过处理,不生效
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为媒体服务入库的文件路径(Item.Path)
const symlinkRule = [
  // [0, "/mnt/sda1"],
];

export default {
  symlinkRule,
}

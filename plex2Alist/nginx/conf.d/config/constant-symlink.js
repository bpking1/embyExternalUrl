
// 选填项,用不到保持默认即可

// 指定需要获取符号链接真实路径的规则,优先级在 mediaMountPath 和 routeRule 之间
// 注意前提条件是此程序或容器必须挂载或具有对应目录的读取权限,否则将跳过处理,不生效
// 此参数仅在软连接后的文件名和原始文件名不一致或路径差异较大时使用,其余情况建议用 mediaPathMapping
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为媒体服务入库的文件路径(Item.Path)
const symlinkRule = [
  // [0, "/mnt/sda1"],
];

export default {
  symlinkRule,
}

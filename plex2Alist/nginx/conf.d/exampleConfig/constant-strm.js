// 本地文件 + 使用标准strm文件配置模板,即标准strm内部只有远程链接,不存在/开头的相对路径
// 不需要挂载功能,不显示依赖alist,strm内部为任意直链
// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认plex的地址是宿主机,要注意iptables给容器放行端口
const plexHost = "http://172.17.0.1:32400";

// 选填项,用不到保持默认即可
// 指定客户端自己请求并获取alist直链的规则,特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// arg1: 匹配的规则,对象为Alist接口返回的链接
// arg2: 指定转发给客户端的alist的host前缀
const cilentSelfAlistRule = [
  // [2, "xxx", alistPublicAddr],
];
// 路径映射,会在xxxMountPath之后全部替换一遍,不要有重叠,此处会同时处理本地路径和strm的内部内容
const plexPathMapping = [
  // ["/mnt/aliyun-01", "/mnt/aliyun-02"],
  // ["http:", "https:"], 
  // [":5244", "/alist"], 
  // ["D:", "F:"],
  // [/blue/g, "red"],
];
// 禁用直链的规则,将转给原始媒体服务器处理,字幕和图片没有走直链,不用添加
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// arg1: 匹配的规则,对象为Item.Path
// arg2: 是否处理alist响应链接
const disableRedirectRule = [
  // [0, "/mnt/sda1"],
  // [1, ".mp3"],
  // [2, "Google"],
  // [2, "/NAS/", true],
  // [3, /private/ig],
];

// 留空项,不要更改
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始plex处理,不用重复填写至disableRedirectRule
const plexMountPath = [""];
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = "";
// alist token, 在alist后台查看
const alistToken = "";
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "";

function getPlexHost(r) {
  return plexHost;
}

export default {
  plexHost,
  plexMountPath,
  disableRedirectRule,
  alistAddr,
  alistToken,
  alistPublicAddr,
  cilentSelfAlistRule,
  plexPathMapping,
  getPlexHost
}

// 全量配置,媒体库混合,本地文件 + CD2/rclone挂载的alist文件 + strm文件
// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认plex的地址是宿主机,要注意iptables给容器放行端口
const plexHost = "http://172.17.0.1:32400";
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始plex处理,不用重复填写至disableRedirectRule
const plexMountPath = ["/mnt"];
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = "http://172.17.0.1:5244";
// alist token, 在alist后台查看
const alistToken = "alsit-123456";

// 选填项,用不到保持默认即可
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";
// 指定客户端自己请求并获取alist直链的规则,特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// arg1: 匹配的规则,对象为Alist接口返回的链接raw_url
// arg2: 指定转发给客户端的alist的host前缀
const cilentSelfAlistRule = [
  // [2, "xxx", alistPublicAddr],
];
// 路径映射,会在xxxMountPath之后从上到下依次全部替换一遍,不要有重叠
// arg0: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// arg1: 0: 默认只处理/开头的路径且不为strm, 1: 只处理strm内部为/开头的相对路径, 2: 只处理strm内部为远程链接的
// arg2: 来源, arg3: 目标
const plexPathMapping = [
  // [0, 0, "/mnt/aliyun-01", "/mnt/aliyun-02"],
  // [0, 2, "http:", "https:"], 
  // [0, 2, ":5244", "/alist"], 
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
];
// 指定是否转发由njs获取strm重定向后直链地址的规则,例如strm内部为局域网ip或链接需要请求头验证
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// arg1: 匹配的规则,对象为xxxPathMapping映射后的strm内部链接
// arg2: 请求验证类型,已为直链的不需要此参数,例如.../d
const redirectStrmLastLinkRule = [
  [0, "http://172."], [0, "http://10."], [0, "http://192."], [0, "http://[fd00:"], 
  // [0, alistAddr], 
  // [0, "http:"], 
  // // arg3: 已为直链的不需要此参数
  // [0, "http://otheralist1.com", "FixedToken", alistToken], 
  // // arg4: 已为直链的不需要此参数,额外指定调用登录接口的api地址
  // [0, "http://otheralist2.com", "TempToken", `read:123456`, `http://otheralist2.com:5244/api/auth/login`], 
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
  redirectStrmLastLinkRule,
  getPlexHost
}

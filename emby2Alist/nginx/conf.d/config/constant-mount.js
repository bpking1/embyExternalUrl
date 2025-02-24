import commonConfig from "./constant-common.js";

const strHead = commonConfig.strHead;

// 选填项,用不到保持默认即可

// rclone/CD2 挂载的 alist 文件配置,根据实际情况修改下面的设置
// 访问宿主机上 5244 端口的 alist 地址, 要注意 iptables 给容器放行端口
const alistAddr = "http://172.17.0.1:5244";

// alist token, 在 alist 后台查看
const alistToken = "alsit-123456";

// alist 是否启用了 sign
const alistSignEnable = false;

// alist 中设置的直链过期时间,以小时为单位,严格对照 alist 设置 => 全局 => 直链有效期
const alistSignExpireTime = 12;

// alist 公网地址,用于需要 alist server 代理流量的情况,按需填写
const alistPublicAddr = "http://youralist.com:5244";

// 指定客户端自己请求并获取 alist 直链的规则,代码优先级在 redirectStrmLastLinkRule 之后
// 特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// 参数?.1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数?.2: 匹配类型或来源(字符串参数类型),优先级高"filePath": 文件路径(Item.Path),默认为"alistRes": alist 返回的链接 raw_url
// ,有分组时不可省略填写,可为表达式,然后下面参数序号-1
// 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
// 参数5: 指定转发给客户端的 alist 的 host 前缀,兼容 sign 参数
const clientSelfAlistRule = [
  // Infuse 客户端对于 115 的进度条拖动可能依赖于此
  // 如果 nginx 为 https,则此 alist 也必须 https,浏览器行为客户端会阻止非 https 请求
  [2, strHead["115"], alistPublicAddr],
  // [2, strHead.ali, alistPublicAddr],
  // 优先使用 filePath,可省去一次查询 alist,如驱动为 alias,则应使用 alistRes
  // ["115-local", "filePath", 0, "/mnt/115", alistPublicAddr],
  // ["115-local", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // ["115-alist", "alistRes", 2, strHead["115"], alistPublicAddr],
  // ["115-alist", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.seekBug],
];

// 响应重定向链接前是否检测有效性,无效链接时转给媒体服务器回源中转处理
const redirectCheckEnable = false;

// 媒体服务/alist 查询失败后是否使用原始链接回源中转流量处理,如无效则直接返回 500
const fallbackUseOriginal = true;

export default {
  alistAddr,
  alistToken,
  alistSignEnable,
  alistSignExpireTime,
  alistPublicAddr,
  clientSelfAlistRule,
  redirectCheckEnable,
  fallbackUseOriginal,
}

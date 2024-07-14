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

// alist 中设置的直链过期时间,以小时为单位
const alistSignExpireTime = 12;

// alist 公网地址,用于需要 alist server 代理流量的情况,按需填写
const alistPublicAddr = "http://youralist.com:5244";

// 指定客户端自己请求并获取 alist 直链的规则,代码优先级在 redirectStrmLastLinkRule 之后
// 特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为 Alist 接口返回的链接 raw_url
// 参数3: 指定转发给客户端的 alist 的 host 前缀,兼容 sign 参数
const clientSelfAlistRule = [
  // "Emby for iOS"和"Infuse"对于 115 的进度条拖动依赖于此
  // 如果 nginx 为 https,则此 alist 也必须 https,浏览器行为客户端会阻止非 https 请求
  [2, strHead["115"], alistPublicAddr],
  // [2, strHead.ali, alistPublicAddr],
];

export default {
  alistAddr,
  alistToken,
  alistSignEnable,
  alistSignExpireTime,
  alistPublicAddr,
  clientSelfAlistRule,
}

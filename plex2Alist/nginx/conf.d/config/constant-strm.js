import commonConfig from "./constant-common.js";
import mountConfig from "./constant-mount.js";

const strHead = commonConfig.strHead;
const alistAddr = mountConfig.alistAddr;
const alistToken = mountConfig.alistToken;
const alistSignExpireTime = mountConfig.alistSignExpireTime;

// 只使用 strm 文件配置模板,即标准 strm 内部只有远程链接,不存在/开头的相对路径
// 不需要挂载功能,不显示依赖 alist,strm 内部为任意直链

// 选填项,用不到保持默认即可

// 指定是否转发由 njs 获取 strm/远程链接 重定向后直链地址的规则,例如 strm/远程链接 内部为局域网 ip 或链接需要验证
// 匹配来源为入库媒体的文件路径
// 参数?.1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数?.2: 匹配类型或来源(字符串参数类型),默认为 "filePath": mediaPathMapping 映射后的 strm/远程链接 内部链接
// ,有分组时不可省略填写,可为表达式
// 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)],
  // [0, alistAddr],
  // [0, "http:"],
  // 参数5: 请求验证类型,当前 alistAddr 不需要此参数
  // 参数6: 当前 alistAddr 不需要此参数,alistSignExpireTime
  // [3, "http://otheralist1.com", "sign", `${alistToken}:${alistSignExpireTime}`],
  // useGroup01 同时满足才命中
  // ["useGroup01", "filePath", "startsWith", ["https://youdomain.xxx.com:88"]], // 目标地址
  // ["useGroup01", "r.headersIn.User-Agent", "startsWith:not", ["Infuse"]], // 链接入参,客户端类型
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];

export default {
  redirectStrmLastLinkRule,
}

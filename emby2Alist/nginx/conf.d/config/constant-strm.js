import commonConfig from "./constant-common.js";
import mountConfig from "./constant-mount.js";

const strHead = commonConfig.strHead;
const alistToken = mountConfig.alistToken;
const alistSignExpireTime = mountConfig.alistSignExpireTime;

// 只使用 strm 文件配置模板,即标准 strm 内部只有远程链接,不存在/开头的相对路径
// 不需要挂载功能,不显示依赖 alist,strm 内部为任意直链

// 选填项,用不到保持默认即可

// 指定是否转发由 njs 获取 strm 重定向后直链地址的规则,例如 strm 内部为局域网 ip 或链接需要验证
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为 mediaPathMapping 映射后的 strm 内部链接
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)],
  // [0, alistAddr],
  // [0, "http:"],
  // 参数3: 请求验证类型,当前 alistAddr 不需要此参数
  // 参数4: 当前 alistAddr 不需要此参数,alistSignExpireTime
  // [0, "http://otheralist1.com", "sign", `${alistToken}:${alistSignExpireTime}`],
];

export default {
  redirectStrmLastLinkRule,
}

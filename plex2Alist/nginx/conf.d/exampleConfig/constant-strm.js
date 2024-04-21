// 只使用strm文件配置模板,即标准strm内部只有远程链接,不存在/开头的相对路径
// 不需要挂载功能,不显示依赖alist,strm内部为任意直链
// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认plex的地址是宿主机,要注意iptables给容器放行端口
const plexHost = "http://172.17.0.1:32400";

// 选填项,用不到保持默认即可
// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  "115": "https://cdnfhnfile.115.com",
};
// 是否开启路由缓存,短时间内同客户端访问相同资源不会再做判断和请求alist,有限的防抖措施,出现问题可以关闭此选项
const routeCacheEnable = true;
// 路由规则,注意有先后顺序,"proxy"规则优先级最高,其余依次,千万注意规则不要重叠,不然排错十分困难
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链302, "block": 只是屏蔽播放
// 参数2: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数3: 匹配类型或来源(字符串参数类型) "filePath": 文件路径(Item.Path), "alistRes": alist返回的链接
// 参数4: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数5: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
const routeRule = [
  // ["filePath", 0, "/mnt/sda1"],
  // ["filePath", 1, ".mp3"],
  // ["filePath", 2, "Google"],
  // ["alistRes", 2, "/NAS/"], // 例如使用alias聚合了nas本地文件,可能会存在卡顿或花屏
  // ["filePath", 3, /private/ig],
  // docker注意必须为host模式,不然此变量全部为内网ip,判断无效,nginx内置变量不带$,客户端地址($remote_addr)
  // ["r.variables.remote_addr", 0, strHead.lanIp],
  // ["r.headersIn.User-Agent", 2, "IE"], // 请求头参数,客户端UA
  // ["r.args.X-Emby-Device-Id", 0, "d4f30461-ec5c-488d-b04a-783e6f419eb1"], // 链接入参,设备id
  // ["r.args.X-Emby-Device-Name", 0, "Microsoft Edge Windows"], // 链接入参,设备名称
  // ["r.args.UserId", 0, "ac0d220d548f43bbb73cf9b44b2ddf0e"], // 链接入参,用户id
  // 以下规则代表禁用["Emby Web", "Emby for iOS", "Infuse"]中的[本地挂载文件或alist返回的链接]的115直链功能
  // ["115-alist", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]], // 链接入参,客户端类型
  // ["115-alist", "alistRes", 0, strHead["115"]],
  // ["115-local", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]],
  // ["115-local", "filePath", 0, "/mnt/115"],
  // 注意非"proxy"无法使用"alistRes"条件,因为没有获取alist直链的过程
  // ["proxy", "filePath", 0, "/mnt/sda1"],
  // ["redirect", "filePath", 0, "/mnt/sda2"],
  // ["block", "filePath", 0, "/mnt/sda4"],
];
// 路径映射,会在xxxMountPath之后从上到下依次全部替换一遍,不要有重叠
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为strm, 1: 只处理strm内部为/开头的相对路径, 2: 只处理strm内部为远程链接的
// 参数3: 来源, 参数4: 目标
const plexPathMapping = [
  // [0, 0, "/mnt/aliyun-01", "/mnt/aliyun-02"],
  // [0, 2, "http:", "https:"], 
  // [0, 2, ":5244", "/alist"], 
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
];
// 指定是否转发由njs获取strm重定向后直链地址的规则,例如strm内部为局域网ip或链接或需要请求头验证
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为xxxPathMapping映射后的strm内部链接
// 参数3: 请求验证类型,已为直链的不需要此参数,例如.../d
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)], 
  // [0, alistAddr], 
  // [0, "http:"], 
  // // 参数4: 已为直链的不需要此参数, 参数暂无作用, sign属于额外验证
  // [0, "http://otheralist1.com", "FixedToken", alistToken], 
  // // arg4: 已为直链的不需要此参数,额外指定调用登录接口的api地址, 参数暂无作用, sign属于额外验证
  // [0, "http://otheralist2.com", "TempToken", `read:123456`, `http://otheralist2.com:5244/api/auth/login`], 
];
// 指定客户端自己请求并获取alist直链的规则,代码优先级在redirectStrmLastLinkRule之后
// 特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为Alist接口返回的链接raw_url
// 参数3: 指定转发给客户端的alist的host前缀
const cilentSelfAlistRule = [
  // [2, "xxx", alistPublicAddr],
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
  routeCacheEnable,
  routeRule,
  alistAddr,
  alistToken,
  alistPublicAddr,
  cilentSelfAlistRule,
  plexPathMapping,
  redirectStrmLastLinkRule,
  getPlexHost,
}

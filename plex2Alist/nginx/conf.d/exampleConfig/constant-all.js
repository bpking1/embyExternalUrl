// 这个总配置单体文件只是备份,生效需要放置在 conf.d 下,且重命名为 constant.js
// 如果使用这个全量总配置文件,忽略 config 下的所有文件,以这个文件为准

// 全量配置,媒体库混合,本地文件 + rclone/CD2 挂载的 alist 文件 + strm文件 + 软链接(路径和文件名不一致)
// export constant allocation

// 必填项,根据实际情况修改下面的设置

// 这里默认 plex 的地址是宿主机,要注意 iptables 给容器放行端口
const plexHost = "http://172.17.0.1:32400";

// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始 plex 处理,不用重复填写至 disableRedirectRule
const plexMountPath = ["/mnt"];

// 访问宿主机上 5244 端口的 alist 地址, 要注意 iptables 给容器放行端口
const alistAddr = "http://172.17.0.1:5244";

// alist token, 在 alist 后台查看
const alistToken = "alsit-123456";

// alist 是否启用了 sign
const alistSignEnable = false;

// alist 中设置的直链过期时间,以小时为单位
const alistSignExpireTime = 12;

// 选填项,用不到保持默认即可

// alist 公网地址, 用于需要 alist server 代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";
// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  "115": "115.com",
};

// 路由缓存配置
const routeCacheConfig = {
  // 总开关,是否开启路由缓存,此为一级缓存,添加阶段为 redirect 和 proxy 之前
  // 短时间内同客户端访问相同资源不会再做判断和请求 alist,有限的防抖措施,出现问题可以关闭此选项
  enable: true,
  // 二级缓存开关,仅针对直链,添加阶段为进入单集详情页,cilentSelfAlistRule 中的和首页直接播放的不生效
  enableL2: false,
  // 缓存键表达式,默认值好处是命中范围大,但会导致 routeRule 中针对设备的规则失效,多个变量可自行组合修改,冒号分隔
  keyExpression: "r.uri:r.args.path:r.args.mediaIndex:r.args.partIndex", //"xxx:r.args.X-Plex-Client-Identifier"
};

// 指定需要获取符号链接真实路径的规则,优先级在 xxxMountPath 和 routeRule 之间
// 注意前提条件是此程序或容器必须挂载或具有对应目录的读取权限,否则将跳过处理,不生效
// 此参数仅在软连接后的文件名和原始文件名不一致或路径差异较大时使用,其余情况建议用 xxxPathMapping
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为媒体服务入库的文件路径(Item.Path)
const symlinkRule = [
  // [0, "/mnt/sda1"],
];

// 路由规则,注意有先后顺序,"proxy"规则优先级最高,其余依次,千万注意规则不要重叠,不然排错十分困难,字幕和图片走了缓存,不在此规则内
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链302, "block": 只是屏蔽播放
// pelx 不需要 "transcode", 可用 "proxy" 代替,稍微有些歧义,这里只是不做修改,交给原始服务中转处理,具体是否转码由 plex 客户端自己判断上报的
// 参数2: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数3: 匹配类型或来源(字符串参数类型) "filePath": 文件路径(Item.Path), "alistRes": alist返回的链接
// 参数4: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数5: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
const routeRule = [
  // ["filePath", 0, "/mnt/sda1"],
  // ["filePath", 1, ".mp3"],
  // ["filePath", 2, "Google"],
  // ["alistRes", 2, "/NAS/"], // 例如使用 alias 聚合了 nas 本地文件,可能会存在卡顿或花屏
  // ["filePath", 3, /private/ig],
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["r.variables.remote_addr", 0, strHead.lanIp],
  // ["r.headersIn.User-Agent", 2, "IE"], // 请求头参数,客户端UA
  // ["r.args.X-Emby-Device-Id", 0, "d4f30461-ec5c-488d-b04a-783e6f419eb1"], // 链接入参,设备id
  // ["r.args.X-Emby-Device-Name", 0, "Microsoft Edge Windows"], // 链接入参,设备名称
  // ["r.args.UserId", 0, "ac0d220d548f43bbb73cf9b44b2ddf0e"], // 链接入参,用户id
  // 以下规则代表禁用["Emby Web", "Emby for iOS", "Infuse"]中的[本地挂载文件或 alist 返回的链接]的 115 直链功能
  // ["115-alist", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]], // 链接入参,客户端类型
  // ["115-alist", "alistRes", 0, strHead["115"]],
  // ["115-local", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]],
  // ["115-local", "filePath", 0, "/mnt/115"],
  // 注意非"proxy"无法使用"alistRes"条件,因为没有获取 alist 直链的过程
  // ["proxy", "filePath", 0, "/mnt/sda1"],
  // ["redirect", "filePath", 0, "/mnt/sda2"],
  // ["block", "filePath", 0, "/mnt/sda4"],
];

// 路径映射,会在 xxxMountPath 之后从上到下依次全部替换一遍,不要有重叠,注意 /mnt 会先被移除掉了
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的
// 参数3: 来源, 参数4: 目标
const plexPathMapping = [
  // [0, 0, "/aliyun-01", "/aliyun-02"],
  // [0, 2, "http:", "https:"], 
  // [0, 2, ":5244", "/alist"], 
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
];

// 指定是否转发由 njs 获取 strm 重定向后直链地址的规则,例如 strm 内部为局域网 ip 或链接需要验证
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为 xxxPathMapping 映射后的 strm 内部链接
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)],
  // [0, alistAddr],
  // [0, "http:"],
  // 参数3: 请求验证类型,当前 alistAddr 不需要此参数
  // 参数4: 当前 alistAddr 不需要此参数,alistSignExpireTime
  // [0, "http://otheralist1.com", "sign", `${alistToken}:${alistSignExpireTime}`],
];

// 指定客户端自己请求并获取 alist 直链的规则,代码优先级在 redirectStrmLastLinkRule 之后
// 特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为 Alist 接口返回的链接 raw_url
// 参数3: 指定转发给客户端的 alist 的 host 前缀,兼容 sign 参数
const cilentSelfAlistRule = [
  // "Emby for iOS"和"Infuse"对于115的进度条拖动依赖于此
  // 如果nginx为https,则此alist也必须https,浏览器行为客户端会阻止非https请求
  [2, strHead["115"], alistPublicAddr],
];

// 转码配置,默认 false,将按之前逻辑强制直接播放
// plex 只能用自身服务转码,只有下面一个参数,多填写没用
const transcodeConfig = {
  enable: false, // 此为允许转码的总开关
};

// for js_set
function getPlexHost(r) {
  return plexHost;
}
function getTranscodeEnable(r) {
  return transcodeConfig.enable;
}

export default {
  plexHost,
  plexMountPath,
  routeCacheConfig,
  symlinkRule,
  routeRule,
  alistAddr,
  alistToken,
  alistSignEnable,
  alistSignExpireTime,
  alistPublicAddr,
  strHead,
  cilentSelfAlistRule,
  plexPathMapping,
  redirectStrmLastLinkRule,
  transcodeConfig,
  getPlexHost,
  getTranscodeEnable,
}

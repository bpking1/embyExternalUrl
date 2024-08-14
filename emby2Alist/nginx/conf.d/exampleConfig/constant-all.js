// 这个总配置单体文件只是备份,生效需要放置在 conf.d 下,且重命名为 constant.js
// 如果使用这个全量总配置文件,忽略 config 下的所有文件,以这个文件为准

// 全量配置,媒体库混合,本地文件 + rclone/CD2 挂载的 alist 文件 + strm文件 + 软链接(路径和文件名不一致)
// export constant allocation

// 必填项,根据实际情况修改下面的设置

// 这里默认 emby/jellyfin 的地址是宿主机,要注意 iptables 给容器放行端口
const embyHost = "http://172.17.0.1:8096";

// emby/jellyfin api key, 在 emby/jellyfin 后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";

// 挂载工具 rclone/CD2 多出来的挂载目录, 例如将 od,gd 挂载到 /mnt 目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始 emby 处理,不用重复填写至 disableRedirectRule
// 如果没有挂载,全部使用 strm 文件,此项填[""],必须要是数组
const mediaMountPath = ["/mnt"];

// 访问宿主机上 5244 端口的 alist 地址, 要注意 iptables 给容器放行端口
const alistAddr = "http://172.17.0.1:5244";

// alist token, 在 alist 后台查看
const alistToken = "alsit-123456";

// alist 是否启用了 sign
const alistSignEnable = false;

// alist 中设置的直链过期时间,以小时为单位
const alistSignExpireTime = 12;

// 选填项,用不到保持默认即可

// alist 公网地址,用于需要 alist server 代理流量的情况,按需填写
const alistPublicAddr = "http://youralist.com:5244";

// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  xEmbyClients: {
    seekBug: ["Emby for iOS", "Infuse"],
    maybeProxy: ["Emby Web", "Emby for iOS", "Infuse"],
  },
  "115": "115.com",
  ali: "aliyundrive.net",
  userIds: {
    mediaPathMappingGroup01: ["ac0d220d548f43bbb73cf9b44b2ddf0e"],
    allowInteractiveSearch: [],
  },
  filePaths: {
    mediaMountPath: [],
    redirectStrmLastLinkRule: [],
    mediaPathMappingGroup01: [],
  },
};
// 参数1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配)
// 参数2: 匹配类型或来源(字符串参数类型),默认为 "filePath": 本地文件为路径,strm 为远程链接
// ,有分组时不可省略填写,可为表达式
// 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// ,分组时建议写 "startsWith" 这样的字符串,方便日志中排错
// 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
const ruleRef = {
  // 这个 key 值仅仅只是代码中引用的可读性标识,需见名知意,可自定义
  // mediaPathMappingGroup01: [
  //   ["useGroup01", "filePath", "startsWith", strHead.filePaths.mediaPathMappingGroup01], // 目标地址
  //   ["useGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  //   ["useGroup01", "r.args.UserId", "startsWith", strHead.userIds.mediaPathMappingGroup01],
  // ],
};

// 路由缓存配置
const routeCacheConfig = {
  // 总开关,是否开启路由缓存,此为一级缓存,添加阶段为 redirect 和 proxy 之前
  // 短时间内同客户端访问相同资源不会再做判断和请求 alist,有限的防抖措施,出现问题可以关闭此选项
  enable: true,
  // 二级缓存开关,仅针对直链,添加阶段为进入单集详情页,clientSelfAlistRule 中的和首页直接播放的不生效
  enableL2: false,
  // 缓存键表达式,默认值好处是命中范围大,但会导致 routeRule 中针对设备的规则失效,多个变量可自行组合修改,冒号分隔
  // 注意 jellyfin 是小写开头 mediaSourceId
  keyExpression: "r.uri:r.args.MediaSourceId", // "r.uri:r.args.MediaSourceId:r.args.X-Emby-Device-Id"
};

// 指定需要获取符号链接真实路径的规则,优先级在 mediaMountPath 和 routeRule 之间
// 注意前提条件是此程序或容器必须挂载或具有对应目录的读取权限,否则将跳过处理,回源中转
// 此参数仅在软链接后的文件名和原始文件名不一致或路径差异较大时使用,其余情况建议用 mediaPathMapping
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为媒体服务入库的文件路径(Item.Path)
const symlinkRule = [
  // [0, "/mnt/sda1"],
];

// 路由规则,注意有先后顺序,"proxy"规则优先级最高,其余依次,千万注意规则不要重叠,不然排错十分困难,字幕和图片走了缓存,不在此规则内
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链302, "transcode": 转码, "block": 只是屏蔽播放
// "transcode",稍微有些歧义,大部分情况等同于"proxy",这里只是不做转码参数修改,具体是否转码由 emby 客户端自己判断上报或客户端手动切换码率控制
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
  // 以下规则代表禁用 strHead.xEmbyClients.maybeProxy 中的[本地挂载文件或 alist 返回的链接]的 115 直链功能
  // ["115-alist", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.maybeProxy], // 链接入参,客户端类型
  // ["115-alist", "alistRes", 0, strHead["115"]],
  // ["115-local", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.maybeProxy],
  // ["115-local", "filePath", 0, "/mnt/115"],
  // 注意非"proxy"无法使用"alistRes"条件,因为没有获取 alist 直链的过程
  // ["proxy", "filePath", 0, "/mnt/sda1"],
  // ["redirect", "filePath", 0, "/mnt/sda2"],
  // ["transcode", "filePath", 0, "/mnt/sda3"],
  // ["transcode", "115-local", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.maybeProxy],
  // ["transcode", "115-local", "filePath", 0, "/mnt/115"],
  // ["block", "filePath", 0, "/mnt/sda4"],
  // 此条规则代表大于等于 3Mbps 码率的走转码,xMediaSource 为固定值,平方使用双星号表示,无意义减加仅为示例
  // ["transcode", "r.xMediaSource.Bitrate", ">=", 3 * 1024 ** 2 -(1 * 1024 ** 2) + (1 * 1024 ** 2)],
];

// 路径映射,会在 mediaMountPath 之后从上到下依次全部替换一遍,不要有重叠,注意 /mnt 会先被移除掉了
// 参数?.1: 生效规则三维数组,有时下列参数序号加一,优先级在参数2之后,需同时满足,多个组是或关系(任一匹配)
// 参数1: 0: 默认做字符串替换replace一次, 1: 前插, 2: 尾插, 3: replaceAll替换全部
// 参数2: 0: 默认只处理/开头的路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的
// 参数3: 来源, 参数4: 目标
const mediaPathMapping = [
  // [0, 0, "/aliyun-01", "/aliyun-02"],
  // [0, 2, "http:", "https:"],
  // [0, 2, ":5244", "/alist"],
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
  // [ruleRef.mediaPathMappingGroup01, 0, 0, "/aliyun-01", "/aliyun-02"],
];

// 指定是否转发由 njs 获取 strm/远程链接 重定向后直链地址的规则,例如 strm/远程链接 内部为局域网 ip 或链接需要验证
// 参数1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数2: 匹配类型或来源(字符串参数类型),默认为 "filePath": mediaPathMapping 映射后的 strm/远程链接 内部链接
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
  // ["useGroup01", "filePath", "startsWith", strHead.lanIp.map(s => "http://" + s)], // 目标地址
  // ["useGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];

// 指定客户端自己请求并获取 alist 直链的规则,代码优先级在 redirectStrmLastLinkRule 之后
// 特殊情况使用,则此处必须使用域名且公网畅通,用不着请保持默认
// 参数1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数2: 匹配类型或来源(字符串参数类型),优先级高"filePath": 文件路径(Item.Path),默认为"alistRes": alist 返回的链接 raw_url
// ,有分组时不可省略填写,可为表达式
// 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
// 参数5: 指定转发给客户端的 alist 的 host 前缀,兼容 sign 参数
const clientSelfAlistRule = [
  // "Emby for iOS"和"Infuse"对于 115 的进度条拖动依赖于此
  // 如果 nginx 为 https,则此 alist 也必须 https,浏览器行为客户端会阻止非 https 请求
  [2, strHead["115"], alistPublicAddr],
  // [2, strHead.ali, alistPublicAddr],
  // 优先使用 filePath,可省去一次查询 alist,如驱动为 alias,则应使用 alistRes
  // ["115-local", "filePath", 0, "/mnt/115", alistPublicAddr],
  // ["115-local", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // ["115-alist", "alistRes", 2, strHead["115"], alistPublicAddr],
  // ["115-alist", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.seekBug],
];

// 转码配置,默认 false,将按之前逻辑禁止转码处理并移除转码选项参数,与服务端允许转码配置有相关性
const transcodeConfig = {
  enable: false, // 此大多数情况下为允许转码的总开关
  enableStrmTranscode: false, // 默认禁用 strm 的转码,体验很差,仅供调试使用
  type: "distributed-media-server", // 负载类型,可选值, ["nginx", "distributed-media-server"]
  maxNum: 3, // 单机最大转码数量,有助于加速轮询, 参数暂无作用,接口无法查询转码情况,忽略此参数
  redirectTransOptEnable: true, // 是否保留码率选择,不保留官方客户端将无法手动切换至转码
  targetItemMatchFallback: "redirect", // 目标服务媒体匹配失败后的降级后路由措施,可选值, ["redirect", "proxy"]
  // 如果只需要当前服务转码,enable 改为 true,server 改为下边的空数组
  server: [],
  // !!!实验功能,主库和所有从库给用户开启[播放-如有必要，在媒体播放期间允许视频转码]+[倒数7行-允许媒体转换]
  // type: "nginx", nginx 负载均衡,好处是使用简单且内置均衡参数选择,缺点是流量全部经过此服务器,
  // 且使用条件很苛刻,转码服务组中的媒体 id 需要和主媒体库中 id 一致,自行寻找实现主从同步,完全同步后,ApiKey 也是一致的
  // type: "distributed-media-server", 分布式媒体服务负载均衡(暂未实现均衡),优先利用 302 真正实现流量的 LB,且灵活,
  // 不区分主从,当前访问服务即为主库,可 emby/jellyfin 混搭,挂载路径可以不一致,但要求库中的标题和语种一致且原始文件名一致
  // 负载的服务组,需要分离转码时才使用,注意下列 host 必须全部为公网地址,会 302 给客户端访问,若参与负载下边手动添加
  // server: [
  //   {
  //     type: "emby",
  //     host: "http://yourdomain.com:8096",
  //     apiKey: "f839390f50a648fd92108bc11ca6730a",
  //   },
  //   {
  //     type: "jellyfin",
  //     host: "http://yourdomain.com:8097",
  //     apiKey: "f839390f50a648fd92108bc11ca6730a",
  //   },
  // ]
};

// 图片缓存策略,包括主页、详情页、图片库的原图,路由器 nginx 请手动调小 conf 中 proxy_cache_path 的 max_size
// 0: 不同尺寸设备共用一份缓存,先访问先缓存,空间占用最小但存在小屏先缓存大屏看的图片模糊问题
// 1: 不同尺寸设备分开缓存,空间占用适中,命中率低下,但契合 emby 的图片缩放处理
// 2: 不同尺寸设备共用一份缓存,空间占用最大,移除 emby 的缩放参数,直接原图高清显示
// 3: 关闭 nginx 缓存功能,已缓存文件不做处理
const imageCachePolicy = 0;

// 对接 emby 通知管理员设置,目前只发送是否直链成功,依赖 emby/jellyfin 的 webhook 配置并勾选外部通知
const embyNotificationsAdmin = {
  enable: false,
  includeUrl: false, // 链接太长,默认关闭
  name: "【emby2Alist】",
};

// 对接 emby 设备控制推送通知消息,目前只发送是否直链成功,此处为统一开关,范围为所有的客户端,通知目标只为当前播放的设备
const embyRedirectSendMessage = {
  enable: false,
  header: "【emby2Alist】",
  timeoutMs: -1, // 消息通知弹窗持续毫秒值
};

// 按路径匹配规则隐藏部分接口返回的 items
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为 Item.Path
// 参数3: 0: 默认同时过滤下列所有类型接口, 1: 只隐藏[搜索建议(不会过滤搜索接口)]接口,
// 2: 只隐藏[更多类似(若当前浏览项目位于规则中,将跳过隐藏)]接口, 3: 只隐藏第三方使用的[海报推荐]接口
const itemHiddenRule = [
  // [0, "/mnt/sda1"],
  // [1, ".mp3", 1],
  // [2, "Google", 2],
  // [3, /private/ig],
];

// 串流配置
const streamConfig = {
  // 默认不启用,因违反 HTTP 规范,链接中携带未编译中文,可能存在兼容性问题,如发现串流访问失败,请关闭此选项,
  // !!! 谨慎开启,启用后将修改直接串流链接为真实文件名,方便第三方播放器友好显示和匹配,
  // 该选项只对 emby 有用, jellyfin 为前端自行拼接的
  useRealFileName: false,
};

// 搜索接口增强配置
const searchConfig = {
  // 开启脚本的部分交互性功能
  interactiveEnable: false,
  // 快速交互,启用后将根据指令头匹配,直接返回虚拟搜索结果,不经过回源查询,优化搜索栏失焦的自动搜索
  interactiveFast: false,
  // 限定交互性功能的隔离,取值来源为带参数的 request_uri 字符串
  // 不带协议与域名,仅作包含匹配,多个值为或的关系,空数组为不隔离
  interactiveEnableRule: [
    // "ac0d220d548f43bbb73cf9b44b2ddf0e", // request_uri path level userId
    // "2d427412-43e1-49e4-a1db-fa17c04d49db", // X-Emby-Device-Id
  ],
};

// nginx 配置 Start

const nginxConfig = {
  // 禁用上游服务的 docs 页面
  disableDocs: true,
};

// for js_set
function getDisableDocs(r) {
  const value = nginxConfig.disableDocs 
    && !ngx.shared["tmpDict"].get("opendocs");
  // r.log(`getDisableDocs: ${value}`);
  return value;
}

// nginx 配置 End

// for js_set
function getEmbyHost(r) {
  return embyHost;
}
function getTranscodeEnable(r) {
  return transcodeConfig.enable;
}
function getTranscodeType(r) {
  return transcodeConfig.type;
}
function getImageCachePolicy(r) {
  return imageCachePolicy;
}

export default {
  embyHost,
  embyApiKey,
  mediaMountPath,
  alistAddr,
  alistToken,
  alistSignEnable,
  alistSignExpireTime,
  alistPublicAddr,
  strHead,
  routeCacheConfig,
  symlinkRule,
  routeRule,
  mediaPathMapping,
  redirectStrmLastLinkRule,
  clientSelfAlistRule,
  transcodeConfig,
  embyNotificationsAdmin,
  embyRedirectSendMessage,
  itemHiddenRule,
  streamConfig,
  searchConfig,
  getEmbyHost,
  getTranscodeEnable,
  getTranscodeType,
  getImageCachePolicy,
  nginxConfig,
  getDisableDocs,
}

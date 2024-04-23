// 全量配置,媒体库混合,本地文件 + CD2/rclone挂载的alist文件 + strm文件
// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认emby/jellyfin的地址是宿主机,要注意iptables给容器放行端口
const embyHost = "http://172.17.0.1:8096";
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始emby处理,不用重复填写至disableRedirectRule
// 如果没有挂载,全部使用strm文件,此项填[""],必须要是数组
const embyMountPath = ["/mnt"];
// emby/jellyfin api key, 在emby/jellyfin后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = "http://172.17.0.1:5244";
// alist token, 在alist后台查看
const alistToken = "alsit-123456";

// 选填项,用不到保持默认即可
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";
// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  "115": "https://cdnfhnfile.115.com",
};
// 是否开启路由缓存,短时间内同客户端访问相同资源不会再做判断和请求alist,有限的防抖措施,出现问题可以关闭此选项
const routeCacheEnable = true;
// 路由规则,注意有先后顺序,"proxy"规则优先级最高,其余依次,千万注意规则不要重叠,不然排错十分困难,字幕和图片走了缓存,不在此规则内
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链302, "transcode": 转码, "block": 只是屏蔽播放
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
  // ["transcode", "filePath", 0, "/mnt/sda3"],
  // ["transcode", "115-local", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]],
  // ["transcode", "115-local", "filePath", 0, "/mnt/115"],
  // ["block", "filePath", 0, "/mnt/sda4"],
];
// 路径映射,会在xxxMountPath之后从上到下依次全部替换一遍,不要有重叠
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为strm, 1: 只处理strm内部为/开头的相对路径, 2: 只处理strm内部为远程链接的
// 参数3: 来源, 参数4: 目标
const embyPathMapping = [
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
// 参数3: 指定转发给客户端的alist的host前缀,兼容sign参数
const cilentSelfAlistRule = [
  // "Emby for iOS"和"Infuse"对于115的进度条拖动依赖于此
  // 如果nginx为https,则此alist也必须https,浏览器行为客户端会阻止非https请求
  [0, strHead["115"], alistPublicAddr],
];
// !!!实验功能,转码负载均衡,默认false,将按之前逻辑禁止转码处理并移除转码选项参数,与emby配置无关
// 主库和所有从库给用户开启[播放-如有必要，在媒体播放期间允许视频转码]+[倒数7行-允许媒体转换]
// type: "nginx", nginx负载均衡,好处是使用简单且内置均衡参数选择,缺点是流量全部经过此服务器,
// 且使用条件很苛刻,转码服务组中的媒体id需要和主媒体库中id一致,自行寻找实现主从同步,完全同步后,ApiKey也是一致的
// type: "distributed-media-server", 分布式媒体服务负载均衡(暂未实现均衡),优先利用302真正实现流量的LB,且灵活,
// 不区分主从,当前访问服务即为主库,可emby/jellyfin混搭,挂载路径可以不一致,但要求库中的标题和语种一致且原始文件名一致
const transcodeConfig = {
  enable: false,
  type: "distributed-media-server", // 负载类型,可选值, ["nginx", "distributed-media-server"]
  maxNum: 3, // 单机最大转码数量,有助于加速轮询, 参数暂无作用,接口无法查询转码情况,忽略此参数
  redirectTransOptEnable: true, // 302的直链文件是否保留码率选择,不保留客户端将无法手动切换至转码
  fallbackRouteMode: "redirect", // 降级后路由措施,可选值, ["redirect", "proxy"]
  // 注意下列host必须全部为公网地址,会302给客户端访问,如果为空数组,将使用当前服务,若参与负载下边手动添加
  server: [
    {
      type: "emby",
      host: "http://yourdomain.com:8096",
      apiKey: "f839390f50a648fd92108bc11ca6730a",
    },
    {
      type: "jellyfin",
      host: "http://yourdomain.com:8097",
      apiKey: "f839390f50a648fd92108bc11ca6730a",
    },
    // plex和weight参数暂未实现,很难
    // {
    //   type: "plex",
    //   host: "http://yourdomain.com:32400",
    //   apiKey: "f839390f50a648fd92108bc11ca6730a",
    // },
  ]
};
// 图片缓存策略,包括主页、详情页、图片库的原图,路由器nginx请手动调小conf中proxy_cache_path的max_size
// 0: 不同尺寸设备共用一份缓存,先访问先缓存,空间占用最小但存在小屏先缓存大屏看的图片模糊问题
// 1: 不同尺寸设备分开缓存,空间占用适中,命中率低下,但契合emby的图片缩放处理
// 2: 不同尺寸设备共用一份缓存,空间占用最大,移除emby的缩放参数,直接原图高清显示
const imageCachePolicy = 0;

// 对接emby通知管理员设置,目前只发送是否直链成功,依赖emby/jellyfin的webhook配置并勾选外部通知
const embyNotificationsAdmin = {
  enable: false,
  includeUrl: false, // 链接太长,默认关闭
  name: "【emby2Alist】",
};
// 对接emby设备控制推送通知消息,目前只发送是否直链成功,此处为统一开关,范围为所有的客户端,通知目标只为当前播放的设备
const embyRedirectSendMessage = {
  enable: false,
  header: "【emby2Alist】",
  timeoutMs: -1, // 消息通知弹窗持续毫秒值
};

// 按路径匹配规则隐藏部分接口返回的items
// 参数1: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数2: 匹配目标,对象为Item.Path
// 参数3: 默认同时隐藏[搜索建议(不会过滤搜索接口)]和[更多类似(若当前浏览项目位于规则中,将跳过隐藏)]接口 
// 0: 默认, 1: 只隐藏[搜索建议]接口, 2: 只隐藏[更多类似]接口
const itemHiddenRule = [
  // [0, "/mnt/sda1"],
  // [1, ".mp3", 1],
  // [2, "Google", 2],
  // [3, /private/ig],
];

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
  embyMountPath,
  embyApiKey,
  routeCacheEnable,
  routeRule,
  alistAddr,
  alistToken,
  alistPublicAddr,
  cilentSelfAlistRule,
  embyPathMapping,
  redirectStrmLastLinkRule,
  embyNotificationsAdmin,
  embyRedirectSendMessage,
  itemHiddenRule,
  transcodeConfig,
  getEmbyHost,
  getTranscodeEnable,
  getTranscodeType,
  getImageCachePolicy,
}

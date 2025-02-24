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
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始 emby 处理
// 如果没有挂载,全部使用 strm 文件,此项填[""],必须要是数组
const mediaMountPath = ["/mnt"];

// 访问宿主机上 5244 端口的 alist 地址, 要注意 iptables 给容器放行端口
const alistAddr = "http://172.17.0.1:5244";

// alist token, 在 alist 后台查看
const alistToken = "alsit-123456";

// alist 是否启用了 sign
const alistSignEnable = false;

// alist 中设置的直链过期时间,以小时为单位,严格对照 alist 设置 => 全局 => 直链有效期
const alistSignExpireTime = 12;

// 选填项,用不到保持默认即可

// alist 公网地址,用于需要 alist server 代理流量的情况,按需填写
const alistPublicAddr = "http://youralist.com:5244";

// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  xEmbyClients: {
    seekBug: ["Emby for iOS"],
  },
  xUAs: {
    seekBug: ["Infuse", "VidHub", "SenPlayer"],
    clientsPC: ["EmbyTheater"],
    clients3rdParty: ["Fileball", "Infuse", "SenPlayer", "VidHub"],
    player3rdParty: ["dandanplay", "VLC", "MXPlayer", "PotPlayer"],
    blockDownload: ["Infuse-Download"],
    infuse: {
      direct: "Infuse-Direct",
      download: "Infuse-Download",
    },
    // 安卓与 TV 客户端不太好区分,浏览器 UA 关键字也有交叉重叠,请使用 xEmbyClients 参数或使用正则
  },
  "115": ["115.com", "115cdn.net"],
  ali: ["aliyundrive.net"],
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
  //   ["mediaPathMappingGroup01", "filePath", "startsWith", strHead.filePaths.mediaPathMappingGroup01], // 目标地址
  //   ["mediaPathMappingGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  //   ["mediaPathMappingGroup01", "r.args.UserId", "startsWith", strHead.userIds.mediaPathMappingGroup01],
  // ],
  // directHlsEnable: [
  //   // 此条规则代表大于等于 4Mbps 码率时生效,XMedia 为固定值,平方使用双星号表示
  //   ["directHlsEnable", "r.XMedia.Bitrate", ">=", 4 * 1024 ** 2],
  //   ["directHlsEnable", "r.args.UserId", "==", "ac0d220d548f43bbb73cf9b44b2ddf0e"],
  // ]
};

// 重定向/直链开关配置,关闭的效果为还原为严格反代逻辑,即中转上游源服务流量
// 此为粗颗粒度控制,优先级最高,细颗粒控制依旧使用路由规则管理
const redirectConfig = {
  enable: true, // 允许直链的总开关,false 等同覆盖下列所有为 false
  // 允许电视直播直链,关闭后特例将忽略 transcodeConfig.enable 值,因直播 m3u 特殊表现为转码播放,实际并未占用服务端硬件转码
  enableVideoLivePlay: true,
  enableVideoStreamPlay: true, // 允许视频串流播放直链
  enableAudioStreamPlay: true, // 允许音频串流播放直链
  enableItemsDownload: true, // 允许网页下载项目直链
  enableSyncDownload: true, // 允许官方客户端下载项目直链
};

// 路由缓存配置
const routeCacheConfig = {
  // 总开关,是否开启路由缓存,此为一级缓存,添加阶段为 redirect 和 proxy 之前
  // 短时间内同客户端访问相同资源不会再做判断和请求 alist,有限的防抖措施,出现问题可以关闭此选项
  enable: true,
  // 二级缓存开关,仅针对直链,添加阶段为进入单集详情页,clientSelfAlistRule 中的和首页直接播放的不生效
  // 非 web 端且限 UA 的不建议使用,效率太低,因部分客户端详情页 UA 和播放器 UA 存在不同的情况
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

// 路由规则,注意顺序是从上至下匹配,千万注意规则不要重叠,不然排错十分困难,字幕和图片走了缓存,不在此规则内
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链 302,
// "transcode": 转码,稍微有些歧义,大部分情况等同于"proxy",这里只是不做转码参数修改,具体是否转码由 emby 客户端自己判断上报或客户端手动切换码率控制,
// "block": 屏蔽媒体播放和下载, "blockDownload": 只屏蔽下载, "blockPlay": 只屏蔽播放,
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
  // 注意非"proxy"无法使用"alistRes"条件,因为没有获取 alist 直链的过程
  // ["proxy", "filePath", 0, "/mnt/sda1"],
  // ["proxy", "直播走中转01", "r.XMedia.IsInfiniteStream", "===", true],
  // ["redirect", "filePath", 0, "/mnt/sda2"],
  // ["transcode", "filePath", 0, "/mnt/sda3"],
  // ["transcode", "115-local", "r.args.X-Emby-Client", 0, strHead.xEmbyClients.XXX],
  // ["transcode", "115-local", "filePath", 0, "/mnt/115"],
  // ["block", "filePath", 0, "/mnt/sda4"],

  // 高级分组规则,XMedia 为固定值,等于 Emby.MediaSources 数组中的单个目标对象
  // 注意设备id具有唯一性,不会跟随切换用户变更,取值参考 /PlaybackInfo 接口的出入参数
  // r.XMedia.MediaStreams 数组比较特殊,路由规则暂未做关键词抽取,但目前匹配视频流规则够用,多音频/字幕流不太好写规则
  // r.XMedia.MediaStreams.0 一般为视频流对象,不支持 r.XMedia.MediaStreams[0] 写法

  // 此条规则代表大于等于 3Mbps 码率的允许转码,平方使用双星号表示,无意义加减仅为示例,注意 emby/jellyfin 码率为 bps 单位
  // ["transcode", "高码率允许转码01", "r.XMedia.Bitrate", ">=", 3 * 1000 ** 2 + (1 * 1000 ** 2) - (1 * 1000 ** 2)],
  // 可选规则,结合上条规则做分组,同时满足才能生效,否则继续向下匹配
  // ["transcode", "高码率允许转码01", "r.args.X-Emby-Device-Id", "===", ["设备id01", "设备id02"]],
  // 此条规则代表 4K 分辨率的允许转码,但假如设备自身上报和上游决定走转码,不满足的也会转码,遵守上游倾向为播放成功率考虑
  // ["transcode", "高分辨率允许转码01", "r.XMedia.MediaStreams.0.DisplayTitle", "includes", "4K"],
  // 可选替换上条规则,更精确的分辨率规则,例如 21:9 视频,或某些 2.5 K 视频等不在标准分辨率划分内的
  // ["transcode", "高分辨率允许转码01", "r.XMedia.MediaStreams.0.Width", ">=", 4320],
  // 精确屏蔽指定功能,注意同样是整体规则都不匹配默认走"redirect",即不屏蔽,建议只用下方一条,太复杂的话需要自行测试
  // ["blockDownload", "屏蔽下载01", "r.headersIn.User-Agent", "includes", strHead.xUAs.blockDownload],
  // 非必须,该分组内细分为用户 id 白名单,结合上面一条代表 "屏蔽指定标识客户端的非指定用户的下载"
  // ["blockDownload", "屏蔽下载01", "r.args.UserId", "startsWith:not", ["用户id01", "用户id02"]],
  // 非必须,该分组内细分为入库路径黑名单,结合上面两条代表 "屏蔽指定标识客户端的非指定用户的指定入库路径的下载"
  // ["blockDownload", "屏蔽下载01", "filePath", "startsWith", ["/mnt/115"]],
];

// 路径映射,会在 mediaMountPath 之后从上到下依次全部替换一遍,不要有重叠,注意 /mnt 会先被移除掉了
// 参数?.1: 生效规则三维数组,有时下列参数序号加一,优先级在参数2之后,需同时满足,多个组是或关系(任一匹配)
// 参数1: 0: 默认做字符串替换 replace 一次, 1: 前插, 2: 尾插, 3: replaceAll 替换全部
// 参数2: 0: 默认只处理本地路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的, 3: 全部处理
// 参数3: 来源, 参数4: 目标
const mediaPathMapping = [
  // [0, 0, "/aliyun-01", "/aliyun-02"],
  // [0, 2, "http:", "https:"],
  // [0, 2, ":5244", "/alist"],
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
  // 此条是一个规则变量引用,方便将规则汇合到同一处进行管理
  // [ruleRef.mediaPathMappingGroup01, 0, 0, "/aliyun-01", "/aliyun-02"],
  // 路径映射多条规则会从上至下依次执行,如下有同一个业务关系集的,注意带上区间的闭合条件,不然会被后续重复替换会覆盖
  // 以下是按码率条件进行路径映射,全用户设备强制,区分用户和设备可再精确添加条件
  // [[["4K 目录映射到 1080P 目录", "r.XMedia.Bitrate", ">", 10 * 1000 ** 2],
  // ], 0, 0, "/4K/", "/1080P/"],
  // [[["1080P 目录映射到 720P 目录", "r.XMedia.Bitrate", ">", 6 * 1000 ** 2],
  //   ["1080P 目录映射到 720P 目录", "r.XMedia.Bitrate", "<=", 10 * 1000 ** 2],
  // ], 0, 0, "/1080P/", "/720P/"],
  // [[["720P 目录映射到 480P 目录", "r.XMedia.Bitrate", ">", 3 * 1000 ** 2],
  //   ["720P 目录映射到 480P 目录", "r.XMedia.Bitrate", "<=", 6 * 1000 ** 2],
  // ], 0, 0, "/720P/", "/480P/"],
];

// 仅针对 alist 返回的 raw_url 进行路径映射,优先级在 mediaPathMapping 和 clientSelfAlistRule 后,使用方法一样
// 参数?.1: 生效规则三维数组,有时下列参数序号加一,优先级在参数2之后,需同时满足,多个组是或关系(任一匹配)
// 参数1: 0: 默认做字符串替换replace一次, 1: 前插, 2: 尾插, 3: replaceAll替换全部
// 参数2: 0: 默认只处理本地路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的, 3: 全部处理
// 参数3: 来源, 参数4: 目标
const alistRawUrlMapping = [
  // [0, 0, "/alias/movies", "/aliyun-01"],
];

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
  // ["useGroup01", "filePath", "startsWith", strHead.lanIp.map(s => "http://" + s)], // 目标地址
  // ["useGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];

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

// 对接 emby 通知管理员设置,目前只发送是否直链成功和屏蔽详情,依赖 emby/jellyfin 的 webhook 配置并勾选外部通知
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
// 4: 只隐藏[首页最新项目]接口,
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
  // 不带协议与域名,仅作包含匹配,多个值为或的关系,未定义或空数组为不隔离
  //interactiveEnableRule: [
  //  "ac0d220d548f43bbb73cf9b44b2ddf0e", // request_uri path level userId
  //  "2d427412-43e1-49e4-a1db-fa17c04d49db", // X-Emby-Device-Id
  //],
};

// 115网盘 web cookie, 会覆盖从 alist 获取到的 cookie
const webCookie115 = "";
// 网盘转码直链配置,当前仅支持 115(必填 webCookie115) 和 emby 挂载媒体环境
const directHlsConfig = {
  enable: false,
  // 仅在首次占位未获取清晰度时,默认播放最小,开启后默认播放最大,版本缓存有效期内客户端自行选择
  defaultPlayMax: false,
  // 启用规则,仅在 enable = true 时生效
  enableRule: ruleRef.directHlsEnable ?? [],
};

// PlaybackInfo 接口的一些增强配置
const playbackInfoConfig = {
  enabled: true,
  // 根据规则组指定播放源排序规则(与 redirectStrmLastLinkRule 配置类似,但必须设置分组名)
  // sourcesSortRules 为旧版兼容排序规则,同时做为未匹配的默认排序规则,不要使用这个组名
  // 匹配规则越靠前优先级越高
  // 参数1: 分组名,组内为与关系(全部匹配),排序规则 key 需要与分组名相同
  // 参数2: 匹配类型或来源(字符串参数类型),不支持 filePath 和 alistRes 变量
  // 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
  // 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
  sourcesSortFitRule: [
    // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 客户端为内网
    // ["useGroup01", "r.args.X-Emby-Client", "startsWith", strHead.xEmbyClients.seekBug], // Emby 客户端类型
    // ["useGroup02", "r.variables.remote_addr", "startsWith:not", strHead.lanIp[0]], // 公网
    // ["useGroup02", "r.variables.remote_addr", "startsWith:not", strHead.lanIp[3]], // 公网
    // ["useGroup03", "r.args.X-Emby-Client", 2, "Emby Web"], // Emby 客户端类型为浏览器
    // ["useGroup03", "r.headersIn.user-agent", 2, "Chrome"], // 通用客户端 UA 标识
  ],
  // 多版本播放源排序规则,对接口数据 MediaSources 数组进行排序,优先级从上至下,数组内从左至右,支持正则表达式
  // key 使用"."进行层级,分割后的键按层级从 MediaSources 获取,根据分割键获取下一层值时若对象为数组,则过滤[Type === 分割键]的第一行数据
  // (如: "MediaStreams.Video.Height"规则中 MediaSources.MediaStreams 值为数组,则取数组中[Type === "Video"]的对象的 Height 值)
  // ":length"为关键字,用于数组长度排序
  // value 只有三种类型, "asc": 正序, "desc": 倒序, 字符串/正则混合数组: 指定按关键字顺序排序
  // 非正则情况下, value 不区分大小写(简化书写), 只有正则区分大小写
  sourcesSortRules: {
    // "Path": ["1080p", "720p", "480p", "hevc", "h265", "h264"], // 按原文件名路径关键字排序
    // "Path": [/^\d{4}p$/g, /^\d{3}p$/g, "hevc", "h265", "h264"], // 正则匹配 4 位数字排在 3 位数字前面并忽略大小写
    // "MediaStreams.Video.Height": "desc", // 按视频高度倒序
    // "MediaStreams.Video.Codec": ["AV1", "HEVC", "H264"], // 按视频编码排序
    // "MediaStreams.Subtitle:length": "desc", // 更多字幕的排在前面
    // "MediaStreams.Video.BitRate": "asc", // 码率正序
  },
  // useGroup01: {
  //   "MediaStreams.Video.Width": "desc",
  //   "MediaStreams.Video.ExtendedVideoSubType": ["DoviProfile5", "DoviProfile8", "Hdr10", "DoviProfile7", "None"], // 视频编码子类型
  //   "MediaStreams.Video.BitRate": "desc", // 码率倒序
  //   "MediaStreams.Video.RealFrameRate": "desc", // 帧率倒序
  // },
  // useGroup02: {
  //   "MediaStreams.Video.BitRate": "asc",
  //   "MediaStreams.Video.RealFrameRate": "asc",
  // },
  // useGroup03: {
  //   "MediaStreams.Video.VideoRange": ["SDR"], // 视频动态范围
  // },
}

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
function getUsersItemsLatestFilterEnable(r) {
  return itemHiddenRule.some(rule => !rule[2] || rule[2] == 0 || rule[2] == 4);
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
  redirectConfig,
  routeCacheConfig,
  symlinkRule,
  routeRule,
  mediaPathMapping,
  alistRawUrlMapping,
  redirectStrmLastLinkRule,
  clientSelfAlistRule,
  redirectCheckEnable,
  fallbackUseOriginal,
  transcodeConfig,
  embyNotificationsAdmin,
  embyRedirectSendMessage,
  itemHiddenRule,
  streamConfig,
  searchConfig,
  webCookie115,
  directHlsConfig,
  playbackInfoConfig,
  getEmbyHost,
  getTranscodeEnable,
  getTranscodeType,
  getImageCachePolicy,
  getUsersItemsLatestFilterEnable,
  nginxConfig,
  getDisableDocs,
}

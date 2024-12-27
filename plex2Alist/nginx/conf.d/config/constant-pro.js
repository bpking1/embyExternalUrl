import commonConfig from "./constant-common.js";
import mountConfig from "./constant-mount.js";

const strHead = commonConfig.strHead;
const ruleRef = commonConfig.ruleRef;
const alistPublicAddr = mountConfig.alistPublicAddr;

// 选填项,高级配置,用不到保持默认即可

// 重定向/直链开关配置,关闭的效果为还原为严格反代逻辑,即中转上游源服务流量
// 此为粗颗粒度控制,优先级最高,细颗粒控制依旧使用路由规则管理
const redirectConfig = {
  enable: true, // 允许直链的总开关,false 等同覆盖下列所有为 false
  enablePartStreamPlayOrDownload: true, // 允许串流播放或下载的直链
  enableVideoTranscodePlay: true, // 允许转码播放的直链
};

// 路由缓存配置
const routeCacheConfig = {
  // 总开关,是否开启路由缓存,此为一级缓存,添加阶段为 redirect 和 proxy 之前
  // 短时间内同客户端访问相同资源不会再做判断和请求 alist,有限的防抖措施,出现问题可以关闭此选项
  enable: true,
  // 二级缓存开关,仅针对直链,添加阶段为进入单集详情页,clientSelfAlistRule 中的和首页直接播放的不生效
  // 非 web 端且限 UA 的不建议使用,生效率太低,因部分客户端详情页 UA 和播放器 UA 存在不同的情况
  enableL2: false,
  // 缓存键表达式,默认值好处是命中范围大,但会导致 routeRule 中针对设备的规则失效,多个变量可自行组合修改,冒号分隔
  keyExpression: "r.uri:r.args.path:r.args.mediaIndex:r.args.partIndex", //"xxx:r.args.X-Plex-Client-Identifier"
};

// 路由规则,注意有先后顺序,"proxy"规则优先级最高,其余依次,千万注意规则不要重叠,不然排错十分困难,字幕和图片走了缓存,不在此规则内
// 参数1: 指定处理模式,单规则的默认值为"proxy",但是注意整体规则都不匹配默认值为"redirect",然后下面参数序号-1
// "proxy": 原始媒体服务器处理(中转流量), "redirect": 直链302, "block": 屏蔽媒体播放和下载
// pelx 不需要 "transcode", 可用 "proxy" 代替,稍微有些歧义,这里只是不做修改,交给原始服务中转处理,具体是否转码由 plex 客户端自己判断上报的
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

  // 可参照 Emby 配置文件,但受限于脚本对于 Plex 获取文件路径的缓存实现,目前可能 XMedia 对象为空,只能使用接口入参
  // 注意设备id具有唯一性,不会跟随切换用户变更,Plex 接口入参不存在用户id,取值参考 /library/metadata/xxx 接口的出入参数
  // 高级分组规则,XMedia 为固定值,等于 Plex.MediaContainer.Metadata[0].Media[目标索引] 对象
  // r.XMedia.Part.0.Stream 数组比较特殊,路由规则暂未做关键词抽取,但目前匹配视频流规则够用,多音频/字幕流不太好写规则
  // r.XMedia.Part.0.Stream.0 一般为视频流对象,不支持 r.XMedia.Part[0].Stream[0] 写法

  // 此条规则代表大于等于 3Mbps 码率的允许转码,平方使用双星号表示,无意义加减仅为示例,注意 plex 码率为 kbps 单位
  // ["transcode", "高码率允许转码01", "r.XMedia.bitrate", ">=", 3 * 1000 + (1 * 1000) - (1 * 1000)],
  // 可选规则,结合上条规则做分组,同时满足才能生效,否则继续向下匹配
  // ["transcode", "高码率允许转码01", "r.args.X-Plex-Client-Identifier", "===", ["设备id01", "设备id02"]],
  // 此条规则代表 4K 分辨率的允许转码,但假如设备自身上报和上游决定走转码,不满足的也会转码,遵守上游倾向为播放成功率考虑
  // ["transcode", "高分辨率允许转码01", "r.XMedia.Part.0.Stream.0.displayTitle", "includes", "4K"],
  // 可选替换上条规则,更精确的分辨率规则,例如 21:9 视频,或某些 2.5 K 视频等不在标准分辨率划分内的
  // ["transcode", "高分辨率允许转码01", "r.XMedia.Part.0.Stream.0.width", ">=", 4320],
  // 精确屏蔽指定功能,注意同样是整体规则都不匹配默认走"redirect",即不屏蔽,建议只用下方一条,太复杂的话需要自行测试
  // ["blockDownload", "屏蔽下载01", "r.headersIn.User-Agent", "includes", strHead.xUAs.blockDownload],
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
  // [[["4K 目录映射到 1080P 目录", "r.XMedia.bitrate", ">", 10 * 1000],
  // ], 0, 0, "/4K/", "/1080P/"],
  // [[["1080P 目录映射到 720P 目录", "r.XMedia.bitrate", ">", 6 * 1000],
  //   ["1080P 目录映射到 720P 目录", "r.XMedia.bitrate", "<=", 10 * 1000],
  // ], 0, 0, "/1080P/", "/720P/"],
  // [[["720P 目录映射到 480P 目录", "r.XMedia.bitrate", ">", 3 * 1000],
  //   ["720P 目录映射到 480P 目录", "r.XMedia.bitrate", "<=", 6 * 1000],
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

export default {
  redirectConfig,
  routeCacheConfig,
  routeRule,
  mediaPathMapping,
  alistRawUrlMapping,
}

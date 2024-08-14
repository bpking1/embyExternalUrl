import commonConfig from "./constant-common.js";
import mountConfig from "./constant-mount.js";

const strHead = commonConfig.strHead;
const ruleRef = commonConfig.ruleRef;
const alistPublicAddr = mountConfig.alistPublicAddr;

// 选填项,高级配置,用不到保持默认即可

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

export default {
  routeCacheConfig,
  routeRule,
  mediaPathMapping,
}

import commonConfig from "./constant-common.js";

const strHead = commonConfig.strHead;
const ruleRef = commonConfig.ruleRef;

// 选填项,特定平台功能,用不到保持默认即可

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
const itemHiddenRule = [];

// 串流配置
const streamConfig = {
  useRealFileName: false,
};

// 搜索接口增强配置
const searchConfig = {
  interactiveEnable: false,
  interactiveFast: false,
};

// 115网盘 web cookie, 会覆盖从 alist 获取到的 cookie
const webCookie115 = {{WEB_COOKIE_115}};
// 网盘转码直链配置,当前仅支持 115(必填 webCookie115) 和 emby 挂载媒体环境
const directHlsConfig = {
  enable: {{DIRECT_HLS_ENABLE}},
  // 仅在首次占位未获取清晰度时,默认播放最小,开启后默认播放最大,版本缓存有效期内客户端自行选择
  defaultPlayMax: {{DIRECT_HLS_DEFAULT_PLAY_MAX}},
  // 启用规则,仅在 enable = true 时生效
  enableRule: ruleRef.directHlsEnable ?? [],
};

// PlaybackInfo 接口的一些增强配置
const playbackInfoConfig = {
  enabled: true,
  sourcesSortFitRule: [],
  sourcesSortRules: {},
}

export default {
  imageCachePolicy,
  embyNotificationsAdmin,
  embyRedirectSendMessage,
  itemHiddenRule,
  streamConfig,
  searchConfig,
  webCookie115,
  directHlsConfig,
  playbackInfoConfig,
}

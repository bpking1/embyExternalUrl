// 这个总配置拆分主体文件只是备份,生效需要放置在 conf.d 下,且重命名为 constant.js
// 如果使用拆分配置,请注意填写 config 下的使用到的配置文件

import commonConfig from "./config/constant-common.js";
import mountConfig from "./config/constant-mount.js";
import proConfig from "./config/constant-pro.js";
import symlinkConfig from "./config/constant-symlink.js";
import strmConfig from "./config/constant-strm.js";
import transcodeConfig from "./config/constant-transcode.js";
import extConfig from "./config/constant-ext.js";

// 必填项,根据实际情况修改下面的设置

// 这里默认 emby/jellyfin 的地址是宿主机,要注意 iptables 给容器放行端口
const embyHost = "http://172.17.0.1:8096";

// emby/jellyfin api key, 在 emby/jellyfin 后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";

// 挂载工具 rclone/CD2 多出来的挂载目录, 例如将 od,gd 挂载到 /mnt 目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始 emby 处理,不用重复填写至 disableRedirectRule
// 如果没有挂载,全部使用 strm 文件,此项填[""],必须要是数组
const mediaMountPath = ["/mnt"];

// for js_set
function getEmbyHost(r) {
  return embyHost;
}
function getTranscodeEnable(r) {
  return transcodeConfig.transcodeConfig.enable;
}
function getTranscodeType(r) {
  return transcodeConfig.transcodeConfig.type;
}
function getImageCachePolicy(r) {
  return extConfig.imageCachePolicy;
}

export default {
  embyHost,
  embyApiKey,
  mediaMountPath,
  strHead: commonConfig.strHead,

  alistAddr: mountConfig.alistAddr,
  alistToken: mountConfig.alistToken,
  alistSignEnable: mountConfig.alistSignEnable,
  alistSignExpireTime: mountConfig.alistSignExpireTime,
  alistPublicAddr: mountConfig.alistPublicAddr,
  cilentSelfAlistRule: mountConfig.cilentSelfAlistRule,

  routeCacheConfig: proConfig.routeCacheConfig,
  routeRule: proConfig.routeRule,
  mediaPathMapping: proConfig.mediaPathMapping,

  symlinkRule: symlinkConfig.symlinkRule,
  redirectStrmLastLinkRule: strmConfig.redirectStrmLastLinkRule,
  transcodeConfig: transcodeConfig.transcodeConfig,

  embyNotificationsAdmin: extConfig.embyNotificationsAdmin,
  embyRedirectSendMessage: extConfig.embyRedirectSendMessage,
  itemHiddenRule: extConfig.itemHiddenRule,
  streamConfig: extConfig.streamConfig,

  getEmbyHost,
  getTranscodeEnable,
  getTranscodeType,
  getImageCachePolicy,
}

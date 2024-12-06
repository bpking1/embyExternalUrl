// 如果使用拆分配置,请注意填写 config 下的使用到的配置文件

import commonConfig from "./config/constant-common.js";
import mountConfig from "./config/constant-mount.js";
import proConfig from "./config/constant-pro.js";
import symlinkConfig from "./config/constant-symlink.js";
import strmConfig from "./config/constant-strm.js";
import transcodeConfig from "./config/constant-transcode.js";
// import extConfig from "./config/constant-ext.js";

// 必填项,根据实际情况修改下面的设置

// 这里默认 plex 的地址是宿主机,要注意 iptables 给容器放行端口
const plexHost = "http://172.17.0.1:32400";

// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始 plex 处理
const mediaMountPath = ["/mnt"];

// for js_set
function getPlexHost(r) {
  return plexHost;
}
function getTranscodeEnable(r) {
  return transcodeConfig.transcodeConfig.enable;
}

export default {
  plexHost,
  mediaMountPath,
  strHead: commonConfig.strHead,

  alistAddr: mountConfig.alistAddr,
  alistToken: mountConfig.alistToken,
  alistSignEnable: mountConfig.alistSignEnable,
  alistSignExpireTime: mountConfig.alistSignExpireTime,
  alistPublicAddr: mountConfig.alistPublicAddr,
  clientSelfAlistRule: mountConfig.clientSelfAlistRule,
  redirectCheckEnable: mountConfig.redirectCheckEnable,
  fallbackUseOriginal: mountConfig.fallbackUseOriginal,

  redirectConfig: proConfig.redirectConfig,
  routeCacheConfig: proConfig.routeCacheConfig,
  routeRule: proConfig.routeRule,
  mediaPathMapping: proConfig.mediaPathMapping,
  alistRawUrlMapping: proConfig.alistRawUrlMapping,

  symlinkRule: symlinkConfig.symlinkRule,
  redirectStrmLastLinkRule: strmConfig.redirectStrmLastLinkRule,
  transcodeConfig: transcodeConfig.transcodeConfig,

  getPlexHost,
  getTranscodeEnable,
}

// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认plex的地址是宿主机,要注意iptables给容器放行端口
const plexHost = "http://172.17.0.1:32400";
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始plex处理,不用重复填写至disableRedirectArr
const plexMountPathArr = ["/mnt"];
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddrPrefix = "http://172.17.0.1";
const alistAddrPort = "5244";
const alistAddr = (alistAddrPort == "" || alistAddrPort == "80" || alistAddrPort == "443") 
  ? alistAddrPrefix 
  : alistAddrPrefix + ":" + alistAddrPort;
// alist token, 在alist后台查看
const alistToken = "alsit-123456";

// 选填项,用不到保持默认即可
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";
// 会在plexMountPathArr之后全部替换一遍,不要有重叠
const plexPathMapping = [
  // ["/mnt/aliyun-01", "/mnt/aliyun-02"],
  // ["http:", "https:"], 
  // [":5244", "/alist"], 
  // ["D:", "F:"],
  // [/blue/g, "red"],
];
// 禁用直链的规则,字幕和图片没有走直链,不用添加。arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: matches(/ain/g), arg2: 是否处理alist响应链接
const disableRedirectArr = [
  // [0, "/mnt/sda1"],
  // [1, ".mp3"],
  // [2, "Google"],
  // [2, "/NAS/", true],
  // [3, /private/ig],
];
const plexTokenKey = "X-Plex-Token";
// 功能正常可以忽略此参数,优先使用此参数决定能否精确搜索到plex挂载路径
// 请大致估算多版本视频的套数,用于计算metadata和part(media)的自增id偏差数
// 如未搜索到,将通过视频文件名搜索plex挂载路径(bug多且对多版本视频搜索不准确)
let metadataIdOffsetFactor = 3;

function getPlexHost(r) {
  return plexHost;
}

export default {
  plexHost,
  plexMountPathArr,
  disableRedirectArr,
  metadataIdOffsetFactor,
  alistToken,
  alistAddrPrefix,
  alistAddrPort,
  alistAddr,
  plexPathMapping,
  alistPublicAddr,
  plexTokenKey,
  getPlexHost
}

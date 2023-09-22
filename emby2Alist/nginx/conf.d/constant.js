// export constant allocation
// 根据实际情况修改下面的设置
const embyIp = "http://172.17.0.1";
const embyPort = 8098;
// 这里默认emby/jellyfin的地址是宿主机,要注意iptables给容器放行端口
const embyHost = embyIp + ":" + embyPort;
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下:  /mnt/onedrive  /mnt/gd ,那么这里 就填写 /mnt
const embyMountPath = "/mnt";
// alist token, 在alist后台查看
const alistToken = "alsit-123456";
const alistIp = "http://172.17.0.1";
const alistPort = 5244;
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = alistIp + ":" + alistPort;
// emby/jellyfin api key, 在emby/jellyfin后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";
// 公网域名, 按需填写, eg: http://youralist.com
const publicDomain = "";
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = publicDomain + ":" + alistPort;
// 使用AList直链播放挂载的NAS本地视频时,可能存在卡顿与花屏，若出现，请启用，使用emby原始链接
const changeAlistToEmby = false;

export default {
  embyIp,
  embyPort,
  embyHost,
  embyMountPath,
  alistToken,
  alistIp,
  alistPort,
  alistAddr,
  embyApiKey,
  publicDomain,
  alistPublicAddr,
  changeAlistToEmby
}

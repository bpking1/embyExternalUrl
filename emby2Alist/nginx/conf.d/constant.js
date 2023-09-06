// export constant allocation
// 根据实际情况修改下面的设置

// 这里默认emby/jellyfin的地址是宿主机,要注意iptables给容器放行端口
const embyHost = "http://172.17.0.1:8096";
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下:  /mnt/onedrive  /mnt/gd ,那么这里 就填写 /mnt
const embyMountPath = "/mnt";
// alist token, 在alist后台查看
const alistToken = "alsit-123456";
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = "http://172.17.0.1:5244";
// emby/jellyfin api key, 在emby/jellyfin后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";

export default {
  embyHost,
  embyMountPath,
  alistToken,
  alistAddr,
  embyApiKey,
  alistPublicAddr
}

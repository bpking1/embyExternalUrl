// export constant allocation
// 根据实际情况修改下面的设置
const embyIp = "http://172.17.0.1";
const embyPort = 8096;
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
// Alist公网域名, 按需填写, eg: http://youralist.com
const publicDomain = "https://alist.example.com";
// Emby公网域名，特殊端口则添加端口
const embyPublicDomain = "https://emby.example.com";
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = publicDomain + ":" + alistPort;
// 使用AList直链播放挂载的NAS本地视频时,可能存在卡顿与花屏，若出现，请启用，使用emby/jellyfin原始链接
const changeAlistToEmby = false;
// !!!风险功能，是否允许转发strm文件内部url直链到客户端，不建议开启，建议strm文件内部只填路径
// 可能存在明文密码，默认禁止并交给原始emby/jellyfin中转处理，仅供调试，泄露密码后果自行承担
const allowRemoteStrmRedirect = false;
// 忽略路径列表，如果Emby文件路径在此列表中，则不创建直链，直接使用emby/jellyfin原始链接
const ignorePath = ['/mnt/localMedia/'];
// 由于Rclone+Onedrive一起使用会修改OneDrive中的特殊字符，导致无法获取到Alist直链
// 如果遇到此问题，请将下面的fixRclonePath设置为true
const fixRclonePath = false;

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
  changeAlistToEmby,
  allowRemoteStrmRedirect,
  embyPublicDomain,
  ignorePath,
  fixRclonePath,
}

// export constant allocation
// 必填项,根据实际情况修改下面的设置
// 这里默认emby/jellyfin的地址是宿主机,要注意iptables给容器放行端口
const embyHost = "http://172.17.0.1:8096";
// rclone 的挂载目录, 例如将od, gd挂载到/mnt目录下: /mnt/onedrive /mnt/gd ,那么这里就填写 /mnt
// 通常配置一个远程挂载根路径就够了,默认非此路径开头文件将转给原始emby处理,不用重复填写至disableRedirectRule
const embyMountPath = ["/mnt"];
// emby/jellyfin api key, 在emby/jellyfin后台设置
const embyApiKey = "f839390f50a648fd92108bc11ca6730a";
// 访问宿主机上5244端口的alist地址, 要注意iptables给容器放行端口
const alistAddr = "http://172.17.0.1:5244";
// alist token, 在alist后台查看
const alistToken = "alsit-123456";

// 选填项,用不到保持默认即可
// alist公网地址, 用于需要alist server代理流量的情况, 按需填写
const alistPublicAddr = "http://youralist.com:5244";
// 指定客户端自己请求并获取alist直链的规则,特殊情况使用,用不着请保持默认
// 部分网盘需要客户端自己请求alist,则此处必须使用域名且外网畅通
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: matches(/ain/g)
// arg2: 指定转发给客户端的alist地址
const cilentSelfAlistRule = [
  [2, "115.com", alistPublicAddr],
];
// 多个可以给emby记录的strm文件内链接做映射,会在embyMountPath之后全部替换一遍,不要有重叠
// strm文件提醒,填写规则参考emby官方文档,强烈建议strm文件内部只填路径,重定向后的远程链接将被部分浏览器跨域限制
const embyPathMapping = [
  // ["/mnt/aliyun-01", "/mnt/aliyun-02"],
  // ["http:", "https:"], 
  // [":5244", "/alist"], 
  // ["D:", "F:"],
  // [/blue/g, "red"],
];
// 禁用直链的规则,字幕和图片没有走直链,不用添加
// arg0: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// arg2: 是否处理alist响应链接
const disableRedirectRule = [
  // [0, "/mnt/sda1"],
  // [1, ".mp3"],
  // [2, "Google"],
  // [2, "/NAS/", true],
  // [3, /private/ig],
];
// 对接emby通知管理员设置,目前只发送是否直链成功
const embyNotificationsAdmin = {
  "Enable": false,
  "IncludeUrl": false, // 链接太长,默认关闭
  "Name": "【emby2Alist】",
};

function getEmbyHost(r) {
  return embyHost;
}

export default {
  embyHost,
  embyMountPath,
  embyApiKey,
  disableRedirectRule,
  alistAddr,
  alistToken,
  alistPublicAddr,
  cilentSelfAlistRule,
  embyPathMapping,
  embyNotificationsAdmin,
  getEmbyHost
}

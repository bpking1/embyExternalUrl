# [emby2Alist](./emby2Alist/README.md)

#### 1.如何确定 embyMountPath 的路径填写?
遵循媒体入库的路径和 alist 的根目录 / 取差集,多出来的那部分就是挂载工具的挂载路径,例如
```javascript
// 我用的 CD2 挂载到群晖的共享目录中为
/CloudNAS/CloudDrive2/AList
// 对应的 alist 根路径为 /
// 但是我为了消除多余出来的平台以及挂载工具的特殊路径,所以 docker 中映射为
/CloudNAS/CloudDrive2/AList
=>
/AList
// 所以我 emby 中入库的媒体路径都是 /AList/xxx 开头的
// 所以我的 embyMountPath 填,也就是挂载工具多出来的目录所代表的 alist 的根目录的 / 的路径
const embyMountPath = ["/AList"];
```
如果挂载的路径映射情况比这更加复杂,就需要这个参数来做路径字符串的映射了
```javascript
// 路径映射,会在 xxxMountPath 之后从上到下依次全部替换一遍,不要有重叠
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的
// 参数3: 来源, 参数4: 目标
const embyPathMapping = [
  // [0, 0, "/mnt/aliyun-01", "/mnt/aliyun-02"],
  // [0, 2, "http:", "https:"], 
  // [0, 2, ":5244", "/alist"], 
  // [0, 0, "D:", "F:"],
  // [0, 0, /blue/g, "red"], // 此处正则不要加引号
  // [1, 1, `${alistPublicAddr}/d`],
  // [2, 2, "?xxx"],
];
```

#### 2.兼容 jellyfin 吗?
API 共有的功能兼容,这里的兼容指的是脚本支持的功能可以同时工作在 emby/jellfin 上,
并不是指可以互通跨客户端使用,且如 emby 的同步下载和 jellfin 的共同观看等服务端各自特有功能也不能跨服务使用

#### 3.可以同时支持 https 和 http 吗?
可以,但需要监听不同端口,以免冲突

#### 4.改完配置后需要重启?
改完直接重启 nginx 或者执行 nginx -s reload 重载配置就行了

#### 5.docker compose 后提示找不到 default.conf?
这个是 IPv6 监听导致 nginx:lastest 默认在容器内部生成了 sh 脚本,忽略此提示也可正常访问
```bash
/docker-entrypoint.d/10-listen-on-ipv6-by-default.sh
```
或者删除此文件、注释掉 IPv6 监听、删除容器重新生成

#### 6.115 内容无法 Web 端播放?
因 emby/jellyfin/plex 的 Web 内嵌播放器无法轻易干预,且 115 没有响应跨域支持,
浏览器严格限制跨域内容,使用浏览器拓展的修改响应头或者使用对应平台的客户端播放,
或者放弃 web 端的直链功能,打开路由配置中示例配置,让 nginx 转给原始服务处理

```js
// 路由缓存配置
const routeCacheConfig = {
  enable: true,
  enableL2: false,
  // 缓存键表达式,默认值添加按设备区分缓存
  // 注意这行也需要更改,如果 routeCacheConfig.enable 为 true 时
  keyExpression: "r.uri:r.args.MediaSourceId:r.args.X-Emby-Device-Id",
};
// 路由规则
const routeRule = [
  // 以下规则代表禁用"Emby Web"中的[本地挂载文件或 alist 返回的链接]的 115 直链功能
  // 注意这里省略了参数1,默认值为"proxy",参数2: 分组名,只是做标识的,可以理解为备注,可以随意填写
  ["115-alist", "r.args.X-Emby-Client", 0, "Emby Web"], // 链接入参,客户端类型
  ["115-alist", "alistRes", 0, strHead["115"]],
  ["115-local", "r.args.X-Emby-Client", 0, "Emby Web"],
  ["115-local", "filePath", 0, "/mnt/115"], // 这里填自身实际情况的 115 挂载路径
]
```

#### 7.Web 端播放部分格式会无限循环播放停止?
因为 Web 浏览器支持的格式极少,具体支持情况看浏览器控制台打印出的 canPlay 之类的信息,
没开启允许转码参数的本项目优先保证直链,而原始媒体服务大部分情况都会走转码以兼容这种情况,建议优先使用对应平台的客户端,
支持的媒体格式更多,实在需要 web 端的,结合转码配置参数和路由配置参数使用

#### 8.nginx 必须使用 host 网络吗?
不是必须的,只是方便处理和理解,因为 nginx 之前可能还有其他反代程序而没有传递客户端真实 IP 标头,
所以用 host 比较简单,能保证本 nginx=> MediaServer 传递的是客户端的真实远程 IP,
在 nginx 后如果直接就是原始媒体服务,MediaServer 就不需要 host 网络了,但是如果 nginx 前后还有其他的反代程序,
则它们都需要传递客户端真实 IP, 所需标头可以参考 proxy-header.conf 或 alist 文档中反代传递的标头,
假如流量链路 npm -> xxx2alist -> MediaServer 只需要在 npm 这里传递标头就行了,
这样 nginx 和 MediaServer 都可以用桥接网络不用改,这个配置同时也是做内网外识别用的,
如果用不到或者不在意 MediaServer 控制台中和 nginx 日志中的显示的客户端 IP 都是内网而不是真实远程 IP 的,也不用管这个配置了

#### 8.为什么需要识别内网网段的地址?
这个如果没有特殊需要可以不用管,选填项,目前两个地方用到了
1.有用户反馈内网环境走直链 Infuse 反而会更卡
```javascript
const routeRule = [
   // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["r.variables.remote_addr", 0, strHead.lanIp],
];
```
2.如果 strm 内部的远程链接为局域网的,转发给远程客户端访问不了,
所以做了内网的条件判断在 nginx 内网这层去获取 strm 内网链接 302 后的公网直链返回给远程客户端
```javascript
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)]
];
```

#### 8.允许转码功能但不需要分离转码负载,该如何配置?
```javascript
const routeRule = [
  ["transcode", "filePath", 0, "/mnt/sda3"], // 允许转码的文件路径开头
];
const transcodeConfig = {
  enable: true, // 允许转码功能的总开关
  type: "distributed-media-server", // 负载类型,只有这个实现了路由规则
  redirectTransOptEnable: false, // 302 的直链文件是否保留码率选择
  targetItemMatchFallback: "redirect", // 目标服务媒体匹配失败后的降级后路由措施
  // 如果只需要当前服务转码,enable 改为 true,server 改为下边的空数组
  server: []
};
```

#### 9.strm 文件的内容应该填写容器可以访问到的地址还是局域网可以访问到的地址还是公网可以访问到的地址?
效率最高的还是填远程客户端可以访问的公网地址,这样代码里几乎没做费时的处理,
但是如果需要 8.2 的处理,就必须保证 nginx 容器和 strm 内部的链接是可访问的,
普通情况下等同于局域网下,只要不是极端情况,例如 nginx 配置了 none 类型网络,
通过 link 和其他容器网络连接,这样就不是局域网了,而且问题估计也比较多,需要自行摸索

#### 10.strm 视频是使用内封字幕比较好还是外挂字幕
总的来说 内嵌字幕 > 内封字幕 > 外挂字幕,
这个是按客户端的播放形式分的,假如用官方修改版客户端还调用了外部的第三方播放器,
这样就是没法传递外挂字幕的地址了,所以播放内封字幕的更好,如果没有调用外部的第三方播放器,
官方客户端和第三方客户端都是支持外挂字幕的加载的,
内封字幕在第三方播放器都是直接播放没有任何影响,内封字幕问题只在官方客户端上存在的,
因为它要兼容的设备比较多,需要扫一个字幕流编码的提取,性能占用可以忽略不记,只占视频文件的 4 成左右,流量也还能接受,
这个提取内封字幕的功能印象中转码设置里可以关闭,但暂未测试过关闭的影响

#### 11.网盘或 strm 文件的转码播放成功率很低?
因为相比本地文件多出来走一遍服务转码的文件分块读取(下载)过程,如果转码的响应时间超过了 10 秒客户端就会主动断开请求,
断开后转码进度就清空重置了,然后客户端会重试转码,循环失败次数过多就直接报没有兼容的流了,
需要保证网络带宽和转码硬件的能力都跟上才能有个好的体验,使用条件太苛刻,
所以不建议对 strm 文件进行转码,且 jellyfin 对它的支持可能有bug,
偶尔会导致 playbackinfo 这个接口长达 30 秒,也就是进详情页也会调用这个接口查询

#### 12.emby/jellyfin 建议配置 https 吗?
不是必须的,但如果是国内家庭带宽出现跨运营商访问端口间歇性阻断,则建议配置,表现形式为访问和浏览详情页都没问题,但是播放视频时可能是因为接口带有 video/stream 等关键字被运营商拦截会卡住无法播放,切换到手机流量则一切正常,需要自行分析判断,注意配置 https 后直播内容如果是 http 的,默认会被浏览器拦截,需要换用对应平台客户端播放,自行取舍,[emby2Alist](./emby2Alist/README.md#2024/03/10)

#### 13.为什么日志名称叫 error.log,不会有歧义吗?
这是因为 nginx 官方的指令就是这个名称,猜测最初是做错误日志使用的,但是添加了 NJS 实现后功能以及指令遗留已经无法更改了,所以还是沿用这个名称,
日志中已经有错误等级实现了,所以忽略 error 这个名称,视作普通业务日志就行了

#### 13.为什么 strm 内部文本中文没有 encodeURIComponent 的情况下显示会乱码?
二选一,确保文件编码是 utf-8,或使用 encodeURIComponent 编码后填写,请注意路径乱码将导致 sign 计算错误

#### 13.为什么海报全部裂开?
因为走了 nginx 缓存,但是容器对映射的宿主机缓存目录没有权限,error.log 日志中会有 permission denied 关键字,
图形化目录映射上不要勾选只读,或在宿主机上手动给缓存目录读写权限, chmod -R 777 ../nginx/embyCache

#### 14.哪些地方配置需要注意的?
总的来说,只用关注,
```
/conf.d/constant.js
/conf.d/emby.conf
/conf.d/includes/http.conf
/conf.d/includes/https.conf
```
1.挂载文件直链的,
```
/conf.d/constant.js 中的必填项和 alistPublicAddr
```
2.只用 strm 文件的,
```
/conf.d/constant.js 中的 embyHost,embyApiKey
```
3.只用 http 的,
```
/conf.d/includes/http.conf 中 listen
```
4.需要 https 的,
```
/conf.d/emby.conf 中 # include /etc/nginx/conf.d/includes/https.conf; # 去掉 # 注释
/conf.d/includes/https.conf 中 listen 和 ssl_certificate 的两个
```
5.有转码需求的,
```
/conf.d/constant.js 中 transcodeConfig,routeRule
```
6.其余均为选填,参照文件内注释

以上为 /conf.d/constant.js 中为单体全量配置文件的,新版改为了默认拆分后的主文件,各配置填写至 /conf.d/config/constant-xxx.js 中,
/conf.d/exampleConfig/ 下的为两种配置文件风格的备份示例文件,改这里不生效的,任选一种复制并改名,替换 /conf.d/constant.js 文件

#### 15.外部播放器无法加载外挂字幕?
已做努力,但没有可用的统一解决方案,详情参见 [emby2Alist](./emby2Alist/README.md#2024/05/23)

#### 16.外部播放器没有回传播放进度?
已做努力,但没有可用的统一解决方案,详情参见 [emby2Alist](./emby2Alist/README.md#2024/05/23)

#### 17.无法直链播放原盘 BDMV 文件夹?
已做努力,但没有可用的统一解决方案,详情参见 [emby2Alist](./emby2Alist/README.md#2024/05/23)

#### 18.win 客户端播放 115 内容有时存在问题?
更新客户端为最新版本可以解决,不清楚原因

#### 19.局域网下可能存在绕过 nginx 处理的问题?
使用容器版 emby 并限定网络模式为桥接(bridge),只开放默认的 8096 端口出来,这样理论上能掐断客户端的 UDP 网络发现,
同时确保 设置 -> 服务器 -> 网络 -> 读取代理标头以确定客户端 IP 地址 选项不为 否,
更多参照 

[emby2Alist](./emby2Alist/README.md#2024/04/10)

https://github.com/bpking1/embyExternalUrl/issues/59#issuecomment-2036672011

#### 20.路由规则还有更多示例吗?
参考 routeRule 中的注释示例进行选择

1.nginx 变量示例,remote_addr 代表远程客户端真实 IP,此规则代表 192. 开头的远程客户端走原始服务处理(proxy)

```js
const routeRule = [
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  ["r.variables.remote_addr", 0, "192."], // 可为单字符串或数组内字符串,填自身实际情况,可以参照 strHead.lanIp, emby2Alist\nginx\conf.d\config\constant-common.js
];
```

2.播放接口的链接 Path 入参,此规则代表,同规则分组需要同时满足,逻辑 and, filePath 以指定字符串开头,且链接入参 UserId 匹配指定字符串,
filePath 本地文件是 / 开头的,远程文件将是链接协议开头的

```js
const routeRule = [
  // 注意这里省略了参数1,默认值为"proxy",参数2: 分组名,只是做标识的,可以理解为备注,可以随意填写
  ["iptv-user-proxy", "r.args.UserId", 0, "ac0d220d548f43bbb73cf9b44b2ddf0e"], // 链接入参,用户 ID,这里填自身实际情况
  ["iptv-user-proxy", "filePath", 0, "https://node1.xxx.com"], // 这里填自身实际情况
];
```

3.指定特定后缀文件由原始服务自己处理(proxy),其中的数字 1 是入库路径以字符串结尾的判断规则,3 是正则匹配,三选一,分开写或者合并在一起

```js
const routeRule = [
  ["proxy", "filePath", 1, ["theme.mp3", "theme.mkv", "theme.mp4"]],
];
const routeRule = [
  ["proxy", "filePath", 1, "theme.mp3"],
  ["proxy", "filePath", 1, "theme.mkv"],
  ["proxy", "filePath", 1, "theme.mp4"],
];
const routeRule = [
  ["proxy", "filePath", 3, /\/theme.(mp3|mkv|mp4)/ig],
];
```

# embyAddExternalUrl

#### 1.支持 plex 吗?
不支持,因为依赖详情页底部的外部媒体数据库链接接口,且这样是全客户端通用,
不是修改的 html 网页,客户端都是内置的静态网页,除了 emby/jellyfin 之外没有地方通过修改接口展示内容

# embyWebAddExternalUrl

#### 1.支持 plex 吗?
不支持,因为 emby/jellyfin 之前同源,所以布局方面和接口很相似,但是 plex 布局和接口完全不同,很难兼容

# [plex2Alist](./plex2Alist/README.md)

#### 1.部分可以参考 emby2Alist

#### 2.plex 必须配置 https 吗?
不是必须的,但是如果有 IOS 客户端就必须配置,因为该客户端强制禁止非 https 连接,
只能给 nginx 配域名和证书,conf 示例里有配置注释

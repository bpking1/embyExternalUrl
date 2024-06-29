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

#### 6.115 内容无法 Web 端播放(htmlvideoplayer 跨域)?
~~因 emby/jellyfin/plex 的 Web 内嵌播放器无法轻易干预,~~

更正,感谢 @lixuemin13 [#236](https://github.com/bpking1/embyExternalUrl/issues/236) 
提供的新思路,干预 htmlvideoplayer 的 <vedio> 标签可以实现

1.运行 shell 命令,先运行 cp 复制备份原文件为 _backup 后缀文件,/system 层级按自身实际情况修改
```shell
cp /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js_backup
```

2.再运行 sed 文本正则替换修改,以去除 emby 最终 <vedio> 标签中 crossorigin="anonymous" 属性,
注意这里更改的为 basehtmlplayer 全局的,包含视频和音频播放标签,仅需视频的参照 [#236](https://github.com/bpking1/embyExternalUrl/issues/236)
```shell
sed -i 's/mediaSource\.IsRemote&&"DirectPlay"===playMethod?null:"anonymous"/null/g' /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js
```
js 中的 mediaSource.IsRemote&&"DirectPlay"===playMethod?null:"anonymous 被替换为 null

3.浏览器控制台网络选项卡勾选 禁用缓存,刷新页面,在源代码选项卡中确认修改生效后取消勾选

4.可选验证结果,不太严谨,只取了 basehtmlplayer.js 倒数开始的 185 个字符,根据实际情况修改
```shell
tail -c 185 /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js
```
预期修改为
```js
BaseHtmlPlayer.prototype.getCrossOriginValue=function(mediaSource,playMethod){return mediaSource.IsRemote&&"DirectPlay"===playMethod?null:"anonymous"};_exports.default=BaseHtmlPlayer})
=>
BaseHtmlPlayer.prototype.getCrossOriginValue=function(mediaSource,playMethod){return null};_exports.default=BaseHtmlPlayer})
```

5.这个是 HTML 规范的 <vedio> 标签还有 HTTP 的规范的 CSP 有关,和 emby 版本关系应该不大,测试 beta V4.9.0.25 也是可以的
https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Sec-Fetch-Mode

以下为原始不完美方案,仅做记录和备用选择,
且 115 没有响应跨域支持,浏览器严格限制跨域内容,使用浏览器拓展的修改响应头 [emby2Alist](./emby2Alist/README.md#2023-12-31)
或者使用对应平台的客户端播放,
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
所以用 host 比较简单,能保证本 nginx => MediaServer 传递的是客户端的真实远程 IP,
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
// 目前路由规则可以不用配置了,默认遵循客户端自己的上报结果
// const routeRule = [
//   ["transcode", "filePath", 0, "/mnt/sda3"], // 允许转码的文件路径开头
// ];
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
所以不建议对 strm 文件进行转码,默认是禁用 strm 转码状态,可关闭 transcodeConfig.enableStrmTranscode = true,仅供调试使用,
且 jellyfin 对它的支持可能有bug,偶尔会导致 playbackinfo 这个接口长达 30 秒,也就是进详情页也会调用这个接口查询

#### 12.emby/jellyfin 建议配置 https 吗?
不是必须的,但如果是国内家庭带宽出现跨运营商访问端口间歇性阻断,则建议配置,
表现形式为访问和浏览详情页都没问题,但是播放视频时可能是因为接口带有 video/stream 等关键字被运营商拦截会卡住无法播放,
切换到手机流量则一切正常,需要自行分析判断,注意配置 https 后直播内容如果是 http 的,
默认会被浏览器拦截,需要换用对应平台客户端播放,自行取舍,[emby2Alist](./emby2Alist/README.md#2024/03/10)

#### 13.为什么日志名称叫 error.log,不会有歧义吗?
这是因为 nginx 官方的指令就是这个名称,猜测最初是做错误日志使用的,
但是添加了 NJS 实现后功能以及指令遗留已经无法更改了,所以还是沿用这个名称,
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
1.使用容器版 emby 并限定网络模式为桥接(bridge),只开放默认的 8096 端口出来,这样理论上能掐断客户端的 UDP 网络发现,
同时确保 设置 -> 服务器 -> 网络 -> 读取代理标头以确定客户端 IP 地址 选项不为 否

2.或者尝试防火墙禁止 emby 默认的 UDP 广播发现端口 7359,注意是 UDP,而不是 TCP 协议
https://dev.emby.media/doc/restapi/Locating-the-Server.html?q=UDP

3.更多参照

[emby2Alist#2024-04-10](./emby2Alist/README.md#2024-04-10)

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

#### 21.因为图片缓存导致更新海报不生效?
1.默认已经新增了指令 proxy_cache_bypass,自己编辑下该海报的访问接口添加 URL 参数 nocache=1,跳过该缓存后重新访问将覆盖旧缓存

2.自行编译配置 proxy_cache_purge 模块并打开 emby.conf 中注释并看情况修改实现,未实际测试过

#### 22.支持 emby API 的客户端播放 STRM 无法记录播放进度?
这个主要依赖于 emby 对 strm 媒体第一次播放后补充入库的媒体编码信息,表现形式为单集详情页下方的媒体信息中有没有视频的编码信息,
将导致 itemInfo 接口中的 RunTimeTicks 可播放毫秒值没有这个字段,所以以下情况是无法记录播放进度的

1.strm 内部文本为 / 开头的,这个属于脚本强行兼容支持的播放,emby 服务端不会进行补充信息

2.strm 内部文本为 http 开头的远程直链,只在第一次播放的时候估计也是没有编码信息的,
第一次播放后 emby 客户端都会报告媒体信息给 server 端进行补充媒体编码信息

可选解决方案

1.可退出后查看详情页下方有没有多出来媒体编码信息,然后再进行播放就是没问题的了

2.emby 插件库里有个貌似可以定时处理 strm 媒体信息的,设置-高级-插件-Catalog-元数据-StrmExtract,
我这边只是看到了,没有尝试过这个插件,需要自行摸索,但是这样其实 strm 又扫库了,虽然可能是定时可控可手动取消的,这点也需要自行权衡下

补充建议

1.StrmExtract 这个也大概率不支持自定义的内部 / 开头的 strm,故还是建议使用 emby 官方文档中 strm 的写法

2.Jellyfin 对于 strm 支持貌似有 bug,会导致播放时源服务的 PlaybackInfo 接口长达 30s 请求超时,
且没有 Emby 针对 strm 的第一次播放后补充入库媒体编码信息的处理,所以每次播放会长达 6-8s 且无播放进度记录,
故 Jellyfin 用 strm 时不建议使用官方客户端播放

3.Plex 基本和 Jellyfin 一样,更甚是官方客户端禁止了 strm 播放支持,虽然也是脚本强行兼容了播放,但也仅限于播放了,
进度和播放记录肯定是没有的,部分第三方播放器不用此脚本也能播放,其余和前文一样

#### 23.播放流程解析?
切入点

Emby/Jellyfin 全靠 PlaybackInfo 接口,但两者实现稍有不同,Emby 进入详情页和播放时都会请求 PlaybackInfo 接口,
两次区别为链接入参有个 IsPlayback 为字符串的 "false":"true",
Jellyfin 进入详情页会查通用的 Items 接口,只在播放时查询一次 PlaybackInfo 接口,

修改点

PlaybackInfo 这个里边的处理更多还是根据路由规则参数判断,
是否强制修改直接播放的服务端判断结果,少量有一段直播的 location 路由处理,

流程

完整流程是客户端发出 PlaybackInfo 请求到达 nginx 的 location ~* /Items/(.)/PlaybackInfo 上,
js 中的 transferPlaybackInfo 发送子请求到源服务(也就是实现反代,只请求了一次,没有多余请求,因为没走 nginx.conf 的 proxy_pass 反代实现),
然后 PlaybackInfo 请求到达源媒体服务内部处理,
NJS 实例等待返回结果(nginx 整体的超时时间这边并没有进行配置,从其他人 issus 中得知 nginx 全局默认 60s 超时),
源服务响应成功的状态后,根据 transferPlaybackInfo => modifyDirecPlayInfo 中 source.IsInfiniteStream 判断修改 source.DirectStreamUrl 直接播放链接,即构造 location 的路由

1.直播走 location ~* /videos/(.)/master 块,然后就是 embyLive.directLive 中 302 到直播 IPTV 源地址的处理了

2.普通媒体文件走 location ~* /videos/(.*)/(stream|original) 块,然后就是 emby2Pan.redirect2Pan 中 302 到直链的处理了

流程失败情况

1.反代响应等待失败会回退到源服务处理,其实这种失败情况还是把 PlaybackInfo 到源服务又走了一遍,假如源服务依旧无法响应,也同样会卡住导致后续 NJS 处理失败

2.还有一种失败是源服务响应回的非 200 状态失败,这种 NJS 会传递源服务的失败结果给客户端,不会导致流程链路断掉

#### 24.NJS 中出现了很多子请求是干什么的?
为了实现自定义反代功能,其次不会影响 nginx 的性能和效率,客户端请求只到达了 nginx,不发子请求是不会从 nginx 到达源服务的,
也就是请求从客户端出发只走了一遍,很多人对这个过程觉得是多走了一遍,是不对的,
注意仔细查看 conf 中条件分支,NJS 处理的基本都没有走 proxy_pass 反代实现,
这里补充总结下 nginx 实现反代修改响应体的已知 4 种方式

1.conf 中的 proxy_pass 指令,nginx 内部基于 C 实现的,也是最常用的方式,但自定义不足很依赖 nginx 其他指令配合才能修改数据

2.conf 中 js_body_filter 指令,nginx 基于 NJS 实现,依赖 proxy_pass 指令进行反代请求,
注意只是请求,响应体是自定义的,响应头官方推荐在 conf 中使用指令修改,
只有 r.sendBuffer(data.toLowerCase(), flags); 时才是手动放行响应数据,故此指令只是修改数据使用,
限定了只能调用同步方式,且方法是根据分块缓冲区被循环调用的,依赖 flags.last 参数 true 来识别最后的分块,
局限性太强且使用繁琐,并不是不推荐使用,需要在特定环境下用反而会更简单

3.conf 中 js_content 指令,nginx 基于 NJS 实现,自定义程度最大,反代的请求和响应均需要自己实现,且与 proxy_pass 解耦,支持异步方法,
r 对象没有重定向或返回的情况下,客户端请求是断在 NJS 这里了,十分注意并没有请求源服务!!! 这里有三种实现反代请求的方式

3.1 r.subrequest(),子请求,只继承源请求的头部信息,这个注意看官方文档,有很多注意事项,这里只提一点,该子请求同样会走 location 匹配,
不会死循环, NJS VM 会强制报错处理,正常使用需要自定义 location 来放行处理,且拿到子请求响应后需要自行构造新的主请求响应体和响应头,
十分注意不要忘了响应头的处理,就算不是分离的子请求,主请求响应头也是空的

3.2 ngx.fetch(),HTTP 请求,和 subrequest 不同之处在于没有依赖关系且不受 location 匹配拦截,
具体也是查看官方文档,需要注意 DNS 解析,和 HTTPS 的证书处理,且响应对象是不同的类型,同样需自行构造响应对象

3.3 r.internalRedirect(uri),NJS 的内部重定向到 location,依赖 conf 中的 proxy_pass 指令

3.4 r.return() 和 r.sendXXX,单纯 NJS HTTP 响应信息,不算反代,要实现反代需结合上述方案

4.使用 lua 脚本来实现,建议参考 OpenRestry

#### 24.如何避免频繁扫库?
可以避免但是会有副作用,没扫描媒体信息入库会导致以下已知问题,

1.没有可播放时长信息表现为点击播放直接标记为了已播放,没有进度记录信息或部分客户端进度跳转有 bug

2.详情页中没有媒体的编码信息,虽然已知影响不大,但不确定是否还有其他影响

实现方式已知的有 3 种,后 2 种偏门方法为网友提供,多谢思路

1.emby/jellyfin 官方文档中支持的 STRM 文件方式,优势可能为官方支持吧,缺点是批量补充媒体信息依赖插件库中插件,
不局限为 http 协议,plex 的话因官方不支持,脚本强制做了支持但已知有上述问题

2.软/硬链接文件结合挂载工具,在扫库前切断链接文件和源文件的联系,扫完后恢复链接文件,切换过程仅为路径的卸载和挂载,
优势是在有工具的情况下操作简单且事后需要单独扫指定媒体信息可以手动限定范围不依赖其他插件,缺点是部分依赖源文件的存在

3.虚拟占位空文件,CMD 下 copy nul "C:\Program Files (x86)\test.mkv" 生成 1 KB 的 test.mkv 空文件,
也可用在 nas-tools 等快速刮削上,shell 下可能是换 touch 命令,没啥优势且肯定无法转码了,毕竟是假文件

3.1 以下只是理论,没实践过,利用 alist 的地址树驱动,添加假的媒体文件

3.2 直接往 SQLite 插入假数据,前提是文件必须存在,不然会被服务端视作失效自动移除,没优点且风险较大

#### 24.阿里网盘非会员限速?
最正规肯定是支持正版开会员解决,这里只是记录几个当前限速规则下的网速最大化的理论解决方案,没有实际测试过,
部分限速细节参考,[emby2Alist](./emby2Alist/README.md#2024-06-16)

1.尽量选择支持多线程播放的客户端,多线程总限速 3MB/s 播 1080P 是没太大问题的,或客户端下载后再播放咯

2.这个不一定有效,chrome 内核浏览器新版默认就是多线程下载,老版本可以 flags 中开启

3.对于不支持多线程的播放器,单线程限速 1MB/s,依赖挂载工具的多线程实现,路由规则中配置特定 UA 走 proxy 代理中转来兼容,
或使用 alist 自身的代理中转功能

```js
// 路径映射,会在 xxxMountPath 之后从上到下依次全部替换一遍,不要有重叠,注意 /mnt 会先被移除掉了
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的
// 参数3: 来源, 参数4: 目标
const embyPathMapping = [
  [0, 0, "\", "/"], // win 平台打开此项
];
```

# embyAddExternalUrl

#### 1.支持 plex 吗?
不支持,因为依赖详情页底部的外部媒体数据库链接接口,且这样是全客户端通用,
不是修改的 html 网页,客户端都是内置的静态网页,除了 emby/jellyfin 之外没有地方通过修改接口展示内容

#### 2.支持 TV 端吗?
不支持,Jellyfin TV 端直接没有外部数据库链接这个区域,Emby TV 端虽然可以添加显示出来,但是电视是没有浏览器的,且内置 WebView 没有支持 URL Scheme 的处理,所以也是无法调用外部播放器的

# embyWebAddExternalUrl

#### 1.支持 plex 吗?
不支持,因为 emby/jellyfin 之前同源,所以布局方面和接口很相似,但是 plex 布局和接口完全不同,很难兼容

# [plex2Alist](./plex2Alist/README.md)

#### 1.部分可以参考 emby2Alist 和 issues#59
https://github.com/bpking1/embyExternalUrl/issues/59

#### 2.plex 必须配置 https 吗?
不是必须的,但是如果有 IOS 客户端就必须配置,因为该客户端强制禁止非 https 连接,
只能给 nginx 配域名和证书,conf 示例里有配置注释

#### 3.plex web 客户端很多无法播放?
PlexWeb 自身存在很多问题,不支持 DTS 的直接播放,不支持所有非内嵌字幕的直接播放,开启允许转码或使用对应平台客户端

#### 4.plex 客户端播放问题?
1.官方客户端很多视频格式和音频格式不支持,设置 - 播放 - 勾选外部播放器(其实也是官方内置的 ExoPlayer) - 音频中勾选 DTS 的支持,
如果发现 DTS 无法选中,取消勾选外部播放器,再勾选外部播放器,多切换几次,是客户端自身 bug

2.官方客户端部分样式的字幕无法显示,和字幕格式没太大关系,ASS/SRT 都是支持的,换简单格式的字幕,尽量找不要特殊字体或太多特效的字幕,
官方客户端支持很差,开启允许转码,或换用第三方客户端播放

#### 5.plex 为何大量 API 进行了反代?
大量播放链接走的直接是 part 的请求,这个单独的 URL 中是没有任何能获取文件路径的办法的,
location ~* /library/parts/(\d+)/(\d+)/file ,/metadata/ 这个是客户端单独的请求,
多线程请求下都是分离的,无法关联使用,/metadata/ 的 media 和 parts 这两个对象是一对多的树结构,
plex 没有提供直接查询 part 这个子节点信息的接口且 /library/parts/(\d+)/(\d+)/file 链接中做了类似于混淆的处理,
没有任何实际含义,两串数字只是文件的修改时间戳,要么查询 sql lite 数据库,
要么就是目前的处理 /metadata/ 之类的接口以缓存此结构中树的子节点 part 的文件路径信息,
为了提升效率,缓存中并没有维护 metadata 和 parts 的关联关系,表现形式为只缓存了 part 的路径信息,因为此脚本只关注这个信息,
记录下尝试过的已知方案,考虑到移除挂载 plex 的 SQLite 文件的依赖,目前选取的方案 4 进行实现

1.原作者的实践处理方案,直接使用其他语言进行查询 plex 的 SQLite 数据库文件来一劳永逸,可以延申出以下理论方案,但是并没有实践过

1.1 NPM 中有用 JS 直接查询 SQLite 的包 sqlite3,参考 https://nginx.org/en/docs/njs/node_modules.html 进行实现

2.尝试过用 media 的 id: 308 和 metadata 的 id: 307 的偏移差来估算关联,plex 对象树层级大致为 metadata > media > part,
数据量少的特定情况下,metadata.id ~= media.id, part.id 在没有多版本视频情况下也是近似或相等的,
所以初期尝试过偏移量直接认定为整库中多版本视频的套数然后 +- 10 的偏移修复量进行实时撞接口处理,直到撞到响应状态 200 的接口,
故此种方案十分不可靠,已废弃并移除了处理代码,且 media.id 并不是严格的视频量递增 id,预告片或者特定的演员也属于 media 对象,
具体查询 plex 的 SQLite 数据库文件进行理清表关系和 id 分配方案

3.part 的关键字已经使用 API 工具进行 URL 的穷举试过了,没有直接查询 part 信息的接口, media 关键字同样如此,只有 /library 接口,
/library/parts/308/1718463720/file.mkv 链接中 308 是 media 对象的 id,1718463720 是 part 的修改时间戳,该接口直接返回二进制流,
没有任何有效信息和 metadata 能关联上,包括请求头和响应头中同样没有

4.直接反代所有包含 part 信息的请求,然后通过 nginx 配置的 js_shared_dict_zone 共享内存缓存 part 的文件路径在多线程的多 NJS VM 中共享,
当然会有非必要的 part 文件路径被缓存,但这点内存占用和反代性能几乎可以忽略不计,且缓存的添加也是做了重复时跳过的处理的,
纯 http API 实现,唯一问题是 js_shared_dict_zone 指令是在 NJS 0.8.0 才被添加的,故对 NJS 版本有了最低限制,需要 nginx:latest

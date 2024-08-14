# [emby2Alist](./emby2Alist/README.md)

#### 1.如何确定 mediaMountPath 的路径填写?
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
// 所以我的 mediaMountPath 填,也就是挂载工具多出来的目录所代表的 alist 的根目录的 / 的路径
const mediaMountPath = ["/AList"];
```
如果挂载的路径映射情况比这更加复杂,就需要这个参数来做路径字符串的映射了,然后 mediaMountPath 置空
```javascript
const mediaMountPath = [];

// 路径映射,会在 mediaMountPath 之后从上到下依次全部替换一遍,不要有重叠
// 参数1: 0: 默认做字符串替换, 1: 前插, 2: 尾插
// 参数2: 0: 默认只处理/开头的路径且不为 strm, 1: 只处理 strm 内部为/开头的相对路径, 2: 只处理 strm 内部为远程链接的
// 参数3: 来源, 参数4: 目标
const mediaPathMapping = [
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
提供的新思路,干预 htmlvideoplayer 的 <video> 标签可以实现

一.新版 conf 中已经默认反代替换实现了,首次需要 二.3 中类似的清空下缓存再试,
感谢 @Akimio521 [#64](https://github.com/chen3861229/embyExternalUrl/issues/64) 

二.以下服务端持久化修改

1.运行 shell 命令,先运行 cp 复制备份原文件为 _backup 后缀文件,/system 层级按自身实际情况修改
```shell
cp /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js /system/dashboard-ui/modules/htmlvideoplayer/basehtmlplayer.js_backup
```

2.再运行 sed 文本正则替换修改,以去除 emby 最终 <video> 标签中 crossorigin="anonymous" 属性,
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

5.这个是 HTML 规范的 <video> 标签还有 HTTP 的规范的 CSP 有关,和 emby 版本关系应该不大,测试 beta V4.9.0.25 也是可以的
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
// 还是需要手动指定下,默认遵循客户端自己的上报结果走转码,但无上报且无配置默认还是直链行为
const routeRule = [
  ["transcode", "filePath", 0, "/mnt/sda3"], // 允许转码的文件路径开头
];

const transcodeConfig = {
  enable: true, // 允许转码功能的总开关
  type: "distributed-media-server", // 负载类型,只有这个实现了路由规则
  redirectTransOptEnable: false, // 302 的直链文件是否保留码率选择
  targetItemMatchFallback: "redirect", // 目标服务媒体匹配失败后的降级后路由措施
  // 如果只需要当前服务转码,enable 改为 true,server 改为下边的空数组
  server: [],
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
0.以下只针对多设备共用一份 nginx 缓存设置的情况,缓存是多级的,已知有

0.1 客户端缓存/浏览器缓存,这个在返回了协商缓存头之后无法控制,浏览器可打开控制台网络选项卡勾选禁用缓存

0.2 nginx 缓存,以下是针对此环节的,可控

0.3 emby 服务端缓存,外部系统,无法干预控制

这里强调下 AI 给出的解释, ningx 缓存内部也是基于此原则设计的,
这是HTTP缓存机制中的一个重要原则,被称为“强制缓存”或“硬缓存”.当客户端（通常是浏览器）从服务器接收到响应时,如果响应中包含了适当的缓存控制头（如Cache-Control或Expires）,则客户端会在缓存数据未过期的情况下直接使用缓存副本,而不会向服务器发送新的请求

1.默认已经新增了指令 proxy_cache_bypass,自己编辑下该海报的访问接口添加 URL 参数 nocache=1,跳过该缓存后重新访问将覆盖旧缓存,
受限于 nginx 的更新缓存模块(proxy_cache_purge)为收费的,有第三方编译的免费的,但是这样增加了复杂度,
所以这个折中操作目前稍显麻烦且批量起来麻烦,批量建议直接清空缓存目录来得简单,因为缓存默认只有 30 天,影响不大,
以下为不清空缓存目录的单条覆盖更新缓存的具体操作步骤

1.1 使用可以打开控制台的浏览器,切换到网络选项卡,找到此封面的接口地址,类似于
https://xxx:8096/emby/Items/437905/Images/Primary?tag=7c509b30054f211a73bcd9f4ad7ab02a&quality=90&maxWidth=251

1.2 然后将此地址手动添加跳过缓存的参数,nocache=1
https://xxx:8096/emby/Items/437905/Images/Primary?tag=7c509b30054f211a73bcd9f4ad7ab02a&quality=90&maxWidth=251&
nocache=1

1.3 将新地址放到新标签页中访问一下,然后再刷新原标签页的页面,就会覆盖掉旧缓存了

2.自行编译配置 proxy_cache_purge 模块并打开 emby.conf 中注释并看情况修改实现,未实际测试过

3.参考[FAQ#28](./FAQ.md#28搜索栏交互性指令如何使用)

4.以上几种解决方案都只能管控 nginx 缓存,假如还是被客户端缓存干预,还是建议直接清空缓存目录来得简单,
进一步如果客户端还存在未失效缓存,直接重装客户端

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

#### 25.如何避免频繁扫库?
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

#### 26.阿里网盘非会员限速?
最正规肯定是支持正版开会员解决,这里只是记录几个当前限速规则下的网速最大化的理论解决方案,没有实际测试过,
部分限速细节参考,[emby2Alist](./emby2Alist/README.md#2024-06-16)

1.尽量选择支持多线程播放的客户端,多线程总限速 3MB/s 播 1080P 是没太大问题的,或客户端下载后再播放咯

2.这个不一定有效,chrome 内核浏览器新版默认就是多线程下载,老版本可以 flags 中开启

3.对于不支持多线程的播放器,单线程限速 1MB/s,依赖挂载工具的多线程实现,路由规则中配置特定 UA 走 proxy 代理中转来兼容,
或使用 alist 自身的代理中转功能

#### 27.nginx 需要配置限流参数吗?
这个根据自身承受范围调整,115 强烈推荐套一层 alist 限流可避免网盘熔断,特点是超限请求会排队执行并不会丢弃,具体参考,
[emby2Alist#2024-04-05](./emby2Alist/README.md#2024-04-05)
,因 alist 限流仅限 115 且不认 IP,毕竟这不是它的本职,这里讲下 nginx 的限流补充方案,可根据远程客户端的真实 IP 地址进行精细化限流,
当然有一定网络配置前提,[FAQ.md#8](./FAQ.md#8nginx-必须使用-host-网络吗),
```
limit_conn: 限制单个 ip 建立连接的个数,注意此种超限直接丢弃请求返回 503 错误
limit_req: 限制单个 ip 请求的个数(请求频率),这个可以配置突发请求个数,超限请求排队执行
# limit_rate: 限制下载速度,只针对 proxy 有效,302 无效,仅记录区别
```
以上两种可结合使用,放置在出现了 js_content emby2Pan.redirect2Pan; 的 location 块中, conf 中添加了一些示例,
具体如何配置随便问下 AI 就行了,很简单且参考资料很多,这里提一个误区,例如想实现限制每天只允许 5 个 IP 访问,
这种过于宽泛的条件很复杂且没必要,建议简单使用两个内置指令就够了,硬要实现的自行结合 js_shared_dict_zone 手动计数,
以下只是个人觉得够用了,根据心理可承受范围自行调整,我只用了 alist 限流并没有使用 nginx 限流且是 115,
从 emby 走的 302 限制为并发时间内最大 5 个 IP 同时连接,细化到请求数,单 IP 1s 内只允许 1 个请求,激发请求等待队列 5 个,
超限的默认 503 返回直接丢弃

./nginx/conf.d/emby/plex.conf
```
## ReqLimit, the processing rate of requests coming from a single IP address
limit_req_zone $binary_remote_addr zone=one:1m rate=1r/s;

## ConnLimit, the number of connections from a single IP addres
limit_conn_zone $binary_remote_addr zone=one:1m;

location ~* /videos/(.*)/(stream|original) {
  limit_conn one 5;
  limit_req zone=one burst=5;
}
```

#### 28.搜索栏交互性指令如何使用?
首先需要持久性配置文件中开启,searchConfig.interactiveEnable = true,然后客户端搜索栏中输入特定指令即可,
实现的目的是快捷临时性操作,不建议实现持久性功能,目前仅支持临时跳过缓存,
注意指令为[]内的字符串,开启/关闭结果会返回虚拟搜索结果来简单提示,
未作权限校验~~和用户隔离,因为只有一个跳过缓存指令,影响不大~~,后期如果实现其他临时操作,需要校验上游接口返回 200 后再执行操作,
已做用户隔离参数,参照 searchConfig.interactiveEnableRule 注释配置

0.全指令和值默认均为字符串,不用考虑单/双引号包裹,客户端输入框停止 1 秒后会自动触发搜索,假如指令输完没响应,手动加个空格再删除空格再次搜索

0.1 非必填,等号(=)用于指定一些入参值

0.2 非必填,英文冒号(:)用于指定该临时操作的持续秒数,该值只在 NJS >= 0.8.5 生效,其余默认 60 秒

1.[/nocache]: 默认在 60 秒内跳过 nginx 缓存,到期自动关闭,注意此行为只影响 nginx,客户端/上游服务缓存属于外部系统,无法干预

1.1 [/nocache:整数]: 整数 < 1 手动关闭跳过 nginx 缓存, 整数 > 0 设定跳过 nginx 缓存持续秒数,到期自动关闭

2.[/open docs]: 默认在 60 秒内允许上游服务 docs 访问,此参数到期自动失效,此时的值取决于 config 中的持久化配置

2.1 [/open docs:整数]: 整数 < 1 手动失效此临时参数, 整数 > 0 设定此参数持续秒数

3.[/help]: 展示一些简单提示

4.[/show dict zone state]: 展示 ningx 内存共享缓存各字典数目,即路由缓存/直链缓存

4.1 [/clear dict zone[=字典名]]: 清空路由缓存/直链缓存,不加 =字典名 同时清空多级路由缓存,只允许指定路由缓存字典名

#### 29.软链接注意点?
1.指定需要获取符号链接真实路径的规则,优先级在 mediaMountPath 和 routeRule 之间,
注意会被 const mediaMountPath = ["/mnt"]; 先移除了 /mnt 路径层级

2.symlinkRule 参数仅在软链接后的文件名和原始文件名不一致或路径差异较大时使用,
不使用 symlinkRule,其余情况建议用 mediaPathMapping 做路径映射效率更高,不走文件系统查询

3.使用 symlinkRule,软链接的目录/文件挂载到 docker 容器目录中暂时需要遵循 emby 中的媒体入库路径的层级,不能少了或多了层级

4.使用 symlinkRule,在 WSL 等跨文件系统风格上存在 bug, 需保证 cd2/rclone + emby + nginx 这三者与文件系统交互的组件使用 docker 部署
参考: https://github.com/chen3861229/embyExternalUrl/issues/53

#### 29.emby 下载功能注意点?
1.emby 对于和 web/PC 端的下载使用简单的 ItemsDownload 接口, jellyfin 客户端也是如此

2.SyncApi 属于与 jellyfin 分家后实现的私有收费功能,仅在移动端上使用,两种下载方式脚本都做了重定向支持

2.1 SyncApi 原服务设计上就有很多 bug, 需要等待 emby 服务端官方修复,
脚本只重定向了 GET /emby/Sync/JobItems/57437/File?api_key=xxx HTTP/2.0" 302 这一个 API,
服务端上前置有同步下载任务状态机制和队列控制,且有多因素多接口影响,已列队 => 准备传输,进入这个状态,才允许客户端发送上述请求开始下载

2.2 如果通知栏没有出现正在下载的通知,检查 2.1 中提到的状态机制,即查看服务端下载选项中的任务队列状态,
客户端这边可尝试杀进程重开 app 多触发几次,然后如果单次下载的任务太多,需要等几十秒才会开始

2.3 不必担心多任务下载的并发问题,客户端同时只会有三个任务项目传输,暂未找到设置的地方,
下载的表现形式为会创建任务所有项目的 0 KB 空文件占位,如果剧集是 emby 合并过的,客户端这边会出现多个不同的剧集文件夹,
暂不清楚单任务项目的多线程下载情况,反正 115 是没问题的,猜测 0 < 下载线程 <= 2

2.4 注意移除了单个任务,服务端实时生效,但客户端任务列表里的不会消失,会一个个请求 emby 服务端返回 404 和 500 依次失败弹出通知栏,
比较烦,推荐单个任务中项目不要添加太多的队列了,即单次下载单季剧集

2.5 查看 emby 调试日志,普通 ass/srt 字幕会走隐式的转换任务,报错之类的,看信息大概是 emby 服务端自身的 bug 了,
只是外挂的字幕文件下载到客户端设备失败,但是并不影响客户端内的播放,
前提是有网络,播放时会走网络重新附加显示外挂字幕,断网状态和走外部播放器就无解了

2.6 服务端设置 => 设备 => 下载 => 设置 => 启用全速转换,暂不清楚这个选项是否能加速任务的准备队列,
没有实际对比测试过,单纯只是服务端禁用了所有用户的转码权限,且知道这个下载过程并不会走转换任务/转码

2.7 客户端推荐设置,下载位置 => 外部存储器(Downloads),不要用默认的内部存储器,高版本安卓非 root 应用无法读取下载后的文件

参考: https://github.com/bpking1/embyExternalUrl/issues/284

#### 30.redirectStrmLastLinkRule?
历史遗留原因,包括所有非 / 开头的远程链接,且只获取了一次重定向地址,没有进行跟随重定向,跟随重定向由客户端自己完成,
这个规则不仅限于控制 STRM 文件内部的链接,在经过 mediaPathMapping 映射后,
目标远程链接地址可能为任意,例如自行拼接的 cd2 访问链接,其它 alist 访问链接,其它种类直链提供服务...

0.这里存在一个小歧义, 所有的示例参数中 X-Emby-Client 为 emby 兼容客户端才会上报,为空时将会导致判断结果出错,
使用这个纯粹是因为找匹配值比较简单,直接在 emby 设置 => 设备,页面中可视化查找,
出错时需要手动改为"r.headersIn.User-Agent"使用通用的客户端标识判断,UA 匹配值在日志中找或互联网搜索,
emby2Alist/nginx/conf.d/config/UA.txt 中记录了一些简单的 UA 值,可自行添加或修改

1.默认开启了检测到待响应的目标链接为内网字符串头开始的,命中此规则,不需要或有 bug 的手动注释关闭
```js
// 指定是否转发由 njs 获取 strm/远程链接 重定向后直链地址的规则,例如 strm/远程链接 内部为局域网 ip 或链接需要验证
// 参数1: 分组名,组内为与关系(全部匹配),多个组和没有分组的规则是或关系(任一匹配),然后下面参数序号-1
// 参数2: 匹配类型或来源(字符串参数类型),默认为 "filePath": mediaPathMapping 映射后的 strm/远程链接 内部链接
// ,有分组时不可省略填写,可为表达式
// 参数3: 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
// 参数4: 匹配目标,为数组的多个参数时,数组内为或关系(任一匹配)
const redirectStrmLastLinkRule = [
  [0, strHead.lanIp.map(s => "http://" + s)],
  // [0, alistAddr],
  // [0, "http:"],
  // 参数5: 请求验证类型,当前 alistAddr 不需要此参数
  // 参数6: 当前 alistAddr 不需要此参数,alistSignExpireTime
  // [3, "http://otheralist1.com", "sign", `${alistToken}:${alistSignExpireTime}`],
  // useGroup01 同时满足才命中
  // ["useGroup01", "filePath", "startsWith", strHead.lanIp.map(s => "http://" + s)], // 目标地址
  // ["useGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];
```

2.emby/jellyfin 针对 strHead.xEmbyClients.seekBug 数组中的特定客户端类型标识开头的,注意此条做了取反逻辑,
同时满足目标地址开头,则脚本获取该重定向后地址响应给客户端进行重定向
```js
const redirectStrmLastLinkRule = [
  // useGroup01 同时满足才命中
  ["useGroup01", "filePath", "startsWith", strHead.lanIp.map(s => "http://" + s)], // 目标地址
  ["useGroup01", "r.args.X-Emby-Client", "startsWith:not", strHead.xEmbyClients.seekBug], // 链接入参,客户端类型
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];
```

3.plex 针对 Infuse seekBug 的特定 User-Agent 标识开头的,注意此条做了取反逻辑,
同时满足目标地址开头,则脚本获取该重定向后地址响应给客户端进行重定向,
这里注意其实客户端最终都是跟随重定向后到网盘商公网直链上的,区别仅在第一次访问的链接不同,
虽然理论上一样的,但 Infuse 避免拖动进度条报错 bug 就是首次只能访问非网盘商公网直链上,
暂不清楚原因,且这样配置了偶尔还是会有拖动进度条 bug,
这个暂时无解,可能属于 Infuse 内部对于播放链接的多线程或 Range 头的的 bytes
```js
const redirectStrmLastLinkRule = [
  // useGroup01 同时满足才命中
  ["useGroup01", "filePath", "startsWith", ["https://youdomain.xxx.com:88"]], // 目标地址
  ["useGroup01", "r.headersIn.User-Agent", "startsWith:not", ["Infuse"]], // 链接入参,客户端 UA
  // docker 注意必须为 host 模式,不然此变量全部为内网ip,判断无效,nginx 内置变量不带$,客户端地址($remote_addr)
  // ["useGroup01", "r.variables.remote_addr", 0, strHead.lanIp], // 远程客户端为内网
];
```

#### 31.路由缓存有效期?
conf 配置文件中默认写的 15 分钟,关键字 routeL1Dict 有三层缓存,L3 缓存暂未实现,
手动更改 timeout 时最好同时改三个,包括被注释的 routeL3Dict,
填写判断依据为水桶短板,例如默认的 15 分钟是因为之前阿里云盘言而无信,将 OpenAPI 中说的 2 小时有效期私自改为 15 分钟,
当时导致缓存后的直链经常失效,目前阿里的有效期是 > 15 分钟的,具体设置多少,需要按自身实际情况填写,可以逐步增加时长测试,
这里提一个仅用 115 的情况,简单测试情况下,没有考虑 CDN 的变动,当前直链有效期为 12 小时,鉴于 UA 隔离导致直链缓存命中率不高,
建议立即改为 timeout=12h 以提升利用率,假如有失效的直链需要清空缓存,一是重启 nginx,重载配置文件是无效的,二是使用搜索栏交互性指令

#### 32.embyHost?
建议填写为正规软硬路由分配的局域网 ip,群晖用户千万不要使用 docker 默认的 172.17.0.X,有用户反馈群晖 docker 网桥反代不稳定的问题,
经常是导致 nginx 请求上游服务超时, error.log 中很多 upstream time out 之类的关键字,
还有一个问题是群晖 docker 容器重建后网桥分配的 ip 会发生变化,所以填路由器分配的局域网 ip 是静态的和 mac 地址绑定,
所以需要换为路由器等稳定设备的局域网 ip, 例如小米路由器是 192.168.31.1 网段, NAS 分配的是 192.168.31.200,
所以 const embyHost = "http://192.168.31.200:8096"; 会更加稳定

#### 33.匹配表达式?
1.注释中的匹配表达式非 r 开头的均为特殊来源,例如"filePath": 文件路径(Item.Path), "alistRes": alist返回的链接

2.1 匹配表达式取值来源均位于 {Object} r nginx objects, HTTP Request, 具体可参考 nginx docs 的 NJS 章节

2.2 新增的 r.xMediaSource 为自定义拓展对象,代表 emby 的 MediaSource 单个对象,注意不是数组,
具体取值可查看 PlaybackInfo 接口的返回值,注意此变量对于路由规则仅支持判断 PlaybackInfo,
假如非官方客户端不遵守 PlaybackInfo 返回结果,直接访问串流接口,此条路由规则将失效

3.匹配符原始为一个简单的数字类型索引,仅支持字符串匹配,后续因新增了数值比较,匹配符变为了字符串类型,
为方便排查日志,历史配置的匹配符也建议改为字符串类型,支持的匹配符见: util.js => MATCHER_ENUM,
"startsWith:not": 为结果取反逻辑

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

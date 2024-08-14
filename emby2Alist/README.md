---
title: emby/jellyfin挂载alist转直链
date: 2021/09/06 22:00:00
---

### 文章更新记录 

#### 2024-08-14

1.升级全体匹配表达式的匹配符类型以增加数值比较

2.emby/jellyfin 路由规则添加了 r.xMediaSource 对象,以支持码率/媒体时长/媒体大小...之类的判断,不过需要注意原始数值的单位

#### 2024-08-04

1.为 mediaPathMapping 添加生效分组规则,需要注意假如规则中有 UserId 或 X-Emby-Device-Id 之类缩小了范围的,
此时 routeCacheConfig.keyExpression 路由缓存表达式也需酌情缩小范围,区别为直链缓存范围大命中率高,默认仅按媒体版本区分,
不缩小范围会导致头一个设备访问添加了直链缓存后,后续该相同版本的媒体将跳过 mediaPathMapping 处理直接返回缓存的直链

#### 2024-07-25

1.修复 ngx.fetch API 没传递 Host 头导致的端口丢失

#### 2024-07-18

1.修复 routeRule 分组规则的错误判断

2.添加 help 和 dict zone 的搜索栏交互指令

#### 2024-07-16

1.图片缓存策略添加关闭 nginx 缓存功能,已缓存文件不做处理,不需要的历史缓存文件需要手动删除,
网盘挂载环境的注意开启 emby 媒体库中的设置,在服务器的元数据文件夹中保留图像的缓存副本,并自行留意回源情况

#### 2024-07-15

1.clientSelfAlistRule 添加分组,修复 redirectStrmLastLinkRule 分组

2.升级 util.strMatches 以支持字符串形式指定取反操作,不影响历史的数字类型参数,但后续建议使用字符串形式以增强可读性

#### 2024-07-14

1.redirectStrmLastLinkRule 添加分组

#### 2024-07-13

1.临时交互性指令添加用户隔离参数

2.提前适配 NJS 0.8.5 的 SharedDict.add 的 timeout 参数,截止当前 nginx:latest 镜像中内置 NJS 仅为 0.8.4

#### 2024-07-11

1.新增临时跳过 nginx 缓存的搜索栏交互性指令

#### 2024-07-09

1.去除 mediaMountPath empty 情况的默认走源服务中转,具有二义性,无法区分是未填写还是需要 mediaPathMapping 手动处理,
可选优化方向为对比路径映射前后的是否相同,来进一步区分,但仍旧存在未知性,可能不符合实际情况,
故回退到之前的需要 routeRule 路由规则手动指定比较稳妥

#### 2024-07-03

1.conf 中排除 HEAD 请求的重定向,以修复 115 跨域导致的主题音乐/视频自动播放失败的问题

1.1 主题曲自动播放会先 HEAD 请求一下,但是不论结果,404 或 200,
都会将 emby 地址放入 audio 标签 src 内,由 HTML 继续发送 GET 请求

1.2 该修复并不能直接支持跨域,允许跨域参照[FAQ#20](../FAQ.md#6115-内容无法-web-端播放htmlvideoplayer-跨域)
,因修复后,HEAD 走的是源服务,之前走的是直链,所以 HEAD 取的响应头有差异,假如引发其它问题,手动去除 conf 中所有新增的以下代码

```
if ($request_method = "HEAD") {
    proxy_pass $emby;
    break;
}
```

1.3 假如需要指定此类特定文件不走直链,走源服务中转,参照路由规则配置,
[FAQ#20](../FAQ.md#20路由规则还有更多示例吗)

#### 2024-06-30

1.transferPlaybackInfo 再进一步遵循开启了允许转码参数的时候,
视为倾向于播放成功率,不在意直链成功率,脚本中不去干预客户端自身上报为要转码的行为了,
也就是除去 TranscodeReasons=ContainerBitrateExceedsLimit 情况下可以官方客户端手动选择最大码率切换回直链,
其余情况严格遵循官方默认行为,无法切换回直链,开启了允许转码参数的情况下倾向于直链的只能使用对应平台客户端,
再次强调 web 客户端不支持高规格音频,非常见字幕格式,大部分视频封装容器,所以一定会走转码,
transcodeConfig.enable = false,的默认值情况和之前脚本逻辑一致,全部直链并禁止转码,

#### 2024-06-29

1.修复 windows 下的路径转义问题

2.移除转码切换逻辑中的 StartTimeTicks 错误判断,目前只以选择的码率是否小于原始码率判断覆盖走转码

2.1 因为之前把直链的优先级定得很高是默认行为,现在越来越多的 issus 关注播放成功率,而不是倾向于直链成功率,
因为转码是 100% 播放成功,而直链播放成功率取决于客户端类型和脚本配置还有多方面因素,
所以逐步在优化为开启了允许转码参数的时候,脚本中不去干预客户端自身上报为要转码的行为了,
transcodeConfig.enable = false,的默认值情况和之前脚本逻辑一致,全部直链并禁止转码,
[emby2Alist#2024-05-28](./README.md#2024-05-28)

2.2 之前的判断逻辑是 StartTimeTicks = "0" (开始播放的毫秒数) 也就是从头开始播放写死为直链了,
这个判断逻辑是错误的,之前如果是继续播放的话切换码率也回不到转码了,而是强制为了直链,
所以目前统一了正确的内置判断逻辑,只根据选择的码率大小是否 > 原始媒体的码率大小,来走直链,
这一过程只限于客户端手动切换码率的情况下,没选择点击播放的情况(从头播放/继续播放),这个情况严格遵循 emby 客户端自己的上报行为

2.3 假如客户端默认上报为了走转码,可以手动选择最大码率来切换回直链,客户端的默认行为后续这边在开启了允许转码参数的时候不会在进行干预了

#### 2024-06-25

1.修复图片和书籍等类型没有 MediaSources 字段导致的 Sync 客户端下载 API 回退源服务中转 bug

#### 2024-06-21

1.兼容 Emby beta V4.9.0.25

2.精确本地文件用 proxy

#### 2024-06-16

1.Emby/Jellyfin 各版本对 stream 和 Download 自定义层级和文件名修改支持不同,故改回原始 URL 地址

2.修复远程链接编码问题

3.最近阿里云盘非会员限速了,改 refresh_token 也没用,个人测试限速规则为单线程 1MB/s,多线程 3MB/s,
大部分播放器都是单线程播放,已放弃并切换至 115,之前就是为了消除此种情况,所以提前用了 alist 的 alias 别名,
切换过程无感,媒体路径并未变化,但最后修改时间变化,扫库无法避免,限流慢慢跑

3.1 补充下,alias 并不能迁移文件,我这里仅仅只是做为一个高可用的容灾使用,原本功能只是把指定的路径文件聚合到一个目录下而已,而且有聚合后变只读的设计,所以使用与否需权衡

3.2 此 alias 配置仅供记录限速之前的,优先级为从上至下,优先级高的路径下存在同名文件将优先返回,具体作用查看 alist 官方文档,
这里记录几个注意点

3.2.1 文档中提到的冒号前的只是一个自定义的分组名而已,可以理解为备注,并不会实际显示为文件夹,所以可以随意填写,我就简单写为 1 了

3.2.2 alias 中每个路径的结尾文件夹名必须一致,这和文档中不同,是个 bug,和上边的官方提到的可以重命名也一样是个 bug

3.2.3 路径转换 那几个是因为源网盘中没有 [1]影视库 文件夹的,所以重复用 alias 转换一下, alist 官方能修复 1 和 2 的话就不需要这个了

3.2.4 从套件版 emby 迁移到 docker 版,卷映射, /CloudNAS/CloudDrive2/AList : /AList ,这样消除了多余出来的平台以及挂载工具的特殊路径

3.2.5 emby 媒体库路径为 /AList/alias/[1]影视库/子分类, 这是为了消除不同网盘商中路径的差异

3.2.6 最终达到了可以随意切换部署平台(仅限 docker 支持)和更改媒体库文件夹中内容的需求,阿里云盘 挂了直接删除 alias 中的对应路径就行了,
文件结构和媒体库路径并未变化,不用动 emby 和 nginx 的任何设置,还有是避免迁移恢复 emby 后启动时会自动从库中移除所有无法访问的媒体库文件,
导致迁移了个寂寞

3.2.7 补充一下 alias 为啥添加 NAS 本地 WebDAV, NAS-tools 订阅和 QB 位于这上边,受限于群晖我这里只能用硬链接转移,
转移后的 link 目录也设计为符合 /alias/[1]影视库 结构,并对此目录用 Cloud Sync 做了实时同步到网盘上,
当然这个也是受限于群晖 Cloud Sync 有 bug,无法监控到非 FileStation 的文件变更,所以暂时是手动刷新的,
添加这个 alias 单纯只是避免有正在上传的文件,而网盘上暂时还没有,聚合后此时就会返回 NAS 本地文件的 WebDAV 地址先凑合用

3.2.8 最后再次提醒 alias 被设计为了只读,虽然新版支持了删除和重命名,但还是需要权衡使用,会导致 emby 中无法进行删除的操作,
有时是 alist 缓存或此文件在 alias 其他盘上存在导致,我这里都是进 alist 源网盘目录进行操作

```
Alias 备份-20240616

/alias/[1]影视库

1:/阿里云盘/AL-JJ-02/[1]影视库
1:/阿里云盘/AL-JJ-01/[1]影视库
1:/阿里云盘/AL-DY-01/[1]影视库
1:/阿里云盘/AL-DM-01/[1]影视库
1:/阿里云盘/AL-ZZ-03/[1]影视库
1:/阿里云盘/AL-ZZ-02/[1]影视库
1:/阿里云盘/AL-ZZ-01/[1]影视库
1:/alias/路径转换/xxx/Onedrive/[1]影视库
1:/alias/路径转换/NAS/[1]影视库
1:/xxx/夸克/[1]影视库
1:/alias/路径转换/115网盘/[1]影视库
1:/alias/路径转换/xxx/天翼云盘个人云/[1]影视库
```

3.2.9 alias 还有个问题是导致 provider 写死为 alias,从而没有 MD5 或 SHA1,所以 alias 后的文件夹是不支持跨盘秒传的,也需要注意下,
alias 还有个优点是方便写元信息(源网盘分开管理),例如 mka 外挂音轨文件会被 emby 入库,但是并无法播放,显得很杂需要屏蔽,
记录下老版正则的配置,新版换了正则库,已经无法兼容高级分组命名写法了

老版 alist 元信息正则隐藏

```
^(?i).*(?P<fileExt>\.mka)$
^(?i).*(?P<keyword>menu|\.sample).*(?P<fileExt>\.mkv|\.mp4)$
^(?i)(?P<full_word>sample|spdvd|sps|menu)$
^(?i).*(?P<keyword>scans).*$

说明
0. 别名合并路径,只读,以下规则只对非管理员生效
1. 匹配 .mka 后缀名的文件,忽略大小写(https://regex101.com/r/hPi7e7/1)
2. 匹配 .mkv 和 .mp4 后缀名中包含 menu 或 .sample,忽略大小写(https://regex101.com/r/2oeOvf/3)
3. 匹配全包含 sample 或 spdvd 或 sps 或 menu,忽略大小写
4. 匹配包含 scans,忽略大小写
```

新版 alist 元信息正则隐藏

```
\.mka

说明
0. 别名合并路径,以下规则只对非管理员生效
1. 匹配 .mka 后缀名的文件,忽略大小写
```

```
\.

说明
0. 别名合并路径,以下规则只对非管理员生效
1. 匹配包含 . 的所有文件
```

```
.*更新补丁
(Backups|Tools)

说明
0. 别名合并路径,以下规则只对非管理员生效
1. 匹配包含 更新补丁
2. 匹配全包含 Backups 或 Tools
```

4.记录一个失败功能尝试,图片的分布式缓存和读写分离实现,
自用是开启了图片缓存的移除缩放参数选项,高清封面大多在 500KB - 3MB 间,极少量超大 30MB 的,
导致浏览合集库时封面加载较慢,这个其实没啥太大问题,三个限制因素无法更改,最大一是 NAS 上传带宽太小,只有 3 MB/s,
二是官方客户端用的 img 标签并设置了 lazyload,三是所有浏览器包括客户端的 webview 都对 HTTP 并发请求进行了限制,
常见的 Chrome 内核限制是 6 个,故开始了分布式缓存尝试,首先测试 Cloudflare,使用 DNS CNAME 代理全站实现 CDN,
结果访问龟速,失败告终,nginx 方向的话可选重定向图片请求到网盘直链实现,但考虑到部分封面图和剧集照网盘中本身没有,
且请求量巨大只有 OneDrive 之类的合适,故放弃,再次尝试实时同步 nignx 已有的缓存目录到其他服务器,
后发现 nignx 缓存文件字如其名,文件头里有响应头之类的信息,无法轻易复用,只能搭建反代使用,而后又和 Range 头冲突,
导致图片被截断,修复后又有双重缓存导致的缓存头错乱导致龟速的强制回源,更甚是 nginx 竟然是先 proxy_pass 再 proxy_cache,
过程中会将上游服务内容先缓存命名为 之前的MD5串.00000001 对比原缓存内容再重命名进行覆盖,
且缓存目录只读, nginx 还拒绝读取,目前明确已经无法实现只读不写,
且最初需求,分布式缓存 nginx 也无法实现,故放弃,无奈只能回到最初,大量图片的并发加载优化只有三条路,一改客户端忽略并发限制,
二用雪碧图也是需要改客户端的,只剩三的多子域名方案,结果给域名 DNS 上了, NAS01-05 五个子域名全部 CNAME 到原域名,
然后当前主 nginx 伪随机 302 上去,不仅没有提升反而因为 302 后更慢了一些,
可能有两个失败原因,一是 5 个子域 CNAME 到了同一个域名或最终 DNS 解析为同一 IP,浏览器不认,
二是官方客户端的 img 标签懒加载方式导致,属于 HTML 限制,多子域无效的话已经毫无意义,故最终全部失败结束,
这里记录下测试 conf 配置块

```
# 此段需要位于 http 块下,server 块上
# 使用 split_clients 指令定义一个变量 $random_nas,根据客户端 IP 的哈希值映射到不同的值
# split_clients "$args" $random_nas {
#     20%      nas01;
#     20%      nas02;
#     20%      nas03;
#     20%      nas04;
#     20%      nas05;
# }

# 这段放在 location ~ /Items/(.*)/Images 块中
# if ($args !~* "noredirect") {
#     return 302 https://$random_nas.mydomain.com:8096$request_uri&noredirect;
# }
```

#### 2024-06-02

1.添加一个图片缓存导致更新海报不生效的折中解决方案

2.体验分享

2.1 有时使用原始链接无法播放,或者官方客户端不显示内挂字幕,如果该文件是通过挂载工具入库的 emby,大概率此时挂载寄了,
读取不到源文件,所以原始服务端口也是播放不了的,需要依次重启 alist => CD2 => emby,alist 可省略,其余必须依次重启

2.2 nfo 文件所在目录层级不太规范导致手动划分的文件夹整个乱掉,例如年份划分的文件夹,
解决办法先让 emby 识别到空的自定义层级目录,然后在手动多选文件夹进行扫描媒体库文件,
各自情况不同,我这里是用 alist 的元信息进行隐藏所有带 . 后缀的文件以达到空目录形式,
隐藏正则为"\.",使用时去掉双引号,一次性元信息使用完毕不用了,在路径后边随便加个不存在的目录 /a 即可失效

#### 2024-06-01

1.修复 L2 缓存只存不取 bug

#### 2024-05-28

1.修复开启允许转码后倾向(即侧重播放成功率)尽量统一,
~~目前除了 strm 文件默认为直链,~~
其余情况全部以官方客户端上报至服务端判断后的结果为准,
[大致可以参考](/plex2Alist/README.md#2024-05-10)

#### 2024-05-26

1.live 添加 route 支持

#### 2024-05-23

没有更新内容,测试均以失败告终,且兼容性极差,这里只是记录下折腾过程,少走弯路,有懂流媒体切片篡改的大佬可以参考下

1.想解决外部播放器的外挂字幕无法统一传递问题

1.1 测试模拟 HLS 的 master.m3u8 文件内容,加入字幕轨道链接,尝试过 ass 和正规的 webVTT 格式,所有播放器均不加载,
失败告终,测试流程为 main.m3u8 中只加一个原始视频的分片,也就是不分片,视频播放 VLC 系全军覆没无法加载,很小部分播放器可以支持内部的 302,
这里注意 #EXTINF:1440.0 为必要时长, PotPlayer 会直接使用这里的时长,不准确将截断后续无法播放, MxPlayer 没这个信息将直接拒绝加载,
Win11 自带的 媒体播放器 会忽略这个时长,直接从视频中读取最准确的时长

master.m3u8
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",LANGUAGE="en",AUTOSELECT=YES,FORCED=NO,URI="https://xxx:8091/Videos/284773/xxx/Subtitles/3/Stream.ass?api_key=xxx"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Chinese",LANGUAGE="cn",AUTOSELECT=YES,FORCED=YES,URI="https://xxx:8091/Videos/284773/xxx/Subtitles/2/Stream.ass?api_key=xxx"

#EXT-X-STREAM-INF:BANDWIDTH=4=8000000,CODECS="avc1,mp4a",RESOLUTION=1920x1080,SUBTITLES="subs"
https://xxx:8091/test/test.m3u8
```

main.m3u8
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:60000
#EXT-X-PLAYLIST-TYPE:VOD

#EXTINF:1440.0,
https://xxx:8091/emby/videos/413843/Stream.mkv?api_key=xxx&Static=true&MediaSourceId=xxx

#EXT-X-ENDLIST
```

1.2 再次尝试切换使用 HLS 的国际标准实现, MPEG-DASH 的 .mpd 文件,失败告终,字幕也是无一加载,且视频播放兼容性更差,
唯一好处是不用计算视频时长,不需要这个 <Period duration="PT0H23M40.000S">,
因为是 2011 年的新协议,PotPlayer 和 Win11 自带的 媒体播放器 失败,虽然 MxPlayer 可以播放,但已经没用了

start.mpd
```xml
<?xml version="1.0"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" 
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="urn:mpeg:DASH:schema:MPD:2011 DASH-MPD.xsd"
     profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
     type="static"
     minBufferTime="PT2S">
  <Period>
    <AdaptationSet mimeType="video/mp4">
      <Representation id="1">
        <BaseURL>https://xxx:8091/emby/videos/413843/Stream.mkv?api_key=xxx&Static=true&MediaSourceId=xxx</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="text/vtt" lang="en">
      <Representation id="2" bandwidth="10000">
        <BaseURL>test.vtt</BaseURL>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="text/vtt" lang="ch">
      <Representation id="3" bandwidth="10000">
        <BaseURL>https://xxx:8091/Videos/284773/xxx/Subtitles/2/Stream.ass?api_key=xxx</BaseURL>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
```

1.3 测试过程发现,PotPlayer 和 MxPlayer 都会自动请求同目录下同文件名的常见字幕后缀文件,
前提是主文件必须返回 200 状态码,不能为 302,但也没啥用,ass 和 vvt 均测试过了,所有播放器均不会在面板中提供选项

```log
xxx - - [23/May/2024:16:46:55 +0800] "https:GET /test/start.mpd HTTP/1.1" 200 1123 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
xxx - - [23/May/2024:16:46:56 +0800] "https:PROPFIND /test/ HTTP/1.1" 405 150 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
xxx - - [23/May/2024:16:46:56 +0800] "https:GET /test/ HTTP/1.1" 403 146 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
xxx - - [23/May/2024:16:46:56 +0800] "https:GET /test/start.smi HTTP/1.1" 404 146 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
xxx - - [23/May/2024:16:46:56 +0800] "https:GET /test/start.srt HTTP/1.1" 404 146 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
xxx - - [23/May/2024:16:46:56 +0800] "https:GET /test/start.ass HTTP/1.1" 200 37516 "-" "(Windows NT 10.0; Win64; x64) PotPlayer/24.01.25" "-"
```

1.4 也尝试过 Http2 的 serverPush,无用, http 规范的 Link 头并加上 preload 或 track 轨道,均无用

2.想解决外部播放器没有回传播放进度的问题

2.1 尝试篡改 HLS 和 DASH,在中间加入回传进度 API 的 URL,但是只有一个分片,且播放器的黑箱进度计算又是一大难题,失败告终

2.2 尝试使用 http 规范的 Link 头并加上 preload 传递一个无限 302 的回调地址,客户端最大只能 20 次重定向,
且大部分播放器并不会遵守浏览器规范,如上,失败告终

2.3 构思使用 http 规范的 CSP 头部 report-to,因规范是用作 CORS 单次汇报使用的,理论阶段就无法使用,失败告终

3.想解决直链播放原盘 BDMV 文件夹的问题

3.1 已经测试过用 HLS 来欺骗播放器,m2ts 可能与 ts 有类似地方,单个分片能播放,但是毫无意义,播放器兼容性极差,
如上述的篡改 HLS 使用原始媒体格式一样,且最大难题是 STREAM 的分片时长不统一且编号有跳跃且会夹杂花絮且外部播放器没法外挂字幕,无法处理,
按蓝光规范需要读取 CLIPINF 中二进制内容,但描述文件过多,几百个 1 KB 文件,
天生不适合网盘,同时为了网盘安全,也不建议用原始服务播放 BDMV,同样是播放的时候会读取 CLIPINF 所有的文件,
建议换其他资源或者把文件下载本服务器本地,或按照 emby 官方的建议,自己混流合并再入库吧

main.m3u8
```
#EXTM3U
#EXT-X-VERSION:14
#EXT-X-TARGETDURATION:60000
#EXT-X-PLAYLIST-TYPE:VOD

#EXTINF:,00001
https://xxx:5244/d/xxx/AL-ZZ-02/test/Guardians.of.the.Galaxy.Vol.2.2017.1080p.BluRay.AVC.DTS-HD.MA.7.1-xxx/BDMV/STREAM/00905.m2ts

#EXT-X-ENDLIST
```

#### 2024-05-21

1.拆分配置文件,根据自身倾向选择 exampleConfig 中的配置并参照注释

#### 2024-05-19

1.提供获取软连接真实路径的配置项,前提条件是此程序或容器必须挂载或具有对应目录的读取权限,否则将跳过处理,不生效,
只做了简单的测试,可能暂时存在和非本地文件路径走代理判断稍微有些冲突,自行尝试配置 mediaMountPath 或 routeRule

#### 2024-05-18

1.串流地址的文件名修改提供开关,默认关闭,按照自身测试和需求情况评估开启

#### 2024-05-11

1.修复错误的 proxy_buffering off 层级导致的缓存失效

#### 2024-05-05

1.还原 115 的链接判断为二级域名,三级域名为 CDN 负载均衡会动态变化,
最好也不要用 alist get 接口中的 provider 字段,使用了 alias 情况下,provider 为 alias 而非 115 Cloud

2.拆分 conf 配置,http 和 https 不要共用相同端口

#### 2024-04-30

1.精确几处逻辑判断的范围,修复媒体容器名不为文件后缀的情况以减少误导,精确 sign 参数添加的范围,去除无用的 itemsFilter 日志打印

#### 2024-04-27

1.升级路由缓存配置,缓存的 key 值可自定义表达式

2.升级路由缓存配置,加入二级缓存开关,注意此仅针对直链,添加阶段为进入单集详情页,clientSelfAlistRule 中的和首页直接播放的不生效,
自行根据实际情况使用,只在缓存中没有直链且进入详情页才会查 alist 预热缓存,15分钟内第二次进入相同详情页命中缓存不再查询 alist,
忽略直链通知的文本内容,只预热了缓存并没有跳转,再次点击播放就会直接读取预热后的直链缓存

#### 2024-04-25

1.媒体项目过滤添加可能为第三方使用的海报推荐接口

#### 2024-04-22

1.修复[emby > 4.8.3.0]直链通知的窗口持续时间

2.更改易混淆的变量名,修复多版本媒体的直链缓存 key

3.提供参数控制 302 的直链文件是否保留码率选择,不保留客户端将无法手动切换至转码

4.
~~提供转码负载失败的降级措施,~~
精确参数为目标服务匹配失败后的降级措施,默认为"redirect"的 302,进入转码接口后官方客户端会将播放环境改为 HLS,
如果内部重定向到直链是不生效的,客户端会死循环,处理方案为先响应了一次 449 报错,依赖客户端默认的3次重试机会,
第一次重试就会重新初始化为普通播放环境播放 302 直链内容,
"proxy": 这个单纯只是作为兜底方案,转给原始媒体服务处理,如果 emby 客户端自己带有转码参数,原始服务也会走转码,
客户端可自行选择最大码率来切换回直链的 302

#### 2024-04-21

1.还原以兼容115部分客户端拖动进度条bug

2.对直链通知添加幂等,默认10秒内不重复发送

#### 2024-04-20

1.升级禁用直链规则为路由规则,内部判断变得十分复杂,有一些历史遗留和可能存在一些优先级问题,请自行测试

2.如果走了转码可以选择最高码率来切回直链,
也可反向操作,
~~被路由规则指定过的不可反向操作,部分播放器可能已经初始化为了HSL播放环境,~~
不要用自动码率,emby的判断有时不准确

3.客户端不支持的音频(Web端DTS)也会导致走转码,可以关闭用户的[播放-如有必要，在媒体播放期间允许视频转码]

4.不用转码功能的,保持[transcodeConfig.enable=false]

#### 2024-04-19

1.升级分组禁用直链规则,添加NJS事件日志,重构拆分转码方法

2.经热心网友协助测试,发现拖动进度条黑屏属于emby的ios官方客户端和infuse播放115独有的问题,阿里云盘不存在此问题,
故升级了直链禁用规则,复现测试可以将115直链放到IDM等多线程下载器中,注意设置为获取直链时的UA,即使是115年费会员,
超过2个线程加载,就会导致整个下载进度卡住,时断时续,猜测这两个客户端默认使用了并发分块加载,
如果有相关设置的话(一般没有,是播放器内核自己的行为),自行设置为1,或者放开禁用直链规则

3.115还有一个问题,很久之前做文件迁移时发现的,一个账号不论多少客户端总共的下载进程最大10个,且有日传输量限制,
这个具体多少流量不清楚,复现测试为浏览器开10个任务,官方客户端下载文件夹只算一个任务,就会发现其余客户端无法播放和下载了

#### 2024-04-16

1.!!!实验功能,转码负载均衡,默认false,将按之前逻辑禁止转码处理并移除转码选项参数,此条与emby配置无关,
主库和所有从库给用户开启[播放-如有必要，在媒体播放期间允许视频转码]+[倒数7行-允许媒体转换],
```javascript
type: "nginx", // nginx负载均衡
```
好处是使用简单且内置均衡参数选择,且因为服务组只能局域网,
理论上对网盘挂载比较安全,因为都是同一出口IP,缺点是流量全部经过此服务器,
且使用条件很苛刻,转码服务组中的媒体id需要和主媒体库中id一致,自行寻找实现主从同步,完全同步后,ApiKey也是一致的

1.1 使用教程,遵循上述前置条件,
更改constant.js中transcodeConfig的enable属性为true,
type改为nginx,在nginx的server-group.conf负载均衡中配置转码服务组,
组内只支持局域网访问,且主从媒体服务类型需一致

2.分布式媒体服务负载均衡(暂未实现均衡)
```javascript
type: "distributed-media-server",
```
优先利用302真正实现流量的LB,且灵活,不区分主从,当前访问服务即为主库,可emby/jellyfin混搭,
挂载路径可以不一致,但要求库中的标题和语种一致且原始文件名一致,
缺点是如果组内都是异网IP,对网盘安全性相对差一些,少量几个人用的无风险,
担心此问题的,把组内所有服务放在同一局域网保证出口IP一致,公网使用不同的端口映射,
虽然是302但是真正访问网盘是目标服务,因为要做转码,不是客户端访问

2.1 使用教程,前置条件只需要给访问的服务用户开启,目标服务可能不用开,使用的是ApiKey调用,没有用户,
[播放-如有必要，在媒体播放期间允许视频转码] + [倒数7行-允许媒体转换],
更改constant.js中transcodeConfig的enable属性为true,
type改为distributed-media-server,在下面的server中配置转码服务组,
组内需要所有服务公网畅通,因为需要客户端302到对应服务

3.实现原理

3.1 查询当前库媒体的名称标题和挂载路径并截取出带后缀的文件名

3.2 调用相同和兼容的查询接口从目标转码服务获取信息并过滤匹配,
首选使用名称标题查询,标题是库中显示的刮削匹配后的名称,
一般和tmdb或imdb对应语言标题相同,此过程和搜索框接口一致,
匹配不上的可以自己用搜索框尝试一下,获取到多个结果后再使用带后缀的文件名进行最终精确匹配

3.3 构造异构系统的转码访问地址并做一些少量的参数兼容转换,LB后302到目标转码服务

4.目前需要关注的注意点

4.1 控制台和播放详情页中的信息不准确,只显示原始码率信息和错误显示的直接播放,无法兼容,跨服务且转码参数过多

4.2 不兼容第三方播放器,因为没有码率选项和转码参数

4.3 虽然支持 emby <=> jellyfin 双向访问,
但简单测试发现部分情况下 jellyfin => emby 会有无法终止转码的风险,
例如在jellyfin没有发出停止播放和终止转码的情况下,emby无从得知是否该结束转码,
复现步骤为播放后直接刷新浏览器,一定要注意避免此种情况,耐心等待正常的播放和停止,
包括提示没有兼容的流也会同步终止转码,如发现emby没有终止转码,硬件占用高,
需要手动清空转码临时目录才能强制终止转码过程,控制台没有相关提示和操作,
emby => jellyfin 不存在此问题,jellyfin会在终止连接后自动且迅速的终止转码并清理临时目录

4.4 emby/jellyfin 混合配置的,注意目标emby必须用此项目反代才能同步播放开始结束和终止转码,
以免出现4.3的情况,当然测试情况下可以随意,直接配置原始emby服务也行,
同样的,目标服务为jellyfin的情况,可以直接配置原始服务

4.5 暂时没有对转码参数进行更改,全靠emby/jellyfin同源,不过可能还是存在部分参数不兼容的情况

4.6 如果当前访问服务为https,则目标服务必须全部使用https,不然302会被浏览器默认拦截,但在一些客户端不存在此问题

4.7 测试条件有限,只测试了 emby <=> jellyfin 的web端双向访问,且由于个人NAS核显等同于没有,
只能选择144P和240P码率互相切换做测试,其他码率的响应时间过长,
媒体服务客户端基本都是10秒内一个切片超时就会主动断开连接重新请求,导致几分钟内还没开始播放,
且只能依靠CPU 100% 和转码临时目录文件判断成功情况

4.8 只测试了CD2挂载alist阿里云盘的文件,理论上NAS本地文件转码响应会更快,因为没有缓存下载这个过程,
~~暂未测试STRM的支持情况~~
STRM会导致jellfin的PlaybackInfo从几秒增长到30秒,效率极差,不建议对STRM使用转码功能

4.9 可以和直链302共存,因为走的是不同的接口,但要保证选择最大码率或用修改版客户端开直连模式,此点基本和以前注意如何避免触发转码类似

4.10 只实现了流量的分离,暂未实现真正的负载均衡,目前极有可能会全部分配到第一台服务器,
因为没找到真正查询服务组转码数量的接口,后期可能参考nginx实现方式,NJS添加计数器解决,
但会出现新问题,分布式需要各节点信息共享,且转码数量不精确,没经过nginx处理的转码会统计不到

#### 2024-04-13

1.注意需要保证njs >= 0.8.0,直接nginx:latest即可,
加入防抖措施,添加内外部重定向地址缓存,以兼容部分客户端不遵循30X重定向规范导致的短时过多重复请求穿透到alist,
例如emby安卓客户端,infuse,表现形式为每次拖动进度条都会重复请求emby原始串流地址,忽略上次拿到的重定向后地址,
Web端没有此问题,调用外部第三方播放器也无此问题,但是播放nas本地视频也会多次请求,故强制兼容解决,
可以打开embyRedirectSendMessage.enable = true,在官方客户端内进行提示查看,
默认按阿里云盘的直链最大有效时间15分钟,请勿随意更改此时间

#### 2024-04-12

1.添加定时任务默认7天自动清空nginx日志,请结合日志重要程度和硬盘占用情况自行调整为合适间隔,建议不要改为小于1天以免影响性能,
使用条件为没有更改过默认日志的路径和名称,且需要更新最新版本njs
```
/var/log/nginx/error.log
/var/log/nginx/access.log
```

2.添加限流配置示例,只对302之前的请求生效,302后是直连第三方服务器,无法进行控制

#### 2024-04-11

1.当媒体服务中存在过多的媒体时访问首页很慢,优化方式为,设置=>服务器=>数据库=>数据库缓存大小（MB）=>进行适当调大,
个人目前为460MB,请根据物理机内存情况合理设置,其他数据库设置请勿更改,
经验证此设置只有 Emby 支持,Jellyfin 没有此设置,且 system.xml 中也无支持

2.添加nginx对接日志中心示例配置,可以和原xxx_log共存,如有需要,打开注释并修改为自己的ip和端口即可
发送日志到syslog,默认使用UDP的514端口,群晖=>日志中心=>接收日志=>新增=>名称随意,保持默认的BSD格式,UDP,514

#### 2024-04-10

客户端绕过 nginx-emby 的参考,新代码已经对系统信息接口反代修改了端口号,不确定是否还有问题

1.之前遇到过类似的,但不完全相同,媒体服务都是有 UDP 广播局域网自动发现的,
但是广域网走的是服务开放的接口获取服务器的 ip 以及端口信息,例如 emby 默认的 8096 端口,
我路由器映射出去也是 8096,这就导致接入了网络发现接口的客户端会擅自连接 8096 端口,
而忽略连接 nginx 的反代端口 8098 之类的,尽管我是手动使用 8098 端口登录的也没用,我是用的官方 emby 安卓客户端

我这边的解决方案是将路由器端口映射为 8096=>7096,路由器这边的设置,emby 是不可能知道的,
表现形式为控制台端口还是 8096,所以客户端在擅自连接 8096 不通时就会老实连接反代的 8091 了

猜测 fileball 接口接入比较完善了,使用了媒体服务提供的网络发现接口,而 infuse 并没有调用此接口,以用户手动填写的为准

#### 2024-04-08

1.增强禁用直链的规则配置,docker环境需要注意此参数客户端地址($remote_addr),
nginx容器网络必须为host模式,不然此变量全部为内网ip,判断无效

#### 2024-04-05

如何避免媒体服务器频繁进行整库扫描刮削,导致内存占用飙升且影响性能,并范围太大会触发网盘的熔断机制

1.部分网盘熔断恢复周期,期间会全部拒绝服务,阿里云盘大概为 30 分钟到 1 小时,115 网盘则为 1-2 小时

2.简单方案,发现整库扫描情况立即重启媒体服务,会消停几小时,但治标不治本,之后还会继续重试,控制台和计划任务里不会显示,无法强制停止

3.alist 一定要开启 115 网盘驱动的限制速率,它的限制比较严格,一扫库必定熔断,默认为 2【限制所有 api 请求速率(1r/[limit_rate]s)】,
意味着 2 秒内只处理 1 个请求,个人设置为 1 也是没问题的,此为限流最小值,缺点是整库扫持续时间会达到一周,但是不会触发熔断,比较安全,
不要设置为 0 ,代表没限制,阿里网盘的熔断机制相对宽松很多,除非一次性文件太多,但是截止当前,alist 并没有当前网盘的限流参数

4.最简单,全部使用 strm 文件解决,没有播放的情况下默认不会进行刮削,emby 对此兼容性较好,只在第一次播放后会将媒体流参数信息存入数据库,
下次播放将跳过分析过程,表现形式为秒播,pelx 对此无法跳过分析过程,播放开始会长达 6-8 秒等待,以上为官方客户端,第三方客户端不会有分析过程

以下为猜想未经测试,仅供记录

1.限流可以放在nginx反代配置,流量路径为 nginx-媒体服务 => 媒体服务 => cd2/rclone => nginx-alist => alist

2.媒体库触发强制自动扫库的根本原因为媒体文件的最后修改时间 > 入库时的最后修改时间,有条件可以在nginx-alist这层做反代返回假的最后修改时间,
或者等待alist添加自定义配置最后修改时间功能,截止目前,并没有相关issue

3.从挂载层解决,查询rclone官方文档得知有缓存参数,此测试结果为会在自定义配置的缓存目录同目录结构下,优先生成一个缓存文件,
缓存文件属性显示大小等于原始文件,但是实际占用大小只为读取的文件大小,例如1G文件,被刮削视频头后,大概实际只占用40%,完全没读取过,只占用0KB,
但是此缓存文件最后修改时间为最后一次读写时间,文档中没有自定义配置的参数,如果想要Web控制台,可以再套一层cd2

#### 2024-03-31

1.对接emby设备控制推送通知消息,目前只发送是否直链成功,范围为所有的客户端,通知目标只为当前播放的设备,如果客户端短时间内走了缓存,则不会触发通知

#### 2024-03-30

1.增强路径映射功能,区分来源类型

2.strm文件内部目前建议为远程链接,这样emby会在第一次播放后进行补充媒体数据,例如媒体格式和字幕流信息,这样官方客户端兼容性更好

3.strm文件内部为/开头的相对路径的虽然强行兼容支持播放,但是好像官方客户端的播放记录和回传存在bug,备选使用

4.添加默认可选参数以支持issue建议的指定strm规则获取重定向后的地址进行转发,兼容局域网的strm链接

5.感谢 @sgpublic 提供的 alist sign 计算方案
~~5.alist >= 3.20的默认对直链开启了sign全部参数,属于额外验证,不接受token验证,~~
~~如果要兼容,性能会很差,需要多用token请求一次alist获取到直链和sign参数,解决方案两种~~

~~5.1.用/开头的路径,这样会用alistToken走fsGet接口一次获取最终直链返回,缺点是官方客户端字幕流不正常且播放记录不准确或者没有~~

~~5.2.nginx请求的alist建议关闭设置-全局-签名所有,将此alist部署为和nginx同一局域网,接口响应也会快很多,通常在200ms-2000ms之间,跨网络会更慢~~
~~如果对直链安全有介意,去掉此alist的公网端口映射,只在局域网使用,公网使用另行部署一个开启sign全部的alist~~

#### 2024-03-28

1.添加基本的配置示例文件,若符合需求,更改内容并删除文件名后缀,复制文件到上一级目录覆盖原始文件即可,\emby2Alist\nginx\conf.d\constant.js

#### 2024-03-18

1.优化请求alist的115直链获取逻辑,透传UA,减少一次302过程,以兼容媒体服务器https而alist为http默认被浏览器客户端强制改写导致的错误

2.~~115直链不在需要clientSelfAlistRule参数,~~
但保留处理逻辑,有特殊需要可自定义配置

3.将items隐藏升级为按路径匹配规则并新增,更多类似,接口隐藏

#### 2024-03-14

1.按规则隐藏搜索接口返回的items

#### 2024-03-13

1.媒体服务器https后,如果alist没有https,且相同域名情况,http链接会被浏览器默认强制改写为https,导致115的处理的第一次302会失败

2.地址栏左边-此网站权限-不安全的内容-允许,或者浏览器设置-Cookie 和网站权限-不安全的内容-允许

3.非浏览器不存在此问题,例如第三方播放器,默认不会阻止,也可将alist套上证书解决此问题

#### 2024-03-10

1.测试并修复本地视频兼容问题,意外发现http2对本地原始链接的视频在部分跨宽带网络阻断有帮助(电信->联通),如有相同情况请开启http2或者http3

#### 2024-03-04

1.优化播放时减少一次媒体查询接口

#### 2024-03-01

1.串流地址加入媒体文件名方便标识和字幕匹配

2.添加图片缓存策略可选配置项

#### 2024-01-20

1.添加实验功能,转码分流

#### 2023-12-31

1.115 的 302 需要 alist 最新版 v3.30.0,由于 115 直链并没有响应允许跨域标识,
~~所以只能用客户端播放,~~
测试emby所有官方客户端和第三方客户端支持跨域,
~~不支持跨域的播放为Web浏览器...~~

2.115 播放形式为响应 302 到原始 alist 链接,由 alist 再 302 一次到直链

3.参考 [FAQ](../FAQ.md#6),
Web浏览器被跨域拦截请使用拓展解决,该拓展有时不稳定,表现形式为开启状态,但是并没有添加跨域响应头,可以寻找类似拓展测试,或者多开关几次并增大 urlRegex 匹配范围确保成功添加自定义响应头后再使用

3.1 推荐这个拓展,虽然好像没人维护了,但是基本功能稳定,但是注意它的匹配规则已经失效,只有匹配类型为域名的全域名规则按预期工作,大部分互联网站都做了 CDN,所以域名是不定时动态变化的,建议直接选择匹配全部,但不用了一定注意关闭插件,以免产生跨域安全风险

https://microsoftedge.microsoft.com/addons/detail/header-editor/afopnekiinpekooejpchnkgfffaeceko

```
CORS Support All
匹配类型: 全部
执行类型: 常规
头名称: access-control-allow-origin
头内容: *
```
```javascript
"receiveHeader": [
    {
        "enable": true,
        "name": "CORS Support_all",
        "ruleType": "modifyReceiveHeader",
        "matchType": "all",
        "exclude": "",
        "group": "media server",
        "isFunction": false,
        "action": {
            "name": "access-control-allow-origin",
            "value": "*"
        }
    },
],
```
![image](https://github.com/chen3861229/embyExternalUrl/assets/42368856/cbe6aff2-7ea6-40ee-b3b5-6238ea33347e)


3.2 这个拓展虽然更新快,但是好像会不定时失效,自行测试

https://microsoftedge.microsoft.com/addons/detail/modheader-modify-http-h/opgbiafapkbbnbnjcdomjaghbckfkglc

```javascript
[
    {
        "respHeaders": [
            {
                "enabled": true,
                "name": "Access-Control-Allow-Origin",
                "value": "*"
            }
        ],
        "shortTitle": "1",
        "title": "CORS Support",
        "urlFilters": [
            {
                "enabled": true,
                "urlRegex": "*.115.com"
            }
        ],
        "version": 2
    }
]
```
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/3ea94076-829f-4542-88e2-3221b9a8c8f4)

4.添加部分可选配置项,对接emby/jellyfin通知管理员设置,方便排查直链情况

#### 2023-10-02

1.支持strm文件的直链,下边第一种情况已做处理默认支持

有多种填写方式,一个strm文件内部只能有一行路径或者链接,具体可以参考emby官方文档,我这里只测试了两种情况,例如:

1-1:
从alist的根路径开始填写,注意不要包含 mediaMountPath 这个参数的路径,特殊字符不用转义,代码内部已做处理
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/240f5aa5-a603-40b6-ab6f-ed7c1b13c806)

1-2:
直接填写直链,~~这种稍微有风险,不建议使用,而且携带密码会被浏览器拦截,~~
且重定向后的远程链接将被部分浏览器跨域限制,无法修复,emby的客户端直接获取到并请求地址
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/5e904160-717b-4b8c-abf6-e08a8756de35)

2.emby在扫库的时候不会刮削strm文件的元数据,只有在视频第一次播放的时候才会获取,这需要几秒钟的时间,且是根据这个文件本身的路径以及文件名来识别的,和strm内容无关,空文件也能刮削出来,在播放时将内部链接传给客户端自己请求

3.根据部分反馈看,1-1的相对路径方式可能存在进度跟踪不准确,且没有在播放完毕后自动标记完成,建议使用标准的第三方工具生成的样式1-2

#### 2023-09-28

1.实现客户端直链下载

#### 2023-02-02

升级到alist v3了,脚本github地址 [bpking1/embyExternalUrl (github.com)](https://github.com/bpking1/embyExternalUrl)

调用外部播放器的油猴脚本账号无法登陆了,换了个新地址:[embyLaunchPotplayer (greasyfork.org)](https://greasyfork.org/en/scripts/459297-embylaunchpotplayer)

#### 2022-05-13

1.兼容jellyfin

2.解决infuse无法播放的问题,感谢@amwamw968

3.用nignx添加了字幕文件的缓存支持

#### 2022-01-12

1.重写了js脚本,支持rclone union,不再需要挂载名和alist盘名一致,不再需要设置emby api_key

2.修复了js脚本不能正确获取同一个视频不同清晰度版本的问题

#### 2021-12-06

1.alist项目作者最近的更新中加入了阿里云盘之外的网盘的支持,且不在需要刷新目录

2.换了另外一个用rust语言写的阿里盘webdav项目,内存占用很小

3.修改了njs脚本中的正则,来修复emby魔改客户端terminusPlayer没有走直链

4.修改nginx配置修复了阿里云盘直链无法在emby web中播放

5.修复了由于反代无法使用jellyfin-mpv-shim直链播放

6.用nignx添加了emby图片的缓存支持

## 这篇文章的受众:
写这篇文章默认读者是emby用户,使用rclone挂载网盘,会使用docker,因篇幅问题以上软件的使用方法不在文章范围之中,此项目不会对原有的emby和rclone配置造成影响或修改

## 原理:
~~使用[aliyundrive-webdav](https://github.com/messense/aliyundrive-webdav) 项目将阿里盘转为webdav, 再~~
使用 rclone 挂载以供 emby 读取
使用[alist项目](https://github.com/Xhofe/alist) 将阿里盘及别的网盘的文件转为直链,使用 nginx 及其 njs 模块将 emby 视频播放地址劫持到 alist直链 
(~~暂时只测试了od,gd和阿里云盘可用,~~
alist 目前支持好几种网盘,感兴趣的可以测试一下)

## 步骤:

### 1.先将配置文件下载到本地

```bash
wget https://github.com/bpking1/embyExternalUrl/releases/download/v0.0.1/emby2Alist.tar.gz && mkdir -p ~/emby2Alist && tar -xzvf ./emby2Alist.tar.gz -C ~/emby2Alist && cd ~/emby2Alist
```

此时大致文件结构如下:
```javascript
~/emby2Alist
├── docker // 创建容器脚本文件夹
|   ├── docker-compose.yml // docker-compose 脚本,根据自身情况修改
|   ├── nginx-emby.syno.json // 群晖 docker 脚本,根据自身情况修改
|   └── nginx-jellyfin.syno.json  // 群晖 docker 脚本,根据自身情况修改
└── nginx // nginx 配置文件夹
    ├── conf.d // nginx 配置文件夹
    |   ├── api // JS 脚本文件夹,完全不用改
    |   ├── cert // SSL 证书文件夹,根据自身情况修改
    |   ├── common // 通用工具类文件夹,完全不用改
    |   ├── config // 常量拆分后配置文件,若为 constant-all.js 完全不用改,若为 constant-main.js 则需要更改对应拆分文件
    |   ├── exampleConfig // 示例 constant 配置文件夹
    |   ├── includes // 拆分的 conf 文件夹,http 和 https 端口在这改
    |   ├── constant.js // 常量主配置文件,根据自身情况修改
    │   ├── emby-live.js // 直播相关脚本,完全不用改
    │   ├── emby-transcode.js // 转码相关脚本,完全不用改
    │   ├── emby.conf // emby 配置文件,根据自身情况修改,注意 https 默认被注释掉了
    │   └── emby.js // 主脚本,完全不用改
    └── nginx.conf // nginx 配置文件,一般不用改
```

### 2. 
看情况修改 constant.js 中的设置项目,通常来说只需要改 alist 密码
这里默认 emby 在同一台机器并且使用 8096 端口,~~否则要修改 emby.js和emby.conf中emby的地址~~
### 3 . 如果不挂载阿里云盘 可以跳过这一步
修改docker-compose.yml 中 service.ali-webdav 的 REFRESH_TOKEN
获取方法参考原项目地址: https://github.com/messense/aliyundrive-webdav

### docker部署的任选以下一种
xxx为示例目录名,请根据自身情况修改

~~前置条件1: 需要手动创建目录~~
```
/xxx/nginx-emby/log
/xxx/nginx-emby/embyCache
```
~~前置条件2: 需要手动移动项目配置文件~~
~~将本项目xxx2Alist/nginx/下所有文件移动到/xxx/nginx-emby/config/下面~~

### 4.1 - docker-compose
启动服务: 在 ~/emby2Alist/docker 目录下执行
```bash
docker-compose up -d
```
查看启动log:
```bash
docker-compose logs -f
```
如果log有报错,请按照提示信息修改,常见错误可能为
1. docker端口占用冲突:  修改 docker-comopse 映射端口
2. webdav 的 refresh token 填写错误 (**如果不挂载阿里云盘则忽略**)

### 4.2 - 群晖docker
容器=>设置=>导入=>选择json配置文件=>确认

### 5. 
防火墙放行 5244, 8091 ~~和 8080端口~~
8080 端口为阿里盘 webdav地址,8091 端口为 emby 转直链端口与默认的 8096 互不影响
访问 5244 端口,初始密码查看 docker log 能看到 ,根据项目文档 https://github.com/Xhofe/alist 在 Alist 项目后台添加网盘 
注意: 

1. 添加 od,gd 盘可以直接复制 rclone 配置里面的 clientid , secret , refreshToken,不用再麻烦去重新搞一次了
2. **不使用阿里云盘可以跳过这步**
   alist阿里盘的refreshToken与webdav那个token是不一样的,这里需要的是要不需要referrer请求头的token,详情请参考这个[issue](https://github.com/Xhofe/alist/issues/88) , 可以用这个网页来获取 [阿里云盘 - RefreshToken (cooluc.com)](https://media.cooluc.com/decode_token/) 
3. 盘名建议一致,这样获取直链更快,不一致也可以

~~添加的网盘在alist里面的名称需要与 rclone挂载的文件夹名称一样  比如挂载路径为 /mnt/ali 那么盘的名称也要叫 ali~~

### 6. 如果不挂载阿里云盘 可以跳过这一步
配置 rclone,挂载网盘,这里以阿里盘 webdav 为例

使用 rclone 挂载 阿里盘 webdav 
第一步name  我这里为 ali
rclone config  选 webdav , 地址为http://localhost:8080 默认用户和密码都为admin
rclone lsf ali:  看一下能否获取到列表
创建文件夹:
mkdir -p /mnt/ali     注:此挂载文件夹的名字需要与 Alist 中的盘名相同
挂载:

```bash
nohup rclone mount ali: /mnt/ali --umask 0000 --default-permissions --allow-non-empty --allow-other --buffer-size 32M --vfs-read-chunk-size 64M --vfs-read-chunk-size-limit 1G &
```
也可以写成 service


### 7. 测试是否成功
访问 8091 端口打开 emby 测试直链是否生效,查看执行 log
```bash
docker logs -f -n 10 nginx-emby 2>&1 | grep js:
```
或者直接查看 ../nginx/log 容器映射出来的原始 nginx error.log 业务日志
8091 端口为走直链端口,原本的 8096 端口 走 emby server 不变
~~直链播放不支持转码,转码的话只能走emby server~~
所以最好 在 emby 设置中将 播放 --> 视频 --> 互联网质量 设置为最高,
~~并且将用户的转码权限关掉,确保走直链,~~
web 端各大浏览器对音频和视频编码支持情况不一,碰到不支持的情况 emby 会强制走转码而不会走直链

## 已知问题:
1. emby web 播放时如果需要使用内封的字幕,实际上是需要 embyServer 在后台用 ffmpeg 去提取的,~~ffmpeg要读取整个视频文件才能获取所有的字幕流,相当于几乎整个视频文件都要通过rclone下载,并且消耗cpu资源,对于比较大的视频文件是不现实的,所以web端建议使用外挂字幕~~,从头读取到字幕流位置截止,大概占文件大小的40%. 只有修改版 emby 客户端调用 MX Player 会同时传递所有外挂字幕,其余方式包括串流地址不支持外挂字幕加载,需要手动下载字幕文件并选择装载
2. ~~google Drive由于api的限制直链只能通过server中转,所以还是建议在cf上搭建goindex来获取直链 ,如何给到emby请参考 这篇[文章](https://blog.738888.xyz/2021/09/09/emby%E6%8C%82%E8%BD%BD%E7%BD%91%E7%9B%98%E8%BD%AC%E7%9B%B4%E9%93%BE%E6%92%AD%E6%94%BE/)结尾,另外一种方法是给alist添加cf worker中转gd的支持,有待研究~~
alist 新版已经支持 cf worker 代理 gd 下载了,详情参考 alist 文档
3. 可能会有其他问题,请留言

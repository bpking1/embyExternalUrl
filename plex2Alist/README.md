---
title: plex挂载alist转直链
date: 2023/11/04 22:00:00
---

### 文章更新记录 
2024/03/07
1.测试并添加https相关示例,plex情况特殊,服务端必须设置-网络-自定义服务器访问 URL: [https://自己的域名:自己的端口号],以发布到plex.tv发现服务器,客户端保持默认设置,不用更改高级设置-自定义ip和端口,高级设置-允许非加密连接-永不
![image](https://github.com/chen3861229/embyExternalUrl/assets/42368856/5efd2df2-33ba-4dc5-9aff-707f25022a9d)
![image-2](https://github.com/chen3861229/embyExternalUrl/assets/42368856/0431fcc9-9c08-4ccb-af88-71614df5b9c1)

2.Web端还会提示部分内容不安全,无视即可,是plex的设计问题,可自行查找xxx.plex.direct:端口号,关键字解决

2024/03/03
1.更换part连接的路径匹配实现,以彻底解决精度问题,同时将挂载路径缓存至客户端,使用到了xml包,此版本需要njs>=0.7.10

2024/02/29

1.修复剧集页面无法打开的bug

2024/01/19

1.提高web的直链下载匹配精度,使用的nginx的新特性共享变量,缓存了/library/metadata接口中part链接数据,~~此版本需要njs>=0.8.0,~~直接nginx:latest即可

~~2.目前的限制是第三方客户端注意必须进一次详情页,再点播放,不要直接点封面图上的播放按钮,下载和第三方客户端不进详情页播放特殊处理的,链接类似/library/parts/81327/1708863299/file.mp4,这个plex没提供直接的api查询出挂载路径,所以这边的处理是用进详情页的数据在nginx共享变量中缓存的,如果缓存没查到,就会用文件名调用plex的接口查询,和首页的查询接口同一个,所以对文件名带-的这种查询不出来,因为plex入库的时候会去掉-~~

2024/01/10

1.兼容新版alist默认签名所有115直链

2024/01/09

~~1.为解决part链接无法获取挂载路径问题,加入偏移量计算,需要大致估算多版本视频的套数,用于计算metadata和part(media)的自增id偏差数~~

2023/11/04

1.参考博客(https://blog.738888.xyz/posts/plex_to_alist_directlink)中的plex直链功能并参考之前的njs实现,实验性(bug)性质支持了直链播放,因为只找到社区维护的简易API(https://plex-docs.vercel.app),所以实现方式比较别扭,~~目前存在多版本视频不能直链下载的bug。~~

~~2.Plex要直链播放只需要设置远程访问-手动设置公开端口为nginx监听端口,避免客户端优先直连32400,如果路由器做了32400端口转发,不影响外部访问。~~

2.Plex要直链播放需要避免客户端优先直连32400,去掉路由器的32400端口转发,添加nginx的端口转发即可
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/9abc036a-72db-4434-9be7-1f31c2686bb2)

## 已知问题:
1.PlexWeb自身存在很多问题,不支持DTS的直接播放,不支持所有非内嵌字幕的直接播放,使用起来就是已经直连云盘在接收数据了,但是Web播放器卡住不动,页签内存过载就直接白屏了,Web只支持简单格式的内嵌字幕视频,解决方案为使用对应平台的客户端,经测试,安卓客户端是没问题的。
![47dc8412c5d0b46aac999d4c3aae36ae](https://github.com/bpking1/embyExternalUrl/assets/42368856/625731e4-a8b9-46f9-b511-96aba4498485)
![baddd39444f9ca6f2069209c2f73f9d](https://github.com/bpking1/embyExternalUrl/assets/42368856/47be6ced-e630-460b-9a7d-bfdedc795907)
![cf1b5edc12c2fd2b52eed17ab3afc85](https://github.com/bpking1/embyExternalUrl/assets/42368856/8bd44d0e-3761-4dc8-b86e-fa3baf8163b6)

2.各客户端对非默认端口的支持不同
- 例如安卓客户端只需要填写nginx端口并且打开客户端高级设置-允许非加密连接-始终,不用填写服务器ip
- IOS客户端强制禁止非https连接,只能给nginx配域名和证书,conf示例里有配置注释

3.经测试plex对strm文件仅限于显示元信息,不具备播放条件

3.可能会有其他问题,请留言

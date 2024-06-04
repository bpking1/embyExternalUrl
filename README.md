### 主要功能
| 名称 | 功能 |
| - | :- |
| [emby2Alist](./emby2Alist/README.md) | emby/jellyfin 挂载 alist 转直链 |
| embyAddExternalUrl | emby/jellyfin 全客户端(除TV端)添加调用外部播放器按钮 |
| [embyWebAddExternalUrl](./embyWebAddExternalUrl/README.md) | emby/jellyfin/alistWeb 调用外部播放器用户脚本,只支持网页 |
| [plex2Alist](./plex2Alist/README.md) | plex 挂载 alist 转直链 |

### 常见问题
[FAQ](./FAQ.md)

# embyExternalUrl

### emby调用外部播放器服务端脚本:

通过nginx的njs模块运行js脚本,在emby视频的外部链接处添加调用外部播放器链接,所有emby官方客户端可用,
不支持老 TV 客户端等没有外部媒体数据库链接处的情况,另外需要注意电视端内置的 web view 实现方式的兼容性

![](https://raw.githubusercontent.com/bpking1/pics/main/img/Screenshot%202023-02-06%20191721.png)

一. 单独使用方法

这里采用的是docker安装,也可以不使用docker,自己安装njs模块

先下载脚本:
```bash
wget https://github.com/bpking1/embyExternalUrl/releases/download/v0.0.1/addExternalUrl.tar.gz && mkdir -p ~/embyExternalUrl && tar -xzvf ./addExternalUrl.tar.gz -C ~/embyExternalUrl && cd ~/embyExternalUrl
```

然后看情况修改externalUrl.js文件里面的serverAddr

tags 和 groups是从视频版本中提取的关键字作为外链的名字,不需要就不用改

emby.conf默认反代emby-server是本机的8096端口,按需修改

docker-compose.yml默认映射8097端口,按需修改

然后启动docker
```
docker-compose up -d
```
访问8097端口,在视频信息页面的底部就添加了外部播放器链接

日志查看:
```
docker logs -f nginx-embyUrl 2>&1 | grep error
```

二. 与 emby2Alist 整合并共存

1.将 externalUrl.js 放到 emby2Alist 的 conf.d 下与 emby.js 处于同一级

2.将 emby.conf 中的 ## addExternalUrl SETTINGS ## 之间的内容复制到 emby2Alist 的 emby.conf 中 location / 块的上面

3.将 emby.conf 最上面的 js_import 复制到 emby2Alist 的 emby.conf 相同位置

4.重启 ngixn 或者输入命令 nginx -s reload 重载配置文件,注意此时使用 emby2Alist 的 nginx 对应端口访问

三. 集成版 docker 一键部署

1.简化配置,拉取镜像映射配置文件即可一键启动。 

2.支持 SSL,内置 acme 自动申请证书、定时更新证书。

3.支持重启自动更新,简化更新流程。

[项目地址](https://github.com/thsrite/MediaLinker?tab=readme-ov-file)

### emby调用外部播放器用户脚本,只支持网页:

[篡改猴地址](https://greasyfork.org/en/scripts/459297-embylaunchpotplayer)




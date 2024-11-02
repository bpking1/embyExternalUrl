---
title: emby/jellyfin 重定向到 alist 直链
date: 2021/09/06 22:00:00
---

## 这篇文章的受众:
写这篇文章默认读者是 emby 用户,使用 rclone 挂载网盘,会使用 docker,因篇幅问题以上软件的使用方法不在文章范围之中,此项目不会对原有的 emby 和rclone 配置造成影响或修改

## 原理:
~~使用[aliyundrive-webdav](https://github.com/messense/aliyundrive-webdav) 项目将阿里盘转为webdav, 再~~
使用 rclone 挂载以供 emby 读取
使用[alist项目](https://github.com/Xhofe/alist) 将阿里盘及别的网盘的文件转为直链,使用 nginx 及其 njs 模块将 emby 视频播放地址劫持到 alist直链 
(~~暂时只测试了od,gd和阿里云盘可用,~~
alist 目前支持好几种网盘,感兴趣的可以测试一下)

## 部署方式,任选一种

### 一.集成版 docker 一键部署

1. 简化配置,拉取镜像映射配置文件即可一键启动。 

2. 支持 SSL,内置 acme 自动申请证书、定时更新证书。

3. 支持重启自动更新,简化更新流程。

[项目地址](https://github.com/thsrite/MediaLinker?tab=readme-ov-file)

### 二.手动在已有的 nginx 环境下部署,步骤基本类似

#### 1.1 nginx proxy manager(WebUI)

https://github.com/chen3861229/embyExternalUrl/issues/73#issuecomment-2452921067


### 三.手动 docker 部署

#### 1.先将配置文件下载到本地

注意版本号和文件名
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

#### 2.修改示例配置
看情况修改 constant.js 中的设置项目,通常来说只需要改 alist 密码
这里默认 emby 在同一台机器并且使用 8096 端口,~~否则要修改 emby.js和emby.conf中emby的地址~~

#### 3.如果不挂载阿里云盘 可以跳过这一步
修改 docker-compose.yml 中 service.ali-webdav 的 REFRESH_TOKEN
获取方法参考原项目地址: https://github.com/messense/aliyundrive-webdav

#### 4.docker 部署的任选以下一种
xxx 为示例目录名,请根据自身情况修改

~~前置条件1: 需要手动创建目录~~
```
/xxx/nginx-emby/log
/xxx/nginx-emby/embyCache
```
~~前置条件2: 需要手动移动项目配置文件~~
~~将本项目xxx2Alist/nginx/下所有文件移动到/xxx/nginx-emby/config/下面~~

#### 4.1 docker-compose
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

#### 4.2 群晖 docker
容器 => 设置 => 导入 => 选择 json 配置文件 => 确认

#### 5.防火墙配置
防火墙放行 5244, 8091 ~~和 8080端口~~
8080 端口为阿里盘 webdav地址,8091 端口为 emby 转直链端口与默认的 8096 互不影响
访问 5244 端口,初始密码查看 docker log 能看到 ,根据项目文档 https://github.com/Xhofe/alist 在 Alist 项目后台添加网盘 
注意:

1. 添加 od,gd 盘可以直接复制 rclone 配置里面的 clientid , secret , refreshToken,不用再麻烦去重新搞一次了
2. **不使用阿里云盘可以跳过这步**
   alist阿里盘的refreshToken与webdav那个token是不一样的,这里需要的是要不需要referrer请求头的token,详情请参考这个[issue](https://github.com/Xhofe/alist/issues/88) , 可以用这个网页来获取 [阿里云盘 - RefreshToken (cooluc.com)](https://media.cooluc.com/decode_token/) 
3. 盘名建议一致,这样获取直链更快,不一致也可以

~~添加的网盘在alist里面的名称需要与 rclone挂载的文件夹名称一样  比如挂载路径为 /mnt/ali 那么盘的名称也要叫 ali~~

#### 6.如果不挂载阿里云盘 可以跳过这一步
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


#### 7.测试是否成功
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

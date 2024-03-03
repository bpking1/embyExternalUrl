---
title: emby挂载alist转直链
date: 2021/09/06 22:00:00
---

### 文章更新记录 
2024/03/01

1.串流地址加入媒体文件名方便标识和字幕匹配

2.添加图片缓存策略可选配置项

2024/01/20

1.添加实验功能,转码分流

2023/12/31

1.115的302需要alist最新版v3.30.0,由于115直链并没有响应允许跨域标识,所以只能用客户端播放,测试emby所有官方客户端和第三方客户端支持跨域,~~不支持跨域的播放为Web浏览器...~~

2.115播放形式为响应302到原始alist链接,由alist再302一次到直链

3.Web浏览器被跨域拦截请使用拓展解决
https://microsoftedge.microsoft.com/addons/detail/modheader-modify-http-h/opgbiafapkbbnbnjcdomjaghbckfkglc
````
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
````
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/3ea94076-829f-4542-88e2-3221b9a8c8f4)

4.添加部分可选配置项,对接emby/jellyfin通知管理员设置,方便排查直链情况

2023/10/02

1.支持strm文件的直链

2023/09/28

1.实现客户端直链下载

2023/2/2

升级到alist v3了，脚本github地址 [bpking1/embyExternalUrl (github.com)](https://github.com/bpking1/embyExternalUrl)

调用外部播放器的油猴脚本账号无法登陆了，换了个新地址:[embyLaunchPotplayer (greasyfork.org)](https://greasyfork.org/en/scripts/459297-embylaunchpotplayer)

2022/5/13

1.兼容jellyfin

2.解决infuse无法播放的问题,感谢@amwamw968

3.用nignx添加了字幕文件的缓存支持

2022/1/12

1.重写了js脚本,支持rclone union,不再需要挂载名和alist盘名一致,不再需要设置emby api_key

2.修复了js脚本不能正确获取同一个视频不同清晰度版本的问题

2021/12/06

1.alist项目作者最近的更新中加入了阿里云盘之外的网盘的支持,且不在需要刷新目录

2.换了另外一个用rust语言写的阿里盘webdav项目,内存占用很小

3.修改了njs脚本中的正则,来修复emby魔改客户端terminusPlayer没有走直链

4.修改nginx配置修复了阿里云盘直链无法在emby web中播放

5.修复了由于反代无法使用jellyfin-mpv-shim直链播放

6.用nignx添加了emby图片的缓存支持

## 这篇文章的受众:
写这篇文章默认读者是emby用户,使用rclone挂载网盘,会使用docker,因篇幅问题以上软件的使用方法不在文章范围之中,此项目不会对原有的emby和rclone配置造成影响或修改

## 原理:
使用[aliyundrive-webdav](https://github.com/messense/aliyundrive-webdav) 项目将阿里盘转为webdav, 再使用rclone挂载以供emby读取
使用[alist项目](https://github.com/Xhofe/alist) 将阿里盘及别的网盘的文件转为直链,使用nginx及其njs模块将emby视频播放地址劫持到 alist直链 (暂时只测试了od,gd和阿里云盘可用,alist目前支持好几种网盘,感兴趣的可以测试一下)

## 步骤:

### 1.先将配置文件下载到本地

```bash
wget https://github.com/bpking1/embyExternalUrl/releases/download/v0.0.1/emby2Alist.tar.gz && mkdir -p ~/emby2Alist && tar -xzvf ./emby2Alist.tar.gz -C ~/emby2Alist && cd ~/emby2Alist
```

此时文件结构如下:
~/emby2Alist
├── docker-compose.yml
└── nginx
    ├── conf.d
    │   ├── emby.conf
    │   └── emby.js
    └── nginx.conf

### 2. 
看情况修改emby.js 中的设置项目,通常来说只需要改alist密码
这里默认emby在同一台机器并且使用8096端口,否则要修改 emby.js和emby.conf中emby的地址
### 3 . 如果不挂载阿里云盘 可以跳过这一步
修改docker-compose.yml 中 service.ali-webdav 的 REFRESH_TOKEN
获取方法参考原项目地址: https://github.com/messense/aliyundrive-webdav

### 4. 
启动服务: 在 ~/emby2Alist 目录下执行
```bash
docker-compose up -d
```
查看启动log:
```bash
docker-compose logs -f
```
如果log有报错,请按照提示信息修改 ,常见错误可能为
1. docker端口占用冲突:  修改docker-comopse映射端口
2. webdav 的refresh token 填写错误 (**如果不挂载阿里云盘则忽略**)

### 5. 
防火墙放行 5244, 8095 和 8080端口
8080端口为阿里盘 webdav地址 , 8095端口为emby转直链端口与默认的8096互不影响
访问5244端口,初始密码查看docker log能看到 ,根据项目文档 https://github.com/Xhofe/alist 在Alist项目后台添加网盘 
注意: 

1. 添加od,gd盘可以直接复制rclone配置里面的 clientid , secret , refreshToken,不用再麻烦去重新搞一次了
2. **不使用阿里云盘可以跳过这步**
   alist阿里盘的refreshToken与webdav那个token是不一样的,这里需要的是要不需要referrer请求头的token,详情请参考这个[issue](https://github.com/Xhofe/alist/issues/88) , 可以用这个网页来获取 [阿里云盘 - RefreshToken (cooluc.com)](https://media.cooluc.com/decode_token/) 
3. 盘名建议一致,这样获取直链更快,不一致也可以

~~添加的网盘在alist里面的名称需要与 rclone挂载的文件夹名称一样  比如挂载路径为 /mnt/ali 那么盘的名称也要叫 ali~~

### 6. 如果不挂载阿里云盘 可以跳过这一步
配置rclone,挂载网盘,这里以阿里盘webdav为例

使用rclone 挂载 阿里盘webdav 
第一步name  我这里为 ali
rclone config  选 webdav , 地址为http://localhost:8080 默认用户和密码都为admin
rclone lsf ali:  看一下能否获取到列表
创建文件夹:
mkdir -p /mnt/ali     注:此挂载文件夹的名字需要与 Alist 中的盘名相同
挂载:

```bash
nohup rclone mount ali: /mnt/ali --umask 0000 --default-permissions --allow-non-empty --allow-other --buffer-size 32M --vfs-read-chunk-size 64M --vfs-read-chunk-size-limit 1G &
```
也可以写成service


### 7.

访问 8095端口打开emby 测试直链是否生效,查看执行log
```bash
docker logs -f -n 10 emby-nginx 2>&1  | grep js:
```
8095端口为走直链端口  , 原本的 8096端口 走 emby server 不变
直链播放不支持转码,转码的话只能走emby server
所以最好 在emby设置中将 播放 --> 视频 --> 互联网质量 设置为最高 ,并且将用户的转码权限关掉,确保走直链
web端各大浏览器对音频和视频编码支持情况不一,碰到不支持的情况emby会强制走转码而不会走直链

## 已知问题:
1. emby web播放时如果需要使用内封的字幕,实际上是需要embyServer在后台用ffmpeg去提取的,~~ffmpeg要读取整个视频文件才能获取所有的字幕流,相当于几乎整个视频文件都要通过rclone下载,并且消耗cpu资源,对于比较大的视频文件是不现实的,所以web端建议使用外挂字幕~~,从头读取到字幕流位置截止,大概占文件大小的40%. 只有修改版emby客户端调用MX Player会同时传递所有外挂字幕,其余方式包括串流地址不支持外挂字幕加载,需要手动下载字幕文件并选择装载
2. ~~google Drive由于api的限制直链只能通过server中转,所以还是建议在cf上搭建goindex来获取直链 ,如何给到emby请参考 这篇[文章](https://blog.738888.xyz/2021/09/09/emby%E6%8C%82%E8%BD%BD%E7%BD%91%E7%9B%98%E8%BD%AC%E7%9B%B4%E9%93%BE%E6%92%AD%E6%94%BE/)结尾,另外一种方法是给alist添加cf worker中转gd的支持,有待研究~~
alist新版已经支持cf worker代理gd下载了,详情参考alist文档
3. 可能会有其他问题,请留言

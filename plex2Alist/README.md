---
title: plex 重定向到 alist 直链
date: 2023/11/04 22:00:00
---

## 使用步骤:

### 1.先将配置文件下载到本地

此时大致文件结构如下:
```javascript
~/plex2Alist
├── docker // 创建容器脚本文件夹
|   ├── docker-compose.yml // docker-compose 脚本,根据自身情况修改
|   ├── nginx-plex.syno.json // 群晖 docker 脚本,根据自身情况修改
└── nginx // nginx 配置文件夹
    ├── conf.d // nginx 配置文件夹
    |   ├── api // JS 脚本文件夹,完全不用改
    |   ├── cert // SSL 证书文件夹,根据自身情况修改
    |   ├── common // 通用工具类文件夹,完全不用改
    |   ├── config // 常量拆分后配置文件,若为 constant-all.js 完全不用改,若为 constant-main.js 则需要更改对应拆分文件
    |   ├── exampleConfig // 示例 constant 配置文件夹
    |   ├── includes // 拆分的 conf 文件夹,http 和 https 端口在这改
    |   ├── constant.js // 常量主配置文件,根据自身情况修改
    │   ├── plex.conf // plex 配置文件,根据自身情况修改,注意 https 默认被注释掉了
    │   └── plex.js // 主脚本,完全不用改
    └── nginx.conf // nginx 配置文件,一般不用改
```

### 2. 
看情况修改 constant.js 中的设置项目,通常来说只需要改 alist 密码
这里默认 plex 在同一台机器并且使用 32400 端口,

### 3. docker部署的任选以下一种
### 3.1 - docker-compose
启动服务: 在 ~/plex2Alist/docker 目录下执行
```bash
docker-compose up -d
```
查看启动log:
```bash
docker-compose logs -f
```
如果log有报错,请按照提示信息修改 ,常见错误可能为
1. docker 端口占用冲突: 修改 docker-comopse 映射端口

### 3.2 - 群晖docker
容器=>设置=>导入=>选择json配置文件=>确认

### 4.1 http
防火墙放行 http(当前默认) 的 8091 端口和 https(需要自己配置证书并启用) 的 8095 为 plex 转直链端口与默认的 32400 互不影响
访问 alist,查看 token,管理=>设置=>其他=>令牌,根据项目文档 https://github.com/Xhofe/alist 在Alist项目后台添加网盘

### 4.2 https
4.2.1 更改`plex2Alist/nginx/conf.d/plex.conf`第 25-26 行,注释默认的 http 访问方式,打开 https 的访问
```js
## Include the http and https configs, better don't use same port
# include /etc/nginx/conf.d/includes/http.conf;
include /etc/nginx/conf.d/includes/https.conf;
```
4.2.2 注意下`plex2Alist/nginx/conf.d/includes/https.conf`中第 12-13 行的,证书文件,证书密钥的路径位置与文件名
```js
ssl_certificate      /etc/nginx/conf.d/cert/fullchain.pem;  ## Location of your public PEM file.
ssl_certificate_key  /etc/nginx/conf.d/cert/privkey.key;  ## Location of your private PEM file.
```
4.2.3 假如不更改默认的证书路径和文件名,直接将证书文件,证书密钥,改为上面的默认文件名,然后放置到`plex2Alist/nginx/conf.d/cert`目录下即可

4.2.4 配置文件更改完成后,需要终端执行`nginx -s reload`或直接重启 nginx 服务刷新配置文件生效

4.2.5 此时通过默认 https 脚本中默认的`8095`端口访问,`http.conf`中的`8091`端口已经被释放无法访问,假如是`Docker`环境,需要检查下容器是否正确映射出了`8095`到`宿主机`上,假如`路由器需要做端口转发(内部端口/宿主机 8095 到外部端口 8095)`开放在公网上,也需要检查下路由器中的设置

### 5. plex 服务端控制台设置
1.设置远程访问-手动设置公开端口为 nginx 的 8091 端口,避免客户端优先直连 32400,如果路由器做了 32400 端口转发,不影响外部访问
2.plex情况特殊,服务端必须设置-网络-自定义服务器访问 URL: [https://自己的域名:自己的端口号],以发布到 plex.tv 发现服务器,
客户端保持默认设置,不用更改高级设置-自定义ip和端口,高级设置-允许非加密连接-永不,如果plex源服务器没有配证书(也不用配),同时不要更改nginx的proxy_pass 值,也就是 constant.js 中的 plexHost 值,保持[http://]开头

### 6. plex 客户端设置
关闭自动质量调节,所有串流改为最高质量或原始,根据自身流量套餐情况选择关闭数据流量下的带宽限制,如限制为 WIFI 网络或关闭允许低码率质量

### 7. 测试是否成功
访问 8091 端口打开 plex 测试直链是否生效,查看执行 log
```bash
docker logs -f -n 10 nginx-plex 2>&1 | grep js:
```
或者直接查看 ../nginx/log 容器映射出来的原始 nginx error.log 业务日志
8091 端口为走直链端口  , 原本的 32400 端口 走 plex server 不变
最好在 plex 设置中将所有 互联网质量 设置为最高,
web 端各大浏览器对音频和视频编码支持情况不一,碰到不支持的情况 plex 会强制走转码而不会走直链

### 8. 补充说明
鉴于 plex 除了 web 外各客户端对于不安全内容 http 默认都是禁止状态,故强烈建议配置域名和证书,
具体查看 plex2Alist/nginx/conf.d/includes/https.conf 文件,注意端口为 8095,且需要放开 
plex2Alist/nginx/conf.d/plex.conf 中的注释 # include /etc/nginx/conf.d/includes/https.conf;

## 已知问题:
1.PlexWeb 自身存在很多问题,不支持 DTS 的直接播放,不支持所有非内嵌字幕的直接播放,使用起来就是已经直连云盘在接收数据了,但是 Web 播放器卡住不动,页签内存过载就直接白屏了,Web 只支持简单格式的内嵌字幕视频,解决方案为使用对应平台的客户端,经测试,安卓客户端是没问题的。
![47dc8412c5d0b46aac999d4c3aae36ae](https://github.com/bpking1/embyExternalUrl/assets/42368856/625731e4-a8b9-46f9-b511-96aba4498485)
![baddd39444f9ca6f2069209c2f73f9d](https://github.com/bpking1/embyExternalUrl/assets/42368856/47be6ced-e630-460b-9a7d-bfdedc795907)
![cf1b5edc12c2fd2b52eed17ab3afc85](https://github.com/bpking1/embyExternalUrl/assets/42368856/8bd44d0e-3761-4dc8-b86e-fa3baf8163b6)

2.各客户端对非默认端口的支持不同
- 例如安卓客户端打开客户端高级设置-允许非加密连接-始终,服务端自定义了网络发现地址的不用填写服务器ip
- IOS 客户端强制禁止非 https 连接,只能给 nginx 配域名和证书,conf示例里有配置注释

~~3.经测试plex对strm文件仅限于显示元信息,不具备播放条件~~

4.可能会有其他问题,请留言

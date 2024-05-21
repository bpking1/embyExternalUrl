### alist 调用外部播放器用户脚本,支持网页和服务端:

[篡改猴地址](https://greasyfork.org/zh-CN/scripts/494829)

需要更改的地方:

1.代码内部变量
````js
// 是否替换原始外部播放器
const replaceOriginLinks = true;
````

效果:
AList V3
![alt text](aabd331039262d2c073ea52dc51c5d24.png)

AList V2
![alt text](image.png)

一. 浏览器单独使用方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net) 拓展插件,
2. 进入脚本详情页点击安装
3. 打开已安装的脚本列表,点击启用按钮,再点击最后边的编辑按钮,选择设置选项卡,
编辑 包括/排除,去掉 原始匹配 勾选的泛化全域名,在 用户匹配 中添加响应的 alist 域名,不能包含端口号,会被忽略

二. 添加到服务端 alist 网站上

1. 登录 alist 管理后台 -> 设置 -> 全局 -> 自定义头部,填入脚本地址即可
````js
<!-- 这是 alist 原本自带的 -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=String.prototype.replaceAll"></script>
<!-- 自己下载到服务器本地开放此文件出来 -->
<!-- <script src="https://xxx:85/alistWebLaunchExternalPlayer.js"></script> -->
<!-- 或下面的 CDN 仓库二选一 -->
<!-- <script src="https://fastly.jsdelivr.net/gh/chen3861229/embyExternalUrl@main/embyWebAddExternalUrl/alistWebLaunchExternalPlayer.js"></script> -->
<!-- <script src="https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/alistWebLaunchExternalPlayer.js"></script> -->
````

#### 其余注意事项请参照
[篡改猴地址](https://greasyfork.org/en/scripts/459297-embylaunchpotplayer)

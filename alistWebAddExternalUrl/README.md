
### alist 调用外部播放器用户脚本,支持网页和服务端:

greasyfork 地址: https://greasyfork.org/zh-CN/scripts/494829

按需更改的地方:

1.代码内部变量

```js
// 是否替换原始外部播放器
const replaceOriginLinks = true;
// 是否使用内置的 Base64 图标
const useInnerIcons = true;
// 移除最后几个冗余的自定义开关
const removeCustomBtns = false;
```

效果:

AList V3
![](https://emby-external-url.7o7o.cc/alistWebAddExternalUrl/preview/preview01.png)

AList V2
![](https://emby-external-url.7o7o.cc/alistWebAddExternalUrl/preview/preview02.png)

一. 浏览器单独使用方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net) 拓展插件,
2. 进入脚本详情页点击安装
3. 打开已安装的脚本列表,点击启用按钮,再点击最后边的编辑按钮,选择设置选项卡,
编辑 包括/排除,去掉 原始匹配 勾选的泛化全域名,在 用户匹配 中添加响应的 alist 域名,不能包含端口号,会被忽略

二. 添加到服务端 alist 网站上

1. 登录 alist 管理后台 -> 设置 -> 全局 -> 自定义头部,填入脚本地址即可

```js
<!-- 这是 alist 原本自带的 -->
<script src="https://polyfill.io/v3/polyfill.min.js?features=String.prototype.replaceAll"></script>
<!-- 自己下载到服务器本地开放此文件出来 -->
<!-- <script src="https://xxx:85/alistWebLaunchExternalPlayer.js"></script> -->
<!-- 或下面的 CDN 仓库二选一 -->
<!-- <script src="https://emby-external-url.7o7o.cc/alistWebAddExternalUrl/alistWebLaunchExternalPlayer.js"></script> -->
<!-- <script src="https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/alistWebLaunchExternalPlayer.js"></script> -->
```

#### 其余注意事项请参照
greasyfork 地址: https://greasyfork.org/en/scripts/459297-embylaunchpotplayer

### CHANGELOG

#### 1.1.3
1. fix(alistWebLaunchExternalPlayer): 提供内部变量移除最后几个冗余的自定义开关

#### 1.1.2
1. feat(alistWebLaunchExternalPlayer): 隐藏其他平台播放器开关数据隔离,添加多开Potplayer开关

#### 1.1.1
1. 添加几个播放器支持
2. 默认开启隐藏其他平台播放器图标

#### 1.1.0
1. 修复剪切板 API 兼容性

#### 1.0.9
1. 修复 Google Chrome Version >= 130 导致的 PotPlayer 拉起播放错误,但注意不要禁用剪切板权限
2. 意外修复了 PotPlayer 串流的中文标题支持问题

#### 1.0.8
1. 修复 mpv-handler 编码错误
2. 更换 @match 为严格匹配以兼容暴力猴

#### 1.0.7
1. 再次修复 URL 编码错误

#### 1.0.6
1. 优先使用本地 base64 图标提升加载速度

#### 1.0.5
1. 修复 MX 错误的注释内容

#### 1.0.4
1. 延迟加载点以适配服务端自定义头部

#### 1.0.3
1. 兼容 AList V2

#### 1.0.2
1. 降低 token 依赖适配第三方网站

#### 1.0.1
1. 修复错误的 URL 双重编码

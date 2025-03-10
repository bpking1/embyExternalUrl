
### emby 调用外部播放器用户脚本,支持网页和服务端:

### 现用户脚本更新地址
https://greasyfork.org/zh-CN/scripts/514529


### 原作者(bpking1)提示信息

1. 添加mpv player, 桌面端需要使用这个项目进行设置 https://github.com/akiirui/mpv-handler
2. 请使用Potplayer官方最新版,目前的版本号是230208,影片标题中文表现为乱码,需要等potplayer官方更新才行
3. PotPlayer可以调用外挂字幕,未选中外挂字幕的时候默认会尝试加载中文外挂字幕
4. 取消直链网盘播放按钮,直链需求可以在emby_server解决,请参考 [这篇文章](https://blog.738888.xyz/posts/emby_jellyfin_to_alist_directlink)
5. potPlayer调用不生效的情况通常是注册表没加上,请重新安装pot官网最新版
6. 需要多开potPlayer的话,将脚本第186行左右的 /current 删除即可
7. 推荐直接将js脚本部署到emby_server,这样就不需要油猴了: 以linux为例,在/opt/emby-server/system/dashboard-ui目录下新建externalPlayer.js文件,将本脚本内容复制到里面,然后在当前目录下的index.html的 /body上面引入脚本即可
8. 提示信息引用至原地址1: https://greasyfork.org/zh-CN/scripts/459297-embylaunchpotplayer
9. 原脚本的账号无法登陆了,以后在这个地址更新,原地址2 https://greasyfork.org/en/scripts/406811-embylaunchpotplayer ,github地址: https://github.com/bpking1/embyExternalUrl

### 部署方式,任选一种

## 一.原生部署到服务端上(推荐)
1. 优点是不依赖其他插件,例如: 油猴/篡改猴, 所有 Web 端共享加载插件,缺点是用户无法手动禁用插件,且非 Web 端不生效
2. 修改服务端的`../emby-server/system/dashboard-ui/index.html`最下方,/body 标签上,`<script src="apploader.js" defer></script>`这行的下方添加,
```js
...
    <script src="https://emby-external-url.7o7o.cc/embyWebAddExternalUrl/embyLaunchPotplayer.js" defer></script>
</body>
```
3. 客户端浏览器刷新页面或清空缓存生效

## 二.服务端插件用户脚本管理器部署方式(推荐)
1. 优点是多端统一共用,支持强制启用,手动启用或禁用插件,更为灵活与现代化,缺点是依赖第三方用户脚本管理器,属于 emby 插件,也可添加其它类型脚本并快捷管理,但同样需要服务端与客户端配合使用[CustomCssJS](https://github.com/Shurelol/Emby.CustomCssJS),服务端改一次,客户端修改集成可手动参考三,不想自己改的可直接使用第三方魔改增强版已内置 **CustomCssJS** 集成的即可,缺点为无 iOS 端的已修改版

## 三.浏览器用户脚本管理器部署方式
1. 优点是最传统且符合习惯,缺点是甚至每个浏览器都需要装用户脚本管理器

## 四.其他部署方式和各客户端集成方式
1. 参考: 
https://github.com/chen3861229/dd-danmaku#%E5%AE%89%E8%A3%85

## 按需更改的地方

1.代码内部变量

```js
const iconConfig = {
    // 图标来源,以下三选一,注释为只留一个,3 的优先级最高
    // 1.add icons from jsdelivr, network
    baseUrl: "https://emby-external-url.7o7o.cc/embyWebAddExternalUrl/icons",
    // baseUrl: "https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/icons",
    // 2.server local icons, same as /emby-server/system/dashboard-ui/icons
    // baseUrl: "icons",
    // 3.add icons from Base64, script inner, this script size 22.5KB to 74KB,
    // 自行复制 ./iconsExt.js 内容到此脚本的 getIconsExt 中
    // 移除最后几个冗余的自定义开关
    removeCustomBtns: false,
};
// 启用后将修改直接串流链接为真实文件名,方便第三方播放器友好显示和匹配,
// 默认不启用,强依赖 nginx-emby2Alist location two rewrite,如发现原始链接播放失败,请关闭此选项
const useRealFileName = false;
```

效果:

Emby Web, iconOnly: false
![image](https://emby-external-url.7o7o.cc/embyWebAddExternalUrl/preview/preview01.png)

Emby Web, iconOnly: true
![image](https://emby-external-url.7o7o.cc/embyWebAddExternalUrl/preview/preview02.png)

### CHANGELOG

#### 1.1.20
1. fix(embyLaunchPotplayer): 适配 4.9.0.40
2. refactor(embyLaunchPotplayer): 抽取 selectors

#### 1.1.19
1. fix(embyLaunchPotplayer): 提供内部变量移除最后几个冗余的自定义开关并添加图标
2. feat(embyLaunchPotplayer): 提供 strm 播放链接直通开关

#### 1.1.18
1. feat(embyLaunchPotplayer): 添加多开 Potplayer 开关

#### 1.1.17
1. 优化图标/文字模式,隐藏其他平台播放器,两个开关的数据隔离

#### 1.1.16
1. 补充丢失的 icon-MXPlayerPro

#### 1.1.15
1. 添加几个播放器支持
2. 默认开启隐藏其他平台播放器图标

#### 1.1.14
1. 修复剪切板 API 兼容性

#### 1.1.13
1. 修复 Google Chrome Version >= 130 导致的 PotPlayer 拉起播放错误,但注意不要禁用剪切板权限
2. 意外修复了 PotPlayer 串流的中文标题支持问题
3. 更换为现代方式写入剪切板 API 以支持火狐,且可能会导致老旧浏览器无法复制

#### 1.1.12
1. 更换默认的网络图标 CDN 为 Cloudflare Pages 地址,以改善中国移动宽带的体验
2. 更换 @match 为严格匹配以兼容暴力猴

#### 1.1.11
1. 播放链接添加 DeviceId 参数

#### 1.1.10
1. 修复 mpv-handler 编码错误

#### 1.1.9
1. 修复非管理员账号 ddplay 的无 filePath 错误

#### 1.1.8
1. 修复自定义的串流和下载地址

#### 1.1.7
1. 添加 iconOnly 设置
2. 兼容Jellyfin 10.9.6 +

#### 1.1.6
1. 重构 html 字符串为 js 对象方式,方便排错
2. 修复未定义变量
3. 复制并填写了 getIconsExt 函数时优先使用本地图标提升加载速度
4. 修复 live 文件名

#### 1.1.5
1. 修复复制链接按钮

#### 1.1.4
1. 兼容 jellfin 10.8.13
2. stream 提供 useRealFileName 开关
3. 修复无当前集情况
4. 调整 JellyfinWebMobileCss 上的样式

#### 1.1.3
1. 同步 emby2Alist 中对 stream.ext 的修改
2. 修复错误的 URL 双重编码

#### 1.1.2
1. 兼容播放列表页
2. 修正一个造成当前集无法播放的 bug
3. 兼容直播详情页
4. 添加弹弹 play 和 base64 图标方式
5. 兼容 jellfin
6. 修复直播页面 bug

#### 1.1.1
兼容首次没有音视频信息加载(STRM)

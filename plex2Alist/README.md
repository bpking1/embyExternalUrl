---
title: plex挂载阿里盘转直链
date: 2023/11/04 22:00:00
---

### 文章更新记录 
2023/11/04
1.参考博客(https://blog.738888.xyz/posts/plex_to_alist_directlink)中的plex直链功能并参考之前的njs实现，实验性(bug)性质支持了直链播放，因为只找到社区维护的简易API(https://plex-docs.vercel.app)，所以实现方式比较别扭，目前存在多版本视频不能直链下载的bug。
2.Plex要直链播放只需要设置远程访问-手动设置公开端口为nginx监听端口，避免客户端优先直连32400，如果路由器做了32400端口转发，不影响外部访问。
![image](https://github.com/bpking1/embyExternalUrl/assets/42368856/9abc036a-72db-4434-9be7-1f31c2686bb2)

## 已知问题:
1. 
PlexWeb自身存在很多问题，不支持DTS的直接播放，不支持所有非内嵌字幕的直接播放，使用起来就是已经直连云盘在接收数据了，但是Web播放器卡住不动，页签内存过载就直接白屏了，Web只支持简单格式的内嵌字幕视频，解决方案为使用对应平台的客户端，经测试，安卓客户端是没问题的。
![47dc8412c5d0b46aac999d4c3aae36ae](https://github.com/bpking1/embyExternalUrl/assets/42368856/625731e4-a8b9-46f9-b511-96aba4498485)
![baddd39444f9ca6f2069209c2f73f9d](https://github.com/bpking1/embyExternalUrl/assets/42368856/47be6ced-e630-460b-9a7d-bfdedc795907)
![cf1b5edc12c2fd2b52eed17ab3afc85](https://github.com/bpking1/embyExternalUrl/assets/42368856/8bd44d0e-3761-4dc8-b86e-fa3baf8163b6)
3. 可能会有其他问题,请留言

// ==UserScript==
// @name         alistWebLaunchExternalPlayer
// @name:en      alistWebLaunchExternalPlayer
// @name:zh      alistWebLaunchExternalPlayer
// @name:zh-CN   alistWebLaunchExternalPlayer
// @namespace    http://tampermonkey.net/
// @version      1.0.5
// @description  alist Web Launc hExternal Player
// @description:zh-cn alistWeb 调用外部播放器, 注意自行更改 UI 中的包括/排除,或下面的 @match
// @description:en  alist Web Launch External Player
// @license      MIT
// @author       @Chen3861229
// @github       https://github.com/bpking1/embyExternalUrl
// @match        */*
// ==/UserScript==

(function () {
    'use strict';
    // 是否替换原始外部播放器
    const replaceOriginLinks = true;
    // 以下为内部使用变量,请勿更改
    let osType = "";
    async function init() {
        const playLinksWrapperEle = getShowEle();
        const linksEle = playLinksWrapperEle.getElementsByTagName("a");
        const oriLinkEle = linksEle[0];
        if (!oriLinkEle) {
            console.warn(`not have oriLinkEle, skip`);
            return;
        }

        const htmlTemplate = (id, imgSrc) => 
            `<a id="${id}" class="" href="" title="${id}"><img class="" src="${imgSrc}"></a>`;
        const iconBaseUrl = "https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/icons";
        const diffLinks = [
            {id: "StellarPlayer", imgSrc: `${iconBaseUrl}/icon-StellarPlayer.webp`},
            {id: "MPV", imgSrc: `${iconBaseUrl}/icon-MPV.webp`},
            {id: "DDPlay", imgSrc: `${iconBaseUrl}/icon-DDPlay.webp`},
        ];
        const sameLinks = [
            {id: "IINA", imgSrc: `${iconBaseUrl}/icon-IINA.webp`},
            {id: "Pot", imgSrc: `${iconBaseUrl}/icon-PotPlayer.webp`},
            {id: "VLC", imgSrc: `${iconBaseUrl}/icon-VLC.webp`},
            {id: "NPlayer", imgSrc: `${iconBaseUrl}/icon-NPlayer.webp`},
            {id: "Infuse", imgSrc: `${iconBaseUrl}/icon-infuse.webp`},
            {id: "MXPlayer", imgSrc: `${iconBaseUrl}/icon-MXPlayer.webp`},
        ];
        const insertLinks = (links, container) => {
            let htmlStr = links.map(link => htmlTemplate(link.id, link.imgSrc)).join("");
            container.insertAdjacentHTML("beforeend", htmlStr);
        };
        if (replaceOriginLinks) {
            playLinksWrapperEle.innerHTML = "";
            // sameLinks always before diffLinks
            insertLinks([...sameLinks, ...diffLinks], playLinksWrapperEle);
        } else {
            insertLinks(diffLinks, playLinksWrapperEle);
        }
        playLinksWrapperEle.setAttribute("inited", "true");

        // fill original links properties
        for (let i = 0; i < linksEle.length; i++) {
            // a tag element
            linksEle[i].className = oriLinkEle.className;
            // img tag element
            const oriImgEle = oriLinkEle.children[0];
            if (!!oriImgEle) {
                linksEle[i].children[0].className = oriImgEle.className;
            } else {
                linksEle[i].children[0].style = "height: inherit";
            }
        }
        
        // get mediaInfo from original a tag href
        const streamUrl = decodeURIComponent(oriLinkEle.href.match(/\?(.*)$/)[1].replace("url=", ""));
        const urlObj = new URL(streamUrl);
        const filePath = decodeURIComponent(urlObj.pathname.substring(urlObj.pathname.indexOf("/d/") + 2));
        const fileName = filePath.replace(/.*[\\/]/, "");
        let subUrl = "";
        const token = localStorage.getItem("token");
        if (!!token) {
            const alistRes = await fetchAlistApi(`${urlObj.origin}/api/fs/get`, filePath, token);
            if (alistRes.related) {
                const subFileName = findSubFileName(alistRes.related);
                subUrl = !!subFileName
                ? `${urlObj.protocol}//${urlObj.host}${encodeURIComponent(streamUrl.replace(alistRes.name, subFileName))}` : "";
            }
        } else {
            console.warn(`localStorage not have token, maybe is not this site owner, skip subtitles process`);
        }

        const mediaInfo = {
            title: fileName,
            streamUrl,
            subUrl,
            position: 0,
        }

        console.log(`mediaInfo:`, mediaInfo);
        osType = getOS();
        console.log(`getOS type: ${osType}`);

        // add link href
        const linkIdsMap = {
            IINA: getIINAUrl,
            Pot: getPotUrl,
            VLC: getVlcUrl,
            NPlayer: getNPlayerUrl,
            Infuse: getInfuseUrl,
            MXPlayer: getMXUrl,
            // diff
            StellarPlayer: getStellarPlayerUrl,
            MPV: getMPVUrl,
            DDPlay: getDDPlayUrl,
        };
        for (let i = 0; i < linksEle.length; i++) {
            const id = linksEle[i].id;
            if (id && id in linkIdsMap) {
                linksEle[i].href = linkIdsMap[id](mediaInfo);
            }
        }
    }

    function getShowEle() {
        return document.querySelector("div.obj-box .hope-flex") // AList V3
            ?? document.querySelector(".chakra-wrap__list"); // AList V2
    }

    async function fetchAlistApi(alistApiPath, alistFilePath, alistToken, ua) {
        const alistRequestBody = {
            path: alistFilePath,
            password: "",
        };
        try {
            const response = await fetch(alistApiPath, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json;charset=utf-8",
                    Authorization: alistToken,
                    "User-Agent": ua,
                },
                body: JSON.stringify(alistRequestBody),
            });
            if (!response.ok) {
                throw new Error(`fetchAlistApi response was not ok. Status: ${response.status}`);
            }
            const alistRes = await response.json();
            if (alistRes.error || alistRes.code !== 200) {
                throw new Error(`fetchAlistApi response had an error or non-200 status. Code: ${alistRes.code}`);
            }
            return alistRes.data;
        } catch (error) {
            console.error(`Error fetching API: ${error.message}`);
            throw error;
        }
    }

    function findSubFileName(related) {
        let subFileName = "";
        const subs = related.filter(o => o.type === 4);
        if (subs.length === 0) {
          console.log(`not have subs, skip`);
        } else {
          const cnSubs = subs.filter(o => o.name.match(/chs|sc|chi|cht|tc|zh/i));
          if (cnSubs.length === 0) {
            console.log(`not have cnSubs, will use first sub`);
            subFileName = subs[0].name;
          } else {
            console.log(`have cnSubs, will use first cnSub`);
            subFileName = cnSubs[0].name;
          }
        }
        return subFileName;
    }

    // URL with "intent" scheme 只支持
    // String => 'S'
    // Boolean =>'B'
    // Byte => 'b'
    // Character => 'c'
    // Double => 'd'
    // Float => 'f'
    // Integer => 'i'
    // Long => 'l'
    // Short => 's'

    // https://github.com/iina/iina/issues/1991
    function getIINAUrl(mediaInfo) {
        return `iina://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`;
    }

    function getPotUrl(mediaInfo) {
        return `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub=${encodeURI(mediaInfo.subUrl)} /current /title="${mediaInfo.title}"}`;
    }

    // https://wiki.videolan.org/Android_Player_Intents/
    function getVlcUrl(mediaInfo) {
        // android subtitles:  https://code.videolan.org/videolan/vlc-android/-/issues/1903
        let vlcUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.subtitles_location=${encodeURI(mediaInfo.subUrl)};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
        if (osType == 'windows') {
            // 桌面端需要额外设置,参考这个项目: https://github.com/stefansundin/vlc-protocol 
            vlcUrl = `vlc://${encodeURI(mediaInfo.streamUrl)}`;
        }
        if (osType == 'ios') {
            // https://wiki.videolan.org/Documentation:IOS/#x-callback-url
            // https://code.videolan.org/videolan/vlc-ios/-/commit/55e27ed69e2fce7d87c47c9342f8889fda356aa9
            vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
        }
        return vlcUrl;
    }

    // https://sites.google.com/site/mxvpen/api
    // https://mx.j2inter.com/api
    // https://support.mxplayer.in/support/solutions/folders/43000574903
    function getMXUrl(mediaInfo) {
        // mxPlayer free
        let mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
        // mxPlayer Pro
        // let mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.pro;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
        return mxUrl;
    }

    function getNPlayerUrl(mediaInfo) {
        let nUrl = osType == 'macOS' 
            ? `nplayer-mac://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1` 
            : `nplayer-${encodeURI(mediaInfo.streamUrl)}`;
        return nUrl;
    }

    function getInfuseUrl(mediaInfo) {
        // sub 参数限制: 播放带有外挂字幕的单个视频文件（Infuse 7.6.2 及以上版本）
        // see: https://support.firecore.com/hc/zh-cn/articles/215090997
        return `infuse://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
    }

    // StellarPlayer
    function getStellarPlayerUrl (mediaInfo) {
        return `stellar://play/${encodeURI(mediaInfo.streamUrl)}`;
    }

    // MPV
    function getMPVUrl(mediaInfo) {
        //桌面端需要额外设置,使用这个项目: https://github.com/akiirui/mpv-handler
        let streamUrl64 = btoa(encodeURIComponent(mediaInfo.streamUrl))
            .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
        let MPVUrl = `mpv://play/${streamUrl64}`;
        if (mediaInfo.subUrl.length > 0) {
            let subUrl64 = btoa(mediaInfo.subUrl).replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
            MPVUrl = `mpv://play/${streamUrl64}/?subfile=${subUrl64}`;
        }

        if (osType == "ios" || osType == "android") {
            MPVUrl = `mpv://${encodeURI(mediaInfo.streamUrl)}`;
        }
        return MPVUrl;
    }

    // see https://greasyfork.org/zh-CN/scripts/443916
    function getDDPlayUrl(mediaInfo) {
        // Subtitles Not Supported: https://github.com/kaedei/dandanplay-libraryindex/blob/master/api/ClientProtocol.md
        const urlPart = mediaInfo.streamUrl + `|filePath=${mediaInfo.title}`;
        let url = `ddplay:${encodeURIComponent(urlPart)}`;
        if (osType == "android") {
            url = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
        }
        return url;
    }

    function getOS() {
        let ua = navigator.userAgent
        if (!!ua.match(/compatible/i) || ua.match(/Windows/i)) {
            return 'windows'
        } else if (!!ua.match(/Macintosh/i) || ua.match(/MacIntel/i)) {
            return 'macOS'
        } else if (!!ua.match(/iphone/i) || ua.match(/Ipad/i)) {
            return 'ios'
        } else if (ua.match(/android/i)) {
            return 'android'
        } else if (ua.match(/Ubuntu/i)) {
            return 'ubuntu'
        } else {
            return 'other'
        }
    }

    // monitor dom changements
    const domChangeObserver = new MutationObserver((mutationsList) => {
        console.log("Detected DOM change (Child List)");
        const showElement = getShowEle();
        if (showElement && showElement.getAttribute("inited") !== "true") {
            init();
            // 切换链接类型依赖监视器
            // domChangeObserver.disconnect();
        }
    });
    window.addEventListener("load", () => {
        domChangeObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    // window.addEventListener("popstate", function() {
    //     console.log("Detected page navigation (forward or back button)");
    //     mutation.observe(document.body, {
    //         childList: true,
    //         subtree: true
    //     });
    // });

})();

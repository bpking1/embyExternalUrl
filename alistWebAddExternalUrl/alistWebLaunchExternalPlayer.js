// ==UserScript==
// @name         alistWebLaunchExternalPlayer
// @name:en      alistWebLaunchExternalPlayer
// @name:zh      alistWebLaunchExternalPlayer
// @name:zh-CN   alistWebLaunchExternalPlayer
// @namespace    http://tampermonkey.net/
// @version      1.1.3
// @description  alist Web Launc hExternal Player
// @description:zh-cn alistWeb 调用外部播放器, 注意自行更改 UI 中的包括/排除,或下面的 @match
// @description:en  alist Web Launch External Player
// @license      MIT
// @author       @Chen3861229
// @github       https://github.com/bpking1/embyExternalUrl
// @match        *://*/*
// ==/UserScript==

(function () {
    'use strict';
    // 是否替换原始外部播放器
    const replaceOriginLinks = true;
    // 是否使用内置的 Base64 图标
    const useInnerIcons = true;
    // 移除最后几个冗余的自定义开关
    const removeCustomBtns = false;
    // 以下为内部使用变量,请勿更改
    const mark = "alistWebLaunchExternalPlayer";
    const lsKeys = {
        hideByOS: `${mark}-hideByOS`,
        notCurrentPot: `${mark}-notCurrentPot`,
    };
    let links = [];
    async function init() {
        const playLinksWrapperEle = getShowEle();
        const linksEle = playLinksWrapperEle.getElementsByTagName("a");
        const oriLinkEle = linksEle[0];
        if (!oriLinkEle) {
            console.warn(`not have oriLinkEle, skip`);
            return;
        }

        const htmlTemplate = (id, title, imgSrc) => {
            return imgSrc ?
            `<a id="${id}" class="" href="" title="${title}">
                <img class="" src="${imgSrc}" style="pointer-events: none;">
            </a>` : 
            `<a id="${id}" class="" href="" title="${title}">${title}</a>`;
        }
        const iconBaseUrl = "https://fastly.jsdelivr.net/gh/bpking1/embyExternalUrl@main/embyWebAddExternalUrl/icons";
        const diffLinks = [
            { id: "icon-StellarPlayer", title: "恒星播放器", imgSrc: `${iconBaseUrl}/icon-StellarPlayer.webp`
                , getSrc: getStellarPlayerUrl, osCheck: [OS.isWindows, OS.isMacOS, OS.isAndroid], },
            { id: "icon-MPV", title: "MPV", imgSrc: `${iconBaseUrl}/icon-MPV.webp`, getSrc: getMPVUrl, },
            { id: "icon-DDPlay", title: "弹弹Play", imgSrc: `${iconBaseUrl}/icon-DDPlay.webp`
                , getSrc: getDDPlayUrl, osCheck: [OS.isWindows, OS.isAndroid], },
            { id: "icon-SenPlayer", title: "SenPlayer", imgSrc: `${iconBaseUrl}/icon-SenPlayer.webp`
                , getSrc: getSenPlayerUrl, osCheck: [OS.isIOS], },
            { id: "icon-Copy", title: "复制串流地址", imgSrc: `${iconBaseUrl}/icon-Copy.webp`
                , getSrc: (mediaInfo) => encodeURI(mediaInfo.streamUrl), },
        ];
        const sameLinks = [
            { id: "icon-IINA", title: "IINA", imgSrc: `${iconBaseUrl}/icon-IINA.webp`
                , getSrc: getIINAUrl, osCheck: [OS.isMacOS], },
            { id: "icon-PotPlayer", title: "Potplayer", imgSrc: `${iconBaseUrl}/icon-PotPlayer.webp`
                , getSrc: getPotUrl, osCheck: [OS.isWindows], },
            { id: "icon-VLC", title: "VLC", imgSrc: `${iconBaseUrl}/icon-VLC.webp`, getSrc: getVlcUrl, },
            { id: "icon-NPlayer", title: "NPlayer", imgSrc: `${iconBaseUrl}/icon-NPlayer.webp`, getSrc: getNPlayerUrl, },
            { id: "icon-infuse", title: "Infuse", imgSrc: `${iconBaseUrl}/icon-infuse.webp`
                , getSrc: getInfuseUrl, osCheck: [OS.isApple], },
            { id: "icon-MXPlayer", title: "MXPlayer", imgSrc: `${iconBaseUrl}/icon-MXPlayer.webp`
                , getSrc: getMXUrl, osCheck: [OS.isAndroid], },
            { id: "icon-MXPlayerPro", title: "MXPlayerPro", imgSrc: `${iconBaseUrl}/icon-MXPlayerPro.webp`
                , getSrc: getMXProUrl, osCheck: [OS.isAndroid], },
            { id: "icon-Fileball", title: "Fileball", imgSrc: `${iconBaseUrl}/icon-Fileball.webp`
                , getSrc: getFileballUrl, osCheck: [OS.isApple], },
            { id: "icon-OmniPlayer", title: "OmniPlayer", imgSrc: `${iconBaseUrl}/icon-OmniPlayer.webp`
                , getSrc: getOmniPlayerUrl, osCheck: [OS.isMacOS], },
            { id: "icon-FigPlayer", title: "FigPlayer", imgSrc: `${iconBaseUrl}/icon-FigPlayer.webp`
                , getSrc: getFigPlayerUrl, osCheck: [OS.isMacOS], },
        ];
        const customBtns = [
            { id: "hideByOS", title: "异构播放器", imgSrc: '',  onClick: hideByOSHandler, },
            { id: "notCurrentPot", title: "多开Potplayer", imgSrc: '',  onClick: notCurrentPotHandler, },
        ];
        if (!removeCustomBtns) {
            diffLinks.push(...customBtns);
        }
        links = replaceOriginLinks ? [...sameLinks, ...diffLinks] : [...diffLinks];
        if (useInnerIcons) {
            // add icons from Base64, script inner, this script size 13.5KB to 64KB
            const iconsExt = getIconsExt();
            links.map(link => {
                const iconExt = iconsExt.find(icon => icon.id === link.id);
                if (iconExt) {
                    link.imgSrc = iconExt.url;
                }
            });
        }
        const insertLinks = (links, container) => {
            const htmlStr = links.map(link => htmlTemplate(link.id, link.title, link.imgSrc)).join("");
            container.insertAdjacentHTML("beforeend", htmlStr);
        };
        if (replaceOriginLinks) {
            playLinksWrapperEle.innerHTML = "";
        }
        // sameLinks always before diffLinks
        insertLinks(links, playLinksWrapperEle);
        playLinksWrapperEle.setAttribute("inited", "true");

        // fill original links properties
        for (let i = 0; i < linksEle.length; i++) {
            // a tag element
            linksEle[i].className = oriLinkEle.className;
            // img tag element
            const oriImgEle = oriLinkEle.children[0];
            const newImgEle = linksEle[i].children[0];
            if (oriImgEle) {
                if (newImgEle) {
                    newImgEle.className = oriImgEle.className;
                }
            } else {
                if (newImgEle) {
                    newImgEle.style = "height: inherit";
                }
            }
        }
        
        // get mediaInfo from original a tag href, this is IINA player, see alistWeb $edurl
        const streamUrl = decodeURIComponent(decodeURIComponent(oriLinkEle.href.match(/\?(.*)$/)[1].replace("url=", "")));
        const urlObj = new URL(streamUrl);
        const filePath = decodeURIComponent(urlObj.pathname.substring(urlObj.pathname.indexOf("/d/") + 2));
        const fileName = filePath.replace(/.*[\\/]/, "");
        let subUrl = "";
        const token = localStorage.getItem("token");
        if (token) {
            const alistRes = await fetchAlistApi(`${urlObj.origin}/api/fs/get`, filePath, token);
            if (alistRes.related) {
                const subFileName = findSubFileName(alistRes.related);
                if (subFileName) {
                    subUrl = `${urlObj.protocol}//${urlObj.host}${encodeURIComponent(streamUrl.replace(alistRes.name, subFileName))}`;
                }
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

        // add link href
        links.map(link => {
            const linkEle = document.getElementById(link.id);
            if (!linkEle) { return; }
            if (link.getSrc) {
                linkEle.href = link.getSrc(mediaInfo);
            } else if (link.onClick) {
                linkEle.onclick = (e) => {
                    e.preventDefault();
                    link.onClick(e);
                }
            }
            if (link.id === "icon-PotPlayer") {
                linkEle.onclick = (e) => {
                    e.preventDefault();
                    let url = e.target.href;
                    const notCurrentPotFlag = localStorage.getItem(lsKeys.notCurrentPot) === "1";
                    if (notCurrentPotFlag) {
                        url = url.replace("/current", "");
                    }
                    writeClipboard(url).then(() => {
                        console.log("成功写入剪切板真实深度链接: ", url);
                        url = `potplayer://${notCurrentPotFlag ? "" : "/current"}/clipboard`;
                        window.open(url, "_self");
                    });
                }
            } else if (link.id === "icon-Copy") {
                linkEle.onclick = (e) => {
                    e.preventDefault();
                    copyUrl(mediaInfo, e.target);
                }
            }
        });
        if (!removeCustomBtns) {
            hideByOSHandler();
            notCurrentPotHandler();
        }
    }

    // copy from /embyWebAddExternalUrl/iconsExt.js, 如果更改了以下内容,请同步更改 ./iconsExt
    function getIconsExt() {
        // base64 data total size 72.5 KB from embyWebAddExternalUrl/icons/min, sync modify
        const iconsExt = [
            { id: "icon-PotPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-VLC", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-IINA", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-NPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-MXPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-MXPlayerPro", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-infuse", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-StellarPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-MPV", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-DDPlay", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-Fileball", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-SenPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-OmniPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-FigPlayer", url: `
                data:image/webp;base64,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
            ` },
            { id: "icon-Copy", url: `
                data:image/webp;base64,UklGRk4FAABXRUJQVlA4WAoAAAAQAAAA/wAA/wAAQUxQSBACAAABkJBtb9xIgmAGFYQwSBhMGTQMUgYugwwDQwgEQTAEQRAE7TmXvPr3TkRMAA20XLf96GqeT+3S6nWioZe1qafXZONRLWKe5X7jAa3dc914MIt4vh8jKc+ecuVhcPes3wfB6nl/DIHVM/8YAKvn/h7v8OTbFO3u6dcSiy1/XmM1B9BKJHYIa6SGgZU47CDWOCsKEkdQ8EuU4jBuURYcJMqOg0URHPwSxIC4xSgOZI2xINFiXJGQGCsSGqP+SjL4PEb7Hz6+bns7RPRtDZyy7GKO8+uWZo71a1Z1uF+2qAP+knI45C+Y1LFbzbFbHfZvTQ4eK3ri4K0OHit6D0dP0VsdPUGPHb0VvgM+Q29y9K/wVfgafAJfh0/hM/hO/5/+P/1/+v/0/+n/0/9nARW+Dp/Ad8BX4XuCb4KP0BP4Knwzekro7fAxeo3QY/QagaeM3pXAqwTeTuA1Aq8SdnYl7A4m6GSml6Nl+0yvhUrbXOj1IGlv9Xaht0Xg6fLuhd7VAJgptv4CugQTAEqwlj+j4DV/PdqavyMa569GI0vfHE7SV8Jt2RMKz9nb4pEkjwdQcyc0wGKpu42AauaUhlgscbcxUM2b0iCLpo1HQZMlrdI47zlrNNKasV6GQjVfvdBg79naabysmbKNhlzzJEyD5pYjmWngvPbs2D7T6HkTS0vfZ/pBTk+1Sdc8qErbb1OhEQNWUDggGAMAAFAhAJ0BKgABAAE+kUagS6WjoyGj8QjIsBIJZW7hbyEIFdqEMYrf9GG3H8wHnM+kn/TelB1CO8heUdqtniP/DgYmKGXeqBp6Z6pMaNxdcAyC4hsW/2/0FPTn/wnaoHhrA8UKquqByKg1mxBYJ2OCIkcZOpghvng45gJuaJ6SPY7WzAHc6pIvro+Ha2YA7nVD6g2YA7nVJjIhbWzAGSB6bQ9G8FNjhc6pMM5lla2SBDSY0QNZP2xNrT/4d4wfVepfpcDZrQhpMaJUzUrieNKjMJjUtMj+3kR1s6pJSiNTEwtUQpscLnVJjRubZIENJjRubZgDGg8gbWzAHc6fAq+t6TBeRUGp3j6fH1/rt/oJ2HvQVFrAAP7+moFi6NzM64ySAPxtbw4hdiiUP8IMPhAdodbZ4d/GkkOsyl8Sf4QVoQS28DE1UFb2KmS2jDrPXnPCdVkZgUd7tp3AE/yj7ACfzh6yX+uOm959+n+EaJ6LpZVd/N91ydDgi7dyd+4Y2nxnSeb+TZ0N8V/6A/jsToddevhAEBIt7xEeYRMK+4Edyav+zzZBg52Z4DPN9/nWV4vjXRvpwjvPLoO/aS1fBTqj/tapgrSA1rY9++l/JhaqOdd168v14iXfxmpfHXuRhTfcdP/PB201PFvQDMFakACIPoS+EXKoqaK7BO2m8t5qRp/nNJZe9qRdw99aL5BR+cKwvn5B6gASxCJvu68kYQMc25wX2p2K/8jHyv/So2oriKKG8ABJdsugEOZeVCk8Ouzd9aaKi77faNqMhBm2ySubgzcafvEC6scHek50ClZUc2rBcQ2lETioAappPSNaVLagF8lcHwojckb8SiPfMpR0V70aC/uBKj3bywXYJGEvNnwzqnyEGmdwAdMApv4HxVxj/cG2gl+5vbfVygwXXve32AcBQaEPUxaeyycrrFNXeASBn1kRJkoQjJOoNzfKh3NdI9DtfDvwhNT3gL4EsJaBIx54q061PbBB7LB9Klg2138fnppmffewwWCOWoYvHcAB8K4kkmAyXSmrFIm5gq//WSqv8x2dwAAAAA==
            ` },
        ];
        return iconsExt;
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
        return `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub=${encodeURI(mediaInfo.subUrl)} /current /title="${mediaInfo.title}"`;
    }

    // https://wiki.videolan.org/Android_Player_Intents/
    function getVlcUrl(mediaInfo) {
        // android subtitles:  https://code.videolan.org/videolan/vlc-android/-/issues/1903
        let vlcUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.subtitles_location=${encodeURI(mediaInfo.subUrl)};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
        if (OS.isWindows()) {
            // 桌面端需要额外设置,参考这个项目: https://github.com/stefansundin/vlc-protocol 
            vlcUrl = `vlc://${encodeURI(mediaInfo.streamUrl)}`;
        }
        if (OS.isIOS()) {
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
        const packageName = "com.mxtech.videoplayer.ad";
        return `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=${packageName};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    }

    function getMXProUrl(mediaInfo) {
        // mxPlayer Pro
        const packageName = "com.mxtech.videoplayer.pro";
        return `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=${packageName};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    }

    function getNPlayerUrl(mediaInfo) {
        let nUrl = OS.isMacOS()
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
        let streamUrl64 = btoa(String.fromCharCode.apply(null, new Uint8Array(new TextEncoder().encode(mediaInfo.streamUrl))))
            .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
        let MPVUrl = `mpv://play/${streamUrl64}`;
        if (mediaInfo.subUrl.length > 0) {
            let subUrl64 = btoa(mediaInfo.subUrl).replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
            MPVUrl = `mpv://play/${streamUrl64}/?subfile=${subUrl64}`;
        }

        if (OS.isIOS() || OS.isAndroid()) {
            MPVUrl = `mpv://${encodeURI(mediaInfo.streamUrl)}`;
        }
        return MPVUrl;
    }

    // see https://greasyfork.org/zh-CN/scripts/443916
    function getDDPlayUrl(mediaInfo) {
        // Subtitles Not Supported: https://github.com/kaedei/dandanplay-libraryindex/blob/master/api/ClientProtocol.md
        const urlPart = mediaInfo.streamUrl + `|filePath=${mediaInfo.title}`;
        let url = `ddplay:${encodeURIComponent(urlPart)}`;
        if (OS.isAndroid()) {
            url = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
        }
        return url;
    }

    function getFileballUrl(mediaInfo) {
        return `filebox://play?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
    }

    function getOmniPlayerUrl(mediaInfo) {
        return `omniplayer://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
    }

    function getFigPlayerUrl(mediaInfo) {
        return `figplayer://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
    }

    function getSenPlayerUrl(mediaInfo) {
        return `SenPlayer://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
    }

    function lsCheckSetBoolean(event, lsKeyName) {
        let flag = localStorage.getItem(lsKeyName) === "1";
        if (event) {
            flag = !flag;
            localStorage.setItem(lsKeyName, flag ? "1" : "0");
        }
        return flag;
    }

    function hideByOSHandler(event) {
        const link = document.getElementById("hideByOS");
        if (!link) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.hideByOS);
        const playLinksWrapperEle = getShowEle();
        const linksEle = playLinksWrapperEle.getElementsByTagName("a");
        Array.from(linksEle).forEach(linkEle => {
            const link = links.find(link => link.id === linkEle.id);
            const shouldHide = flag && link.osCheck && !link.osCheck.some(check => check());
            console.log(`${link.id} Should Hide: ${shouldHide}`);
            linkEle.style.display = shouldHide ? 'none' : 'block';
        });
        link.style.backgroundColor = flag ? "rgb(0, 145, 255)" : "";
    }

    function notCurrentPotHandler(event) {
        const link = document.getElementById("notCurrentPot");
        if (!link) {
            return;
        }
        const flag = lsCheckSetBoolean(event, lsKeys.notCurrentPot);
        link.style.backgroundColor = flag ? "rgb(0, 145, 255)" : "";
    }

    async function copyUrl(mediaInfo, target) {
        const streamUrl = encodeURI(mediaInfo.streamUrl);
        if (await writeClipboard(streamUrl)) {
            console.log(`decodeURI for show copyUrl = ${mediaInfo.streamUrl}`);
            target.innerText = '复制成功';
        }
    }

    async function writeClipboard(text) {
        let flag = false;
        if (navigator.clipboard) {
            // 火狐上 need https
            try {
                await navigator.clipboard.writeText(text);
                flag = true;
                console.log("成功使用 navigator.clipboard 现代剪切板实现");
            } catch (error) {
                console.error('navigator.clipboard 复制到剪贴板时发生错误:', error);
            }
        } else {
            flag = writeClipboardLegacy(text);
            console.log("不存在 navigator.clipboard 现代剪切板实现,使用旧版实现");
        }
        return flag;
    }

    function writeClipboardLegacy(text) {
        let textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.style.position = 'absolute';
        textarea.style.clip = 'rect(0 0 0 0)';
        textarea.value = text;
        textarea.select();
        if (document.execCommand('copy', true)) {
            return true;
        }
        return false;
    }

    const OS = {
        isAndroid: () => /android/i.test(navigator.userAgent),
        isIOS: () => /iPad|iPhone|iPod/i.test(navigator.userAgent),
        isMacOS: () => /Macintosh|MacIntel/i.test(navigator.userAgent),
        isApple: () => OS.isMacOS() || OS.isIOS(),
        isWindows: () => /compatible|Windows/i.test(navigator.userAgent),
        isMobile: () => OS.isAndroid() || OS.isIOS(),
        isUbuntu: () => /Ubuntu/i.test(navigator.userAgent),
        // isAndroidEmbyNoisyX: () => OS.isAndroid() && ApiClient.appVersion().includes('-'),
        // isEmbyNoisyX: () => ApiClient.appVersion().includes('-'),
        isOthers: () => Object.entries(OS).filter(([key, val]) => key !== 'isOthers').every(([key, val]) => !val()),
    };

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

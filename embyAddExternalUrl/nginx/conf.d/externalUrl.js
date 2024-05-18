// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 选填项
// 外网 emby 地址,如果上层无反代或传递了 Host 标头或 docker 为 host 网络,此处可为空
let serverAddr = 'https://bpking.top';
const tags = ['BluRay', 'REMUX', 'WEB-DL']; // 添加视频tag
const groups = ['CMCT', 'WIKI', 'Z0N3', 'EbP', 'PTer', 'EPSILON', 'FRDS', 'SMURF']; // 添加制作组
// 启用后将修改直接串流链接为真实文件名,方便第三方播放器友好显示和匹配,
// 默认不启用,可能存在兼容问题,如发现原始链接播放失败,请关闭此选项
const useRealFileName = false;

// 正常情况请勿填写和更改,程序内部用的全局变量
let api_key = '';
let domain = '';
let oriData = '';
let osType = '';
let serverType = 'emby';
const redirectKey = 'redirect2external';

const addExternalUrl = async (r, data, flags) => {
    fillApiKeyAndServerType(r);
    osType = getOS(r);

    // 外链地址协议默认从调用者取,如果上级还有反代服务器且上级配置了 https 而此服务是 http,需要自行将 ${r.variables.scheme} 改为 https
    // 如果是反代服务器两种都有,可以将这一行注释掉,统一使用第一行填写的地址
    serverAddr = r.headersIn.Host ? `${r.variables.scheme}://${r.headersIn.Host}` : serverAddr;

    domain = `${serverAddr}/emby/videos/${r.uri.split('Items/')[1]}`;
    r.warn(`api_key: ${api_key}`);
    r.warn(`domain: ${domain}`);

    if (flags.last === false) {
        oriData += data;
        r.warn(`flags.last: ${flags.last} , data.length: ${data.length}`);
        return;
    } else {
        r.warn(`flags.last: ${flags.last}`);
        data = JSON.parse(oriData);
        r.warn(`data.length: ${JSON.stringify(data).length}`);
    }

    r.warn(`osType: ${osType}`);
    if (data.MediaSources && data.MediaSources.length > 0) {
        try {
            data = addUrl(r, data);
        } catch (error) {
            r.error(`addUrl error: ${error}`);
        }
    }
    r.warn(`addUrldata.length: ${JSON.stringify(data).length}`)
    r.sendBuffer(JSON.stringify(data), flags);
    r.done();
}

const addUrl = (r, data) => {
	const itemId = data.Id;
	const serverId = data.ServerId;
    data.MediaSources.map(mediaSource => {
        const fileName = mediaSource.Path.replace(/.*[\\/]/, "");
        // origin link: /emby/videos/401929/stream.xxx?xxx
        // modify link: /emby/videos/401929/stream/xxx.xxx?xxx
        // this is not important, hit "/emby/videos/401929/" path level still worked
        let streamUrl = `${domain}/`;
        streamUrl += useRealFileName ? `stream/${fileName}` : `stream.${mediaSource.Container}`;
        streamUrl += `?api_key=${api_key}&Static=true&MediaSourceId=${mediaSource.Id}`;
        //get subtitle
        let subUrl = '';
        try {
            subUrl = getSubUrl(r, mediaSource);
        } catch (error) {
            r.error(`get sub url error: ${error}`);
        }
        //get displayTitle
        let displayTitle = '';
        try {
            displayTitle = mediaSource.MediaStreams.find(s => s.Type === 'Video').DisplayTitle;
            displayTitle = typeof displayTitle === 'undefined' ? '' : displayTitle;
        } catch (error) {
            r.error(`get displayTitle error: ${error}`);
        }
        //get position
        const position = parseInt(data.UserData.PlaybackPositionTicks / 10000);
        //get tagName
        let tagName = '';
        try {
            tagName = tags.find(t => mediaSource.Name.toUpperCase().includes(t.toUpperCase()));
            tagName = typeof tagName === 'undefined' ? '' : tagName;
        } catch (error) {
            r.error(`get tagName error: ${mediaSource.Name}`);
        }
        //get groupName
        let groupName = '';
        try {
            groupName = groups.find(g => mediaSource.Name.toUpperCase().includes(g.toUpperCase()));
            groupName = typeof groupName === 'undefined' ? '' : groupName;
        } catch (error) {
            r.error(`get groupName error: ${mediaSource.Name}`);
        }
        const mediaInfo = {
            title: data.Name,
            streamUrl,
            subUrl,
            position,
            displayTitle,
            mediaSourceName: (tagName + groupName).length > 1 ? `${tagName}-${groupName}` : mediaSource.Name
        }
        data.ExternalUrls.push(getPotUrl(mediaInfo));
        data.ExternalUrls.push(getVlcUrl(mediaInfo));
        data.ExternalUrls.push(getIinaUrl(mediaInfo));
        data.ExternalUrls.push(getNPlayerUrl(mediaInfo));
        data.ExternalUrls.push(getMXUrl(mediaInfo));
        data.ExternalUrls.push(getInfuseUrl(mediaInfo));
        data.ExternalUrls.push(getStellarPlayerUrl(mediaInfo));
        data.ExternalUrls.push(getMPVUrl(mediaInfo));
        data.ExternalUrls.push(getDDPlayUrl(mediaInfo));
        data.ExternalUrls.push(getWebUrl(mediaInfo, itemId, serverId));
    });
    return data;
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

const getPotUrl = (mediaInfo) => {
    return {
        Name: `potplayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub=${encodeURI(mediaInfo.subUrl)} /seek=${getSeek(mediaInfo.position)}`
        // 双引号不能直接放,可能要base64编码一下
        // Url: `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub="${encodeURI(mediaInfo.subUrl)}" /current /title="${encodeURI(mediaInfo.title)}" /seek=${getSeek(mediaInfo.position)}`
    }
}

// https://wiki.videolan.org/Android_Player_Intents/
const getVlcUrl = (mediaInfo) => {
    // android subtitles:  https://code.videolan.org/videolan/vlc-android/-/issues/1903
    let vlcUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.subtitles_location=${encodeURI(mediaInfo.subUrl)};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    if (osType == 'windows') {
        // PC端需要额外设置,参考这个项目,MPV也是类似的方法:  https://github.com/stefansundin/vlc-protocol
        vlcUrl = `vlc://${encodeURI(mediaInfo.streamUrl)}`;
    }
    if (osType == 'ios') {
        // https://wiki.videolan.org/Documentation:IOS/#x-callback-url
        // ios: https://code.videolan.org/videolan/vlc-ios/-/commit/55e27ed69e2fce7d87c47c9342f8889fda356aa9
        vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
    }
    const vlcUrl64 = Buffer.from(vlcUrl, 'utf8').toString('base64');
    return {
        Name: `vlc-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${vlcUrl64}`
    }
}

// https://github.com/iina/iina/issues/1991
const getIinaUrl = (mediaInfo) => {
    return {
        Name: `IINA-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `iina://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`
    }
}

const getInfuseUrl = (mediaInfo) => {
    // sub 参数限制: 播放带有外挂字幕的单个视频文件（Infuse 7.6.2 及以上版本）
    // see: https://support.firecore.com/hc/zh-cn/articles/215090997
    const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
    const infuseUrl64 = Buffer.from(infuseUrl, 'utf8').toString('base64');
    return {
        Name: `Infuse-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${infuseUrl64}`
    }
}

// https://sites.google.com/site/mxvpen/api
// https://mx.j2inter.com/api
// https://support.mxplayer.in/support/solutions/folders/43000574903
const getMXUrl = (mediaInfo) => {
    // mxPlayer free
    const mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    const mxUrl64 = Buffer.from(mxUrl, 'utf8').toString('base64');
    // mxPlayer Pro
    // const mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.pro;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    return {
        Name: `mxPlayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${mxUrl64}`
    }
}

const getNPlayerUrl = (mediaInfo) => {
    let nplayerUrl = osType == "macOS" 
            ? `nplayer-mac://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1` 
            : `nplayer-${encodeURI(mediaInfo.streamUrl)}`;
    const nplayerUrl64 = Buffer.from(nplayerUrl, 'utf8').toString('base64');
    return {
        Name: `nplayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${nplayerUrl64}`
    }
}

const getStellarPlayerUrl = (mediaInfo) => {
    const url = `stellar://play/${encodeURI(mediaInfo.streamUrl)}`;
    const url64 = Buffer.from(url, 'utf8').toString('base64');
    return {
        Name: `恒星播放器-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${url64}`
    }
}

const getMPVUrl = (mediaInfo) => {
    // 桌面端需要额外设置,使用这个项目: https://github.com/akiirui/mpv-handler
    const streamUrl64 = btoa(encodeURIComponent(mediaInfo.streamUrl))
            .replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
    let MPVUrl = `mpv://play/${streamUrl64}`;
    if (mediaInfo.subUrl.length > 0) {
        let subUrl64 = btoa(mediaInfo.subUrl).replace(/\//g, "_").replace(/\+/g, "-").replace(/\=/g, "");
        MPVUrl = `mpv://play/${streamUrl64}/?subfile=${subUrl64}`;
    }

    if (osType == "ios" || osType == "android") {
        MPVUrl = `mpv://${encodeURI(mediaInfo.streamUrl)}`;
    }

    const url64 = Buffer.from(MPVUrl, 'utf8').toString('base64');
    return {
        Name: `MPV-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${url64}`
    }
}

// see: https://greasyfork.org/zh-CN/scripts/443916
const getDDPlayUrl = (mediaInfo) => {
	// Subtitles Not Supported: https://github.com/kaedei/dandanplay-libraryindex/blob/master/api/ClientProtocol.md
    const urlPart = mediaInfo.streamUrl + `|filePath=${mediaInfo.title}`;
    let url = `ddplay:${encodeURIComponent(urlPart)}`;
    if (osType == 'android') {
    	url = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.xyoye.dandanplay;type=video/*;end`;
    }
    const url64 = Buffer.from(url, 'utf8').toString('base64');
    return {
        Name: `弹弹play-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${url64}`
    }
}

const getWebUrl = (mediaInfo, itemId, serverId) => {
    let urlPart = serverType == 'emby' ? '#!/item' : '#/details';
	return {
        Name: `网页打开-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/web/index.html${urlPart}?id=${itemId}&serverId=${serverId}`
    }
}

const getSeek = (position) => {
    let ticks = position * 10000;
    let parts = []
        , hours = ticks / 36e9;
    (hours = Math.floor(hours)) && parts.push(hours);
    let minutes = (ticks -= 36e9 * hours) / 6e8;
    ticks -= 6e8 * (minutes = Math.floor(minutes)),
        minutes < 10 && hours && (minutes = "0" + minutes),
        parts.push(minutes);
    let seconds = ticks / 1e7;
    return (seconds = Math.floor(seconds)) < 10 && (seconds = "0" + seconds),
        parts.push(seconds),
        parts.join(":")
}

const getSubUrl = (r, mediaSource) => {
    let subTitleUrl = '';
    //尝试返回第一个外挂中字
    const chiSubIndex = mediaSource.MediaStreams.findIndex(m => m.Language == "chi" && m.IsExternal);
    r.warn('chisubINdex: ' + chiSubIndex);
    if (chiSubIndex > -1) {
        const subtitleCodec = mediaSource.MediaStreams[chiSubIndex].Codec;
        subTitleUrl = `${domain}/${mediaSource.Id}/Subtitles/${chiSubIndex}/Stream.${subtitleCodec}?api_key=${api_key}`;
    } else {
        //尝试返回第一个外挂字幕
        const externalSubIndex = mediaSource.MediaStreams.findIndex(m => m.IsExternal);
        r.warn('subIndex: ' + externalSubIndex);
        if (externalSubIndex > -1) {
            const subtitleCodec = mediaSource.MediaStreams[externalSubIndex].Codec;
            subTitleUrl = `${domain}/${mediaSource.Id}/Subtitles/${externalSubIndex}/Stream.${subtitleCodec}?api_key=${api_key}`;
        }
    }
    return subTitleUrl;
}

/**
 * getOS, copy from embyLaunchPotplayer.js
 * @param {Object} r nginx objects, HTTP Request
 * @returns windows...
 */
const getOS = (r) => {
    const ua = r.headersIn["User-Agent"]
    r.warn(`getOS UA: ${ua}`)
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

const fillApiKeyAndServerType = (r) => {
    const embyTokenKey = 'X-Emby-Token'
    api_key = r.args[embyTokenKey] ?? r.headersIn[embyTokenKey]
    api_key = api_key ? api_key : r.args.api_key
    if (api_key) {
        return;
    }
    const jellfinAuth = r.headersIn['X-Emby-Authorization']
    if (jellfinAuth) {
        api_key = jellfinAuth.replaceAll(/"/g, '').split(',').map(m => m.trim())
            .find(item => item.startsWith('Token=')).replace('Token=', '')
    }
    if (api_key) {
        serverType = 'jellyfin'
        return;
    }
}

function HeaderFilter(r) {
    r.headersOut['Content-Length'] = null;
}

const redirectUrl = (r) => {
    const baseLink = r.args.link;
    r.warn(`baseLink:  ${baseLink}`);
    const link = Buffer.from(baseLink, 'base64').toString('utf8');
    r.return(302, link);
}

export default { addExternalUrl, redirectUrl, HeaderFilter };
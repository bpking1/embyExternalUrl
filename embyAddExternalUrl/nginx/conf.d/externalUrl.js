let serverAddr = 'https://bpking.top';        //外网emby地址
const tags = ['BluRay', 'REMUX', 'WEB-DL'];                 //添加视频tag
const groups = ['CMCT', 'WIKI', 'Z0N3', 'EbP', 'PTer', 'EPSILON', 'FRDS', 'SMURF'];   //添加制作组


let api_key = '';
let domain = '';
let oriData = '';
const redirectKey = 'redirect2external';

const addExternalUrl = async (r, data, flags) => {
    api_key = r.args['X-Emby-Token'] ? r.args['X-Emby-Token'] : r.headersIn['X-Emby-Token'];
    api_key = api_key ? api_key : r.args.api_key;

    //外链地址默认http,如果是https,则需要将这里的 http 改为 https,如果是反代服务器两种都有,可以将这一行注释掉,统一使用第一行填写的地址
    serverAddr = r.headersIn.Host ? `http://${r.headersIn.Host}` : serverAddr;

    domain = `${serverAddr}/emby/videos/${r.uri.split('Items/')[1]}`;
    r.error(`api_key: ${api_key}`);
    r.error(`domain: ${domain}`);

    if (flags.last === false) {
        oriData += data;
        r.error(`flags.last: ${flags.last} , data.length: ${data.length}`);
        return;
    } else {
        r.error(`flags.last: ${flags.last}`);
        data = JSON.parse(oriData);
        r.error(`data.length: ${JSON.stringify(data).length}`);
    }


    if (data.MediaSources && data.MediaSources.length > 0) {
        try {
            data = addUrl(r, data);
        } catch (error) {
            r.error(`addUrl error: ${error}`);
        }
    }
    r.error(`addUrldata.length: ${JSON.stringify(data).length}`)
    r.sendBuffer(JSON.stringify(data), flags);
    r.done();
}

const addUrl = (r, data) => {
    data.MediaSources.map(mediaSource => {
        const streamUrl = `${domain}/stream.${mediaSource.Container}?api_key=${api_key}&Static=true&MediaSourceId=${mediaSource.Id}`;
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
        data.ExternalUrls.push(getMXUrl(mediaInfo));
        data.ExternalUrls.push(getNPlayerUrl(mediaInfo));
        data.ExternalUrls.push(getInfuseUrl(mediaInfo));
    });
    return data;
}

const getPotUrl = (mediaInfo) => {
    return {
        Name: `potplayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub=${encodeURI(mediaInfo.subUrl)} /seek=${getSeek(mediaInfo.position)}`
        //双引号不能直接放,可能要base64编码一下
        //Url: `potplayer://${encodeURI(mediaInfo.streamUrl)} /sub="${encodeURI(mediaInfo.subUrl)}" /current /title="${encodeURI(mediaInfo.title)}" /seek=${getSeek(mediaInfo.position)}`
    }
}

//https://wiki.videolan.org/Android_Player_Intents/
const getVlcUrl = (mediaInfo) => {
    //安卓:
    //android subtitles:  https://code.videolan.org/videolan/vlc-android/-/issues/1903
    //const vlcUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=org.videolan.vlc;type=video/*;S.subtitles_location=${encodeURI(mediaInfo.subUrl)};S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    //const vlcUrl64 = Buffer.from(vlcUrl, 'utf8').toString('base64');
    //PC:
    //PC端需要额外设置,参考这个项目,MPV也是类似的方法:  https://github.com/stefansundin/vlc-protocol
    //const vlcUrl = `vlc://${encodeURI(mediaInfo.streamUrl)}`;

    //ios:
    //https://code.videolan.org/videolan/vlc-ios/-/commit/55e27ed69e2fce7d87c47c9342f8889fda356aa9
    const vlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(mediaInfo.streamUrl)}&sub=${encodeURIComponent(mediaInfo.subUrl)}`;
    const vlcUrl64 = Buffer.from(vlcUrl, 'utf8').toString('base64');
    return {
        Name: `vlc-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${vlcUrl64}`
    }
}

//https://github.com/iina/iina/issues/1991
const getIinaUrl = (mediaInfo) => {
    return {
        Name: `IINA-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `iina://weblink?url=${encodeURIComponent(mediaInfo.streamUrl)}&new_window=1`
    }
}

//infuse
const getInfuseUrl = (mediaInfo) => {
    const infuseUrl = `infuse://x-callback-url/play?url=${encodeURIComponent(mediaInfo.streamUrl)}`;
    const infuseUrl64 = Buffer.from(infuseUrl, 'utf8').toString('base64');
    return {
        Name: `Infuse-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${infuseUrl64}`
    }
}

//https://sites.google.com/site/mxvpen/api
const getMXUrl = (mediaInfo) => {
    //mxPlayer free
    const mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.ad;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    const mxUrl64 = Buffer.from(mxUrl, 'utf8').toString('base64');
    //mxPlayer Pro
    //const mxUrl = `intent:${encodeURI(mediaInfo.streamUrl)}#Intent;package=com.mxtech.videoplayer.pro;S.title=${encodeURI(mediaInfo.title)};i.position=${mediaInfo.position};end`;
    return {
        Name: `mxPlayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${mxUrl64}`
    }
}

const getNPlayerUrl = (mediaInfo) => {
    const nplayerUrl = `nplayer-${encodeURI(mediaInfo.streamUrl)}`;
    const nplayerUrl64 = Buffer.from(nplayerUrl, 'utf8').toString('base64');
    return {
        Name: `nplayer-${mediaInfo.mediaSourceName}-${mediaInfo.displayTitle}`,
        Url: `${serverAddr}/${redirectKey}?link=${nplayerUrl64}`
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
    r.error('chisubINdex: ' + chiSubIndex);
    if (chiSubIndex > -1) {
        const subtitleCodec = mediaSource.MediaStreams[chiSubIndex].Codec;
        subTitleUrl = `${domain}/${mediaSource.Id}/Subtitles/${chiSubIndex}/Stream.${subtitleCodec}?api_key=${api_key}`;
    } else {
        //尝试返回第一个外挂字幕
        const externalSubIndex = mediaSource.MediaStreams.findIndex(m => m.IsExternal);
        r.error('subIndex: ' + externalSubIndex);
        if (externalSubIndex > -1) {
            const subtitleCodec = mediaSource.MediaStreams[externalSubIndex].Codec;
            subTitleUrl = `${domain}/${mediaSource.Id}/Subtitles/${externalSubIndex}/Stream.${subtitleCodec}?api_key=${api_key}`;
        }
    }
    return subTitleUrl;
}

function HeaderFilter(r) {
    r.headersOut['Content-Length'] = null;
}

const redirectUrl = (r) => {
    const baseLink = r.args.link;
    r.error(`baseLink:  ${baseLink}`);
    const link = Buffer.from(baseLink, 'base64').toString('utf8');
    r.return(302, link);
}


export default { addExternalUrl, redirectUrl, HeaderFilter };
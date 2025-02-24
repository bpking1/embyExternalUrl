// @author: itinybad
// @date: 2024-08-03

import config from "../constant.js";
import util from "../common/util.js";
import urlUtil from "../common/url-util.js";
import liveUtil from "../common/live-util.js";
import events from "../common/events.js";
// import emby from "../emby.js";
// import embyApi from "../api/emby-api.js";
import alistApi from "../api/alist-api.js";

import qs from "querystring";

const ARGS = {
  idSplit: "_",
  virtualPrefix: "virtual",
};

async function vSubtitlesAdepter(r) {
  events.njsOnExit(`vSubtitlesAdepter: ${r.uri}`);

  const ua = r.headersIn["User-Agent"];
  r.warn(`vSubtitlesAdepter, UA: ${ua}`);

  const uriParts = r.uri.split("/");
  const subtitlesIndex = uriParts.indexOf("Subtitles");
  const mediaSourceId = uriParts[subtitlesIndex - 1];
  const mediaStreamIndex = uriParts[subtitlesIndex + 1];

  const vMediaSource = getVMediaSourceChcheById(mediaSourceId, ua);
  if (!vMediaSource) {
    return r.return(404);
  }
  const subtitle = vMediaSource.MediaStreams[mediaStreamIndex];
  let subtitleData = await util.cost(async function fetchSubtitle() {
    // Subtitles not have UA check,but already payload
    return await (await ngx.fetch(subtitle["XUrl"], { headers: { "User-Agent": ua} })).text();
  });
  // !!!important, emby web hls only support vtt, and first line must be WEBVTT
  // <track> load: srt => vtt, <canvas> load ass not need convert
  if (subtitle.Codec !== liveUtil.SUBS_CODEC_ENUM.webvtt) {
    const convertedData = liveUtil.subCodecConvert(subtitleData, subtitle.Codec);
    if (convertedData) {
      r.warn(`vSubtitlesAdepter convert ${subtitle.Codec} => ${liveUtil.SUBS_CODEC_ENUM.webvtt}`);
      subtitleData = convertedData;
    }
  }
  return r.return(200, subtitleData);
}

async function fetchHls(alistFilePath, ua, alistAddr, alistToken) {
  let parsedM3U8 = null;
  if (!alistAddr) { alistAddr = config.alistAddr; }
  if (!alistToken) { alistToken = config.alistToken; }
  const alistLinkApi = alistAddr + alistApi.API_ENUM.fsLink;
  const alistLinkRes = await alistApi.fetchPath(alistLinkApi, alistFilePath, alistToken, ua);
  if (typeof alistLinkRes === "string" && alistLinkRes.startsWith("error")) {
    throw new Error("cannot access alist link, " + alistLinkRes);
  }
  const directUrl = alistLinkRes.data.url;
  const domainArr115 = config.strHead["115"];
  const is115 = Array.isArray(domainArr115) ? domainArr115.some(d => directUrl.includes(d)) : directUrl.includes(domainArr115);
  if (is115) {
    let customCookie = '';
    if (config.webCookie115.length > 0) {
      customCookie = config.webCookie115;
    } else {
      customCookie = alistLinkRes.data.header.Cookie;
    }
    if (!customCookie) {
      throw new Error("cannot found any cookie. please check your alist or constant.js");
    }
    parsedM3U8 = await fetch115Hls(qs.parse(directUrl)["d"], customCookie, ua);
  }
  return parsedM3U8;
}

async function fetch115Hls(dParam, customCookie, ua) {
  // no this await will cause following 1st await init pickCode local variable
  await new Promise(resolve => setTimeout(resolve, 0));
  try {
    ngx.log(ngx.WARN, `fetch115Hls dParam: ${dParam}`);
    // try to get pickcode through search param d
    let pickCode = '';
    let hlsMasterData = '';
    // maybe these are pickcodes too.
    let backup = [];
    // suppose only pickcode contains both English and numbers
    dParam.split('-').forEach(segment => {
      ngx.log(ngx.WARN, `fetch115Hls dParam segment: ${segment}`);
      if (/[a-zA-Z]/.test(segment) && /\d/.test(segment)) {
        pickCode = segment;
      } else if (segment.length > 6) {
        // but who knows
        backup.push(segment);
      }
    });
    backup.unshift(pickCode);
    for (let i = 0; i < backup.length; i++) {
      let backupElement = backup[i];
      const masterUrl = `https://v.anxia.com/site/api/video/m3u8/${backupElement}.m3u8`;
      ngx.log(ngx.WARN, `fetch115Hls masterUrl: ${masterUrl}`);
      const masterPlRes = await ngx.fetch(masterUrl, {
        method: "GET",
        headers: {
          "Referer": `https://v.anxia.com/?pickcode=${backupElement}&share_id=0`, // not need this, for safe side
          "User-Agent": ua,
          "Cookie": customCookie,
        },
        max_response_body_size: 65535
      });
      if (masterPlRes.status === 403) {
        throw new Error('fetch115Hls masterUrl 403, Cookie expired');
      }
      const text = await masterPlRes.text();
      ngx.log(ngx.WARN, `fetch115Hls masterPlaylistText: \n${text}`);
      if (text.startsWith("#EXTM3U")) {
        hlsMasterData = text;
        break;
      }
    }
    if (hlsMasterData === '') {
      throw new Error('cannot get any transcode. If transcode can be played normally on the official 115 disk, the cookies configured in the alist or configuration file are non-web cookies and need to be corrected.');
    }
    let parsedM3U8 = liveUtil.parseM3U8(hlsMasterData);
    const subtitlesUrl = `https://v.anxia.com/webapi/movies/subtitle?pickcode=${pickCode}`;
    ngx.log(ngx.WARN, `fetch115Hls subtitlesUrl: ${subtitlesUrl}`);
    const subtitleRes = await ngx.fetch(subtitlesUrl, {
      method: "GET",
      headers: { // subtitleApi not need headers, for safe side
        "Referer": `https://v.anxia.com/?pickcode=${pickCode}&share_id=0`,
        "User-Agent": ua,
        "Cookie": customCookie,
      },
      max_response_body_size: 65535
    });
    const subtitle = await subtitleRes.json();
    ngx.log(ngx.WARN, `fetch115Hls subtitle: ${JSON.stringify(subtitle)}`);
    parsedM3U8.subtitles = subtitle.data.list;
    const defaultSubId = subtitle.data.autoload.sid;
    parsedM3U8.subtitles.map(sub => {
      sub.isDefault = sub.sid === defaultSubId;
      ngx.log(ngx.WARN, `subtitle original title: ${sub.title}`);
      sub.title = sub.title.replace("内置", "内封转外置");
      ngx.log(ngx.WARN, `subtitle converted title: ${sub.title}`);
    });
    // add extra mark fields
    parsedM3U8.namePrefix = "115";
    parsedM3U8.ua = ua; // only 115 need this field

    return parsedM3U8;
  } catch (error) {
    throw error;
  }
}

function generateVMdiaSourceId(oriSourceId, streamIndex) {
  return `virtual-transcoded${ARGS.idSplit}${oriSourceId}${ARGS.idSplit}${streamIndex}`;
}

function checkVirtual(mediaSourceId) {
  return mediaSourceId.includes(ARGS.virtualPrefix);
}

function toVMediaSources(parsedM3U8) {
  const vSources = [];
  parsedM3U8.streams.map((stream, streamI) => {
    // virtual live stream behavior
    const Id = generateVMdiaSourceId(parsedM3U8.XId, streamI);
    const MediaStreams = [];
    if (parsedM3U8.subtitles) {
      parsedM3U8.subtitles.map((subtitle, subtitleI) => {
        // !!!important, Protocol: "Http", IsExternalUrl: true, maybe only support web client
        MediaStreams.push({
          Codec: subtitle.type,
          // Language: "chi",
          // Title: "简体",
          DisplayTitle: subtitle.title,
          IsDefault: subtitle.isDefault,
          // IsForced: subtitleI === 0,
          Type: "Subtitle",
          Index: subtitleI,
          IsExternal: true,
          DeliveryMethod: "External",
          // Unsafe attempt to load URL xxx from frame with URL xxx Domains, protocols and ports must match.
          DeliveryUrl: `/Videos/${parsedM3U8.ItemId}/${Id}/Subtitles/${subtitleI}/0/Stream.${subtitle.type}?api_key=${config.embyApiKey}`,
          IsExternalUrl: false,
          IsTextSubtitleStream: true,
          SupportsExternalStream: true,
          // Path: `Stream.${subtitle.type}`,
          Protocol: "File",
          // SubtitleLocationType: "InternalStream",
          XUrl: subtitle.url,
        })
      })
    }
    let Name = `网盘转码直链[${parsedM3U8.ItemId}]`;
    if (parsedM3U8.namePrefix) {
      Name = parsedM3U8.namePrefix + Name;
    }
    if (stream.quality) {
      Name += ` - ${stream.quality}`;
    }
    if (stream.resolution) {
      Name += ` (${stream.resolution}P)`;
    }
    const RequiredHttpHeaders = {};
    if (parsedM3U8.ua) {
      RequiredHttpHeaders["User-Agent"] = parsedM3U8.ua;
    }
    vSources.push({
      // Container: "hls",
      Id,
      MediaStreams,
      Name,
      Path: stream.url,
      Protocol: "Http",
      RequiredHttpHeaders,
      IsRemote: true,
      SupportsDirectPlay: true,
      SupportsDirectStream: true,
      SupportsTranscoding: false,
      // some origin MediaSource and Extra fields
      ItemId: parsedM3U8.ItemId,
      XName: parsedM3U8.XName,
      XId: parsedM3U8.XId,
      XPath: parsedM3U8.XPath,
      XIsPlaceholder: parsedM3U8.XIsPlaceholder,
      XPlaySessionId: parsedM3U8.XPlaySessionId,
      // XparsedM3U8: parsedM3U8, // for debug
    });
  });
  return vSources;
}

async function fetchHlsWithCache(r, source, playSessionId) {
  const isVirtual = checkVirtual(source.Id);
  const mediaSourceId = isVirtual ? source.XId : source.Id;
  const sourcePath = isVirtual ? source.XPath : source.Path;
  const cacheKey = mediaSourceId;
  let vMediaSources = ngx.shared["versionDict"].get(cacheKey);
  if (vMediaSources && !isVirtual) {
    ngx.log(ngx.WARN, `PlaybackInfo isPlayback false, source param is original`);
    vMediaSources = JSON.parse(vMediaSources);
  } else {
    let parsedM3U8 = null;
    if (!isVirtual) {
      parsedM3U8 = { streams: [{ url: sourcePath }], audios: [], subtitles: [] };
      ngx.log(ngx.WARN, `fetchHlsWithCache used fast placeholder version`);
    } else {
      const ua = r.headersIn["User-Agent"];
      ngx.log(ngx.WARN, `fetchHls, UA: ${ua}`);
      parsedM3U8 = await fetchHls(sourcePath, ua);
      parsedM3U8.XIsFetchHls = true;
      ngx.log(ngx.WARN, `fetchHlsWithCache get slow hls version`);
    }
    ngx.log(ngx.INFO, `fetchHlsWithCache parsedM3U8: ${JSON.stringify(parsedM3U8)}`);
    parsedM3U8.ItemId = source.ItemId;
    parsedM3U8.XName = isVirtual ? source.XName : source.Name;
    parsedM3U8.XId = isVirtual ? source.XId : source.Id;
    parsedM3U8.XPath = sourcePath;
    parsedM3U8.XIsPlaceholder = !isVirtual;
    parsedM3U8.XPlaySessionId = playSessionId;
    vMediaSources = toVMediaSources(parsedM3U8);
    const plhVSourceId = generateVMdiaSourceId(mediaSourceId, 0);
    vMediaSources.map(vSource => {
      vSource.DirectStreamUrl = urlUtil.generateDirectStreamUrl(r, vSource.Id, "master.m3u8");
      if (r.uri.includes("master.m3u8")) {
        ngx.log(ngx.WARN, `not from PlaybackInfo, start fix vSource.DirectStreamUrl`);
        vSource.DirectStreamUrl = vSource.DirectStreamUrl.replace(plhVSourceId, vSource.Id).replace("/emby", "");
      }
    });
    const requiredUA = parsedM3U8.ua;
    if (parsedM3U8.XIsFetchHls && requiredUA) {
      ngx.log(ngx.WARN, `fetchHls has requiredUA, cache one UA`);
      util.dictAdd("versionDict", cacheKey + `:${requiredUA}`, JSON.stringify(vMediaSources), null, true);
      ngx.log(ngx.WARN, `cache two, hls version cache cover placeholder version`);
    }
    util.dictAdd("versionDict", cacheKey, JSON.stringify(vMediaSources), null, true);
  }
  return vMediaSources;
}

function getVMediaSourceChcheById(vSourceId, ua) {
  if (!vSourceId) { return null; }
  let rvt = null;
  if (checkVirtual(vSourceId)) {
    const oriSourceId = vSourceId.split(ARGS.idSplit)[1];
    const cacheSourceIndex = parseInt(vSourceId.split(ARGS.idSplit)[2]);
    let cacheKey = oriSourceId;
    // Placeholder or Bitrate Ver can be null, Playback is required UA check
    if (ua) {
      cacheKey += `:${ua}`;
      ngx.log(ngx.WARN, `getVMediaSourceChcheById ua in, cacheKey add UA`);
    }
    let vMediaSource = ngx.shared["versionDict"].get(cacheKey);
    if (vMediaSource) {
      vMediaSource = JSON.parse(vMediaSource)[cacheSourceIndex];
      rvt = vMediaSource;
    } else {
      ngx.log(ngx.WARN, `cacheKey with UA not find, will try placeholder version`);
      vMediaSource = ngx.shared["versionDict"].get(oriSourceId);
      if (vMediaSource) {
        vMediaSource = JSON.parse(vMediaSource)[cacheSourceIndex];
        rvt = vMediaSource;
        ngx.log(ngx.WARN, `getVMediaSourceChcheById placeholder: ${JSON.stringify(rvt)}`);
      }
    }
  }
  return rvt;
}

function delVMediaSourceChcheById(vSourceId, ua) {
  if (vSourceId && vSourceId.startsWith(ARGS.virtualPrefix)) {
    const oriSourceId = vSourceId.split(ARGS.idSplit)[1];
    return ngx.shared["versionDict"].delete(`${oriSourceId}:${ua}`);
  }
}

// only for emby-live.js
async function getUrlByVMediaSources(r) {
  const ua = r.headersIn["User-Agent"];
  let rvt = "";
  const directHlsConfig = config.directHlsConfig;
  if (directHlsConfig.enable) {
    r.warn(`getUrlByVMediaSources, UA: ${ua}`);
    const mediaSourceId = urlUtil.getMediaSourceId(r.args);
    ngx.log(ngx.WARN, `getUrlByVMediaSources mediaSourceId: ${mediaSourceId}`);
    const vMediaSource = getVMediaSourceChcheById(mediaSourceId, ua);
    ngx.log(ngx.WARN, `getUrlByVMediaSources vMediaSource: ${JSON.stringify(vMediaSource)}`);
    if (vMediaSource) {
      r.warn(`mediaSourceId hit virtual: ${mediaSourceId}`);
      const requiredUA = vMediaSource.RequiredHttpHeaders["User-Agent"];
      const needFetch = vMediaSource.XIsPlaceholder || (requiredUA && requiredUA !== ua);
      if (needFetch) {
        if (requiredUA && requiredUA !== ua) {
          ngx.log(ngx.WARN, `fetchHlsWithCache because currentUA not same as requiredUA: ${requiredUA}`);
        }
        let extMediaSources = null;
        try {
          extMediaSources = await util.cost(fetchHlsWithCache, r, vMediaSource, vMediaSource.XPlaySessionId);
        } catch (error) {
          ngx.log(ngx.ERR, `fetchHlsWithCache: ${error}`);
        }
        if (!extMediaSources || extMediaSources.length < 1) {
          ngx.log(ngx.ERR, `extMediaSources unexpected length: ${extMediaSources.length}`);
          return rvt;
        }
        // rvt = 1;
        if (directHlsConfig.defaultPlayMax) {
          rvt = extMediaSources[extMediaSources.length - 1].Path;
        } else {
          rvt = extMediaSources[0].Path;
        }
      } else {
        rvt = vMediaSource.Path;
      }
    }
  }
  return rvt;
}

// only for PlaybackInfo
async function fetchHlsByPlh(r) {
  const ua = r.headersIn["User-Agent"];
  ngx.log(ngx.INFO, `fetchHlsByPlh, UA: ${ua}`);
  const placeholderVSourceId = r.args.MediaSourceId;
  const directHlsConfig = config.directHlsConfig;
  if (!directHlsConfig.enable) { return; }
  let vMediaSource = getVMediaSourceChcheById(placeholderVSourceId, ua);
  if (!vMediaSource || !vMediaSource.XIsPlaceholder) { return; }
  const extMediaSources = await fetchHlsWithCache(r, vMediaSource, vMediaSource.XPlaySessionId);
  if (directHlsConfig.defaultPlayMax) {
    vMediaSource = extMediaSources[extMediaSources.length - 1];
  } else {
    vMediaSource = extMediaSources[0];
  }
  return vMediaSource;
}

function getVMediaSourcesIsPlayback(rArgs) {
  const isPlayback = rArgs.IsPlayback === "true";
  if (!isPlayback) { return; }
  // PlaybackInfo UA and Real Playback UA is not same, do't use UA filter
  const vMediaSource = embyVMedia.getVMediaSourceChcheById(rArgs.MediaSourceId);
  if (vMediaSource) {
    // rArgs.AudioStreamIndex; DefaultAudioStreamIndex
    let subtitleStreamIndex = parseInt(rArgs.SubtitleStreamIndex);
    if (!subtitleStreamIndex || subtitleStreamIndex === -1) {
      subtitleStreamIndex = vMediaSource.MediaStreams.findIndex(s => s.Type === "Subtitle" && s.IsDefault);
    }
    vMediaSource.DefaultSubtitleStreamIndex = subtitleStreamIndex;
    // PlaySessionId is important, will error in /emby/Sessions/Playing/Progress
    return { MediaSources: [vMediaSource], PlaySessionId: vMediaSource.XPlaySessionId };
  }
}

async function getVMediaSourcesByHls(r, source, notLocal, playSessionId) {
  const mark = "getVMediaSourcesByHls";
  const isPlayback = r.args.IsPlayback === "true";
  if (isPlayback) {
    return ngx.log(ngx.WARN, `${mark} not isPlayback, return;`);
  }
  const directHlsConfig = config.directHlsConfig;
  if (!directHlsConfig.enable) {
    return ngx.log(ngx.WARN, `${mark} directHlsConfig.enable is false, return;`);
  }
  ngx.log(ngx.WARN, `${mark} start`);
  const mediaPathMapping = config.mediaPathMapping.slice(); // warnning config.XX Objects is current VM shared variable
  config.mediaMountPath.filter(s => s).map(s => mediaPathMapping.unshift([0, 0, s, ""]));
  const mediaItemPath = util.doUrlMapping(r, source.Path, notLocal, mediaPathMapping, "mediaPathMapping");
  ngx.log(ngx.WARN, `${mark} mapped emby file path: ${mediaItemPath}`);
  let realEnable = true;
  if (directHlsConfig.enableRule && directHlsConfig.enableRule.length > 0) {
    const rule = util.simpleRuleFilter(r, directHlsConfig.enableRule, mediaItemPath, null, "directHlsEnableRule");
    realEnable = rule && rule.length > 0;
  }
  if (realEnable) {
    const sourceCopy = Object.assign({}, source);
    sourceCopy.Path = mediaItemPath;
    try {
      return await util.cost(fetchHlsWithCache, r, sourceCopy, playSessionId);
    } catch (error) {
      ngx.log(ngx.ERR, `${mark}: ${error}`);
    }
  }
}

export default {
  ARGS,
  vSubtitlesAdepter,
  fetchHls,
  checkVirtual,
  fetchHlsWithCache,
  getVMediaSourceChcheById,
  delVMediaSourceChcheById,
  // fetchHlsByPlh,
  getUrlByVMediaSources,
  getVMediaSourcesIsPlayback,
  getVMediaSourcesByHls,
};
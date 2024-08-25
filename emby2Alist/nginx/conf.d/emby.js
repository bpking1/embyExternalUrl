// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 nginx-emby 2>&1 | grep js:"
// docker logs -f -n 10 自己的容器名称 2>&1 | grep js:
// 正常情况下此文件所有内容不需要更改

import config from "./constant.js";
import util from "./common/util.js";
import urlUtil from "./common/url-util.js";
import events from "./common/events.js";
import embyApi from "./api/emby-api.js";
import ngxExt from "./modules/ngx-ext.js";
import embyVMedia from "./modules/emby-v-media.js";

async function redirect2Pan(r) {
  events.njsOnExit(`redirect2Pan: ${r.uri}`);

  const ua = r.headersIn["User-Agent"];
  r.warn(`redirect2Pan, UA: ${ua}`);

  // check route cache
  const routeCacheConfig = config.routeCacheConfig;
  if (routeCacheConfig.enable) {
    // webClient download only have itemId on pathParam
    let cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
    r.log(`redirect2Pan routeCacheKey: ${cacheKey}`);
    let routeDictKey;
    let cachedLink;
    for (let index = 1; index < 3; index++) {
      routeDictKey = `routeL${index}Dict`;
      cachedLink = ngx.shared[routeDictKey].get(cacheKey);
      if (!cachedLink) {
        // 115 must use ua
        cachedLink = ngx.shared[routeDictKey].get(`${cacheKey}:${ua}`);
      }
      if (cachedLink) {
        r.warn(`hit cache ${routeDictKey}: ${cachedLink}`);
        if (cachedLink.startsWith("@")) {
          // use original link
          return internalRedirect(r, cachedLink, routeDictKey);
        } else {
          return redirect(r, cachedLink, routeDictKey);
        }
      } else {
        r.log(`not found from cache ${routeDictKey}, skip`);
      }
    }
  }

  // fetch mount emby/jellyfin file path
  const itemInfo = util.getItemInfo(r);
  r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
  let embyRes = await util.cost(fetchEmbyFilePath,
    itemInfo.itemInfoUri,
    itemInfo.itemId,
    itemInfo.Etag,
    itemInfo.mediaSourceId);
  r.log(`embyRes: ${JSON.stringify(embyRes)}`);
  if (embyRes.message.startsWith("error")) {
    r.error(`fail to fetch fetchEmbyFilePath: ${embyRes.message},fallback use original link`);
    return internalRedirect(r);
  }

  // strm file internal text maybe encode
  r.warn(`notLocal: ${embyRes.notLocal}`);
  if (embyRes.notLocal) {
    embyRes.path = decodeURIComponent(embyRes.path);
    r.warn(`notLocal decodeURIComponent embyRes.path`);
  }

  // check symlinkRule
  const symlinkRule = config.symlinkRule;
  if (symlinkRule && symlinkRule.length > 0) {
    const hitRule = symlinkRule.find(rule => util.strMatches(rule[0], embyRes.path, rule[1]));
    if (hitRule) {
      r.warn(`hit symlinkRule: ${JSON.stringify(hitRule)}`);
      const realpath = util.checkAndGetRealpathSync(embyRes.path);
      if (realpath) {
        r.warn(`symlinkRule realpath overwrite pre: ${embyRes.path}`);
        embyRes.path = realpath;
      }
    }
  }
  r.warn(`mount emby file path: ${embyRes.path}`);

  // add Expression Context to r
  r[util.ARGS.rXMediaKey] = embyRes.mediaSource;
  ngx.log(ngx.WARN, `add emby/jellyfin MediaSource to r: ${JSON.stringify(r[util.ARGS.rXMediaKey])}`);

  // diff from PlaybackInfo routeRule, because depends on current playback 
  // routeRule, not must before mediaPathMapping, before is simple, can ignore mediaPathMapping
  const routeMode = util.getRouteMode(r, embyRes.path, false, embyRes.notLocal);
  r.warn(`getRouteMode: ${routeMode}`);
  if (util.ROUTE_ENUM.proxy == routeMode) {
    // use original link
    return internalRedirect(r);
  } else if (util.ROUTE_ENUM.block == routeMode) {
    return r.return(403, "blocked");
  }

  // file path mapping
  let mediaItemPath = util.doMediaPathMapping(embyRes.path, embyRes.notLocal);
  ngx.log(ngx.WARN, `mapped emby file path: ${mediaItemPath}`);

  // strm file inner remote link redirect,like: http,rtsp
  // not only strm, mediaPathMapping maybe used remote link
  const isRemote = !util.isAbsolutePath(mediaItemPath);
  if (isRemote) {
    let rule = util.simpleRuleFilter(
      r, config.redirectStrmLastLinkRule, mediaItemPath,
      util.SOURCE_STR_ENUM.filePath, "redirectStrmLastLinkRule"
    );
    if (rule && rule.length > 0) {
      if (!Number.isInteger(rule[0])) {
        r.warn(`convert groupRule remove groupKey and sourceValue`);
        rule = rule.slice(2);
      }
      let directUrl = await ngxExt.fetchLastLink(mediaItemPath, rule[2], rule[3], ua);
      if (directUrl) {
        mediaItemPath = directUrl;
      } else {
        r.warn(`warn: fetchLastLink, not expected result, failback once`);
        directUrl = await ngxExt.fetchLastLink(ngxExt.lastLinkFailback(mediaItemPath), rule[2], rule[3], ua);
        if (directUrl) {
          mediaItemPath = directUrl;
        }
      }
    }
    // need careful encode filePathPart, other don't encode
    const filePathPart = urlUtil.getFilePathPart(mediaItemPath);
    if (filePathPart) {
      r.warn(`is CloudDrive/AList link, encodeURIComponent filePathPart before: ${mediaItemPath}`);
      mediaItemPath = mediaItemPath.replace(filePathPart, encodeURIComponent(filePathPart));
    }
    return redirect(r, mediaItemPath);
  }

  // clientSelfAlistRule, before fetch alist
  const alistDUrl = util.getClientSelfAlistLink(r, mediaItemPath);
  if (alistDUrl) { return redirect(r, alistDUrl); }

  // fetch alist direct link
  const alistFilePath = mediaItemPath;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  const alistRes = await util.cost(fetchAlistPathApi,
    alistFsGetApiPath,
    alistFilePath,
    alistToken,
    ua,
  );
  r.warn(`fetchAlistPathApi, UA: ${ua}`);
  if (!alistRes.startsWith("error")) {
    // routeRule
    const routeMode = util.getRouteMode(r, alistRes, true, embyRes.notLocal);
    if (util.ROUTE_ENUM.proxy == routeMode) {
      // use original link
      return internalRedirect(r);
    } else if (util.ROUTE_ENUM.block == routeMode) {
      return r.return(403, "blocked");
    }
    // clientSelfAlistRule, after fetch alist, cover raw_url
    return redirect(r, util.getClientSelfAlistLink(r, alistRes, alistFilePath) ?? alistRes);
  }
  r.warn(`alistRes: ${alistRes}`);
  if (alistRes.startsWith("error403")) {
    r.error(`fail to fetch fetchAlistPathApi: ${alistRes},fallback use original link`);
    return internalRedirect(r);
  }
  if (alistRes.startsWith("error500")) {
    r.warn(`will req alist /api/fs/list to rerty`);
    // const filePath = alistFilePath.substring(alistFilePath.indexOf("/", 1));
    const filePath = alistFilePath;
    const alistFsListApiPath = `${alistAddr}/api/fs/list`;
    const foldersRes = await fetchAlistPathApi(
      alistFsListApiPath,
      "/",
      alistToken,
      ua,
    );
    if (foldersRes.startsWith("error")) {
      r.error(`fail to fetch /api/fs/list: ${foldersRes},fallback use original link`);
      return internalRedirect(r);
    }
    const folders = foldersRes.split(",").sort();
    for (let i = 0; i < folders.length; i++) {
      r.warn(`try to fetch alist path from /${folders[i]}${filePath}`);
      let driverRes = await fetchAlistPathApi(
        alistFsGetApiPath,
        `/${folders[i]}${filePath}`,
        alistToken,
        ua,
      );
      if (!driverRes.startsWith("error")) {
        driverRes = driverRes.includes("http://172.17.0.1")
          ? driverRes.replace("http://172.17.0.1", config.alistPublicAddr)
          : driverRes;
        return redirect(r, driverRes);
      }
    }
    r.error(`fail to fetch alist resource: not found,fallback use original link`);
    return internalRedirect(r);
  }
  r.error(`fail to fetch fetchAlistPathApi: ${alistRes},fallback use original link`);
  return internalRedirect(r);
}

// 拦截 PlaybackInfo 请求
async function transferPlaybackInfo(r) {
  events.njsOnExit(`transferPlaybackInfo: ${r.uri}`);

  // virtualMediaSources
  if (config.directHlsConfig && config.directHlsConfig.enable) {
    const vMediaSources = embyVMedia.getVMediaSourcesIsPlayback(r.args);
    if (vMediaSources) {
      r.headersOut["Content-Type"] = "application/json;charset=utf-8";
      return r.return(200, JSON.stringify(vMediaSources));
    }
  }  
  
  let start = Date.now();
  const isPlayback = r.args.IsPlayback === "true";
  // replay the request
  const proxyUri = urlUtil.proxyUri(r.uri);
  r.warn(`playbackinfo proxy uri: ${proxyUri}`);
  const query = urlUtil.generateUrl(r, "", "").substring(1);
  r.warn(`playbackinfo proxy query string: ${query}`);
  const response = await r.subrequest(proxyUri, {
    method: r.method,
    args: query
  });
  if (response.status === 200) {
    const body = JSON.parse(response.responseText);
    if (body.MediaSources && body.MediaSources.length > 0) {
      r.log(`main request headersOut: ${JSON.stringify(r.headersOut)}`);
      r.log(`subrequest headersOut: ${JSON.stringify(response.headersOut)}`);
      r.warn(`origin playbackinfo: ${response.responseText}`);
      const transcodeConfig = config.transcodeConfig; // routeRule
      const routeCacheConfig = config.routeCacheConfig;
      let extMediaSources = []; // virtualMediaSources
      for (let i = 0; i < body.MediaSources.length; i++) {
        const source = body.MediaSources[i];
        // if (source.IsRemote) {
        //   // live streams are not blocked
        //   // return r.return(200, response.responseText);
        // }
        // 防止客户端转码（转容器）
        modifyDirectPlaySupports(source, true);

        r[util.ARGS.rXMediaKey] = source;
        const isStrm = util.checkIsStrmByMediaSource(source);
        const notLocal = source.IsRemote || isStrm;
        // virtualMediaSources, fast placeholder, all PlaybackInfo too slow, switch prosess on play start
        if (config.directHlsConfig && config.directHlsConfig.enable) {
          const vMediaSources = await embyVMedia.getVMediaSourcesByHls(r, source, notLocal, body.PlaySessionId);
          if (vMediaSources && vMediaSources.length > 0) {
            extMediaSources = extMediaSources.concat(vMediaSources);
          }
        }
        // routeRule
        source.XRouteMode = util.ROUTE_ENUM.redirect; // for debug
        if (transcodeConfig.enable) {
          const routeMode = util.getRouteMode(r, source.Path, false, notLocal);
          r.warn(`playbackinfo routeMode: ${routeMode}`);
          source.XRouteMode = routeMode; // for debug
          if (util.ROUTE_ENUM.redirect == routeMode) {
            if (!transcodeConfig.redirectTransOptEnable) source.SupportsTranscoding = false;
            // 1. first priority is user clients choice video bitrate < source.Bitrate
            // 2. strict cover routeMode, do't use r.args.StartTimeTicks === "0"
            // 3. source.TranscodingUrl is important, sometimes SupportsTranscoding true but it's empty        
            if (
              (transcodeConfig.enableStrmTranscode || !isStrm)
              && source.SupportsTranscoding && source.TranscodingUrl
              && (
                // https://dev.emby.media/reference/pluginapi/MediaBrowser.Model.Session.TranscodeReason.html
                source.TranscodingUrl.includes("TranscodeReasons=ContainerBitrateExceedsLimit")
                  ? parseInt(r.args.MaxStreamingBitrate) < source.Bitrate
                  : true
              )
            ) {
              r.warn(`client reported and server judgment to transcode, cover routeMode`);
              source.XRouteMode = util.ROUTE_ENUM.transcode; // for debug
              modifyDirectPlaySupports(source, false);
              continue;
            }
          } else if (util.ROUTE_ENUM.transcode == routeMode) {
            r.warn(`routeMode modify playback supports`);
            // because clients prefer SupportsDirectPlay > SupportsDirectStream > SupportsTranscoding
            modifyDirectPlaySupports(source, false);
            continue;
          } else if (util.ROUTE_ENUM.block == routeMode) {
            return r.return(403, "blocked");
          }
          // util.ROUTE_ENUM.proxy == routeMode, because subdivided transcode, proxy do't modify
        } else {
          source.SupportsTranscoding = false;
          if (!transcodeConfig.redirectTransOptEnable) {
            r.warn(`transcodeConfig.enable && redirectTransOptEnable all false, remove origin transcode vars`);
            delete source.TranscodingUrl;
            delete source.TranscodingSubProtocol;
            delete source.TranscodingContainer;
          }
        }

        r.warn(`modify direct play info`);
        modifyDirecPlayInfo(r, source);

        // async cachePreload
        if (routeCacheConfig.enable && routeCacheConfig.enableL2
          && !isPlayback && !source.DirectStreamUrl.includes(".m3u")) {
          cachePreload(r, `${urlUtil.getCurrentRequestUrlPrefix(r)}/emby${source.DirectStreamUrl}`, util.CHCHE_LEVEL_ENUM.L2);
        }
      }

      body.MediaSources = body.MediaSources.concat(extMediaSources); // virtualMediaSources
      
      util.copyHeaders(response.headersOut, r.headersOut);
      const jsonBody = JSON.stringify(body);
      r.headersOut["Content-Type"] = "application/json;charset=utf-8";
      let end = Date.now();
      r.warn(`${end - start}ms, transfer playbackinfo: ${jsonBody}`);
      return r.return(200, jsonBody);
    }
  }
  r.warn(`playbackinfo subrequest failed, status: ${response.status}`);
  return internalRedirect(r);
}

function modifyDirecPlayInfo(r, source) {
  source.XOriginDirectStreamUrl = source.DirectStreamUrl; // for debug
  let localtionPath = source.IsInfiniteStream ? "master" : "stream";
  const fileExt = source.IsInfiniteStream
    && (!source.Container || source.Container === "hls")
    ? "m3u8" : source.Container;
  let resourceKey = `${localtionPath}.${fileExt}`;
  // only not live check use real filename
  if (!source.IsInfiniteStream && config.streamConfig.useRealFileName) {
    // origin link: /emby/videos/401929/stream.xxx?xxx
    // modify link: /emby/videos/401929/stream/xxx.xxx?xxx
    // this is not important, hit "/emby/videos/401929/" path level still worked
    resourceKey = `${localtionPath}/${util.getFileNameByPath(source.Path)}`;
  }
  source.DirectStreamUrl = urlUtil.generateDirectStreamUrl(r, source.Id, resourceKey);
  // a few players not support special character
  source.DirectStreamUrl = encodeURI(source.DirectStreamUrl);
  source.XModifyDirectStreamUrlSuccess = true; // for debug
}

function modifyDirectPlaySupports(source, flag) {
  source.SupportsDirectPlay = flag;
  source.SupportsDirectStream = flag;
  let msg = `modify direct play supports all ${flag}`;
  if (!flag && source.TranscodingUrl) {
    source.TranscodingUrl = urlUtil.appendUrlArg(
      source.TranscodingUrl,
      util.ARGS.useProxyKey,
      "1"
    );
    source.XModifyTranscodingUrlSuccess = true; // for debug
    msg += ", and add useProxyKey"
  }
  ngx.log(ngx.WARN, msg);
}

async function modifyBaseHtmlPlayer(r) {
  events.njsOnExit(`modifyBaseHtmlPlayer: ${r.uri}`);
  try {
    // 获取响应
    const res = await util.cost(embyApi.fetchBaseHtmlPlayer, config.embyHost, r.args);
    // 读取响应体
    let body = await res.text();
    // 替换指定内容
    body = body.replace(/mediaSource\.IsRemote\s*&&\s*"DirectPlay"\s*===\s*playMethod\s*\?\s*null\s*:\s*"anonymous"/g, 'null');
    // 复制响应头
    util.copyHeaders(res.headers, r.headersOut);
    // 构造新的响应
    r.return(res.status, body);
  } catch (error) {
    r.warn(`fetchBaseHtmlPlayer: ${error}, skip, ${r.uri}`);
    return internalRedirectExpect(r);
  }
}

async function fetchAlistPathApi(alistApiPath, alistFilePath, alistToken, ua) {
  const alistRequestBody = {
    path: alistFilePath,
    password: "",
  };
  try {
    const urlParts = urlUtil.parseUrl(alistApiPath);
    const hostValue = `${urlParts.host}:${urlParts.port}`;
    ngx.log(ngx.WARN, `fetchAlistPathApi add Host: ${hostValue}`);
    const response = await ngx.fetch(alistApiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: alistToken,
        "User-Agent": ua,
        Host: hostValue,
      },
      max_response_body_size: 65535,
      body: JSON.stringify(alistRequestBody),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result) {
        return `error: alist_path_api response is null`;
      }
      if (result.message == "success") {
        // alist /api/fs/get
        if (result.data.raw_url) {
          return result.data.raw_url;
        }
        // alist /api/fs/link
        if (result.data.header.Cookie) {
          return result.data;
        }
        // alist /api/fs/list
        return result.data.content.map((item) => item.name).join(",");
      }
      if (result.code == 403) {
        return `error403: alist_path_api ${result.message}`;
      }
      return `error500: alist_path_api ${result.code} ${result.message}`;
    } else {
      return `error: alist_path_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: alist_path_api fetchAlistFiled ${error}`;
  }
}

async function fetchEmbyFilePath(itemInfoUri, itemId, Etag, mediaSourceId) {
  let rvt = {
    message: "success",
    path: "",
    itemName: "",
    notLocal: false,
    mediaSource: null,
  };
  try {
    const res = await ngx.fetch(itemInfoUri, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Content-Length": 0,
      },
      max_response_body_size: 8388608, // bytes, default 32KB this is 8MB
    });
    if (res.ok) {
      const result = await res.json();
      if (!result) {
        rvt.message = `error: emby_api itemInfoUri response is null`;
        return rvt;
      }
      if (itemInfoUri.includes("JobItems")) {
        const jobItem = result.Items.find(o => o.Id == itemId);
        if (jobItem) {
          // "MediaType": "Photo"... not have "MediaSources" field
          rvt.path = jobItem.OutputPath;
          // live stream not support download, can ignore it
          rvt.notLocal = util.checkIsStrmByPath(jobItem.OutputPath);
        } else {
          rvt.message = `error: emby_api /Sync/JobItems response not found jobItemId: ${itemId}`;
          return rvt;
        }
      } else {
        const item = result.Items[0];
        if (!item) {
          rvt.message = `error: emby_api /Items response is null`;
          return rvt;
        }
        if (item.MediaSources) {
          let mediaSource = item.MediaSources[0];
          // ETag only on Jellyfin
          if (Etag) {
            mediaSource = item.MediaSources.find((m) => m.ETag == Etag);
          }
          // item.MediaSources on Emby has one, on Jellyfin has many!
          if (mediaSourceId) {
            mediaSource = item.MediaSources.find((m) => m.Id == mediaSourceId);
          }
          rvt.path = mediaSource.Path;
          rvt.itemName = item.Name;
          /**
           * note1: MediaSourceInfo{ Protocol }, String ($enum)(File, Http, Rtmp, Rtsp, Udp, Rtp, Ftp, Mms)
           * note2: live stream "IsInfiniteStream": true
           * eg1: MediaSourceInfo{ IsRemote }: true
           * eg1: MediaSourceInfo{ IsRemote }: false, but MediaSourceInfo{ Protocol }: File, this is scraped
           */
          rvt.notLocal = mediaSource.IsInfiniteStream
            || mediaSource.IsRemote
            || util.checkIsStrmByPath(item.Path);
          rvt.mediaSource = mediaSource;
        } else {
          // "MediaType": "Photo"... not have "MediaSources" field
          rvt.path = item.Path;
        }
      }
      return rvt;
    } else {
      rvt.message = `error: emby_api ${res.status} ${res.statusText}`;
      return rvt;
    }
  } catch (error) {
    rvt.message = `error: emby_api fetch mediaItemInfo failed, ${error}`;
    return rvt;
  }
}

async function sendMessage2EmbyDevice(deviceId, header, text, timeoutMs) {
  if (!deviceId) {
    ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: deviceId is required, skip`);
    return;
  }
  embyApi.fetchSessions(config.embyHost, config.embyApiKey, { DeviceId: deviceId }).then(sessionResPromise => {
    if (sessionResPromise.status !== 200) {
      ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice sessionRes.status: ${sessionResPromise.status}`);
      return;
    }
    sessionResPromise.json().then(sessionRes => {
      if (!sessionRes || (sessionRes && sessionRes.length == 0)) {
        ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: fetchSessions: session not found, skip`);
        return;
      }
      // sometimes have multiple sessions
      const targetSession = sessionRes.filter(s => s.SupportsRemoteControl)[0];
      if (targetSession) {
        embyApi.fetchSessionsMessage(targetSession.Id, header, text, timeoutMs);
      } else {
        ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: targetSession not found, skip`);
      }
    }).catch((error) => {
      ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: ${error}, skip`);
    });
  }).catch((error) => {
    ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: ${error}, skip`);
  });
}

async function cachePreload(r, url, cacheLevel) {
  url = urlUtil.appendUrlArg(url, util.ARGS.cacheLevleKey, cacheLevel);
  ngx.log(ngx.WARN, `cachePreload Level: ${cacheLevel}`);
  preload(r, url);
}

async function preload(r, url) {
  events.njsOnExit(`preload`);

  url = urlUtil.appendUrlArg(url, util.ARGS.internalKey, "1");
  const ua = r.headersIn["User-Agent"];
  ngx.fetch(url, {
    method: "HEAD",
    headers: {
      "User-Agent": ua,
    },
    max_response_body_size: 1024
  }).then(res => {
    ngx.log(ngx.WARN, `preload response.status: ${res.status}`);
    if ((res.status > 300 && res.status < 309) || res.status == 200) {
      ngx.log(ngx.WARN, `success: preload used UA: ${ua}, url: ${url}`);
    } else {
      ngx.log(ngx.WARN, `error: preload, skip`);
    }
  }).catch((error) => {
    ngx.log(ngx.ERR, `error: preload: ${error}`);
  });
}

async function redirectAfter(r, url, cachedRouteDictKey) {
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    let cachedMsg = "";
    const routeCacheConfig = config.routeCacheConfig;
    if (routeCacheConfig.enable) {
      const ua = r.headersIn["User-Agent"];
      // webClient download only have itemId on pathParam
      let cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
      cacheKey = url.includes(config.strHead["115"]) ? `${cacheKey}:${ua}` : cacheKey;
      r.log(`redirectAfter cacheKey: ${cacheKey}`);
      // cachePreload added args in url
      const cacheLevle = r.args[util.ARGS.cacheLevleKey] ?? util.CHCHE_LEVEL_ENUM.L1;
      let flag = !ngx.shared["routeL2Dict"].has(cacheKey);
      // && !ngx.shared["routeL3Dict"].has(cacheKey);
      let routeDictKey = "routeL1Dict";
      if (util.CHCHE_LEVEL_ENUM.L2 === cacheLevle) {
        routeDictKey = "routeL2Dict";
        flag = !ngx.shared["routeL1Dict"].has(cacheKey);
        // } else if (util.CHCHE_LEVEL_ENUM.L3 === cacheLevle) {
        //   routeDictKey = "routeL3Dict";
        //   flag = !ngx.shared["routeL1Dict"].has(cacheKey) && !ngx.shared["routeL2Dict"].has(cacheKey);
      }
      if (flag) {
        util.dictAdd(routeDictKey, cacheKey, url);
        cachedMsg += `cache ${routeDictKey} added, `;
      }
      cachedMsg = cachedRouteDictKey ? `hit cache ${cachedRouteDictKey}, ` : cachedMsg;
    }

    const deviceId = urlUtil.getDeviceId(r.args);
    const idemVal = ngx.shared.idemDict.get(deviceId);
    if (config.embyNotificationsAdmin.enable && !idemVal) {
      embyApi.fetchNotificationsAdmin(
        config.embyNotificationsAdmin.name,
        config.embyNotificationsAdmin.includeUrl ?
          `${cachedMsg}original link: ${r.uri}\nredirect to: ${url}` :
          `${cachedMsg}redirect: success`
      );
      util.dictAdd("idemDict", deviceId, "1");
    }

    if (config.embyRedirectSendMessage.enable && !idemVal) {
      sendMessage2EmbyDevice(deviceId,
        config.embyRedirectSendMessage.header,
        `${cachedMsg}redirect: success`,
        config.embyRedirectSendMessage.timeoutMs);
      util.dictAdd("idemDict", deviceId, "1");
    }
  } catch (error) {
    r.error(`error: redirectAfter: ${error}`);
  }
}

async function internalRedirectAfter(r, uri, cachedRouteDictKey) {
  try {
    await new Promise(resolve => setTimeout(resolve, 0));
    let cachedMsg = "";
    const routeCacheConfig = config.routeCacheConfig;
    if (routeCacheConfig.enable) {
      cachedMsg = `hit routeCache L1: ${!!cachedRouteDictKey}, `;
      // webClient download only have itemId on pathParam
      const cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
      util.dictAdd("routeL1Dict", cacheKey, uri);
    }

    const deviceId = urlUtil.getDeviceId(r.args);
    const idemVal = ngx.shared.idemDict.get(deviceId);
    const msgPrefix = `${cachedMsg}use original link: `;
    if (config.embyNotificationsAdmin.enable && !idemVal) {
      embyApi.fetchNotificationsAdmin(
        config.embyNotificationsAdmin.name,
        config.embyNotificationsAdmin.includeUrl ?
          msgPrefix + r.uri :
          `${msgPrefix}success`
      );
      util.dictAdd("idemDict", deviceId, "1");
    }

    if (config.embyRedirectSendMessage.enable && !idemVal) {
      sendMessage2EmbyDevice(deviceId,
        config.embyRedirectSendMessage.header,
        `${msgPrefix}success`,
        config.embyRedirectSendMessage.timeoutMs);
      util.dictAdd("idemDict", deviceId, "1");
    }
  } catch (error) {
    r.error(`error: internalRedirectAfter: ${error}`);
  }
}

async function redirect(r, url, cachedRouteDictKey) {
  if (config.alistSignEnable) {
    url = util.addAlistSign(url, config.alistToken, config.alistSignExpireTime);
  }
  if (config.redirectCheckEnable && !(await util.cost(ngxExt.linkCheck, url, r.headersIn["User-Agent"]))) {
    r.warn(`redirectCheck fail: ${url}`);
    return internalRedirect(r);
  }

  r.warn(`redirect to: ${url}`);
  // need caller: return;
  r.return(302, url);

  // async
  redirectAfter(r, url, cachedRouteDictKey);
}

function internalRedirect(r, uri, cachedRouteDictKey) {
  if (!uri) {
    uri = "@root";
    r.warn(`use original link`);
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);

  // async
  internalRedirectAfter(r, uri, cachedRouteDictKey);
}

function internalRedirectExpect(r, uri) {
  if (!uri) { uri = "@root"; }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);
}

export default {
  redirect2Pan,
  fetchEmbyFilePath,
  transferPlaybackInfo,
  modifyBaseHtmlPlayer,
  redirect,
  internalRedirect,
  internalRedirectExpect,
};

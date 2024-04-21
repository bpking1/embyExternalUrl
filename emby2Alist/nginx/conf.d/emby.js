// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 emby-nginx 2>&1  | grep js:"
// 正常情况下此文件所有内容不需要更改

import config from "./constant.js";
import util from "./common/util.js";
import events from "./common/events.js";
import embyApi from "./api/emby-api.js";

async function redirect2Pan(r) {
  events.njsOnExit(r);
  const ua = r.headersIn["User-Agent"];
  r.warn(`redirect2Pan, UA: ${ua}`);

  // check redirect link cache
  if (config.routeCacheEnable) {
    const cachedLink = ngx.shared.routeDict.get(`${ua}:${r.uri}`);
    if (!!cachedLink) {
      r.warn(`hit routeCache: ${cachedLink}`);
      if (cachedLink.startsWith("@")) {
        // use original link
        return internalRedirect(r, cachedLink, true);
      } else {
        return redirect(r, cachedLink, true);
      }
    }
  }

  let embyRes = {
    path: r.args[util.args.filePathKey],
    notLocal: r.args[util.args.notLocalKey] === "1", // fuck js Boolean("false") === true, !!"0" === true
  };
  if (!embyRes.path) {
    // fetch mount emby/jellyfin file path
    const itemInfo = util.getItemInfo(r);
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
    // start = Date.now();
    embyRes = await util.cost(fetchEmbyFilePath,
      itemInfo.itemInfoUri, 
      itemInfo.itemId, 
      itemInfo.Etag, 
      itemInfo.mediaSourceId);
    r.log(`embyRes: ${JSON.stringify(embyRes)}`);
    if (embyRes.message.startsWith("error")) {
      r.error(embyRes.message);
      return r.return(500, embyRes.message);
    }
  } else {
    embyRes.path = decodeURIComponent(embyRes.path);
    r.warn(`cached PlaybackInfo path, will skip excess fetchEmbyFilePath`);
  }
  // strm file internal text maybe encode
  if (embyRes.notLocal) {
    embyRes.path = decodeURIComponent(embyRes.path);
  }
  r.warn(`mount emby file path: ${embyRes.path}`);

  // routeRule
  const routeMode = util.getRouteMode(r, embyRes.path, false, embyRes.notLocal);
  if (util.routeEnum.proxy == routeMode) {
    // use original link
    return internalRedirect(r);
  } else if (util.routeEnum.block == routeMode) {
    return r.return(403, "blocked");
  }

  let isRemote = util.checkIsRemoteByPath(embyRes.path);
  // file path mapping
  let embyPathMapping = config.embyPathMapping;
  config.embyMountPath.map(s => {
    if (!!s) {
      embyPathMapping.unshift([0, 0 , s, ""]);
    }
  });
  r.warn(`embyPathMapping: ${JSON.stringify(embyPathMapping)}`);
  let embyItemPath = embyRes.path;
  embyPathMapping.map(arr => {
    if ((arr[1] == 0 && embyRes.notLocal)
      || (arr[1] == 1 && (!embyRes.notLocal || isRemote))
      || (arr[1] == 2 && (!embyRes.notLocal || !isRemote))) {
        return;
    }
    embyItemPath = util.strMapping(arr[0], embyItemPath, arr[2], arr[3]);
  });
  isRemote = util.checkIsRemoteByPath(embyItemPath)
  r.warn(`mapped emby file path: ${embyItemPath}`);

  // strm file inner remote link redirect,like: http,rtsp
  if (isRemote) {
    const rule = util.redirectStrmLastLinkRuleFilter(embyItemPath);
    if (!!rule && rule.length > 0) {
      r.warn(`filePath hit redirectStrmLastLinkRule: ${JSON.stringify(rule)}`);
      let directUrl = await fetchStrmLastLink(embyItemPath, rule[2], rule[3], rule[4], ua);
      if (!!directUrl) {
        embyItemPath = directUrl;
      } else {
        r.warn(`warn: fetchStrmLastLink, not expected result, failback once`);
        directUrl = await fetchStrmLastLink(util.strmLinkFailback(strmLink), rule[2], rule[3], rule[4], ua);
        if (!!directUrl) {
          embyItemPath = directUrl;
        }
      }
    }
    // don't encode, excepted webClient, clients not decode
    return redirect(r, embyItemPath);
  }

  // fetch alist direct link
  const alistFilePath = embyItemPath;
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
    if (util.routeEnum.proxy == routeMode) {
      // use original link
      return internalRedirect(r);
    } else if (util.routeEnum.block == routeMode) {
      return r.return(403, "blocked");
    }
    return redirect(r, alistRes);
  }
  r.warn(`alistRes: ${alistRes}`);
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    return r.return(403, alistRes);
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
      r.error(foldersRes);
      return r.return(500, foldersRes);
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
    r.warn(`fail to fetch alist resource: not found`);
    return r.return(404);
  }
  r.error(alistRes);
  return r.return(500, alistRes);
}

// 拦截 PlaybackInfo 请求，防止客户端转码（转容器）
async function transferPlaybackInfo(r) {
  events.njsOnExit(r);
  let start = Date.now();
  // replay the request
  const proxyUri = util.proxyUri(r.uri);
  r.warn(`playbackinfo proxy uri: ${proxyUri}`);
  const query = util.generateUrl(r, "", "").substring(1);
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
      for (let i = 0; i < body.MediaSources.length; i++) {
        const source = body.MediaSources[i];
        // if (source.IsRemote) {
        //   // live streams are not blocked
        //   // return r.return(200, response.responseText);
        // }

        const notLocal = util.checkNotLocal(source.Protocol, source.MediaStreams.length) ? "1" : "0";
        // routeRule
        let isRedirectWithTransOpt = false;
        if (config.transcodeBalanceConfig.enable) {
          const routeMode = util.getRouteMode(r, source.Path, false, notLocal);
          if (util.routeEnum.redirect == routeMode) {
            isRedirectWithTransOpt = true;
            if (r.args.AutoOpenLiveStream === "true" && r.args.StartTimeTicks != 0) {
              continue;
            }
          } else if (util.routeEnum.transcode == routeMode) {
            continue;
          } else if (util.routeEnum.block == routeMode) {
            return r.return(403, "blocked");
          }
        }

        r.warn(`modify direct play info`);
        source.SupportsDirectPlay = true;
        source.SupportsDirectStream = true;
        source.OriginDirectStreamUrl = source.DirectStreamUrl; // for debug
        source.DirectStreamUrl = util.addDefaultApiKey(
          r,
          util
            .generateUrl(r, "", r.uri)
            .replace("/emby/Items", "/videos")
            // origin link: /emby/videos/401929/stream.xxx?xxx
            // modify link: /emby/videos/401929/stream/xxx.xxx?xxx
            .replace("PlaybackInfo", `stream/${source.Name}.${source.Container}`)
        );
        source.DirectStreamUrl = util.appendUrlArg(
          source.DirectStreamUrl,
          "MediaSourceId",
          source.Id
        );
        source.DirectStreamUrl = util.appendUrlArg(
          source.DirectStreamUrl,
          "Static",
          "true"
        );
        // addFilePath and strmInfo cache to clients
        source.DirectStreamUrl = util.appendUrlArg(
          source.DirectStreamUrl,
          util.args.filePathKey,
          // r.args default remove special character
          encodeURIComponent(source.Path)
        );
        source.DirectStreamUrl = util.appendUrlArg(
          source.DirectStreamUrl,
          util.args.notLocalKey,
          notLocal
        );
        // a few players not support special character
        source.DirectStreamUrl = encodeURI(source.DirectStreamUrl);
        // routeRule
        if (isRedirectWithTransOpt) {
          continue;
        }
        r.warn(`remove transcode config`);
        source["X-Modify-Success"] = true; // for debug
        source.SupportsTranscoding = false;
        if (source.TranscodingUrl) {
          delete source.TranscodingUrl;
          delete source.TranscodingSubProtocol;
          delete source.TranscodingContainer;
        }
      }

      util.copyHeaders(response, r);
      const bodyJson = JSON.stringify(body);
      r.headersOut["Content-Type"] = "application/json;charset=utf-8";
      let end = Date.now();
      r.warn(`${end - start}ms, transfer playbackinfo: ${bodyJson}`);
      return r.return(200, bodyJson);
    }
  }
  r.warn("playbackinfo subrequest failed");
  return internalRedirect(r);
}

async function fetchAlistPathApi(alistApiPath, alistFilePath, alistToken, ua) {
  const alistRequestBody = {
    path: alistFilePath,
    password: "",
  };
  try {
    const response = await ngx.fetch(alistApiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: alistToken,
        "User-Agent": ua,
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
          return handleAlistRawUrl(result, alistFilePath);
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

function handleAlistRawUrl(alistRes, alistFilePath) {
  let rawUrl = alistRes.data.raw_url;
  const alistSign = alistRes.data.sign;
  const cilentSelfAlistRule = config.cilentSelfAlistRule;
  if (cilentSelfAlistRule.length > 0) {
    cilentSelfAlistRule.some(rule => {
      if (util.strMatches(rule[0], rawUrl, rule[1])) {
        rawUrl = `${rule[2]}/d${encodeURI(alistFilePath)}${!alistSign ? "" : `?sign=${alistSign}`}`;
        return true;
      }
    });
  }
  return rawUrl;
}

async function fetchAlistAuthApi(url, username, password) {
  const body = {
    username: username,
    password: password,
  };
  try {
    const response = await ngx.fetch(url, {
      method: "POST",
      max_response_body_size: 1024,
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result) {
        return `error: alist_auth_api response is null`;
      }
      if (result.message == "success") {
        return result.data.token;
      }
      return `error500: alist_auth_api ${result.code} ${result.message}`;
    } else {
      return `error: alist_auth_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: alist_auth_api filed ${error}`;
  }
}

async function fetchEmbyFilePath(itemInfoUri, itemId, Etag, mediaSourceId) {
  let rvt = {
    message: "success",
    path: "",
    itemName: "",
    notLocal: false,
  };
  try {
    const res = await ngx.fetch(itemInfoUri, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Content-Length": 0,
      },
      max_response_body_size: 8388608, // 1MB
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
          rvt.path = jobItem.MediaSource.Path;
          rvt.notLocal = util.checkIsStrmByPath(jobItem.OutputPath);
        } else {
          rvt.message = `error: emby_api /Sync/JobItems response is null`;
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
          rvt.notLocal = util.checkIsStrmByPath(item.Path);
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

async function itemsFilter(r) {
  events.njsOnExit(r);
  r.variables.request_uri += "&Fields=Path";
  const subR = await r.subrequest(util.proxyUri(r.uri));
  let body;
  if (subR.status === 200) {
  	body = JSON.parse(subR.responseText);
  } else {
  	r.warn("itemsFilter subrequest failed");
	  return internalRedirect(r);
  }
  let totalRecordCount = body.Items.length;
  r.warn(`itemsFilter before: ${totalRecordCount}`);

  const flag = r.variables.flag;
  r.warn(`itemsFilter flag: ${flag}`);
  let mainItemPath;
  if (flag == "itemSimilar") {
    // fetch mount emby/jellyfin file path
    const itemInfo = util.getItemInfo(r);
    r.warn(`itemSimilarInfoUri: ${itemInfo.itemInfoUri}`);
    const embyRes = await util.cost(fetchEmbyFilePath,
      itemInfo.itemInfoUri, 
      itemInfo.itemId, 
      itemInfo.Etag, 
      itemInfo.mediaSourceId
    );
    mainItemPath = embyRes.path;
    r.warn(`mainItemPath: ${mainItemPath}`);
  }

  const itemHiddenRule = config.itemHiddenRule;
  if (!!body.Items && itemHiddenRule.length > 0) {
    body.Items = body.Items.filter(item => {
      if (!item.Path) {
        return true;
      }
      return !itemHiddenRule.some(rule => {
        if ((!rule[2] || rule[2] == 0 || rule[2] == 2) && !!mainItemPath 
          && util.strMatches(rule[0], mainItemPath, rule[1])) {
          return false;
        }
        if (flag == "searchSuggest" && rule[2] == 2) {
          return false;
        }
        if (flag == "itemSimilar" && rule[2] == 1) {
          return false;
        }
        if (util.strMatches(rule[0], item.Path, rule[1])) {
          r.warn(`itemPath hit itemHiddenRule: ${item.Path}`);
          return true;
        }
      });
    });
  }
  totalRecordCount = body.Items.length;
  r.warn(`itemsFilter after: ${totalRecordCount}`);
  body.TotalRecordCount = totalRecordCount;
  util.copyHeaders(subR, r);
  return r.return(200, JSON.stringify(body));
}

async function systemInfoHandler(r) {
  events.njsOnExit(r);
  const subR = await r.subrequest(util.proxyUri(r.uri));
  let body;
  if (subR.status === 200) {
  	body = JSON.parse(subR.responseText);
  } else {
  	r.warn(`systemInfoHandler subrequest failed`);
	  return internalRedirect(r);
  }
  const currentPort = parseInt(r.variables.server_port);
  const originPort = parseInt(body.HttpServerPortNumber);
  body.WebSocketPortNumber = currentPort;
  body.HttpServerPortNumber = currentPort;
  if (body.LocalAddresses) {
    body.LocalAddresses.forEach((s, i, arr) => {
      arr[i] = s.replace(originPort, currentPort);
    });
  }
  if (body.RemoteAddresses) {
    body.RemoteAddresses.forEach((s, i, arr) => {
      arr[i] = s.replace(originPort, currentPort);
    });
  }
  // old clients
  if (!!body.LocalAddress) {
    body.LocalAddress = body.LocalAddress.replace(originPort, currentPort);
  }
  if (!!body.WanAddress) {
    body.WanAddress = body.WanAddress.replace(originPort, currentPort);
  }
  util.copyHeaders(subR, r);
  return r.return(200, JSON.stringify(body));
}

async function fetchStrmLastLink(strmLink, authType, authInfo, authUrl, ua) {
  let token;
  if (!!authType) {
    if (authType == "FixedToken" && !!authInfo) {
      token = authInfo;
    }
    if (authType == "TempToken" && !!authInfo && !!authUrl) {
      const arr = authInfo.split(":");
      token = await fetchAlistAuthApi(authUrl, arr[0], arr[1]);
    }
  }
  try {
  	// fetch Api ignore nginx locations
    const response = await ngx.fetch(encodeURI(strmLink), {
      method: "HEAD",
      headers: {
        Authorization: token,
        "User-Agent": ua,
      },
      max_response_body_size: 1024
    });
    const contentType = response.headers["Content-Type"];
    ngx.log(ngx.WARN, `fetchStrmLastLink response.status: ${response.status}, contentType: ${contentType}`);
    // response.redirected api error return false
    if ((response.status > 300 && response.status < 309) || response.status == 403) {
      return response.headers["Location"];
    } else if (response.status == 200) {
      // alist 401 but return 200 status code
      if (contentType.includes("application/json")) {
        ngx.log(ngx.ERR, `fetchStrmLastLink alist mayby return 401, check your alist sign or auth settings`);
        return;
      }
      ngx.log(ngx.ERR, `error: fetchStrmLastLink, not expected result`);
    } else {
      ngx.log(ngx.ERR, `error: fetchStrmLastLink: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchStrmLastLink: ${error}`);
  }
}

async function sendMessage2EmbyDevice(deviceId, header, text, timeoutMs) {
  if (!deviceId) {
    ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: deviceId is required, skip`);
    return;
  }
  embyApi.fetchSessions(config.embyHost, config.embyApiKey, {DeviceId:deviceId}).then(sessionResPromise => {
    sessionResPromise.json().then(sessionRes => {
      if (!sessionRes || (!!sessionRes && sessionRes.length == 0)) {
        ngx.log(ngx.WARN, `warn: sendMessage2EmbyDevice: fetchSessions: session not found, skip`);
        return;
      }
      // sometimes have multiple sessions
      embyApi.fetchSessionsMessage(sessionRes.filter(s => s.SupportsRemoteControl)[0].Id, header, text, timeoutMs);
    });
  });
}

function redirect(r, uri, isCached) {
  r.warn(`redirect to: ${uri}`);
  // need caller: return;
  r.return(302, uri);

  // async
  let cachedMsg = "";
  if (config.routeCacheEnable) {
    cachedMsg = `hit routeCache: ${!!isCached}, `;
    util.dictAdd("routeDict", `${r.headersIn["User-Agent"]}:${r.uri}`, uri);
  }
  if (config.embyNotificationsAdmin.enable) {
    embyApi.fetchNotificationsAdmin(
      config.embyNotificationsAdmin.name,
      config.embyNotificationsAdmin.includeUrl ? 
      `${cachedMsg}original link: ${r.uri}\nredirect to: ${uri}` :
      `${cachedMsg}redirect: success`
    );
  }
  if (config.embyRedirectSendMessage.enable) {
    sendMessage2EmbyDevice(util.getDeviceId(r.args),
      config.embyRedirectSendMessage.header,
      `${cachedMsg}redirect: success`,
      config.embyRedirectSendMessage.timeoutMs);
  }
}

function internalRedirect(r, uri, isCached) {
  if (!uri) {
    uri = "@root";
    r.warn(`use original link`);
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);

  // async
  let cachedMsg = "";
  if (config.routeCacheEnable) {
    cachedMsg = `hit routeCache: ${!!isCached}, `;
    util.dictAdd("routeDict", `${r.headersIn["User-Agent"]}:${r.uri}`, uri);
  }
  const msgPrefix = `${cachedMsg}use original link: `;
  if (config.embyNotificationsAdmin.enable) {
    embyApi.fetchNotificationsAdmin(
      config.embyNotificationsAdmin.name,
      config.embyNotificationsAdmin.includeUrl ? 
      msgPrefix + r.uri :
      `${msgPrefix}success`
    );
  }
  if (config.embyRedirectSendMessage.enable) {
    sendMessage2EmbyDevice(util.getDeviceId(r.args),
      config.embyRedirectSendMessage.header,
      `${msgPrefix}success`,
      config.embyRedirectSendMessage.timeoutMs);
  }
}

function internalRedirectExpect(r, uri) {
  if (!uri) {
    uri = "@root";
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);
}

export default {
  redirect2Pan,
  fetchEmbyFilePath,
  transferPlaybackInfo,
  itemsFilter,
  systemInfoHandler,
  redirect,
  internalRedirect,
  internalRedirectExpect,
};

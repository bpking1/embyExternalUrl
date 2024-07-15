// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 plex-nginx 2>&1  | grep js:"
// 正常情况下此文件所有内容不需要更改

import config from "./constant.js";
import util from "./common/util.js";
import events from "./common/events.js";
import ngxExt from "./modules/ngx-ext.js";

const xml = require("xml");

async function redirect2Pan(r) {
  events.njsOnExit(`redirect2Pan: ${r.uri}`);

  const ua = r.headersIn["User-Agent"];
  r.warn(`redirect2Pan, UA: ${ua}`);

  // check transcode
  if (config.transcodeConfig.enable
    && r.uri.toLowerCase().includes("/transcode/universal/start")
    && r.args.directPlay === "0") {
    r.warn(`required plex clients self report, skip modify`);
    return internalRedirect(r);
  }
  
  // check route cache
  const routeCacheConfig = config.routeCacheConfig;
  if (routeCacheConfig.enable) {
    // webClient download only have itemId on pathParam
    let cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
    r.log(`redirect2Pan cacheKey: ${cacheKey}`);
    let routeDictKey;
    let cachedLink;
    for (let index = 1; index < 3; index++) {
      routeDictKey = `routeL${index}Dict`;
      cachedLink = ngx.shared[routeDictKey].get(cacheKey);
      if (!cachedLink) {
        // 115 must use ua
        cachedLink = ngx.shared[routeDictKey].get(`${cacheKey}:${ua}`);
      }
      if (!!cachedLink) {
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

  // fetch mount plex file path
  const itemInfo = await util.cost(getPlexItemInfo, r);
  let mediaServerRes;
  if (itemInfo.filePath) {
    mediaServerRes = {path: itemInfo.filePath};
    r.warn(`get filePath from cache partInfoDict`);
  } else {
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
    mediaServerRes = await util.cost(fetchPlexFilePath,
      itemInfo.itemInfoUri, 
      itemInfo.mediaIndex, 
      itemInfo.partIndex
    );
    r.log(`mediaServerRes: ${JSON.stringify(mediaServerRes)}`);
    if (mediaServerRes.message.startsWith("error")) {
      r.error(`fail to fetch fetchPlexFilePath: ${mediaServerRes.message},fallback use original link`);
      return internalRedirect(r);
    }
  }

  // strm file internal text maybe encode
  const notLocal = util.checkIsStrmByPath(mediaServerRes.path);
  r.warn(`notLocal: ${notLocal}`);
  if (notLocal) {
    mediaServerRes.path = decodeURIComponent(mediaServerRes.path);
    r.warn(`notLocal decodeURIComponent mediaServerRes.path`);
  }

  // check symlinkRule
  const symlinkRule = config.symlinkRule;
  if (symlinkRule && symlinkRule.length > 0) {
    const hitRule = symlinkRule.find(rule => util.strMatches(rule[0], mediaServerRes.path, rule[1]));
    if (hitRule) {
      r.warn(`hit symlinkRule: ${JSON.stringify(hitRule)}`);
      const realpath = util.checkAndGetRealpathSync(mediaServerRes.path);
      if (realpath) {
        r.warn(`symlinkRule realpath overwrite pre: ${mediaServerRes.path}`);
        mediaServerRes.path = realpath;
      }
    }
  }
  r.warn(`mount plex file path: ${mediaServerRes.path}`);

  // routeRule, not must before mediaPathMapping, before is simple, can ignore mediaPathMapping
  const routeMode = util.getRouteMode(r, mediaServerRes.path, false, notLocal);
  r.warn(`getRouteMode: ${routeMode}`);
  if (util.ROUTE_ENUM.proxy == routeMode) {
    // use original link
    return internalRedirect(r);
  } else if (util.ROUTE_ENUM.block == routeMode) {
    return r.return(403, "blocked");
  }

  // strm support
  if (notLocal) {
    const strmInnerText = await util.cost(fetchStrmInnerText, r);
    r.warn(`fetchStrmInnerText cover mount plex file path: ${strmInnerText}`);
    mediaServerRes.path = strmInnerText;
  }

  let isRemote = !util.isAbsolutePath(mediaServerRes.path);
  let mediaPathMapping = config.mediaPathMapping;
  // file path mapping
  config.mediaMountPath.map(s => {
    if (!!s) {
      mediaPathMapping.unshift([0, 0 , s, ""]);
    }
  });
  r.warn(`mediaPathMapping: ${JSON.stringify(mediaPathMapping)}`);
  let mediaItemPath = mediaServerRes.path;
  mediaPathMapping.map(arr => {
    if ((arr[1] == 0 && notLocal)
      || (arr[1] == 1 && (!notLocal || isRemote))
      || (arr[1] == 2 && (!notLocal || !isRemote))) {
        return;
    }
    mediaItemPath = util.strMapping(arr[0], mediaItemPath, arr[2], arr[3]);
  });
  // windows filePath to URL path, warn: markdown log text show \\ to \
  if (mediaItemPath.startsWith("\\")) {
    r.warn(`windows filePath to URL path \\ => /`);
    mediaItemPath = mediaItemPath.replaceAll("\\", "/");
  }
  r.warn(`mapped plex file path: ${mediaItemPath}`);

  // strm file inner remote link redirect,like: http,rtsp
  // not only strm, mediaPathMapping maybe used remote link
  isRemote = !util.isAbsolutePath(mediaItemPath);
  if (isRemote) {
    let rule = util.simpleRuleFilter(r, config.redirectStrmLastLinkRule, mediaItemPath, SOURCE_STR_ENUM.filePath, "redirectStrmLastLinkRule");
    if (rule && rule.length > 0) {
      if (!Number.isInteger(rule[0])) {
        // convert groupRule remove groupKey and sourceValue
        r.warn(`convert groupRule remove groupKey and sourceValue`);
        rule = rule.slice(2);
      }
      let directUrl = await ngxExt.fetchLastLink(mediaItemPath, rule[2], rule[3], ua);
      if (!!directUrl) {
        mediaItemPath = directUrl;
      } else {
        r.warn(`warn: fetchLastLink, not expected result, failback once`);
        directUrl = await ngxExt.fetchLastLink(ngxExt.lastLinkFailback(mediaItemPath), rule[2], rule[3], ua);
        if (!!directUrl) {
          mediaItemPath = directUrl;
        }
      }
    }
    // need careful encode filePathPart, other don't encode
    const filePathPart = util.getFilePathPart(mediaItemPath);
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
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const alistFilePath = mediaItemPath;
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
    const routeMode = util.getRouteMode(r, alistRes, true, notLocal);
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

// copy from emby2Alist/nginx/conf.d/emby.js
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
          return result.data.raw_url;
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

async function cachePreload(r, url, cacheLevel) {
  url = util.appendUrlArg(url, util.ARGS.cacheLevleKey, cacheLevel);
  ngx.log(ngx.WARN, `cachePreload Level: ${cacheLevel}`);
  preload(r, url);
}

async function preload(r, url) {
  events.njsOnExit(`preload`);

  url = util.appendUrlArg(url, util.ARGS.internalKey, "1");
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

// plex only

async function fetchPlexFilePath(itemInfoUri, mediaIndex, partIndex) {
  let rvt = {
    "message": "success",
    "path": ""
  };
  try {
    const res = await ngx.fetch(itemInfoUri, {
      method: "GET",
      headers: {
      	"Accept": "application/json", // only plex need this
        "Content-Type": "application/json;charset=utf-8",
        "Content-Length": 0,
      },
      max_response_body_size: 65535
    });
    if (res.ok) {
      const result = await res.json();
      if (!result) {
        rvt.message = `error: plex_api itemInfoUri response is null`;
        return rvt;
      }
      if (!result.MediaContainer.Metadata) {
        rvt.message = `error: plex_api No search results found`;
        return rvt;
      }
      // location ~* /library/parts/(\d+)/(\d+)/file, not hava mediaIndex and partIndex
      mediaIndex = mediaIndex ? mediaIndex : 0;
      partIndex = partIndex ? partIndex : 0;
      rvt.path = result.MediaContainer.Metadata[0].Media[mediaIndex].Part[partIndex].file;
      return rvt;
    } else {
      rvt.message = `error: plex_api ${res.status} ${res.statusText}`;
      return rvt;
    }
  } catch (error) {
    rvt.message = `error: plex_api fetch mediaItemInfo failed, ${error}`;
    return rvt;
  }
}

async function getPlexItemInfo(r) {
  const plexHost = config.plexHost;
  const path = r.args.path;
  const mediaIndex = r.args.mediaIndex;
  const partIndex = r.args.partIndex;
  const api_key = r.args[util.ARGS.plexTokenKey];
  let filePath;
  let itemInfoUri = "";
  if (path) {
	  // see: location ~* /video/:/transcode/universal/start
  	itemInfoUri = `${plexHost}${path}?${util.ARGS.plexTokenKey}=${api_key}`;
  } else {
  	// see: location ~* /library/parts/(\d+)/(\d+)/file
    filePath = ngx.shared.partInfoDict.get(r.uri);
    r.warn(`getPlexItemInfo r.uri: ${r.uri}`);
    if (!filePath) {
      r.warn(`!!! not expect, will fallback search`);
      const plexRes = await fetchPlexFileFullName(`${plexHost}${r.uri}?download=1&${util.ARGS.plexTokenKey}=${api_key}`);
      if (!plexRes.startsWith("error")) {
        const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
        itemInfoUri = `${plexHost}/search?query=${encodeURI(plexFileName)}&${util.ARGS.plexTokenKey}=${api_key}`;
      } else {
        r.warn(plexRes);
      }
    }
  }
  return { filePath, itemInfoUri, mediaIndex, partIndex, api_key };
}

async function fetchPlexFileFullName(downloadApiPath) {
  try {
    const response = await ngx.fetch(downloadApiPath, {
      method: "HEAD",
      max_response_body_size: 100 * 1024 ** 3, // 100GB,not important,because HEAD method not have body
    });
    if (response.ok) {
      return util.getFileNameByHead(decodeURI(response.headers["Content-Disposition"]));
    } else {
      return `error: plex_download_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchPlexFileNameFiled ${error}`;
  }
}

async function fetchStrmInnerText(r) {
  const plexHost = config.plexHost;
  const api_key = r.args[util.ARGS.plexTokenKey];
  const downloadApiPath = `${plexHost}${r.uri}?download=1&${util.ARGS.plexTokenKey}=${api_key}`;
  try {
  	// fetch Api ignore nginx locations
    const response = await ngx.fetch(downloadApiPath, {
      method: "HEAD",
      max_response_body_size: 1024
    });
    // plex strm downloadApi self return 301, response.redirected api error return false
    if (response.status > 300 && response.status < 309) {
      const location = response.headers["Location"];
      let strmInnerText = location;
      const tmpArr = plexHost.split(":");
      const plexHostWithoutPort = `${tmpArr[0]}:${tmpArr[1]}`;
      if (location.startsWith(plexHostWithoutPort)) {
        // strmInnerText is local path
        strmInnerText = location.replace(plexHostWithoutPort, "");
      }
      r.log(`fetchStrmInnerText: ${strmInnerText}`);
      return decodeURI(strmInnerText);
    }
    if (response.ok) {
      r.log(`fetchStrmInnerText: ${response.text()}`);
      return decodeURI(response.text());
    } else {
      return `error: plex_download_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchStrmInnerText ${error}`;
  }
}

async function plexApiHandler(r) {
  events.njsOnExit(`plexApiHandler: ${r.uri}`);

  const subR = await r.subrequest(util.proxyUri(r.uri), {
    method: r.method,
  });
  const contentType = subR.headersOut["Content-Type"];
  //r.log(`plexApiHandler Content-Type Header: ${contentType}`);
  let bodyObj;
  let sBody;
  if (subR.status === 200) {
    if (contentType.includes("application/json")) {
      bodyObj = JSON.parse(subR.responseText);
      plexApiHandlerForJson(r, bodyObj);
      sBody = JSON.stringify(bodyObj);
    } else if (contentType.includes("text/xml")) {
      bodyObj = xml.parse(subR.responseText);
      plexApiHandlerForXml(r, bodyObj);
      sBody = xml.serialize(bodyObj);
    }
  } else {
  	r.warn(`plexApiHandler subrequest failed, status: ${subR.status}`);
	  return internalRedirect(r);
  }

  util.copyHeaders(subR.headersOut, r.headersOut);
  return r.return(200, sBody);
}

function plexApiHandlerForJson(r, body) {
  const mediaContainer = body.MediaContainer;
  mediaContainerHandler(r, mediaContainer);
  const directoryArr = mediaContainer.Directory;
  if (!!directoryArr) {
    directoryArr.map(dir => {
      directoryHandler(r, dir);
    });
  }
  if (mediaContainer.size > 0) {
    let metadataArr = [];
    if (!!mediaContainer.Hub) {
      mediaContainer.Hub.map(hub => {
        if (!!hub.Metadata) {
          hub.Metadata.map(metadata => {
            metadataArr.push(metadata);
          });
        }
      });
    } else {
      if (!!mediaContainer.Metadata) {
        mediaContainer.Metadata.map(metadata => {
          metadataArr.push(metadata);
        });
      }
    }
    metadataArr.map(metadata => {
      metadataHandler(r, metadata);
      if (!!metadata.Media) {
        metadata.Media.map(media => {
          mediaInfoHandler(r, media);
          if (!!media.Part) {
            media.Part.map(part => partInfoHandler(r, part));
          }
        });
      }
    });
  }
}

function plexApiHandlerForXml(r, body) {
  const mediaContainerXmlDoc = body.MediaContainer;
  mediaContainerHandler(r, mediaContainerXmlDoc, true);
  const directoryXmlDoc = mediaContainerXmlDoc.$tags$Directory;
  if (!!directoryXmlDoc) {
    directoryXmlDoc.map(dir => {
      directoryHandler(r, dir, true);
    });
  }
  let videoXmlNodeArr = mediaContainerXmlDoc.$tags$Video;
  let mediaXmlNodeArr;
  let partXmlNodeArr;
  // r.log(videoXmlNodeArr.length);
  if (!!videoXmlNodeArr && videoXmlNodeArr.length > 0) {
    videoXmlNodeArr.map(video => {
      metadataHandler(r, video, true);
      // Video.key prohibit modify, clients not supported
      mediaXmlNodeArr = video.$tags$Media;
      if (!!mediaXmlNodeArr && mediaXmlNodeArr.length > 0) {
        mediaXmlNodeArr.map(media => {
          mediaInfoHandler(r, media, true);
          partXmlNodeArr = media.$tags$Part;
          if (!!partXmlNodeArr && partXmlNodeArr.length > 0) {
            partXmlNodeArr.map(part => partInfoHandler(r, part, true));
          }
        });
      }
    });
  }
}

/**
 * handler design patterns,below root to child order
 * @param {Object} r nginx objects, HTTP Request
 * @param {Object} mainObject different single object
 * @param {Boolean} isXmlNode mainObject is xml node
 */

function mediaContainerHandler(r, mediaContainer, isXmlNode) {
  // another custome process
}

function directoryHandler(r, directory, isXmlNode) {
  // modifyDirectoryHidden(r, directory, isXmlNode);
  // another custome process
}

function metadataHandler(r, metadata, isXmlNode) {
  // Metadata.key prohibit modify, clients not supported
  // json is metadata, xml is $tags$Video tag
  // another custome process
}

function mediaInfoHandler(r, media, isXmlNode) {
  fillMediaInfo(r, media, isXmlNode);
  // another custome process
}

function partInfoHandler(r, part, isXmlNode) {
  cachePartInfo(r, part, isXmlNode);
  fillPartInfo(r, part, isXmlNode);
  // another custome process
}

// another custome process

function cachePartInfo(r, part, isXmlNode) {
  if (!part) return;
  // Part.key can modify, but some clients not supported
  // partKey += `?${util.filePathKey}=${partFilePath}`;
  let partKey = part.key;
  let partFilePath = part.file;
  if (isXmlNode) {
    partKey = part.$attr$key;
    partFilePath = part.$attr$file;
  }
  util.dictAdd("partInfoDict", partKey, partFilePath);
  routeCachePartInfo(r, partKey);
}

function routeCachePartInfo(r, partKey) {
  if (!partKey) return;
  if (config.routeCacheConfig.enableL2 
    && r.uri.startsWith("/library/metadata")) {
    // async cachePreload
    cachePreload(r, util.getCurrentRequestUrlPrefix(r) + partKey, util.CHCHE_LEVEL_ENUM.L2);
  }
}

function fillMediaInfo(r, media, isXmlNode) {
  if (!media) return;
  // only strm file not have mediaContainer
  // no real container required can playback, but subtitles maybe error
  const defaultContainer = "mp4";
  if (isXmlNode) {
    if (!media.$attr$container) {
      media.$attr$container = defaultContainer;
    }
  } else {
    if (!media.container) {
      media.container = defaultContainer;
    }
  }
}

function fillPartInfo(r, part, isXmlNode) {
  // !!!important is MediaInfo, PartInfo is not important
  if (!part) return;
  // only strm file not have mediaContainer
  // no real container required can playback, but subtitles maybe error
  const defaultContainer = "mp4";
  const defaultStream = [];
  if (isXmlNode) {
    if (!part.$attr$container) {
      part.$attr$container = defaultContainer;
    }
    if (!part.$attr$Stream) {
      part.$attr$Stream = defaultStream;
    }
  } else {
    if (!part.container) {
      part.container = defaultContainer;
    }
    if (!part.Stream) {
      part.Stream = defaultStream;
    }
  }
}

function modifyDirectoryHidden(r, dir, isXmlNode) {
  if (!dir) return;
  if (isXmlNode) {
    if (dir.$attr$hidden == "2") {
      dir.$attr$hidden = "0";
    }
  } else {
    if (dir.hidden == 2) {
      dir.hidden = 0;
    }
  }
  r.warn(`${dir.title}, modify hidden 2 => 0`);
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
  } catch (error) {
    r.error(`error: redirectAfter: ${error}`);
  }
}

async function internalRedirectAfter(r, uri, cachedRouteDictKey) {
  try {
    const routeCacheConfig = config.routeCacheConfig;
    if (routeCacheConfig.enable) {
      const cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
      util.dictAdd("routeL1Dict", cacheKey, uri);
    }
  } catch (error) {
    r.error(`error: internalRedirectAfter: ${error}`);
  }
}

function redirect(r, url, cachedRouteDictKey) {
  // for strm, only plex need this, like part location, but conf don't use add_header, repetitive: "null *"
  // add_header Access-Control-Allow-Origin *;
  r.headersOut["Access-Control-Allow-Origin"] = "*";

  if (!!config.alistSignEnable) {
    url = util.addAlistSign(url, config.alistToken, config.alistSignExpireTime);
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
  if (!uri) {
    uri = "@root";
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);
}

export default {
  redirect2Pan,
  fetchPlexFilePath,
  plexApiHandler,
  redirect,
  internalRedirect,
  internalRedirectExpect,
};

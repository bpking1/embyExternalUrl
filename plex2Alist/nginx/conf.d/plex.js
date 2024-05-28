// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 plex-nginx 2>&1  | grep js:"
// 正常情况下此文件所有内容不需要更改

import config from "./constant.js";
import util from "./common/util.js";
import events from "./common/events.js";

const xml = require("xml");
let allData = "";

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
    let cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
    const cacheLevle = r.args[util.ARGS.cacheLevleKey] ?? util.CHCHE_LEVEL_ENUM.L1;
    let routeDictKey = "routeL1Dict";
    // if (util.CHCHE_LEVEL_ENUM.L2 === cacheLevle) {
    //   routeDictKey = "routeL2Dict";
    // } else if (util.CHCHE_LEVEL_ENUM.L3 === cacheLevle) {
    //   routeDictKey = "routeL3Dict";
    // }
    let cachedLink = ngx.shared[routeDictKey].get(cacheKey);
    if (!cachedLink) {
      // 115 must use ua
      cacheKey += `:${ua}`;
      cachedLink = ngx.shared[routeDictKey].get(cacheKey);
    }
    if (!!cachedLink) {
      r.warn(`hit routeCache ${cacheLevle}: ${cachedLink}`);
      if (cachedLink.startsWith("@")) {
        // use original link
        return internalRedirect(r, cachedLink, true);
      } else {
        return redirect(r, cachedLink, true);
      }
    }
  }

  // fetch mount plex file path
  const itemInfo = await util.cost(getPlexItemInfo, r);
  let mediaServerRes;
  if (itemInfo.filePath) {
    mediaServerRes = {path: itemInfo.filePath};
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
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

  // routeRule
  const routeMode = util.getRouteMode(r, mediaServerRes.path, false, notLocal);
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

  let isRemote = util.checkIsRemoteByPath(mediaServerRes.path);
  let plexPathMapping = config.plexPathMapping;
  // file path mapping
  config.plexMountPath.map(s => {
    if (!!s) {
      plexPathMapping.unshift([0, 0 , s, ""]);
    }
  });
  r.warn(`plexPathMapping: ${JSON.stringify(plexPathMapping)}`);
  let mediaItemPath = mediaServerRes.path;
  plexPathMapping.map(arr => {
    if ((arr[1] == 0 && notLocal)
      || (arr[1] == 1 && (!notLocal || isRemote))
      || (arr[1] == 2 && (!notLocal || !isRemote))) {
        return;
    }
    mediaItemPath = util.strMapping(arr[0], mediaItemPath, arr[2], arr[3]);
  });
  r.warn(`mapped plex file path: ${mediaItemPath}`);

  // strm file inner remote link redirect,like: http,rtsp
  isRemote = util.checkIsRemoteByPath(mediaItemPath);
  if (isRemote) {
    const rule = util.redirectStrmLastLinkRuleFilter(mediaItemPath);
    if (!!rule && rule.length > 0) {
      r.warn(`filePath hit redirectStrmLastLinkRule: ${JSON.stringify(rule)}`);
      let directUrl = await fetchStrmLastLink(mediaItemPath, rule[2], rule[3], ua);
      if (!!directUrl) {
        mediaItemPath = directUrl;
      } else {
        r.warn(`warn: fetchStrmLastLink, not expected result, failback once`);
        directUrl = await fetchStrmLastLink(util.strmLinkFailback(strmLink), rule[2], rule[3], ua);
        if (!!directUrl) {
          mediaItemPath = directUrl;
        }
      }
    }
    // don't encode, excepted webClient, clients not decode
    return redirect(r, mediaItemPath);
  }

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
    return redirect(r, alistRes);
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
        ngx.log(ngx.WARN, `hit cilentSelfAlistRule: ${JSON.stringify(rule)}`);
        if (!rule[2]) {
          ngx.log(ngx.ERR, `alistPublicAddr is required`);
          return true;
        }
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

/**
 * fetchStrmLastLink, actually this just once request,currently sufficient
 * @param {String} strmLink eg: "https://alist/d/file.xxx"
 * @param {String} authType eg: "sign"
 * @param {String} authInfo eg: "sign:token:expireTime"
 * @param {String} ua 
 * @returns redirect after link
 */
async function fetchStrmLastLink(strmLink, authType, authInfo, ua) {
  // this is for multiple instances alist add sign
  if (authType && authType === "sign" && authInfo) {
    const arr = authInfo.split(":");
    strmLink = util.addAlistSign(strmLink, arr[0], parseInt(arr[1]));
  }
  // this is for current alist add sign
  if (!!config.alistSignEnable) {
    strmLink = util.addAlistSign(strmLink, config.alistToken, config.alistSignExpireTime);
  }
  try {
  	// fetch Api ignore nginx locations,ngx.ferch,redirects are not handled
    const response = await ngx.fetch(encodeURI(strmLink), {
      method: "HEAD",
      headers: {
        "User-Agent": ua,
      },
      max_response_body_size: 1024
    });
    const contentType = response.headers["Content-Type"];
    ngx.log(ngx.WARN, `fetchStrmLastLink response.status: ${response.status}, contentType: ${contentType}`);
    // response.redirected api error return false
    if ((response.status > 300 && response.status < 309) || response.status == 403) {
      // if handle really LastLink, modify here to recursive and return link on status 200
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
      max_response_body_size: 858993459200 // 100Gb,not important,because HEAD method not have body
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

function plexApiHandler(r, data, flags) {
  events.njsOnExit(`plexApiHandler: ${r.uri}`);
  
  const contentType = r.headersOut["Content-Type"];
  //r.log(`plexApiHandler Content-Type Header: ${contentType}`);
  if (contentType.includes("application/json")) {
    plexApiHandlerForJson(r, data, flags);
  } else if (contentType.includes("text/xml")) {
    plexApiHandlerForXml(r, data, flags);
  } else {
    r.sendBuffer(data, flags);
  }
}

function plexApiHandlerForJson(r, data, flags) {
  allData += data;
  if (flags.last) {
    const uri = r.uri;
  	let body = JSON.parse(allData);
  	const mediaContainer = body.MediaContainer;
    mediaContainerHandler(uri, mediaContainer);
    const directoryArr = mediaContainer.Directory;
    if (!!directoryArr) {
      directoryArr.map(dir => {
        directoryHandler(uri, dir);
      });
    }
    if (mediaContainer.size > 0) {
      let metadataArr = [];
      let partKey;
      let partFilePath;
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
        metadataHandler(uri, metadata);
        if (!!metadata.Media) {
          metadata.Media.map(media => {
            mediaInfoHandler(uri, media);
            if (!!media.Part) {
              media.Part.map(part => {
                partKey = part.key;
                partFilePath = part.file;
                util.dictAdd("partInfoDict", partKey, partFilePath);
                partInfoHandler(uri, part);
              });
            }
          });
        }
      });
    }
  	r.sendBuffer(JSON.stringify(body), flags);
  }
}

function plexApiHandlerForXml(r, data, flags) {
  allData += data;
  if (flags.last) {
    const uri = r.uri;
    let body = xml.parse(allData);
    const mediaContainerXmlDoc = body.MediaContainer;
    mediaContainerHandler(uri, mediaContainerXmlDoc, true);
    const directoryXmlDoc = mediaContainer.$tags$Directory;
    if (!!directoryXmlDoc) {
      directoryXmlDoc.map(dir => {
        directoryHandler(uri, dir, true);
      });
    }
    let videoXmlNodeArr = mediaContainerXmlDoc.$tags$Video;
    let mediaXmlNodeArr;
    let partXmlNodeArr;
    let partKey;
    let partFilePath;
    // r.log(videoXmlNodeArr.length);
    if (!!videoXmlNodeArr && videoXmlNodeArr.length > 0) {
    	videoXmlNodeArr.map(video => {
        metadataHandler(uri, video, true);
    		// Video.key prohibit modify, clients not supported
    		mediaXmlNodeArr = video.$tags$Media;
    		if (!!mediaXmlNodeArr && mediaXmlNodeArr.length > 0) {
    			mediaXmlNodeArr.map(media => {
            mediaInfoHandler(uri, media, true);
    				partXmlNodeArr = media.$tags$Part;
    				if (!!partXmlNodeArr && partXmlNodeArr.length > 0) {
    					partXmlNodeArr.map(part => {
                partKey = part.$attr$key;
                partFilePath = part.$attr$file;
                util.dictAdd("partInfoDict", partKey, partFilePath);
                partInfoHandler(uri, part, true);
    					});
    				}
    			});
    		}
    	});
    }
    // r.log(JSON.stringify(body.MediaContainer.$tags$Video.length));
    r.sendBuffer(xml.serialize(body), flags);
  }
}

/**
 * handler design patterns,below root to child order
 * @param {String} uri nginx r.uri, no host, no args
 * @param {Object} mainObject different single object
 * @param {Boolean} isXmlNode mainObject is xml node
 */

function mediaContainerHandler(uri, mediaContainer, isXmlNode) {
  // another custome process
}

function directoryHandler(uri, directory, isXmlNode) {
  // modifyDirectoryHidden(uri, directory, isXmlNode);
  // another custome process
}

function metadataHandler(uri, metadata, isXmlNode) {
  // Metadata.key prohibit modify, clients not supported
  // json is metadata, xml is $tags$Video tag
  // another custome process
}

function mediaInfoHandler(uri, media, isXmlNode) {
  fillMediaInfo(uri, media, isXmlNode);
  // another custome process
}

function partInfoHandler(uri, part, isXmlNode) {
  // Part.key can modify, but some clients not supported
  // partKey += `?${util.filePathKey}=${partFilePath}`;
  fillPartInfo(uri, part, isXmlNode);
  // another custome process
}

// another custome process

function fillMediaInfo(uri, media, isXmlNode) {
  if (!media) {
    return;
  }
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

function fillPartInfo(uri, part, isXmlNode) {
  // !!!important is MediaInfo, PartInfo is not important
  if (!part) {
    return;
  }
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

function modifyDirectoryHidden(uri, dir, isXmlNode) {
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

async function redirectAfter(r, url, isCached) {
  try {
    const routeCacheConfig = config.routeCacheConfig;
    if (routeCacheConfig.enable) {
      // const cacheLevle = r.args[util.ARGS.cacheLevleKey] ?? util.CHCHE_LEVEL_ENUM.L1;
      let routeDictKey = "routeL1Dict";
      // if (util.CHCHE_LEVEL_ENUM.L2 === cacheLevle) {
      //   routeDictKey = "routeL2Dict";
      // } else if (util.CHCHE_LEVEL_ENUM.L3 === cacheLevle) {
      //   routeDictKey = "routeL3Dict";
      // }
      const ua = r.headersIn["User-Agent"];
      // webClient download only have itemId on pathParam
      let cacheKey = util.parseExpression(r, routeCacheConfig.keyExpression) ?? r.uri;
      cacheKey = url.includes(config.strHead["115"]) ? `${cacheKey}:${ua}` : cacheKey;
      util.dictAdd(routeDictKey, cacheKey, url);
    }
  } catch (error) {
    r.error(`error: redirectAfter: ${error}`);
  }
}

async function internalRedirectAfter(r, uri, isCached) {
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

function redirect(r, url, isCached) {
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
  redirectAfter(r, url, isCached);
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
  internalRedirectAfter(r, uri, isCached);
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

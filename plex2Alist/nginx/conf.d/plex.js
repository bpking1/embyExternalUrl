// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 plex-nginx 2>&1  | grep js:"
// 正常情况下此文件所有内容不需要更改
import config from "./constant.js";
import util from "./util.js";

const xml = require("xml");
let allData = "";

async function redirect2Pan(r) {
  let plexPathMapping = config.plexPathMapping;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;

  // fetch mount plex file path
  let start = Date.now();
  const itemInfo = await getPlexItemInfo(r);
  let end = Date.now();
  let mediaServerRes;
  if (itemInfo.filePath) {
    mediaServerRes = {path: itemInfo.filePath};
    r.warn(`${end - start}ms, itemInfoUri: ${itemInfo.itemInfoUri}`);
  } else {
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
    mediaServerRes = await fetchPlexFilePath(
      itemInfo.itemInfoUri, 
      itemInfo.mediaIndex, 
      itemInfo.partIndex
    );
    end = Date.now();
    r.log(`mediaServerRes: ${JSON.stringify(mediaServerRes)}`);
    if (mediaServerRes.message.startsWith("error")) {
      r.error(mediaServerRes.message);
      return r.return(500, mediaServerRes.message);
    }
  }
  // strm file internal text maybe encode
  const isStrm = util.checkIsStrmByPath(mediaServerRes.path);
  if (isStrm) {
      mediaServerRes.path = decodeURIComponent(mediaServerRes.path);
  }
  r.warn(`${end - start}ms, mount plex file path: ${mediaServerRes.path}`);
  
  if (util.isDisableRedirect(mediaServerRes.path, false, isStrm)) {
    // use original link
    return internalRedirect(r);
  }

  // strm support
  if (isStrm) {
    start = Date.now();
    const strmInnerText = await fetchStrmInnerText(r);
    end = Date.now();
    r.warn(`${end - start}ms, fetchStrmInnerText cover mount plex file path: ${strmInnerText}`);
    mediaServerRes.path = strmInnerText;
  }

  let isRemote = !mediaServerRes.path.startsWith("/");
  // file path mapping
  config.plexPathMapping.map(s => {
    if (!!s) {
      plexPathMapping.unshift([0, 0 , s, ""]);
    }
  });
  r.warn(`plexPathMapping: ${JSON.stringify(plexPathMapping)}`);
  let mediaItemPath = mediaServerRes.path;
  plexPathMapping.map(arr => {
    if ((arr[1] == 0 && isStrm)
      || (arr[1] == 1 && (!isStrm || isRemote))
      || (arr[1] == 2 && (!isStrm || !isRemote))) {
        return;
    }
    mediaItemPath = util.strMapping(arr[0], mediaItemPath, arr[2], arr[3]);
  });
  isRemote = !mediaItemPath.startsWith("/");
  r.warn(`mapped plex file path: ${mediaItemPath}`);

  // strm file inner remote link redirect,like: http,rtsp
  if (isRemote) {
    const ruleArr2D = config.redirectStrmLastLinkRule;
    for (let i = 0; i < ruleArr2D.length; i++) {
      const rule = ruleArr2D[i];
      if (util.strMatches(rule[0], mediaItemPath, rule[1])) {
        r.warn(`filePath hit redirectStrmLastLinkRule: ${JSON.stringify(rule)}`);
        const directUrl = await fetchStrmLastLink(mediaItemPath, rule[2], rule[3], rule[4]);
        if (!!directUrl) {
          return redirect(r, directUrl);
        }
      }
    }
    return redirect(r, encodeURI(decodeURIComponent(mediaItemPath)));
  }

  // fetch alist direct link
  const alistFilePath = mediaItemPath;
  start = Date.now();
  const ua = r.headersIn["User-Agent"];
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  const alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken,
    ua,
  );
  end = Date.now();
  r.warn(`${end - start}ms, fetchAlistPathApi, UA: ${ua}`);
  if (!alistRes.startsWith("error")) {
    if (util.isDisableRedirect(alistRes, true, isStrm)) {
      // use original link
      return internalRedirect(r);
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

async function fetchStrmLastLink(strmLink, authType, authInfo, authUrl) {
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
        Authorization: token
      },
      max_response_body_size: 1024
    });
    ngx.log(ngx.WARN, `fetchStrmLastLink response.status: ${response.status}`);
    // response.redirected api error return false
    if (300 < response.status < 309 || response.status == 403) {
      return response.headers["Location"];
    } else {
      ngx.log(ngx.ERR, `error: fetchStrmLastLink: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchStrmLastLink: ${error}`);
  }
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
  const api_key = r.args[util.args.plexTokenKey];
  let filePath;
  let itemInfoUri = "";
  if (path) {
	  // see: location ~* /video/:/transcode/universal/start
  	itemInfoUri = `${plexHost}${path}?${util.args.plexTokenKey}=${api_key}`;
  } else {
  	// see: location ~* /library/parts/(\d+)/(\d+)/file
    filePath = ngx.shared.partInfoDict.get(r.uri);
    r.warn(`getPlexItemInfo r.uri: ${r.uri}`);
    if (!filePath) {
      const plexRes = await fetchPlexFileFullName(`${plexHost}${r.uri}?download=1&${util.args.plexTokenKey}=${api_key}`);
      if (!plexRes.startsWith("error")) {
        const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
        itemInfoUri = `${plexHost}/search?query=${encodeURI(plexFileName)}&${util.args.plexTokenKey}=${api_key}`;
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
  const api_key = r.args[util.args.plexTokenKey];
  const downloadApiPath = `${plexHost}${r.uri}?download=1&${util.args.plexTokenKey}=${api_key}`;
  try {
  	// fetch Api ignore nginx locations
    const response = await ngx.fetch(downloadApiPath, {
      method: "HEAD",
      max_response_body_size: 1024
    });
    // plex strm downloadApi self return 301, response.redirected api error return false
    if (300 < response.status < 309) {
      const location = response.headers["Location"];
      let strmInnerText = location;
      const tmpArr = plexHost.split(":");
      const plexHostWithoutPort = `${tmpArr[0]}:${tmpArr[1]}`;
      if (location.startsWith(plexHostWithoutPort)) {
        // strmInnerText is local path
        strmInnerText = location.replace(plexHostWithoutPort, "");
      }
      r.warn(`fetchStrmInnerText innerText: ${strmInnerText}`);
      return decodeURI(strmInnerText);
    }
    if (response.ok) {
      r.warn(`fetchStrmInnerText innerText: ${response.text()}`);
      return decodeURI(response.text());
    } else {
      return `error: plex_download_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchStrmInnerText ${error}`;
  }
}

function plexApiHandler(r, data, flags) {
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
  	let body = JSON.parse(allData);
  	const MediaContainer = body.MediaContainer;
    if (MediaContainer.size > 0) {
      let metadataArr = [];
      let partKey;
      let partFilePath;
      if (!!MediaContainer.Hub) {
        MediaContainer.Hub.map(hub => {
          if (!!hub.Metadata) {
            hub.Metadata.map(metadata => {
              metadataArr.push(metadata);
            });
          }
        });
      } else {
        if (!!MediaContainer.Metadata) {
          MediaContainer.Metadata.map(metadata => {
            metadataArr.push(metadata);
          });
        }
      }
      metadataArr.map(metadata => {
        // Metadata.key prohibit modify, clients not supported
        if (!!metadata.Media) {
          metadata.Media.map(media => {
            fillMediaInfo(media);
            if (!!media.Part) {
              media.Part.map(part => {
                partKey = part.key;
                partFilePath = part.file;
                cachePartInfo(partKey, partFilePath);
                fillPartInfo(part);
                // Part.key can modify, but some clients not supported
                // partKey += `?${util.filePathKey}=${partFilePath}`;
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
    let body = xml.parse(allData);
    const mediaContainerXmlDoc = body.MediaContainer;
    let videoXmlNodeArr = mediaContainerXmlDoc.$tags$Video;
    let mediaXmlNodeArr;
    let partXmlNodeArr;
    let partKey;
    let partFilePath;
    // r.log(videoXmlNodeArr.length);
    if (!!videoXmlNodeArr && videoXmlNodeArr.length > 0) {
    	videoXmlNodeArr.map(video => {
    		// Video.key prohibit modify, clients not supported
    		mediaXmlNodeArr = video.$tags$Media;
    		if (!!mediaXmlNodeArr && mediaXmlNodeArr.length > 0) {
    			mediaXmlNodeArr.map(media => {
            fillMediaInfo(media, true);
    				partXmlNodeArr = media.$tags$Part;
    				if (!!partXmlNodeArr && partXmlNodeArr.length > 0) {
    					partXmlNodeArr.map(part => {
                partKey = part.$attr$key;
                partFilePath = part.$attr$file;
                cachePartInfo(partKey, partFilePath);
                fillPartInfo(part, true);
                // Part.key can modify, but some clients not supported
                // partKey += `?${util.filePathKey}=${partFilePath}`;
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

function fillMediaInfo(media, isXmlNode) {
  if (!media) {
    return;
  }
  // only strm file not have mediaContainer
  // no real container required can playback, but subtitles maybe error
  const defaultContainer = "mp4";
  if (!!isXmlNode && isXmlNode) {
    if (!media.$attr$container) {
      media.$attr$container = defaultContainer;
    }
  } else {
    if (!media.container) {
      media.container = defaultContainer;
    }
  }
}

function fillPartInfo(part, isXmlNode) {
  // !!!important is MediaInfo, PartInfo is not important
  if (!part) {
    return;
  }
  // only strm file not have mediaContainer
  // no real container required can playback, but subtitles maybe error
  const defaultContainer = "mp4";
  const defaultStream = [];
  if (!!isXmlNode && isXmlNode) {
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

function cachePartInfo(partKey, partFilePath) {
  if (!partKey || !partFilePath) {
    return;
  }
  const preValue = ngx.shared.partInfoDict.get(partKey);
  if (!preValue || (!!preValue && preValue != partFilePath)) {
    ngx.shared.partInfoDict.add(partKey, partFilePath);
    ngx.log(ngx.INFO, `cachePartInfo: ${partKey + " : " + partFilePath}`);
  }
}

function redirect(r, uri) {
  r.warn(`redirect to: ${uri}`);
  // need caller: return;
  r.return(302, uri);
}

function internalRedirect(r, uri) {
  if (!uri) {
    uri = "@root";
    r.warn(`use original link`);
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);
}

export default { redirect2Pan, fetchPlexFilePath, plexApiHandler };

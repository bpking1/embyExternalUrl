//author: @bpking  https://github.com/bpking1/embyExternalUrl
//查看日志: "docker logs -f -n 10 plex-nginx 2>&1  | grep js:"
import config from "./constant.js";
import util from "./util.js";
const xml = require("xml");

async function redirect2Pan(r) {
  const plexPathMapping = config.plexPathMapping;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const filePath = r.args[util.filePathKey];

  let mediaServerRes = {path: filePath};
  let start = Date.now();
  let end;
  if (!filePath) {
    // fetch mount plex file path
    const itemInfo = await util.getPlexItemInfo(r);
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
    r.warn(`${end - start}ms, mount plex file path: ${mediaServerRes.path}`);
  }

  if (util.isDisableRedirect(r, mediaServerRes.path)) {
    r.warn(`mediaServerRes hit isDisableRedirect`);
    // use original link
    return internalRedirect(r);
  }

  // file path mapping
  r.warn(`plexPathMapping: ${JSON.stringify(plexPathMapping)}`);
  config.plexMountPath.map(o => {
    plexPathMapping.unshift([o, ""]);
  });
  let alistFilePath = mediaServerRes.path;
  plexPathMapping.map(arr => {
    alistFilePath = alistFilePath.replace(arr[0], arr[1]);
  });
  r.warn(`mapped plex file path: ${alistFilePath}`);

  // fetch alist direct link
  start = Date.now();
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  let alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken
  );
  end = Date.now();
  r.warn(`${end - start}ms, fetchAlistPathApi`);
  if (!alistRes.startsWith("error")) {
    if (util.isDisableRedirect(r, alistRes, true)) {
      r.warn(`alistRes hit isDisableRedirect`);
      // use original link
      return internalRedirect(r);
    }
    return redirect(r, alistRes);
  }
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    return r.return(403, alistRes);
  }
  if (alistRes.startsWith("error500")) {
    const filePath = alistFilePath.substring(alistFilePath.indexOf("/", 1));
    const alistFsListApiPath = `${alistAddr}/api/fs/list`;
    const foldersRes = await fetchAlistPathApi(
      alistFsListApiPath,
      "/",
      alistToken
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
        alistToken
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
async function fetchAlistPathApi(alistApiPath, alistFilePath, alistToken) {
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
        if (result.data.raw_url) {
          return handleAlistRawUrl(result, alistFilePath);
        }
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

// plex only
let allData = "";
async function partKeyAddFilePath(r, data, flags) {
  const contentType = r.headersOut["Content-Type"];
  if (contentType.includes("application/json")) {
    partKeyAddFilePathForJson(r, data, flags);
  } else if (contentType.includes("text/xml")) {
    // only like android client use xml, web and third party clients use json
    partKeyAddFilePathForXml(r, data, flags);
  } else {
    r.sendBuffer(data, flags);
  }
}

async function partKeyAddFilePathForJson(r, data, flags) {
  allData += data;
  if (flags.last) {
  	let body = JSON.parse(allData);
  	const MediaContainer = body.MediaContainer;
    if (MediaContainer.size > 0) {
      let metadataArr = [];
      if (!!MediaContainer.Hub) {
        MediaContainer.Hub.map(hub => {
          hub.Metadata.map(metadata => {
            metadataArr.push(metadata);
          });
        });
      } else {
        MediaContainer.Metadata.map(metadata => {
          metadataArr.push(metadata);
        });
      }
      metadataArr.map(metadata => {
        // Metadata.key prohibit modify, clients not supported
        if (!!metadata.Media) {
          metadata.Media.map(media => {
            if (!!media.Part) {
              media.Part.map(part => {
                // Part.key can modify, clients supported
                part.key += `?${util.filePathKey}=${part.file}`;
              });
            }
            });
        }
      });
    }
  	r.sendBuffer(JSON.stringify(body), flags);
  }
}

async function partKeyAddFilePathForXml(r, data, flags) {
  allData += data;
  if (flags.last) {
    let body = xml.parse(allData);
    const mediaContainerXmlDoc = body.MediaContainer;
    let videoXmlNodeArr = mediaContainerXmlDoc.$tags$Video;
    let mediaXmlNodeArr;
    let partXmlNodeArr;
    // r.log(videoXmlNodeArr.length);
    if (!!videoXmlNodeArr && videoXmlNodeArr.length > 0) {
    	videoXmlNodeArr.map(video => {
    		// Video.key prohibit modify, clients not supported
    		mediaXmlNodeArr = video.$tags$Media;
    		if (!!mediaXmlNodeArr && mediaXmlNodeArr.length > 0) {
    			mediaXmlNodeArr.map(media => {
    				partXmlNodeArr = media.$tags$Part;
    				if (!!partXmlNodeArr && partXmlNodeArr.length > 0) {
    					partXmlNodeArr.map(part => {
    						// Part.key can modify, clients supported
                			part.$attr$key += `?${util.filePathKey}=${part.$attr$file}`;
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

// async function cachePartInfo(r) {
//   // replay the request
//   const proxyUri = util.proxyUri(r.uri);
//   const res = await r.subrequest(proxyUri);
//   const body = JSON.parse(res.responseText);
//   body.MediaContainer.Metadata.forEach(metadata => {
//     if (!!metadata.Media) {
//       metadata.Media.forEach(media => {
//         media.Part.forEach(part => {
//           const preValue = ngx.shared.partInfoDict.get(part.key);
//           if (!preValue || (!!preValue && preValue != part.file)) {
//             const filePath = part.file;
//             ngx.shared.partInfoDict.add(part.key, filePath);
//             r.log(`cachePartInfo: ${part.key + " : " + filePath}`);
//           }
//         });
//       });
//     }
//   });
//   for (const key in res.headersOut) {
//     r.headersOut[key] = res.headersOut[key];
//   }
//   r.return(res.status, JSON.stringify(body));
// }

function redirect(r, uri) {
  r.warn(`redirect to: ${uri}`);
  // need caller: return;
  r.return(302, uri);
}

function internalRedirect(r) {
  r.warn(`use original link`);
  // need caller: return;
  r.internalRedirect(util.proxyUri(r.uri));
}

export default { redirect2Pan, fetchPlexFilePath, partKeyAddFilePath };

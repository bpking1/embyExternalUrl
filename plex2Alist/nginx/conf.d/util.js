import config from "./constant.js";

// copy from emby2Alist/nginx/conf.d/util.js
function generateUrl(r, host, uri, ignoreSpChar) {
  let url = host + uri;
  let isFirst = true;
  for (const key in r.args) {
    // a few players not support special character
    if (ignoreSpChar && (key === "X-Emby-Client" || key === "X-Emby-Device-Name")) {
      continue;
    }
    url += isFirst ? "?" : "&";
    url += `${key}=${r.args[key]}`;
    isFirst = false;
  }
  return url;
}

function getPlexOriginRequestUrl(r) {
  const plexHost = config.publicDomain == ""
    ? config.plexHost
    : config.publicDomain + ":" + config.plexPort;
  return generateUrl(r, plexHost, r.uri);
}

function getFileNameByHead(contentDisposition) {
  if (contentDisposition && contentDisposition.length > 0) {
    const regex = /filename[^;\n]*=(UTF-\d['"]*)?((['"]).*?[.]$\2|[^;\n]*)?/gi;
    return contentDisposition.match(regex)[1].replace("filename*=UTF-8''", "");
  }
  return null;
}

async function getPlexItemInfo(r) {
  const plexHost = config.plexHost;
  const path = r.args.path;
  const mediaIndex = r.args.mediaIndex;
  const partIndex = r.args.partIndex;
  const api_key = r.args["X-Plex-Token"];
  let itemInfoUri = "";
  if (path) {
	  // see: location ~* /video/:/transcode/universal/start
  	itemInfoUri = `${plexHost}${path}?X-Plex-Token=${api_key}`;
  } else {
  	// see: location ~* /library/parts/(\d+)/(\d+)/file
  	const plexRes = await fetchPlexFileFullName(`${plexHost}${r.uri}?download=1&X-Plex-Token=${api_key}`);
  	if (!plexRes.startsWith("error")) {
  	  const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
  	  itemInfoUri = `${plexHost}/search?query=${encodeURI(plexFileName)}&X-Plex-Token=${api_key}`;
  	}
  }
  return { itemInfoUri, mediaIndex, partIndex, api_key };
}

async function fetchPlexFileFullName(downloadApiPath) {
  try {
    const response = await ngx.fetch(downloadApiPath, {
      method: "HEAD",
      max_response_body_size: 858993459200 // 100Gb,not important,because HEAD method not have body
    });
    if (response.ok) {
      return getFileNameByHead(decodeURI(response.headers["Content-Disposition"]));
    } else {
      return `error: plex_download_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchPlexFileNameFiled ${error}`;
  }
}

export default {
  getPlexOriginRequestUrl,
  getFileNameByHead,
  getPlexItemInfo,
};

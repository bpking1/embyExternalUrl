import config from "./constant.js";

function proxyUri(uri) {
  return `/proxy${uri}`;
}

function appendUrlArg(u, k, v) {
  if (u.includes(k)) {
    return u;
  }
  return u + (u.includes("?") ? "&" : "?") + `${k}=${v}`;
}

function addDefaultApiKey(r, u) {
  let url = u;
  const itemInfo = getItemInfo(r);
  if (!url.includes("api_key") && !url.includes("X-Emby-Token")) {
    url = appendUrlArg(url, "api_key", itemInfo.api_key);
  }
  return url;
}

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

function getEmbyOriginRequestUrl(r) {
  const embyHost = config.publicDomain == ""
    ? config.embyHost
    : config.publicDomain + ":" + config.embyPort;
  return generateUrl(r, embyHost, r.uri);
}

function getCurrentRequestUrl(r) {
  const host = r.headersIn["Host"];
  return addDefaultApiKey(r, generateUrl(r, "http://" + host, r.uri));
}

function getFileNameByHead(contentDisposition) {
  if (contentDisposition && contentDisposition.length > 0) {
    const regex = /filename[^;\n]*=(UTF-\d['"]*)?((['"]).*?[.]$\2|[^;\n]*)?/gi;
    return contentDisposition.match(regex)[1].replace("filename*=UTF-8''", "");
  }
  return null;
}

function getItemInfo(r) {
  const embyHost = config.embyHost;
  const embyApiKey = config.embyApiKey;
  const regex = /[A-Za-z0-9]+/g;
  const itemId = r.uri.replace("emby", "").replace("Sync", "").replace(/-/g, "").match(regex)[1];
  const mediaSourceId = r.args.MediaSourceId
    ? r.args.MediaSourceId
    : r.args.mediaSourceId;
  const Etag = r.args.Tag;
  let api_key = r.args["X-Emby-Token"]
    ? r.args["X-Emby-Token"]
    : r.args.api_key;
  api_key = api_key ? api_key : embyApiKey;
  let itemInfoUri = "";
  if (r.uri.includes("JobItems")) {
	itemInfoUri = `${embyHost}/Sync/JobItems?api_key=${api_key}`;
  } else {
    if (mediaSourceId) {
      itemInfoUri = `${embyHost}/Items?Ids=${mediaSourceId}&Fields=Path,MediaSources&Limit=1&api_key=${api_key}`;
    } else {
      itemInfoUri = `${embyHost}/Items?Ids=${itemId}&Fields=Path,MediaSources&Limit=1&api_key=${api_key}`;
    }
  }
  return { itemInfoUri, itemId , Etag, mediaSourceId, api_key };
}

async function getPlexItemInfo(r) {
  const embyHost = config.embyHost;
  const path = r.args.path;
  const mediaIndex = r.args.mediaIndex;
  const partIndex = r.args.partIndex;
  const api_key = r.args["X-Plex-Token"];
  let itemInfoUri = "";
  if (path) {
	  // see: location ~* /video/:/transcode/universal/start
  	itemInfoUri = `${embyHost}${path}?X-Plex-Token=${api_key}`;
  } else {
  	// see: location ~* /library/parts/(\d+)/(\d+)/file
  	const plexRes = await fetchPlexFileFullName(`${embyHost}${r.uri}?download=1&X-Plex-Token=${api_key}`);
  	if (!plexRes.startsWith("error")) {
  	  const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
  	  itemInfoUri = `${embyHost}/search?query=${encodeURI(plexFileName)}&X-Plex-Token=${api_key}`;
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
  appendUrlArg,
  addDefaultApiKey,
  proxyUri,
  getFileNameByHead,
  getItemInfo,
  getPlexItemInfo,
  generateUrl,
  getCurrentRequestUrl,
  getEmbyOriginRequestUrl,
};

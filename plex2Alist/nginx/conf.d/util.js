import config from "./constant.js";

const plexTokenKey = "X-Plex-Token";
// copy from emby2Alist/nginx/conf.d/util.js
function proxyUri(uri) {
  return `/proxy${uri}`;
}

function isDisableRedirect(r, str, isAlistRes) {
  let arr2D;
  if (!!isAlistRes) {
    arr2D = config.disableRedirectRule.filter(rule => !!rule[2]);
  } else {
    // not embyMountPath first
    if (config.plexMountPath.some(path => !str.startsWith(path))) {
      return true;
    }
    arr2D = config.disableRedirectRule.filter(rule => !rule[2]);
  }
  return arr2D.some(rule => strMatches(rule[0], str, rule[1]));
}

function strMatches(type, searchValue, matcher) {
  if (0 == type && searchValue.startsWith(matcher)) {
    return true;
  }
  if (1 == type && searchValue.endsWith(matcher)) {
    return true;
  }
  if (2 == type && searchValue.includes(matcher)) {
    return true;
  }
  if (3 == type && !!searchValue.match(matcher)) {
    return true;
  }
  return false;
}

// plex only
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
  const api_key = r.args[plexTokenKey];
  let filePath;
  let itemInfoUri = "";
  if (path) {
	  // see: location ~* /video/:/transcode/universal/start
  	itemInfoUri = `${plexHost}${path}?${plexTokenKey}=${api_key}`;
  } else {
  	// see: location ~* /library/parts/(\d+)/(\d+)/file
    filePath = ngx.shared.PartInfo.get(r.uri);
    r.warn(`getPlexItemInfo r.uri: ${r.uri}`);
    if (!filePath) {
      const plexRes = await fetchPlexFileFullName(`${plexHost}${r.uri}?download=1&${plexTokenKey}=${api_key}`);
      if (!plexRes.startsWith("error")) {
        const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
        itemInfoUri = `${plexHost}/search?query=${encodeURI(plexFileName)}&${plexTokenKey}=${api_key}`;
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
      return getFileNameByHead(decodeURI(response.headers["Content-Disposition"]));
    } else {
      return `error: plex_download_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchPlexFileNameFiled ${error}`;
  }
}

export default {
  proxyUri,
  isDisableRedirect,
  strMatches,
  getPlexItemInfo,
};

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

function getCurrentRequestUrl(r) {
  const host = r.headersIn["Host"];
  return addDefaultApiKey(r, generateUrl(r, "http://" + host, r.uri));
}

function isDisableRedirect(r, str, isAlistRes) {
  let arr2D;
  if (!!isAlistRes) {
    arr2D = config.disableRedirectArr.filter(arr => !!arr[2]);
  } else {
    // not embyMountPathArr first
    if (config.embyMountPathArr.some(path => !str.startsWith(path))) {
      return true;
    }
    arr2D = config.disableRedirectArr.filter(arr => !arr[2]);
  }
  return arr2D.some(arr => {
    if (0 == arr[0] && str.startsWith(arr[1])) {
      return true;
    }
    if (1 == arr[0] && str.endsWith(arr[1])) {
      return true;
    }
    if (2 == arr[0] && str.includes(arr[1])) {
      return true;
    }
    if (3 == arr[0] && str.matches(arr[1])) {
      return true;
    }
  });
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

export default {
  appendUrlArg,
  addDefaultApiKey,
  proxyUri,
  getItemInfo,
  generateUrl,
  isDisableRedirect,
  getCurrentRequestUrl
};

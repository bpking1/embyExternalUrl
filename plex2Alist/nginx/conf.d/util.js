import config from "./constant.js";

// copy from emby2Alist/nginx/conf.d/util.js
function proxyUri(uri) {
  return `/proxy${uri}`;
}

function isDisableRedirect(r, str, isAlistRes) {
  let arr2D;
  if (!!isAlistRes) {
    arr2D = config.disableRedirectArr.filter(arr => !!arr[2]);
  } else {
    // not plexMountPathArr first
    if (config.plexMountPathArr.some(path => !str.startsWith(path))) {
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

// plex only
function getFileNameByHead(contentDisposition) {
  if (contentDisposition && contentDisposition.length > 0) {
    const regex = /filename[^;\n]*=(UTF-\d['"]*)?((['"]).*?[.]$\2|[^;\n]*)?/gi;
    return contentDisposition.match(regex)[1].replace("filename*=UTF-8''", "");
  }
  return null;
}

async function getPlexItemInfo(r) {
  const plexTokenKey = "X-Plex-Token";
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
    const fetchPlexMetadataRes = await fetchPlexMetadata(r);
    r.log(`fetchPlexMetadataRes: ${fetchPlexMetadataRes}`);
    if (fetchPlexMetadataRes.startsWith("error")) {
      const plexRes = await fetchPlexFileFullName(`${plexHost}${r.uri}?download=1&${plexTokenKey}=${api_key}`);
      if (!plexRes.startsWith("error")) {
        const plexFileName = plexRes.substring(0, plexRes.lastIndexOf("."));
        itemInfoUri = `${plexHost}/search?query=${encodeURI(plexFileName)}&${plexTokenKey}=${api_key}`;
      }
    } else {
      filePath = fetchPlexMetadataRes;
    }
  }
  return { filePath, itemInfoUri, mediaIndex, partIndex, api_key };
}

async function fetchPlexMetadata(r) {
  const regex = /[A-Za-z0-9]+/g;
  const partId = parseInt(r.uri.replace("/library/parts", "").match(regex)[0]);
  r.warn(`fetchPlexMetadata partId: ${partId}`);
  const metadataIdArr = [];
  for (let i = partId; i < partId + config.metadataIdOffsetFactor; i++) {
    metadataIdArr.push(i);
  }
  r.warn(`fetchPlexMetadata metadataIdArr: ${JSON.stringify(metadataIdArr)}`);
  const plexTokenKey = config.plexTokenKey;
  const plexHost = config.plexHost;
  const api_key = r.args[plexTokenKey];
  let itemInfoUri = `${plexHost}/library/metadata/${metadataIdArr.join(",")}?${plexTokenKey}=${api_key}`;
  r.warn(`fetchPlexMetadata itemInfoUri: ${itemInfoUri}`);
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
      r.log(`fetchPlexMetadata result: ${JSON.stringify(result)}`);
      let partArr = [];
      result.MediaContainer.Metadata.forEach(metadata => {
        metadata.Media.forEach(media => {
          media.Part.forEach(part => {
            partArr.push(part);
          });
        });
      });
      r.log(`fetchPlexMetadata partArr: ${JSON.stringify(partArr)}`);
      partArr = partArr.filter(part => part.key.startsWith(r.uri));
      r.warn(`fetchPlexMetadata partArr filter: ${JSON.stringify(partArr)}`);
      if (partArr.length < 1) {
        return `error: fetchPlexMetadata No search results found`;
      } else {
        return partArr[0].file;
      }
    } else {
      return `error: plex_download_api ${res.status} ${res.statusText}`;
    }
  } catch (error) {
    return `error: plex_download_api fetchPlexMetadata ${error}`;
  }
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
  getPlexItemInfo,
};

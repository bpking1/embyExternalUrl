import config from "./constant.js";

const args = {
  plexTokenKey: "X-Plex-Token",
}

// copy from emby2Alist/nginx/conf.d/util.js
function proxyUri(uri) {
  return `/proxy${uri}`;
}

function isDisableRedirect(str, isAlistRes) {
  let arr2D;
  if (!!isAlistRes) {
    // this var isAlistRes = true
    arr2D = config.disableRedirectRule.filter(rule => !!rule[2]);
  } else {
    // not plexMountPath first
    if (config.plexMountPath.some(path => !!path && !str.startsWith(path))) {
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

function checkIsStrmByPath(filePath) {
  if (!!filePath) {
    // strm: filePath1-itemPath like: /xxx/xxx.strm
    return filePath.toLowerCase().endsWith(".strm");
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

export default {
  args,
  proxyUri,
  isDisableRedirect,
  checkIsStrmByPath,
  strMatches,
  getFileNameByHead,
};

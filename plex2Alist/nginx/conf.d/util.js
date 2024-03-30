import config from "./constant.js";

const args = {
  plexTokenKey: "X-Plex-Token",
}

// copy from emby2Alist/nginx/conf.d/util.js
function proxyUri(uri) {
  return `/proxy${uri}`;
}

function isDisableRedirect(str, isAlistRes, isStrm) {
  let arr2D;
  if (!!isAlistRes) {
    // this var isAlistRes = true
    arr2D = config.disableRedirectRule.filter(rule => !!rule[2]);
  } else {
    // not xxxMountPath first
    if (config.embyMountPath.some(path => !!path && !str.startsWith(path) && !isStrm)) {
      ngx.log(ngx.WARN, `hit isDisableRedirect, not xxxMountPath first: ${path}`);
      return true;
    }
    arr2D = config.disableRedirectRule.filter(rule => !rule[2]);
  }
  return arr2D.some(rule => {
    let flag = strMatches(rule[0], str, rule[1]);
    if (flag) {
      ngx.log(ngx.WARN, `hit isDisableRedirect: ${JSON.stringify(rule)}`);
    }
    return flag;
  });
}

function strMapping(type, sourceValue, searchValue, replaceValue) {
  let str = sourceValue;
  if (type == 1) {
    str = searchValue + str;
    ngx.log(ngx.WARN, `strMapping append: ${searchValue}`);
  }
  if (type == 2) {
    str += searchValue;
    ngx.log(ngx.WARN, `strMapping unshift: ${searchValue}`);
  }
  if (type == 0) {
    str = str.replace(searchValue, replaceValue);
    ngx.log(ngx.WARN, `strMapping replace: ${searchValue} => ${replaceValue}`);
  }
  return str;
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
  strMapping,
  strMatches,
  getFileNameByHead,
};

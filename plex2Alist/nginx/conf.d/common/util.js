import config from "../constant.js";

const args = {
  plexTokenKey: "X-Plex-Token",
}

// copy from emby2Alist/nginx/conf.d/util.js
function proxyUri(uri) {
  return `/proxy${uri}`;
}

function isDisableRedirect(r, filePath, isAlistRes, notLocal) {
  let arr3D;
  if (!!isAlistRes) {
    // this var isAlistRes = true
    arr3D = config.disableRedirectRule.filter(rule => !!rule[3]);
  } else {
    // not xxxMountPath first
    config.plexMountPath.some(path => {
      if (!!path && !filePath.startsWith(path) && !notLocal) {
        ngx.log(ngx.WARN, `hit isDisableRedirect, not xxxMountPath first: ${path}`);
        return true;
      }
    });
    arr3D = config.disableRedirectRule.filter(rule => !rule[3]);
  }
  return arr3D.some(rule => {
    const sourceStr = getSourceStrByType(rule[0], r, filePath);
    const matcher = rule[2];
    let flag;
    if (Array.isArray(matcher) 
      && matcher.some(m => strMatches(rule[1], sourceStr, m))) {
      flag = true;
    } else {
      flag = strMatches(rule[1], sourceStr, matcher);
    }
    if (flag) {
      ngx.log(ngx.WARN, `hit isDisableRedirect: ${JSON.stringify(rule)}`);
    }
    return flag;
  });
}

function getSourceStrByType(type, r, filePath) {
  let str = filePath;
  if (type === "0") {
    return str;
  }
  let val;
  const typeArr = type.split(".");
  const rootTypeVal = typeArr.shift();
  if (rootTypeVal === "r") {
    val = r;
    typeArr.map(typeVal => {
      val = val[typeVal];
    });
    str = val;
  }
  return str;
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

function checkIsRemoteByPath(filePath) {
  if (!!filePath) {
    return !filePath.startsWith("/") && !filePath.startsWith("\\");
  }
  return false;
}


function redirectStrmLastLinkRuleFilter(filePath) {
  return config.redirectStrmLastLinkRule.filter(rule => {
    const matcher = rule[1];
    let flag;
    if (Array.isArray(matcher) 
      && matcher.some(m => strMatches(rule[0], filePath, m))) {
      flag = true;
    } else {
      flag = strMatches(rule[0], filePath, matcher);
    }
    return flag;
  });
}

function strmLinkFailback(url) {
  if (!url) {
    return url;
  }
  let rvt = alistLinkFailback(url);
  return rvt;
}

function alistLinkFailback(url) {
  let rvt = url;
  const alistAddr = config.alistAddr;
  const alistPublicAddr = config.alistPublicAddr;
  let uri = url.replace(alistAddr, "");
  if (!!alistAddr && url.startsWith(alistAddr) && !uri.startsWith("/d/")) {
    rvt = `${alistAddr}/d${uri}`;
    ngx.log(ngx.WARN, `hit alistLinkFailback, add /d: ${rvt}`);
    return rvt;
  }
  uri = url.replace(alistPublicAddr, "");
  if (!!alistPublicAddr && url.startsWith(alistPublicAddr) && !uri.startsWith("/d/")) {
    rvt = `${alistPublicAddr}/d${uri}`;
    ngx.log(ngx.WARN, `hit alistLinkFailback, add /d: ${rvt}`);
    return rvt;
  }
  return rvt;
}

async function dictAdd(dictName, key, value) {
  if (!key || !value) {
    return;
  }
  const dict = ngx.shared[dictName];
  const preValue = dict.get(key);
  if (!preValue || (!!preValue && preValue != value)) {
    dict.add(key, value);
    ngx.log(ngx.WARN, `${dictName} add: [${key}] : [${value}]`);
  }
}

function cost(func) {
  if (!func || (!!func && !func instanceof Function)) {
    ngx.log(ngx.ERR, `target function not null or is not function`);
    return;
  }
  const args = Array.prototype.slice.call(arguments, 1);
  console.log(func.name, args);
  const start = Date.now();
  const rvt = func.apply(func, args);
  if (rvt instanceof Promise) {
    rvt.then(realRvt => {
      const end = Date.now();
      ngx.log(ngx.WARN, `${end - start}ms, ${func.name} async function cost`);
    });
  } else {
    const end = Date.now();
    ngx.log(ngx.WARN, `${end - start}ms, ${func.name} function cost`);
  }
  return rvt;
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
  strMapping,
  strMatches,
  isDisableRedirect,
  checkIsStrmByPath,
  checkIsRemoteByPath,
  redirectStrmLastLinkRuleFilter,
  strmLinkFailback,
  dictAdd,
  cost,
  getFileNameByHead,
};

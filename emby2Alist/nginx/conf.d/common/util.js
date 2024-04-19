import config from "../constant.js";

const args = {
  filePathKey: "filePath",
  notLocalKey: "notLocal",
}

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

function generateUrl(r, host, uri) {
  let url = host + uri;
  let isFirst = true;
  for (const key in r.args) {
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

function copyHeaders(sourceR, targetR, skipKeys) {
  if (!skipKeys) {
    // auto generate content length
    skipKeys = ["Content-Length"];
  }
  for (const key in sourceR.headersOut) {
	  if (skipKeys.includes(key)) {
	    continue;
	  }
	  targetR.headersOut[key] = sourceR.headersOut[key];
	}
}

function groupBy(array, key) {
  return array.reduce((result, currentItem) => {
    const groupKey = typeof key === 'function' ? key(currentItem) : currentItem[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(currentItem);
    return result;
  }, {});
};

function isDisableRedirect(r, filePath, isAlistRes, notLocal) {
  const disableRedirectRule = config.disableRedirectRule;
  const embyMountPath = config.embyMountPath;
  if (!isAlistRes) {
    // this var isAlistRes = false
    // local file not xxxMountPath first
    if (embyMountPath.every(path => 
      !!path && !filePath.startsWith(path) && !notLocal)) {
      ngx.log(ngx.WARN, `hit isDisableRedirect, not xxxMountPath first: ${JSON.stringify(embyMountPath)}`);
      return true;
    }
  }
  
  const oldRules = disableRedirectRule.filter(rule => rule.length <= 3);
  if (!oldRules || (!!oldRules && oldRules.length === 0)) {
    return false;
  }
  let matchedRule = getMatchedRule(r, oldRules, filePath);
  if (matchedRule) {
    ngx.log(ngx.WARN, `hit isDisableRedirect: ${JSON.stringify(matchedRule)}`);
    return true;
  }
  const groupRulesObjArr = groupBy(disableRedirectRule.filter(rule => rule.length > 3), 0);
  if (Object.keys(groupRulesObjArr) === 0) {
    return false;
  }
  let matchedGroupKey;
  for (const gKey in groupRulesObjArr) {
    matchedGroupKey = getMatchedRuleGroupKey(r, gKey, groupRulesObjArr[gKey], filePath);
    if (matchedGroupKey) {
      ngx.log(ngx.WARN, `hit isDisableRedirect, group: ${matchedGroupKey}`);
      return true;
    }
  }
  return false;
}

function getMatchedRuleGroupKey(r, groupKey, groupRulesArr3D, filePath) {
  let rvt;
  ngx.log(ngx.INFO, `getMatchedRuleGroupKey groupRulesArr3D: ${JSON.stringify(groupRulesArr3D)}`);
  // remove groupKey
  const oldRulesArr3D = groupRulesArr3D.map(gRule => gRule.slice(1));
  ngx.log(ngx.INFO, `getMatchedRuleGroupKey oldRulesArr3D: ${JSON.stringify(oldRulesArr3D)}`);
  if (oldRulesArr3D.every(rule => !!getMatchedRule(r, [rule], filePath))) {
    rvt = groupKey;
  }
  return rvt;
}

function getMatchedRule(r, ruleArr3D, filePath) {
  return ruleArr3D.find(rule => {
    const sourceStr = getSourceStrByType(r, rule[0], filePath);
    ngx.log(ngx.WARN, `sourceStrValue, ${rule[0]} = ${sourceStr}`);
    const matcher = rule[2];
    let flag;
    if (Array.isArray(matcher) 
      && matcher.some(m => strMatches(rule[1], sourceStr, m))) {
      flag = true;
    } else {
      flag = strMatches(rule[1], sourceStr, matcher);
    }
    return flag;
  });
}

function getSourceStrByType(r, type, filePath) {
  let str = filePath;
  if (type === "filePath") {
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

function checkNotLocal(protocol, mediaStreamsLength) {
  // MediaSourceInfo{ Protocol }, string ($enum)(File, Http, Rtmp, Rtsp, Udp, Rtp, Ftp, Mms)
  // live stream "IsInfiniteStream": true
  if (!!protocol) {
    if (protocol != "File") {
      return true;
    }
    return mediaStreamsLength == 0;
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

export default {
  args,
  proxyUri,
  appendUrlArg,
  addDefaultApiKey,
  generateUrl,
  getCurrentRequestUrl,
  copyHeaders,
  isDisableRedirect,
  strMapping,
  strMatches,
  checkIsStrmByPath,
  checkNotLocal,
  checkIsRemoteByPath,
  redirectStrmLastLinkRuleFilter,
  strmLinkFailback,
  getItemInfo,
  dictAdd,
  cost,
};

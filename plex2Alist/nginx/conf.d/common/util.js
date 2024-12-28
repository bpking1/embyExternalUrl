import config from "../constant.js";
import urlUtil from "./url-util.js";

const ARGS = {
  plexTokenKey: "X-Plex-Token",
  internalKey: "internal",
  cacheLevleKey: "cacheLevel",
  rXMediaKey: "XMedia",
}

const ROUTE_ENUM = {
  proxy: "proxy",
  redirect: "redirect",
  block: "block", // blockAll
  blockDownload: "blockDownload",
  blockPlay: "blockPlay",
};

const CHCHE_LEVEL_ENUM = {
  L1: "L1",
  L2: "L2",
  // L3: "L3",
};

const SOURCE_STR_ENUM = {
  filePath: "filePath",
  alistRes: "alistRes",
};

const MATCHER_ENUM = {
  startsWith: { id: "startsWith", fn: (s, t) => s.startsWith(t) },
  endsWith: { id: "endsWith", fn: (s, t) => s.endsWith(t) },
  includes: { id: "includes", fn: (s, t) => s.includes(t) },
  match: { id: "match", fn: (s, t) => !!s.match(t) },
  // before is old@declare index not modify
  ">": { id: ">", name: "greaterThan", fn: (s, t) => s > t },
  "<": { id: "<", name: "lessThan", fn: (s, t) => s < t },
  "==": { id: "==", name: "equal", fn: (s, t) => s == t },
  "!=": { id: "!=", name: "notEqual", fn: (s, t) => s != t },
  ">=": { id: ">=", name: "greaterThanOrEqual", fn: (s, t) => s >= t },
  "<=": { id: "<=", name: "lessThanOrEqual", fn: (s, t) => s <= t },
  "===": { id: "===", name: "strictEqual", fn: (s, t) => s === t },
  "!==": { id: "!==", name: "strictNotEqual", fn: (s, t) => s !== t },
  not: { id: "not", fn: (flag) => !flag }, // special
};

// copy from emby2Alist/nginx/conf.d/util.js

/**
 * doUrlMapping
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} mediaItemPath media server item path
 * @param {Boolean} notLocal Http or strm link
 * @param {Array} mappingArr 4D Array, first index is enable rule, 3D Array
 * @param {String} mark log and tip keyword
 * @returns mapped url
 */
function doUrlMapping(r, url, notLocal, mappingArr, mark) {
  if (!mark) {
    mark = "urlMapping";
  }
  const isRelative = !isAbsolutePath(url);
  ngx.log(ngx.WARN, `${mark}: ${JSON.stringify(mappingArr)}`);
  let enableRule;
  mappingArr.map(arr => {
    const rangeVal = arr[Number.isInteger(arr[0]) ? 1 : 2];
    if (rangeVal != 3) {
      if ((rangeVal == 0 && notLocal)
        || (rangeVal == 1 && (!notLocal || isRelative))
        || (rangeVal == 2 && (!notLocal || !isRelative))) {
        return;
      }
    }
    enableRule = Number.isInteger(arr[0]) ? null : arr.splice(0, 1)[0];
    if (enableRule) {
      let hitRule = simpleRuleFilter(
        r, enableRule, url,
        SOURCE_STR_ENUM.filePath, `${mark}EnableRule`
      );
      if (!(hitRule && hitRule.length > 0)) { return; }
    }
    url = strMapping(arr[0], url, arr[2], arr[3]);
  });
  // windows filePath to URL path, warn: markdown log text show \\ to \
  if (url.startsWith("\\")) {
    ngx.log(ngx.WARN, `windows filePath to URL path \\ => /`);
    url = url.replaceAll("\\", "/");
  }
  return url;
}

function copyHeaders(sourceHeaders, targetHeaders, skipKeys) {
  if (!skipKeys) {
    // auto generate content length
    skipKeys = ["Content-Length"];
  }
  for (const key in sourceHeaders) {
	  if (skipKeys.includes(key)) {
	    continue;
	  }
	  targetHeaders[key] = sourceHeaders[key];
	}
}

/**
 * groupBy
 * @param {Array} array original > 1D array
 * @param {Number|Function} key groupBy key, Number is 1D array index, Function is custom key getter
 * @returns grouped Object Array, key is groupBy key(String), value is grouped 1D array
 */
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

/**
 * getRouteMode
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} filePath mediaFilePath or alistRes link
 * @param {Boolean} isAlistRes alistRes link
 * @param {Boolean} notLocal if not need proxy route can be undefined
 * @returns ROUTE_ENUM.xxx
 */
function getRouteMode(r, filePath, isAlistRes, notLocal) {
  // unify every length to 5
  let cRouteRule = config.routeRule.slice().map((rule, index) => {
    if (!Object.keys(ROUTE_ENUM).includes(rule[0])) {
      rule.unshift(ROUTE_ENUM.proxy);
    }
    if (rule.length === 4) {
      return rule.slice(0, 1).concat(`default-${rule[0]}-group-${index}`).concat(rule.slice(1));
    } else {
      return rule;
    }
  });
  // skip internal request
  if (r.args[ARGS.internalKey] === "1") {
    cRouteRule = cRouteRule.filter(rule => rule[2] != "r.variables.remote_addr");
  }
  if (!isAlistRes) {
    const mountPath = config.mediaMountPath;
    // exact, local file not mediaMountPath first
    if (!notLocal && mountPath && mountPath.every(path => path && !filePath.startsWith(path))) {
      ngx.log(ngx.WARN, `hit proxy, localFile not mountPath first: ${JSON.stringify(mountPath)}`);
      return ROUTE_ENUM.proxy;
    }
  }
  if (cRouteRule.length === 0 && isAlistRes) {
    // default value is redirect routeMode
    return ROUTE_ENUM.redirect;
  }
  // routeRules groupBy routeMode
  const routeRulesObjArr = groupBy(cRouteRule, 0);
  ngx.log(ngx.INFO, `routeRules groupBy routeMode: ${JSON.stringify(routeRulesObjArr)}`);
  for (const routeMode in routeRulesObjArr) {
    cRouteRule = routeRulesObjArr[routeMode];
    // remove routeMode
    const oldRulesArr3D = cRouteRule.map(rRule => rRule.slice(1));
    let matchedGroupKey = getMatchedRuleGroupKey(r, oldRulesArr3D, filePath);
    if (matchedGroupKey) {
      ngx.log(ngx.WARN, `hit ${routeMode}, group: ${matchedGroupKey}`);
      return routeMode;
    }
  }
  return ROUTE_ENUM.redirect;
}

/**
 * isProxy, old isDisableRedirectRule, one rule matched will return
 * sigle rule priority > group rule
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} filePath mediaFilePath or alistRes link
 * @param {Boolean} isAlistRes alistRes link
 * @param {Boolean} notLocal if not need proxy route can be undefined
 * @returns Boolean
 */
// function isProxy(r, proxyRules, filePath, isAlistRes, notLocal) {
//   const disableRedirectRule = proxyRules;
//   const mountPath = config.mediaMountPath;
//   if (!isAlistRes) {
//     // exact, local file not mediaMountPath first
//     if (!notLocal && mountPath && mountPath.every(path => path && !filePath.startsWith(path))) {
//       ngx.log(ngx.WARN, `hit proxy, localFile not mountPath first: ${JSON.stringify(mountPath)}`);
//       return true;
//     }
//   }
  
//   // old proxy, sigle rule length is 3 or 4(group)
//   const oldRules = disableRedirectRule.filter(rule => rule.length <= 3);
//   if (oldRules.length > 0) {
//     let matchedRule = getMatchedRule(r, oldRules, filePath);
//     if (matchedRule) {
//       ngx.log(ngx.WARN, `hit proxy: ${JSON.stringify(matchedRule)}`);
//       return true;
//     }
//   }
//   // new proxy with group name
//   const groupRulesObjArr = groupBy(disableRedirectRule.filter(rule => rule.length > 3), 0);
//   if (Object.keys(groupRulesObjArr) === 0) {
//     return false;
//   }
//   let matchedGroupKey;
//   for (const gKey in groupRulesObjArr) {
//     matchedGroupKey = getMatchedRuleGroupKey(r, gKey, groupRulesObjArr[gKey], filePath);
//     if (matchedGroupKey) {
//       ngx.log(ngx.WARN, `hit proxy, group: ${matchedGroupKey}`);
//       return true;
//     }
//   }
//   return false;
// }

/**
 * getMatchedRuleGroupKey
 * @param {Object} r nginx objects, HTTP Request
 * @param {Array} groupRuleArr3D [["115-alist", "r.args.X-Emby-Client", 0, ["Emby Web", "Emby for iOS", "Infuse"]]]
 * @param {String} filePath mediaFilePath or alistRes link
 * @returns "115-alist"
 */
function getMatchedRuleGroupKey(r, groupRuleArr3D, filePath) {
  const routeRulesObjArr = groupBy(groupRuleArr3D, 0);
  ngx.log(ngx.INFO, `groupBy index 0: ${JSON.stringify(routeRulesObjArr)}`);
  let cRouteRule;
  for (const groupKey in routeRulesObjArr) {
    cRouteRule = routeRulesObjArr[groupKey];
    // remove groupKey
    const ruleArr3D = cRouteRule.map(gRule => gRule.slice(1));
    ngx.log(ngx.WARN, `getMatchedRuleGroupKey: ${groupKey}, ruleArr3D: ${JSON.stringify(ruleArr3D)}`);
    // one group inner "every" is logical "and"
    if (ruleArr3D.every(rule => !!getMatchedRule(r, [rule], filePath))) {
      return groupKey;
    }
  }
}

/**
 * getMatchedRule
 * @param {Object} r nginx objects, HTTP Request
 * @param {Array} ruleArr3D [["filePath", 3, /private/ig]]
 * @param {String} filePath mediaFilePath or alistRes link
 * @returns ["filePath", 3, /private/ig]
 */
function getMatchedRule(r, ruleArr3D, filePath) {
  return ruleArr3D.find(rule => {
    let sourceStr = filePath;
    if (!Object.values(SOURCE_STR_ENUM).includes(rule[0])) {
      sourceStr = parseExpression(r, rule[0]);
      if (rule[0] === 'r.variables.remote_addr') {
        sourceStr = urlUtil.getRealIp(r);
      }
    }
    let flag = false;
    ngx.log(ngx.WARN, `sourceStrValue, ${rule[0]} = ${sourceStr}`);
    if (!sourceStr) {
      return flag;
    }
    const matcher = rule[2];
    if (Array.isArray(matcher) 
      && matcher.some(m => strMatches(rule[1], sourceStr, m))) {
      flag = true;
    } else {
      flag = strMatches(rule[1], sourceStr, matcher);
    }
    return flag;
  });
}

/**
 * parseExpression
 * @param {Object} rootObj like r
 * @param {String} expression like "r.args.MediaSourceId", notice skipped "r."
 * @param {String} propertySplit like "."
 * @param {String} groupSplit like ":", group will return string type
 * @returns parsed value or string
 */
function parseExpression(rootObj, expression, propertySplit, groupSplit) {
  if (arguments.length < 4) {
    if (arguments.length < 3) {
      if (arguments.length < 2) {
        throw new Error("Missing required parameter: rootObj");
      }
      propertySplit = ".";
      groupSplit = ":";
    } else {
      propertySplit = ".";
      groupSplit = propertySplit;
    }
  }

  if (typeof rootObj !== "object" || rootObj === null) {
    throw new Error("rootObj must be a non-null object");
  }
  
  if (typeof expression !== "string" || expression.trim() === "") {
    return undefined;
  }

  if (typeof propertySplit !== "string" || typeof groupSplit !== "string") {
    throw new Error("Property and group split must be strings");
  }

  const expGroups = expression.split(groupSplit);
  let values = [];

  expGroups.map(expGroup => {
    if (!expGroup.trim()) return;

    const expArr = expGroup.split(propertySplit);
    let val = rootObj;

    // skipped index 0
    expArr.map((expPart, index) => {
      if (index === 0) return;
      if (val && Object.hasOwnProperty.call(val, expPart)) {
        val = val[expPart];
      } else {
        val = "";
        ngx.log(ngx.INFO, `Property "${expPart}" not found in object,will ignore`);
      }
    });

    values.push(val);
  });

  values = values.filter(item => item);
  return expGroups.length > 1 ? values.join(groupSplit) : values[0];
}

function strMapping(type, sourceValue, searchValue, replaceValue) {
  let str = sourceValue;
  if (type == 0) {
    str = str.replace(searchValue, replaceValue);
    ngx.log(ngx.WARN, `strMapping replace: ${searchValue} => ${replaceValue}`);
  } else if (type == 1) {
    str = searchValue + str;
    ngx.log(ngx.WARN, `strMapping append: ${searchValue}`);
  } else if (type == 2) {
    str += searchValue;
    ngx.log(ngx.WARN, `strMapping unshift: ${searchValue}`);
  } else if (type == 3) {
    str = str.replaceAll(searchValue, replaceValue);
    ngx.log(ngx.WARN, `strMapping replaceAll: ${searchValue} => ${replaceValue}`);
  }
  return str;
}

/**
 * strMatches
 * @param {Number|String} type MATCHER_ENUM
 * @param {String|Number|Boolean} source
 * @param {String|RegExp|Number|Boolean} target
 * @returns boolean
 */
function strMatches(type, source, target) {
  let flag = false;
  // old, @declare, 0: startsWith(str), 1: endsWith(str), 2: includes(str), 3: match(/ain/g)
  if (Number.isInteger(type)) {
    const typeStr = MATCHER_ENUM[Object.keys(MATCHER_ENUM)[type]].id;
    if (typeStr) {
      const matcherFunction = MATCHER_ENUM[typeStr].fn;
      flag = matcherFunction(source, target);
    } else {
      throw new Error("Unknown type: " + type);
    }
  } else if (typeof type == "string") {
    // new, type is string, support negate matcher
    const parts = type.split(":");
    const typeStr = parts[0];
    const negateStr = parts[1];

    const matcherFunction = MATCHER_ENUM[typeStr].fn;
    if (matcherFunction) {
      flag = matcherFunction(source, target);
      if (negateStr === MATCHER_ENUM.not.id) {
        flag = MATCHER_ENUM.not.fn(flag);
      }
    } else {
      throw new Error("Unknown type: " + typeStr);
    }
  } else {
    throw new Error("Invalid type: " + type);
  }
  const logLevel = flag ? ngx.WARN : ngx.INFO;
  ngx.log(logLevel, `strMatches result: ${flag}, type: ${type}, ${typeof source} source: ${source}, ${typeof target} target: ${target}`);
  return flag;
}

function checkIsStrmByPath(filePath) {
  if (filePath) {
    // strm: filePath1-itemPath like: /xxx/xxx.strm
    return filePath.toLowerCase().endsWith(".strm");
  }
  return false;
}

function isAbsolutePath(filePath) {
  return filePath && typeof filePath === "string" 
    ? filePath.startsWith("/") || filePath.startsWith("\\") : false;
}

/**
 * simpleRuleFilter
 * 1.support old rule, index 0: match, index 1: matchTarget
 * 2.support new rule, index 0: matchSource, index 1: match, index 2: matchTarget
 * 3.support new rule, index 0: groupName, index 1: matchSource, index 2: match, index 3: matchTarget
 * @param {Object} r nginx objects, HTTP Request
 * @param {Array}  ruleArr3D support group rule
 * @param {String} filePath mediaFilePath or alistRes raw_url
 * @param {String} firstSourceStr SOURCE_STR_ENUM String
 * @param {String} mark log and tip keyword
 * @returns undefined | matchedRule: old rule is single, group return first rule
 */
function simpleRuleFilter(r, ruleArr3D, filePath, firstSourceStr, mark) {
  if (!firstSourceStr) {
    firstSourceStr = SOURCE_STR_ENUM.filePath;
  }
  if (!mark) {
    mark = "simpleRule";
  }
  // group current rules, old is true, new is false
  const onGroupRulesObjArr = groupBy(ruleArr3D, 
    rule => Number.isInteger(rule[0]) || Object.values(MATCHER_ENUM).includes(rule[0])
  );
  ngx.log(ngx.INFO, `onGroupRulesObjArr: ${JSON.stringify(onGroupRulesObjArr)}`);
  let onGroupItemRules;
  let paramRulesArr3D;
  for (const onKey in onGroupRulesObjArr) {
    ngx.log(ngx.INFO, `${mark}Filter onKey: ${onKey}, typeof: ${typeof onKey}`);
    onGroupItemRules = onGroupRulesObjArr[onKey];
    // old new group
    if (onKey === "true") {
      // convert params, old rules default add index 0
      paramRulesArr3D = onGroupItemRules.map(rRule => {
        const copy = rRule.slice();
        copy.unshift(firstSourceStr);
        return copy;
      });
      let matchedRule = getMatchedRule(r, paramRulesArr3D, filePath);
      if (matchedRule) {
        matchedRule = Object.values(SOURCE_STR_ENUM).includes(matchedRule[0]) ? matchedRule.slice(1) : matchedRule;
        ngx.log(ngx.WARN, `hit ${mark}: ${JSON.stringify(matchedRule)}`);
        return matchedRule;
      }
    } else {
      // new rules groupBy group name
      const keyGroupRulesObjArr = groupBy(onGroupItemRules, 0);
      ngx.log(ngx.INFO, `keyGroupRulesObjArr: ${JSON.stringify(keyGroupRulesObjArr)}`);
      if (Object.keys(keyGroupRulesObjArr).length === 0) {
        return;
      }
      for (const kgKey in keyGroupRulesObjArr) {
        // key group after single group
        ngx.log(ngx.INFO, `${mark}Filter kgKey: ${kgKey}`);
        paramRulesArr3D = keyGroupRulesObjArr[kgKey];
        // single group logical "and"
        const matchedGroupKey = getMatchedRuleGroupKey(r, paramRulesArr3D, filePath);
        if (matchedGroupKey) {
          ngx.log(ngx.WARN, `hit ${mark} group: ${matchedGroupKey}`);
          return paramRulesArr3D.find(gRule => gRule[0] === matchedGroupKey);
        }
      }
    }
  }
}

/**
 * getClientSelfAlistLink
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} filePath mediaFilePath or alist raw_url, like: http://xxx
 * @param {String} alistFilePath null or mapped mediaItemPath, like: /file.mp4 or any string, depend on mediaPathMapping rule
 * @returns alist dUrl
 */
function getClientSelfAlistLink(r, filePath, alistFilePath) {
  if (!filePath) {
    return r.warn(`args[1] filePath is required`);
  }
  let rule = simpleRuleFilter(r, config.clientSelfAlistRule, filePath, SOURCE_STR_ENUM.alistRes, "clientSelfAlistRule");
  if (rule && rule.length > 0) {
    if (!Number.isInteger(rule[0])) {
      // convert groupRule remove groupKey and sourceValue
      r.warn(`convert groupRule remove groupKey and sourceValue`);
      rule = rule.slice(2);
    }
    const alistPublicAddr = rule.length === 3 ? rule[2] : config.alistPublicAddr;
    // encodeURIComponent because of "#" in path
    let realFilePath = encodeURIComponent(alistFilePath || filePath);
    realFilePath = realFilePath.replaceAll("%2F", "/");
    return `${alistPublicAddr}/d${realFilePath}`;
  }
}

/**
 * dictAdd, ngx.shared.SharedDict.add(key, value [,timeout])
 * @since NJS 0.8.0
 * @param {String} dictName 
 * @param {String} key 
 * @param {String|Number} value default is String, js_shared_dict_zone type=number
 * @param {Number} timeout milliseconds,since NJS 0.8.5
 * @param {Boolean} isSet switch dict.set to cover preValue
 * @returns Number "fail" -1: fail, 0: not expire, "success" 1: added, 2: added with timeout
 */
function dictAdd(dictName, key, value, timeout, isSet) {
  if (!dictName || !key || !value) return 0;

  const dict = ngx.shared[dictName];
  let methodName = isSet ? "set" : "add";
  if (!isSet) {
    const preValue = dict.get(key);
    if (preValue === value) return 0;
  }
  
  const msgBase = `${dictName} ${methodName}: [${key}] : [${value}]`;
  // simple version string compare use Unicode, better use njs.version_number
  if (njs.version >= "0.8.5" && timeout && timeout > 0) {
    if (dict[methodName].call(dict, key, value, timeout)) {
      ngx.log(ngx.WARN, `${msgBase}, timeout: ${timeout}ms`);
      return 2;
    }
  } else {
    if (dict[methodName].call(dict, key, value)) {
      ngx.log(ngx.WARN, `${msgBase}${timeout ? `, skip arguments: timeout: ${timeout}ms` : ''}`);
      return 1;
    }
  }
  return 0;
}

async function cost(func) {
  if (!func || !(func instanceof Function)) {
    ngx.log(ngx.ERR, `target function not null or is not function`);
    return;
  }
  const args = Array.prototype.slice.call(arguments, 1);
  const start = Date.now();
  let rvt;
  try {
    rvt = func.apply(func, args);
    if (rvt instanceof Promise) {
      await rvt.then(
        realRvt => {
          const end = Date.now();
          ngx.log(ngx.WARN, `cost ${end - start}ms, ${func.name} async function cost`);
          // return realRvt;
        },
        error => {
          const end = Date.now();
          ngx.log(ngx.ERR, `cost ${end - start}ms, ${func.name} async function throw an error`);
          throw error;
        }
      );
    } else {
      const end = Date.now();
      ngx.log(ngx.WARN, `cost ${end - start}ms, ${func.name} function cost`);
    }
  } catch (error) {
    const end = Date.now();
    ngx.log(ngx.ERR, `cost ${end - start}ms, ${func.name} sync function throw an error`);
    throw error;
  }
  return rvt;
}

/**
 * Crypto
 */
const crypto = require('crypto');

function calculateHMAC(data, key) {
  // 创建 HMAC 对象，并指定算法和密钥
  const hmac = crypto.createHmac('sha256', key);
  // 更新要计算的数据
  hmac.update(data);
  // 计算摘要并以 GoLang 中 URLEncoding 方式返回
  return hmac.digest('base64')
      .replaceAll("+", "-")
      .replaceAll("/", "_");
}

function addAlistSign(url, alistToken, alistSignExpireTime) {
  let path = url.match(/https?:\/\/[^\/]+(\/[^?#]*)/)[1]
  const startIndex = path.indexOf("/d/")
  const signNX = url.indexOf("sign=") === -1
  const expiredHour = alistSignExpireTime ?? 0
  if ((signNX || expiredHour > 0) && startIndex !== -1) {
    // add sign param for alist
    if (url.indexOf("?") === -1) {
      url += "?"
    } else if (signNX) {
      url += "&"
    }
    console.log(url)
    let time = 0;
    if (expiredHour !== 0) {
      time = Math.floor(Date.now() / 1000 + expiredHour * 3600)
    }
    path = decodeURIComponent(path.substring(startIndex + 2).replaceAll('//','/'))
    const signData = `${path}:${time}`
    ngx.log(ngx.WARN, `sign data: ${signData}`)
    const signPrefix = calculateHMAC(signData, alistToken)
    const signValue = `${signPrefix}:${time}`
    if (!signNX && expiredHour > 0) {
      const oldSign = url.match(/sign=([^&]+)/)[1]
      url = url.replace(oldSign, signValue)
      ngx.log(ngx.WARN, `force replace old sign: ${oldSign} => ${signValue}`)
    } else {
      url = `${url}sign=${signValue}`
      ngx.log(ngx.WARN, `add sign: ${signValue}`)
    }
  }
  return url;
}

/**
 * File System
 */
const fs = require("fs");

function checkAndGetRealpathSync(path) {
  try {
    // this only check SymbolicLink file read permission, not target file
    fs.accessSync(path, fs.constants.R_OK);
    let symStats = fs.lstatSync(path);
    if (!symStats) throw new Error(`symStats is null`);
    // if (!symStats.isFile()) throw new Error(`not a file`);
    if (symStats.nlink > 1) throw new Error(`this is hard-link`);
    if (!symStats.isSymbolicLink()) throw new Error(`not isSymbolicLink`);
    return fs.realpathSync(path);
  } catch (e) {
    ngx.log(ngx.WARN, `${e}, skip: ${path}`);
  }
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
  ARGS,
  ROUTE_ENUM,
  CHCHE_LEVEL_ENUM,
  SOURCE_STR_ENUM,
  doUrlMapping,
  copyHeaders,
  strMapping,
  strMatches,
  getRouteMode,
  parseExpression,
  checkIsStrmByPath,
  isAbsolutePath,
  simpleRuleFilter,
  getClientSelfAlistLink,
  dictAdd,
  cost,
  calculateHMAC,
  addAlistSign,
  checkAndGetRealpathSync,
  getFileNameByHead,
};

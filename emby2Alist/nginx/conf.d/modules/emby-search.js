// @author: Chen3861229
// @date: 2024-07-13

import config from "../constant.js";
import util from "../common/util.js";
import events from "../common/events.js";
import emby from "../emby.js";
// import embyApi from "../api/emby-api.js";

const ARGS = {
  dictName: "tmpDict",
  itemsType: "Episode",
}

const DIRECTIVE_SPLIT_ENUM = {
  directive: { key: "/", desc: "指令分隔符" },
  valueSplit: { key: "=", desc: "参数分隔符" },
  timeSplit: { key: ":", desc: "有效秒数分隔符" },
}

const DICT_ZONE_EMUN = {
  transcodeDict: { key: "transcodeDict", desc: "转码链接缓存字典" },
  routeL1Dict: { key: "routeL1Dict", desc: "一级直链缓存字典" },
  routeL2Dict: { key: "routeL2Dict", desc: "二级直链缓存字典" },
  // routeL3Dict: { key: "routeL3Dict", desc: "三级直链缓存字典" },
  idemDict: { key: "idemDict", desc: "防抖缓存字典" },
  tmpDict: { key: "tmpDict", desc: "内部用临时变量缓存字典" },
  versionDict: { key: "versionDict", desc: "虚拟多版本缓存字典" },
}

const DIRECTIVE_KEY_ENUM = {
  help: { key: "help", desc: "帮助" },
  skipImageCache: { key: "skipImageCache", desc: "临时跳过 nginx 图片缓存" },
  opendocs: { key: "opendocs", desc: "临时允许访问上游 docs" },
  showDictZoneState: { key: "showDictZoneState", desc: "显示路由缓存/直链缓存数量" },
  clearDictZone: { key: "clearDictZone", desc: "清空路由缓存/直链缓存" },
}

async function searchHandle(r) {
  const searchConfig = config.searchConfig;
  const enable = searchConfig && searchConfig.interactiveEnable;
  if (!enable) {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }
  let hitFlag = true;
  if (searchConfig.interactiveEnableRule && searchConfig.interactiveEnableRule.length > 0) {
    hitFlag = searchConfig.interactiveEnableRule.some(rule => r.variables.request_uri.includes(rule));
  }
  if (!hitFlag) {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }

  events.njsOnExit(`searchHandle: ${r.uri}`);

  const searchTerm = r.args.SearchTerm;
  r.headersOut['Content-Type'] = 'application/json; charset=utf-8';
  if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM.help.key)) {
    r.return(200, handleHelp(r));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM.skipImageCache.key)) {
    r.return(200, handleWithTimeout(r, searchTerm, DIRECTIVE_KEY_ENUM.skipImageCache.key));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM.opendocs.key)) {
    r.return(200, handleWithTimeout(r, searchTerm, DIRECTIVE_KEY_ENUM.opendocs.key));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM.showDictZoneState.key)) {
    r.return(200, handleShowDictZoneStat(r, searchTerm));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM.clearDictZone.key)) {
    r.return(200, handleClearDictZone(r, searchTerm));
  } else if (searchConfig.interactiveFast && searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive.key)) {
    r.return(200, handleHelp(r));
  } else {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }
}

function handleHelp(r) {
  const items1 = Object.keys(DIRECTIVE_KEY_ENUM).map(k => {
    return {
      Name: DIRECTIVE_KEY_ENUM[k].desc, // sub title
      SeriesName: DIRECTIVE_SPLIT_ENUM.directive.key + DIRECTIVE_KEY_ENUM[k].key, // main title
      Type: ARGS.itemsType,
    };
  });
  const items2 = Object.keys(DIRECTIVE_SPLIT_ENUM).map(k => {
    return {
      Name: DIRECTIVE_SPLIT_ENUM[k].desc, // sub title
      SeriesName: DIRECTIVE_SPLIT_ENUM[k].key, // main title
      Type: ARGS.itemsType,
    };
  });
  const items3 = Object.keys(DICT_ZONE_EMUN).map(k => {
    return {
      Name: DICT_ZONE_EMUN[k].desc, // sub title
      SeriesName: DICT_ZONE_EMUN[k].key, // main title
      Type: ARGS.itemsType,
    };
  });
  const items = items1.concat(items2).concat(items3);
  return JSON.stringify({
    Items: items,
    TotalRecordCount: 0
  });
}

/**
 * handleWithTimeout
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} searchTerm 
 * @param {String} directiveKey not with /
 * @returns 
 */
function handleWithTimeout(r, searchTerm, directiveKey) {
  let msg;
  let timeoutS = parseInt(searchTerm.split(DIRECTIVE_SPLIT_ENUM.timeSplit.key)[1]);
  r.warn(`${directiveKey} input timeoutS: ${timeoutS}`);
  if (isNaN(timeoutS)) {
    timeoutS = 60;
    r.warn(`${directiveKey} handle default timeoutS: ${timeoutS}`);
  }
  if (timeoutS < 1) {
    msg = ngx.shared[ARGS.dictName].delete(directiveKey) ? "CloseSuccess" : "CloseFail";
  } else {
    const msgIndex = util.dictAdd(ARGS.dictName, directiveKey, "1", timeoutS ? timeoutS * 1000 : -1);
    msg = ["AddFail", "NotExpire", `With60Seconds`, `With${timeoutS}Seconds`][msgIndex + 1];
  }
  r.warn(`${directiveKey} msg: ${msg}`);
  return JSON.stringify({
    Items: [{
      Name: searchTerm,
      SeriesName: msg,
      Type: ARGS.itemsType,
    }],
    TotalRecordCount: 0
  });
}

function handleShowDictZoneStat(r, searchTerm) {
  const items = Object.values(DICT_ZONE_EMUN).map(value => {
    return {
      Name: `${value.key}(${value.desc})`, // sub title
      SeriesName: String(ngx.shared[value.key].size()), // main title
      Type: ARGS.itemsType,
    };
  });
  return JSON.stringify({
    Items: items,
    TotalRecordCount: 0
  });
}

function handleClearDictZone(r, searchTerm) {
  let msg;
  const value = searchTerm.split(DIRECTIVE_SPLIT_ENUM.valueSplit.key)[1];
  if (value) {
    if (value.includes("route")) {
      ngx.shared[value].clear();
      msg = `clear ${success ? "success" : "fail"}: ${value}`;
      r.warn(`handleClearDictZone: ${msg}`);
    } else {
      msg = `not allow: ${value}`;
      r.warn(`handleClearDictZone: ${msg}`);
    }
  } else {
    ngx.shared[DICT_ZONE_EMUN.routeL1Dict.key].clear();
    ngx.shared[DICT_ZONE_EMUN.routeL2Dict.key].clear();
    msg = `clear routeDict success, skip others`;
    r.warn(`handleClearDictZone: ${msg}`);
  }
  return JSON.stringify({
    Items: [{
      Name: searchTerm,
      SeriesName: msg,
      Type: ARGS.itemsType,
    }],
    TotalRecordCount: 0
  });
}

// for js_set
function getNocache(r) {
  const value = ngx.shared[ARGS.dictName].get(DIRECTIVE_KEY_ENUM.skipImageCache.key) ?? "";
  // r.log(`getNocache: ${value}`);
  return value;
}

export default {
  searchHandle,
  getNocache,
};
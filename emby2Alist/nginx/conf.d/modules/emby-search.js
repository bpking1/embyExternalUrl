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
  directive: "/",
  valueSplit: "=",
  timeSplit: ":",
}

const DICT_ZONE_EMUN = {
  transcodeDict: "transcodeDict",
  routeL1Dict: "routeL1Dict",
  routeL2Dict: "routeL2Dict",
  // routeL3Dict: "routeL3Dict",
  idemDict: "idemDict",
  tmpDict: "tmpDict",
}

const DIRECTIVE_KEY_ENUM = {
  help: "help",
  nocache: "nocache",
  openDocs: "open docs",
  showDictZoneStat: "show dict zone stat",
  clearDictZone: "clear dict zone",
}

async function searchHandle(r) {
  const searchConfig = config.searchConfig;
  let hitFlag = searchConfig.interactiveEnableRule.length == 0;
  if (searchConfig && !hitFlag) {
    hitFlag = searchConfig.interactiveEnableRule.some(rule => r.variables.request_uri.includes(rule));
  }
  if (!searchConfig || !searchConfig.interactiveEnable || !hitFlag) {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }

  events.njsOnExit(`searchHandle: ${r.uri}`);

  const searchTerm = r.args.SearchTerm;
  if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive + DIRECTIVE_KEY_ENUM.help)) {
    r.return(200, handleHelp(r));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive + DIRECTIVE_KEY_ENUM.nocache)) {
    r.return(200, handleWithTimeout(r, searchTerm, DIRECTIVE_KEY_ENUM.nocache));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive + DIRECTIVE_KEY_ENUM.openDocs)) {
    r.return(200, handleWithTimeout(r, searchTerm, DIRECTIVE_KEY_ENUM.openDocs));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive + DIRECTIVE_KEY_ENUM.showDictZoneStat)) {
    r.return(200, handleShowDictZoneStat(r, searchTerm));
  } else if (searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive + DIRECTIVE_KEY_ENUM.clearDictZone)) {
    r.return(200, handleClearDictZone(r, searchTerm));
  } else if (searchConfig.interactiveFast && searchTerm.startsWith(DIRECTIVE_SPLIT_ENUM.directive)) {
    r.return(200, handleHelp(r));
  } else {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }
}

function handleHelp(r) {
  const items1 = Object.keys(DIRECTIVE_KEY_ENUM).map(key => {
    return {
      Name: key, // sub title
      SeriesName: `${DIRECTIVE_SPLIT_ENUM.directive}${DIRECTIVE_KEY_ENUM[key]}`, // main title
      Type: ARGS.itemsType,
    };
  });
  const items2 = Object.keys(DIRECTIVE_SPLIT_ENUM).map(key => {
    return {
      Name: key, // sub title
      SeriesName: DIRECTIVE_SPLIT_ENUM[key], // main title
      Type: ARGS.itemsType,
    };
  });
  const items3 = Object.keys(DICT_ZONE_EMUN).map(key => {
    return {
      Name: key, // sub title
      SeriesName: DIRECTIVE_SPLIT_ENUM[key], // main title
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
  let timeoutS = parseInt(searchTerm.split(DIRECTIVE_SPLIT_ENUM.timeSplit)[1]);
  r.warn(`${directiveKey} input timeoutS: ${timeoutS}`);
  if (isNaN(timeoutS)) {
    timeoutS = 60;
    r.warn(`${directiveKey} handle default timeoutS: ${timeoutS}`);
  }
  if (timeoutS < 1) {
    msg = ngx.shared[ARGS.dictName].delete(directiveKey) ? "CloseSuccess" : "CloseFail";
  } else {
    const flag = util.dictAdd(ARGS.dictName, directiveKey, "1", timeoutS ? timeoutS * 1000 : -1);
    msg = ["AddFail", "NotExpire", `With60Seconds`, `With${timeoutS}Seconds`][flag + 1];
  }
  r.warn(`${directiveKey} msg: ${msg}`);
  return JSON.stringify({
    Items: [{
      Name: searchTerm,
      SeriesName: `${msg}`,
      Type: ARGS.itemsType,
    }],
    TotalRecordCount: 0
  });
}

function handleShowDictZoneStat(r, searchTerm) {
  const items = Object.values(DICT_ZONE_EMUN).map(value => {
    return {
      Name: value, // sub title
      SeriesName: String(ngx.shared[value].size()), // main title
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
  const value = searchTerm.split(DIRECTIVE_SPLIT_ENUM.valueSplit)[1];
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
    ngx.shared[DICT_ZONE_EMUN.routeL1Dict].clear();
    ngx.shared[DICT_ZONE_EMUN.routeL2Dict].clear();
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
  const value = ngx.shared[ARGS.dictName].get(DIRECTIVE_KEY_ENUM.nocache) ?? "";
  // r.log(`getNocache: ${value}`);
  return value;
}

export default {
  searchHandle,
  getNocache,
};
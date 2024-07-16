// @author: Chen3861229
// @date: 2024-07-13

import config from "../constant.js";
import util from "../common/util.js";
import events from "../common/events.js";
import emby from "../emby.js";
// import embyApi from "../api/emby-api.js";

const ARGS = {
  directive: "/",
  valueSplit: "=",
  timeSplit: ":",
  dictName: "tmpDict",
  // directive key
  nocacheKey: "nocache",
  openDocsKey: "opendocs",
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
  if (searchTerm.includes(ARGS.directive + ARGS.nocacheKey)) {
    r.return(200, handleWithTimeout(r, searchTerm, ARGS.nocacheKey));
  } else if (searchTerm.includes(ARGS.directive + ARGS.openDocsKey)) {
    r.return(200, handleWithTimeout(r, searchTerm, ARGS.openDocsKey));
  } else {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }
}

/**
 * handleWithTimeout
 * @param {Object} r nginx objects, HTTP Request
 * @param {String} searchTerm 
 * @param {String} directiveKey not with /
 * @returns 
 */
function handleWithTimeout(r, searchTerm, directiveKey) {
  let msg = directiveKey;
  let timeoutS = parseInt(searchTerm.split(ARGS.timeSplit)[1]);
  r.warn(`${directiveKey} input timeoutS: ${timeoutS}`);
  if (isNaN(timeoutS)) {
    timeoutS = 60;
    r.warn(`${directiveKey} handle default timeoutS: ${timeoutS}`);
  }
  if (timeoutS < 1) {
    msg += ngx.shared[ARGS.dictName].delete(directiveKey) ? "CloseSuccess" : "CloseFail";
  } else {
    const flag = util.dictAdd(ARGS.dictName, directiveKey, "1", timeoutS ? timeoutS * 1000 : -1);
    msg += ["AddFail", "NotExpire", `With60Seconds`, `With${timeoutS}Seconds`][flag + 1];
  }
  r.warn(`${directiveKey} msg: ${msg}`);
  return JSON.stringify({
    Items: [{
      Name: `${msg}`,
    }],
    TotalRecordCount: 0
  });
}

// for js_set
function getNocache(r) {
  const value = ngx.shared[ARGS.dictName].get(ARGS.nocacheKey) ?? "";
  // r.log(`getNocache: ${value}`);
  return value;
}

export default {
  ARGS,
  searchHandle,
  getNocache,
};
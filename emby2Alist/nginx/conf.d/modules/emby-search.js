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
  nocacheKey: "nocache",
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
    r.return(200, cacheHandle(r, searchTerm));
  } else {
    r.variables.request_uri += `&${util.ARGS.useProxyKey}=1`;
    return emby.internalRedirectExpect(r, r.variables.request_uri);
  }
}

function cacheHandle(r, searchTerm) {
  let msg = ARGS.nocacheKey;
  let timeoutS = parseInt(searchTerm.split(ARGS.timeSplit)[1]);
  r.warn(`cacheHandle input timeoutS: ${timeoutS}`);
  if (isNaN(timeoutS)) {
    timeoutS = 60;
    r.warn(`cacheHandle handle default timeoutS: ${timeoutS}`);
  }
  if (timeoutS < 1) {
    msg += ngx.shared[ARGS.dictName].delete(ARGS.nocacheKey) ? "CloseSuccess" : "CloseFail";
  } else {
    const flag = util.dictAdd(ARGS.dictName, ARGS.nocacheKey, "1", timeoutS ? timeoutS * 1000 : -1);
    msg += ["AddFail", "NotExpire", `With60Seconds`, `With${timeoutS}Seconds`][flag + 1];
  }
  r.warn(`cacheHandle msg: ${msg}`);
  return JSON.stringify({
    Items: [{
      Name: `${msg}`,
    }],
    TotalRecordCount: 0
  });
}

// for js_set
function getNocache(r) {
  const nocache = ngx.shared["tmpDict"].get("nocache") ?? "";
  // r.log(`getNocache: ${nocache}`);
  return nocache;
}

export default {
  ARGS,
  searchHandle,
  getNocache,
};
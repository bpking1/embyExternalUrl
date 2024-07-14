// @author: chen3861229
// @date: 2024-07-13

import config from "../constant.js";
import util from "../common/util.js";
// import events from "../common/events.js";

/**
 * fetchLastLink, actually this just once request,currently sufficient
 * @param {String} oriLink eg: "https://alist/d/file.xxx" or "http(s)://xxx"
 * @param {String} authType eg: "sign"
 * @param {String} authInfo eg: "sign:token:expireTime"
 * @param {String} ua 
 * @returns redirect after link
 */
async function fetchLastLink(oriLink, authType, authInfo, ua) {
  // this is for multiple instances alist add sign
  if (authType && authType === "sign" && authInfo) {
    const arr = authInfo.split(":");
    oriLink = util.addAlistSign(oriLink, arr[0], parseInt(arr[1]));
  }
  // this is for current alist add sign
  if (!!config.alistSignEnable) {
    oriLink = util.addAlistSign(oriLink, config.alistToken, config.alistSignExpireTime);
  }
  try {
      // fetch Api ignore nginx locations,ngx.ferch,redirects are not handled
    // const response = await util.cost(ngx.fetch, encodeURI(oriLink), {
    //   method: "HEAD",
    //   headers: {
    //     "User-Agent": ua,
    //   },
    //   max_response_body_size: 1024
    // });
    const response = await ngx.fetch(encodeURI(oriLink), {
      method: "HEAD",
      headers: {
        "User-Agent": ua,
      },
      max_response_body_size: 1024
    });
    const contentType = response.headers["Content-Type"];
    ngx.log(ngx.WARN, `fetchLastLink response.status: ${response.status}, contentType: ${contentType}`);
    // response.redirected api error return false
    if ((response.status > 300 && response.status < 309) || response.status == 403) {
      // if handle really LastLink, modify here to recursive and return link on status 200
      return response.headers["Location"];
    } else if (response.status == 200) {
      // alist 401 but return 200 status code
      if (contentType.includes("application/json")) {
        ngx.log(ngx.ERR, `fetchLastLink alist mayby return 401, check your alist sign or auth settings`);
        return;
      }
      ngx.log(ngx.ERR, `error: fetchLastLink, not expected result`);
    } else {
      ngx.log(ngx.ERR, `error: fetchLastLink: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchLastLink: ${error}`);
  }
}

function lastLinkFailback(url) {
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

// NJS log level only have: info, warn, error
// nginx log level settings emby2Alist\nginx\nginx.conf error_log  /var/log/nginx/error.log notice;

function info(message) {
  ngx.log(ngx.INFO, message);
}

function warn(message) {
  ngx.log(ngx.WARN, message);
}

function error(message) {
  ngx.log(ngx.ERR, message);
}

function log(level, message) {
  ngx.log(level, message);
}

export default {
  fetchLastLink,
  lastLinkFailback,
  info,
  warn,
  error,
  log,
};
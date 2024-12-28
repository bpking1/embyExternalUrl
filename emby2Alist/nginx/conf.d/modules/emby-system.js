// @author: chen3861229
// @date: 2024-07-13

import config from "../constant.js";
import util from "../common/util.js";
import urlUtil from "../common/url-util.js";
import events from "../common/events.js";
import emby from "../emby.js";
// import embyApi from "../api/emby-api.js";

async function systemInfoHandler(r) {
  events.njsOnExit(`systemInfoHandler: ${r.uri}`);
  
  // /emby/System/Info?api_key=xxx is important,access token(api_key) is invalid,clients redirects itself to the login page
  // r.variables.request_uri = r.variables.request_uri.replace(r.args.api_key, config.embyApiKey);
  const subR = await r.subrequest(urlUtil.proxyUri(r.uri), {
    method: r.method,
  });
  let body;
  if (subR.status === 200) {
  	body = JSON.parse(subR.responseText);
  } else {
  	r.warn(`systemInfoHandler subrequest failed, status: ${subR.status}`);
	  return emby.internalRedirect(r);
  }
  const currentPort = parseInt(r.variables.server_port);
  const originPort = parseInt(body.WebSocketPortNumber);
  body.WebSocketPortNumber = currentPort;
  if (body.HttpServerPortNumber) {
    body.HttpServerPortNumber = currentPort;
  }
  if (body.LocalAddresses) {
    body.LocalAddresses.forEach((s, i, arr) => {
      arr[i] = s.replace(originPort, currentPort);
    });
  }
  if (body.RemoteAddresses) {
    body.RemoteAddresses.forEach((s, i, arr) => {
      arr[i] = s.replace(originPort, currentPort);
    });
  }
  // old clients
  if (body.LocalAddress) {
    body.LocalAddress = body.LocalAddress.replace(originPort, currentPort);
  }
  if (body.WanAddress) {
    body.WanAddress = body.WanAddress.replace(originPort, currentPort);
  }
  util.copyHeaders(subR.headersOut, r.headersOut);
  return r.return(200, JSON.stringify(body));
}

export default {
  systemInfoHandler,
};
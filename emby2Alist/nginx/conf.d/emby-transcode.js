// @author: Chen3861229
// @date: 2024-02-07

import config from "./constant.js";
import util from "./common/util.js";
import events from "./common/events.js";
import emby from "./emby.js";
import embyApi from "./api/emby-api.js";

import qs from "querystring";

let keys = {
  idKey: "Id",
  filePathKey: "Path",
  mediaSourcesKey: "MediaSources",
}

async function transcodeBalance(r) {
  if (!checkEnable(r)) {
    return emby.internalRedirectExpect(r);
  }
  events.njsOnExit(`transcodeBalance: ${r.uri}`);

  // const routeInternalDictKey = `${r.args.MediaSourceId}:${util.getDeviceId(r.args)}`;

  // getCurrentItemInfo
  const currentItem = await getCurrentItemInfo(r);
  if (!currentItem) {
    return emby.internalRedirectExpect(r);
  }

  // swich transcode opt, skip modify
  if (r.args.StartTimeTicks === "0") {
    // routeRule
    const notLocal = util.checkIsStrmByPath(currentItem.path);
    const routeMode = util.getRouteMode(r, currentItem.path, false, notLocal);
    if (util.ROUTE_ENUM.proxy == routeMode) {
      return emby.internalRedirectExpect(r);
      // not need route, clients will self select
    // } else if (util.ROUTE_ENUM.redirect == routeMode) {
    //   // this maybe not support, because player is already init to HLS
    //   return emby.redirect2Pan(r);
    } else if (util.ROUTE_ENUM.block == routeMode) {
      return r.return(403, "blocked");
    }
  }
  
  // check transcode load
  let transServer = await getTransServer(r);
  if (!transServer) {
    return emby.internalRedirectExpect(r);
  }

  // media item match
  const targetItem = await mediaItemMatch(r, currentItem, transServer, keys);
  if (!targetItem) {
    const targetItemMatchFallback = config.transcodeConfig.targetItemMatchFallback;
    r.warn(`targetItemMatchFallback: ${targetItemMatchFallback}`);
    if (util.ROUTE_ENUM.proxy == targetItemMatchFallback) {
      return emby.internalRedirectExpect(r);
    } else {
      // util.dictAdd("routeInternalDict", routeInternalDictKey, util.ROUTE_ENUM.redirect);
      return r.return(449, "need retry playback");
      // return emby.redirect2Pan(r);
    }
  }
  const targetMediaId = targetItem.source ? targetItem.source[keys.idKey] : targetItem.item[keys.idKey];
  r.warn(`media item match success target server item id: ${targetMediaId}`);

  // build target server url
  // redirect to target server
  emby.redirect(r, buildTransServerUrl(r, transServer, targetMediaId));

  // async add cache
  util.dictAdd("transcodeDict", r.args["PlaySessionId"], JSON.stringify({
    DeviceId: r.args["DeviceId"],
    Server: transServer,
    TargetItemId: targetItem.item[keys.idKey],
    TargetItemSourceId: targetItem.source ? targetItem.source[keys.idKey] : "",
  }));
  return;
}

function checkEnable(r) {
  let flag = false;
  const transcodeConfig = config.transcodeConfig;
  if (transcodeConfig && transcodeConfig.enable 
    && transcodeConfig.type === "distributed-media-server"
    && transcodeConfig.server && transcodeConfig.server.length > 0) {
    flag = true;
  }
  return flag;
}

async function getTransServer(r) {
  const transcodeConfig = config.transcodeConfig;
  let serverArr = transcodeConfig.server;
  if (!serverArr || (!!serverArr && serverArr.length === 0)) {
    return r.warn(`no transServer, will use current server transcode`);
  }
  const maxNum = transcodeConfig.maxNum;
  let target;
  let serverTmp;
  let transSessions;
  let start = Date.now();
  for (let i = 0; i < serverArr.length; i++) {
    serverTmp = serverArr[i];
    try {
      transSessions = await embyApi.fetchSessions(serverTmp.host, serverTmp.apiKey, {IsPlaying: true});
    } catch (error) {
      r.warn(`fetchSessions: ${error}, skip this server: ${serverTmp.host}`);
      continue;
    }
    r.warn(`fetchSessions res.status: ${transSessions.status}`);
    transSessions = await transSessions.json();
    r.log(`fetchSessions res: ${JSON.stringify(transSessions)}`);
    transSessions = transSessions.filter(s => embyApi.PlayMethodEnum.Transcode == s.PlayState.PlayMethod);
    serverTmp.transcodeNum = transSessions.length;
    if (transSessions.length > maxNum) {
      r.warn(`hit maxNum, skip this server: ${serverTmp.host}`);
      continue;
    }
    target = serverTmp;
  }
  if (!target) {
    r.warn(`all server overload, will use least transcode`);
    target = serverArr.sort((a, b) => a.transcodeNum - b.transcodeNum)[0];
  }
  let end = Date.now();
  r.warn(`${end - start}ms, find target server: ${target.host}`);
  if (target.host == config.embyHost) {
    r.warn(`find target server same as currentServer`);
    return emby.internalRedirectExpect(r);
  }
  return target;
}

async function getCurrentItemInfo(r) {
  const isEmby = !!config.embyHost;
  if (!isEmby) {
    return r.error(`not supported media server type`);
  }

  let rvt = {
    notLocal: false,
    itemName: "",
    path: "",
    itemId: "",
    mediaSourceId: "",
  }
  let mediaServerRes;
  if (isEmby) {
    const itemInfo = util.getItemInfo(r);
    mediaServerRes = await util.cost(emby.fetchEmbyFilePath,
      itemInfo.itemInfoUri,
      itemInfo.itemId,
      itemInfo.Etag,
      itemInfo.mediaSourceId
    );
    r.warn(`fetchEmbyFilePath mediaServerRes: ${JSON.stringify(mediaServerRes)}`);
    if (mediaServerRes.message.startsWith("error") || !mediaServerRes.itemName || !mediaServerRes.path) {
      return r.error(mediaServerRes.message);
    }
    rvt.notLocal = mediaServerRes.notLocal;
    rvt.itemName = mediaServerRes.itemName;
    rvt.path = mediaServerRes.path;
    rvt.itemId = itemInfo.itemId;
    rvt.mediaSourceId = itemInfo.mediaSourceId;
  } else {}
  r.log(`mediaServerRes: ${JSON.stringify(mediaServerRes)}`);
  r.warn(`getCurrentItemInfo: ${JSON.stringify(rvt)}`);
  return rvt;
}

async function mediaItemMatch(r, currentItem, transServer, keys) {
  const isEmby = transServer.type == "emby" || transServer.type == "jellyfin";
  if (!isEmby) {
    return r.error(`not supported media server type`);
  }

  let targetRes;
  let targetItems;
  if (isEmby) {
    try {
      targetRes = await util.cost(embyApi.fetchItems,
        transServer.host, 
        transServer.apiKey,
        {
          SearchTerm: encodeURI(currentItem.itemName),
          Limit: 10,
          Recursive: true,
          Fields: "ProviderIds,Path,MediaSources",
        }
      );
    } catch (error) {
      return r.error(`media item match fetchItems: ${error}`);
    }
    r.warn(`media item match targetRes.status: ${targetRes.status}`);
    targetRes = await targetRes.json();
    targetItems = targetRes.Items;
  } else {
    // try {
    //   targetRes = await util.cost(embyApi.fetchItems,
    //     transServer.host, 
    //     transServer.apiKey,
    //     {
    //       SearchTerm: encodeURI(currentItem.itemName),
    //       Limit: 10,
    //       Recursive: true,
    //       Fields: "ProviderIds,Path,MediaSources",
    //     }
    //   );
    // } catch (error) {
    //   r.error(`media item match fetchItems: ${error}`);
    //   return emby.internalRedirectExpect(r);
    // }
    // targetRes = await targetRes.json();
    // targetItems = targetRes.Items;
    // keys.filePathKey = "";
    // keys.mediaSourcesKey = "";
  }

  r.warn(`media item match fetchItems: ${JSON.stringify(targetItems)}`);
  if (targetItems.length < 1) {
    return r.error(`media item match not found`);
  }

  const currentFileName = currentItem.path.split("/").pop();
  let fileNameTmp;
  let targetItem; // mutiple versions parent item
  let targetItemSource; // mutiple versions detail item
  targetItems.map(item => {
    fileNameTmp = item[keys.filePathKey].split("/").pop();
    if (fileNameTmp == currentFileName) {
      targetItem = item;
      return;
    }
    item[keys.mediaSourcesKey].map(source => {
      fileNameTmp = source[keys.filePathKey].split("/").pop();
      if (fileNameTmp == currentFileName) {
        targetItem = item;
        targetItemSource = source;
        return;
      }
    });
  });
  r.warn(`media item match targetItem: ${JSON.stringify(targetItem)}`);
  if (!targetItem || (!!targetItem && !targetItem.Id)) {
    return r.error(`media item match not found`);
  }

  return { item: targetItem, itemSource: targetItemSource, keys: keys };
}

function buildTransServerUrl(r, transServer, targetMediaId) {
  const isEmby = transServer.type == "emby" || transServer.type == "jellyfin";
  if (!isEmby) {
    return r.error(`not supported media server type`);
  }

  // let oriArgs = r.variables.args;
  r.warn(`original args: ${r.variables.args}`);
  let rArgs = r.args;
  let baseUrl;
  if (isEmby) {
    for (let k in rArgs) {
      // k == "DeviceId"
      if (k == "api_key" || k == "MediaSourceId" || k == "TranscodeReasons") {
        const newK = "ori_" + k;
        rArgs[newK] = rArgs[k];
        delete rArgs[k];
      }
    }
    if (transServer.type == "jellyfin") {
      // jellyfin, MediaSourceId, The mediaSourceId field is required
      rArgs["MediaSourceId"] = targetMediaId;
      // jellyfin, StartTimeTicks, Error processing request
      // let oriVal = rArgs["StartTimeTicks"];
      // if (oriVal) {
        // rArgs["ori_StartTimeTicks"] = oriVal;
        delete rArgs["StartTimeTicks"];
        // rArgs["runtimeTicks"] = oriVal;
      // }
    }
    rArgs["api_key"] = transServer.apiKey;
    baseUrl = `${transServer.host}/Videos/${targetMediaId}/master.m3u8`;
  } else {
    // params mapping
    // rArgs["api_key"] = transServer.apiKey;
    // baseUrl = `${transServer.host}/Videos/${targetMediaId}/master.m3u8`;
  }
  
  // important, avoid dead loops
  rArgs[util.ARGS.useProxyKey] = "1";
  let args = qs.stringify(rArgs);
  r.warn(`modify args: ${args}`);

  return `${baseUrl}?${args}`;
}

async function syncDelete(r) {
  if (!checkEnable(r)) {
    return emby.internalRedirectExpect(r);
  }
  events.njsOnExit(`syncDelete: ${r.uri}`);
  
  const uri = r.uri;
  let rArgs = r.args;
  // Not Expect, this playSessionId on switch video bitrate will always be old value
  const playSessionId = rArgs["PlaySessionId"];
  r.warn(`syncDelete transcodeDict key: ${playSessionId}`);
  const cachedStr = ngx.shared.transcodeDict.get(playSessionId);
  if (!cachedStr) {
    r.log(`syncDelete playSession not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const cacheObj = JSON.parse(cachedStr);
  if (!cacheObj) {
    r.warn(`syncDelete cacheObj not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const server = cacheObj.Server;
  if (!server || (!!server && !server.host)) {
    r.warn(`syncDelete targetServer not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  let res;
  try {
    res = await embyApi.fetchVideosActiveEncodingsDelete(server.host, server.apiKey, {
      DeviceId: cacheObj.DeviceId,
      PlaySessionId: playSessionId
    });
  } catch (error) {
    r.warn(`fetchVideosActiveEncodingsDelete: ${error}, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  if (res && res.ok) {
    r.warn(`syncDelete success: ${server.host}`);
  }
  // After redirect, a new njs VM is started in the target location, the VM in the original location is stopped
  return emby.internalRedirectExpect(r);
}

async function syncPlayState(r) {
  if (!checkEnable(r)) {
    return emby.internalRedirectExpect(r);
  }
  events.njsOnExit(`syncPlayState: ${r.uri}`);

  const uri = r.uri;
  if (!r.requestText) {
    r.warn(`syncPlayState requestText not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const reqBody = JSON.parse(r.requestText);
  // Expect, this playSessionId is always current
  const playSessionId = reqBody["PlaySessionId"];
  r.warn(`syncPlayState transcodeDict key: ${playSessionId}`);
  const cachedStr = ngx.shared.transcodeDict.get(playSessionId);
  if (!cachedStr) {
    r.log(`syncPlayState playSession not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const cacheObj = JSON.parse(cachedStr);
  if (!cacheObj) {
    r.warn(`syncPlayState cacheObj not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const server = cacheObj.Server;
  if (!server || (!!server && !server.host)) {
    r.warn(`syncPlayState targetServer not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  reqBody["ItemId"] = cacheObj.TargetItemId;
  reqBody["MediaSourceId"] = cacheObj.TargetItemSourceId;
  reqBody["PlayMethod"] = embyApi.PlayMethodEnum.Transcode;
  let rArgs = r.args;
  if (server.type == "jellyfin") {
    delete rArgs["X-Emby-Token"];
  }
  rArgs["api_key"] = server.apiKey;
  let url = `${server.host}${r.uri}?${qs.stringify(rArgs)}`;
  r.warn(`syncPlayState fetchUrl: ${url}`);
  r.warn(`syncPlayState fetchBody: ${JSON.stringify(reqBody)}`);
  ngx.fetch(url, {
    method: r.method,
    headers: {
      "User-Agent": r.headersIn["User-Agent"],
      "Content-Type": "application/json"
    },
    body: JSON.stringify(reqBody),
  }).then(res => {
    r.warn(`syncPlayState fetch res.status: ${res.status}`);
    if (res.ok || res.status === 204) {
      r.warn(`syncPlayState success: ${server.host}`);
    }
  });
  return emby.internalRedirectExpect(r);
}

export default {
  transcodeBalance,
  syncDelete,
  syncPlayState,
};

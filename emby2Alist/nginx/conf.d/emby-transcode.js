// @author: Chen3861229
// @date: 2024-02-07
import config from "./constant.js";
import util from "./common/util.js";
import emby from "./emby.js";
import embyApi from "./api/emby-api.js";

import qs from "querystring";

async function transcodeBalance(r) {
  checkEnable(r);

  const itemInfo = util.getItemInfo(r);
  const embyRes = await util.cost(fetchEmbyFilePath,
    itemInfo.itemInfoUri, 
    itemInfo.itemId, 
    itemInfo.Etag, 
    itemInfo.mediaSourceId
  );
  r.log(`embyRes: ${JSON.stringify(embyRes)}`);
  if (embyRes.message.startsWith("error") || !embyRes.itemName || !embyRes.path) {
    r.error(embyRes.message);
    return emby.internalRedirectExpect(r);
  }
  r.warn(`itemName: ${embyRes.itemName}, originalFilePath: ${embyRes.path}`);
  
  // check transcode load
  const maxNum = transcodeBalanceConfig.maxNum;
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
    transSessions = transSessions.filter(s => s.PlayState.PlayMethod == "Transcode");
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

  // media item match
  let targetRes;
  try {
    targetRes = await util.cost(embyApi.fetchItems,
      target.host, 
      target.apiKey,
      {
        NameStartsWith: encodeURI(embyRes.itemName),
        Limit: 10,
        Recursive: true,
        Fields: "ProviderIds,Path,MediaSources",
      }
    );
  } catch (error) {
    r.error(`media item match fetchItems: ${error}`);
    return emby.internalRedirectExpect(r);
  }
  r.warn(`media item match targetRes.status: ${targetRes.status}`);
  const targetBody = await targetRes.json();
  r.warn(`media item match fetchItems: ${JSON.stringify(targetBody)}`);
  const targetItems = targetBody.Items;
  if (targetItems.length < 1) {
    r.error(`media item match not found`);
    return emby.internalRedirectExpect(r);
  }
  const fileName = embyRes.path.split("/").pop();
  let fileNameTmp;
  let targetItem;
  let targetItemSource;
  targetItems.map(item => {
    fileNameTmp = item.Path.split("/").pop();
    if (fileNameTmp == fileName) {
      targetItem = item;
      return;
    }
    item.MediaSources.map(source => {
      fileNameTmp = source.Path.split("/").pop();
      if (fileNameTmp == fileName) {
        targetItem = item;
        targetItemSource = source;
        return;
      }
    });
  });
  r.warn(`media item match targetItem: ${JSON.stringify(targetItem)}`);
  if (!targetItem || (!!targetItem && !targetItem.Id)) {
    r.error(`media item match not found`);
    return emby.internalRedirectExpect(r);
  }
  const targetMediaId = targetItemSource ? targetItemSource.Id : targetItem.Id;
  r.warn(`media item match success target server item id: ${targetMediaId}`);

  // build target server url
  // let oriArgs = r.variables.args;
  r.warn(`original args: ${r.variables.args}`);
  let rArgs = r.args;
  if (target.type == "emby" || target.type == "jellyfin") {
    for (let k in rArgs) {
      // k == "DeviceId"
      if (k == "api_key" || k == "MediaSourceId" || k == "TranscodeReasons") {
        const newK = "ori_" + k;
        rArgs[newK] = rArgs[k];
        delete rArgs[k];
      }
    }
    if (target.type == "jellyfin") {
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
  }
  // important, avoid dead loops
  rArgs["skipDirect"] = "1";
  let args = qs.stringify(rArgs);
  r.warn(`modify args: ${args}`);

  const targetUrl = `${target.host}/Videos/${targetMediaId}/master.m3u8?${args}&api_key=${target.apiKey}`;

  // redirect to target server
  emby.redirect(r, targetUrl);

  // async add cache
  util.dictAdd("transcodeDict", rArgs["PlaySessionId"], JSON.stringify({
    DeviceId: rArgs["DeviceId"],
    Server: target,
    TargetItemId: targetItem.Id,
    TargetItemSourceId: targetItemSource ? targetItemSource.Id : "",
  }));
  return;
}

async function syncDelete(r) {
  checkEnable(r);
  
  const uri = r.uri;
  // let rArgs = util.capitalizeKeys(r.args);
  let rArgs = r.args;
  const playSessionId = rArgs["PlaySessionId"];
  r.warn(`syncDelete transcodeDict key: ${playSessionId}`);
  const cachedStr = ngx.shared.transcodeDict.get(playSessionId);
  if (!cachedStr) {
    r.warn(`syncDelete playSession not exist, skip, ${uri}`);
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
  checkEnable(r);

  const uri = r.uri;
  if (!r.requestText) {
    r.warn(`syncPlayState requestText not exist, skip, ${uri}`);
    return emby.internalRedirectExpect(r);
  }
  const reqBody = JSON.parse(r.requestText);
  const playSessionId = reqBody["PlaySessionId"];
  r.warn(`syncPlayState transcodeDict key: ${playSessionId}`);
  const cachedStr = ngx.shared.transcodeDict.get(playSessionId);
  if (!cachedStr) {
    r.warn(`syncPlayState playSession not exist, skip, ${uri}`);
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

function checkEnable(r) {
  const transcodeBalanceConfig = config.transcodeBalanceConfig;
  if (!!transcodeBalanceConfig && transcodeBalanceConfig.enable) {
    return emby.internalRedirectExpect(r);
  }
  let serverArr = transcodeBalanceConfig.server;
  if (transcodeBalanceConfig.type != "distributed-media-server" 
    || !serverArr || (!!serverArr && serverArr.length < 1)) {
    // r.error(`transcodeBalanceConfig type not excepted`);
    return emby.internalRedirectExpect(r);
  }
}

export default {
  transcodeBalance,
  syncDelete,
  syncPlayState,
};

//author: @bpking  https://github.com/bpking1/embyExternalUrl
//查看日志: "docker logs -f -n 10 emby-nginx 2>&1  | grep js:"
import config from "./constant.js";
import util from "./util.js";

async function redirect2Pan(r) {
  const embyMountPathArr = config.embyMountPathArr;
  const embyPathMapping = config.embyPathMapping;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const localAlistResPrefix = config.localAlistResPrefix;
  // fetch mount emby/jellyfin file path
  const itemInfo = util.getItemInfo(r);
  r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
  let start = Date.now();
  const embyRes = await fetchEmbyFilePath(
    itemInfo.itemInfoUri, 
    itemInfo.itemId, 
    itemInfo.Etag, 
    itemInfo.mediaSourceId
  );
  let end = Date.now();
  r.log(`embyRes: ${JSON.stringify(embyRes)}`);
  if (embyRes.message.startsWith("error")) {
    r.error(embyRes.message);
    return r.return(500, embyRes.message);
  }
  r.warn(`${end - start}ms, mount emby file path: ${embyRes.path}`);

  if (util.isDisableRedirect(r, embyRes)) {
    r.warn(`isDisableRedirect`);
    // use original link
    return internalRedirect(r);
  }

  // file path mapping
  r.warn(`embyPathMapping: ${JSON.stringify(embyPathMapping)}`);
  embyMountPathArr.map(o => {
    embyPathMapping.unshift([o, ""]);
  });
  let alistFilePath = embyRes.path;
  embyPathMapping.map(arr => {
    alistFilePath = alistFilePath.replace(arr[0], arr[1]);
  });
  r.warn(`mapped emby file path: ${alistFilePath}`);

  // strm file inner remote link direct,like: http,rtsp
  if (embyRes.isRemoteStrm) {
    r.warn(`!!!warnning remote strm file protocol: ${embyRes.protocol}`);
    return redirect302(r, alistFilePath);
  }

  // fetch alist direct link
  start = Date.now();
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  let alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken
  );
  end = Date.now();
  r.warn(`${end - start}ms, fetchAlistPathApi`);
  if (!alistRes.startsWith("error")) {
    // fixLocalAlistResPortMiss
    alistRes = alistRes.includes(localAlistResPrefix)
      ? alistRes.replace(localAlistResPrefix, alistAddr)
      : alistRes;
    // 使用AList直链播放挂载的NAS本地视频时,可能存在卡顿与花屏
    if (alistRes.startsWith(localAlistResPrefix)) {
      // use original link
      return internalRedirect(r);
    }
    return redirect302(r, alistRes);
  }
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    return r.return(403, alistRes);
  }
  if (alistRes.startsWith("error500")) {
    const filePath = alistFilePath.substring(alistFilePath.indexOf("/", 1));
    const alistFsListApiPath = `${alistAddr}/api/fs/list`;
    const foldersRes = await fetchAlistPathApi(
      alistFsListApiPath,
      "/",
      alistToken
    );
    if (foldersRes.startsWith("error")) {
      r.error(foldersRes);
      return r.return(500, foldersRes);
    }
    const folders = foldersRes.split(",").sort();
    for (let i = 0; i < folders.length; i++) {
      r.warn(`try to fetch alist path from /${folders[i]}${filePath}`);
      let driverRes = await fetchAlistPathApi(
        alistFsGetApiPath,
        `/${folders[i]}${filePath}`,
        alistToken
      );
      if (!driverRes.startsWith("error")) {
        driverRes = driverRes.includes(localAlistResPrefix)
          ? driverRes.replace(localAlistResPrefix, config.alistPublicAddr)
          : driverRes;
        return redirect302(r, driverRes);
      }
    }
    r.warn(`fail to fetch alist resource: not found`);
    return r.return(404);
  }
  r.error(alistRes);
  return r.return(500, alistRes);
}

// 拦截 PlaybackInfo 请求，防止客户端转码（转容器）
async function transferPlaybackInfo(r) {
  // replay the request
  const proxyUri = util.proxyUri(r.uri);
  r.warn(`playbackinfo proxy uri: ${proxyUri}`);
  const query = util.generateUrl(r, "", "").substring(1);
  r.warn(`playbackinfo proxy query string: ${query}`);
  const response = await r.subrequest(proxyUri, {
    method: r.method,
    args: query
  });
  const body = JSON.parse(response.responseText);
  if (
    response.status === 200 &&
    body.MediaSources &&
    body.MediaSources.length > 0
  ) {
    r.log(`main request headersOut: ${JSON.stringify(r.headersOut)}`);
    r.log(`subrequest headersOut: ${JSON.stringify(response.headersOut)}`);
    r.warn(`origin playbackinfo: ${response.responseText}`);
    for (let i = 0; i < body.MediaSources.length; i++) {
      const source = body.MediaSources[i];
      // if (source.IsRemote) {
      //   // live streams are not blocked
      //   // return r.return(200, response.responseText);
      // }
      r.warn(`modify direct play info`);
      source.SupportsDirectPlay = true;
      source.SupportsDirectStream = true;
      source.OriginDirectStreamUrl = source.DirectStreamUrl; // for debug
      source.DirectStreamUrl = util.addDefaultApiKey(
        r,
        util
          .generateUrl(r, "", r.uri, true)
          .replace("/emby/Items", "/videos")
          .replace("PlaybackInfo", `stream.${source.Container}`)
      );
      source.DirectStreamUrl = util.appendUrlArg(
        source.DirectStreamUrl,
        "MediaSourceId",
        source.Id
      );
      source.DirectStreamUrl = util.appendUrlArg(
        source.DirectStreamUrl,
        "Static",
        "true"
      );
      r.warn(`remove transcode config`);
      source.SupportsTranscoding = false;
      if (source.TranscodingUrl) {
        delete source.TranscodingUrl;
        delete source.TranscodingSubProtocol;
        delete source.TranscodingContainer;
      }
    }
    for (const key in response.headersOut) {
      if (key === "Content-Length") {
        // auto generate content length
        continue;
      }
      r.headersOut[key] = response.headersOut[key];
    }
    const bodyJson = JSON.stringify(body);
    r.headersOut["Content-Type"] = "application/json;charset=utf-8";
    r.warn(`transfer playbackinfo: ${bodyJson}`);
    return r.return(200, bodyJson);
  }
  r.warn("playbackinfo subrequest failed");
  return internalRedirect(r);
}

async function fetchAlistPathApi(alistApiPath, alistFilePath, alistToken) {
  const alistRequestBody = {
    path: alistFilePath,
    password: "",
  };
  try {
    const response = await ngx.fetch(alistApiPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: alistToken,
      },
      max_response_body_size: 65535,
      body: JSON.stringify(alistRequestBody),
    });
    if (response.ok) {
      const result = await response.json();
      if (result === null || result === undefined) {
        return `error: alist_path_api response is null`;
      }
      if (result.message == "success") {
        if (result.data.raw_url) {
          return result.data.raw_url;
        }
        return result.data.content.map((item) => item.name).join(",");
      }
      if (result.code == 403) {
        return `error403: alist_path_api ${result.message}`;
      }
      return `error500: alist_path_api ${result.code} ${result.message}`;
    } else {
      return `error: alist_path_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: alist_path_api fetchAlistFiled ${error}`;
  }
}

async function fetchEmbyFilePath(itemInfoUri, itemId, Etag, mediaSourceId) {
  let rvt = {
    "message": "success",
    "protocol": "File", // MediaSourceInfo{ Protocol }, string ($enum)(File, Http, Rtmp, Rtsp, Udp, Rtp, Ftp, Mms)
    "path": "",
    "isRemoteStrm": false,
  };
  try {
    const res = await ngx.fetch(itemInfoUri, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Content-Length": 0,
      },
      max_response_body_size: 8388608, // 1MB
    });
    if (res.ok) {
      const result = await res.json();
      if (result === null || result === undefined) {
        rvt.message = `error: emby_api itemInfoUri response is null`;
        return rvt;
      }
      if (itemInfoUri.includes("JobItems")) {
        const jobItem = result.Items.find(o => o.Id == itemId);
        if (jobItem) {
          rvt.protocol = jobItem.MediaSource.Protocol;
          rvt.path = jobItem.MediaSource.Path;
        } else {
          rvt.message = `error: emby_api /Sync/JobItems response is null`;
          return rvt;
        }
      } else {
        const item = result.Items[0];
        if (!item) {
          rvt.message = `error: emby_api /Items response is null`;
          return rvt;
        }
        if (item.MediaSources) {
          let mediaSource = item.MediaSources[0];
          // ETag only on Jellyfin
          if (Etag) {
            mediaSource = item.MediaSources.find((m) => m.ETag == Etag);
          }
          // item.MediaSources on Emby has one, on Jellyfin has many!
          if (mediaSourceId) {
            mediaSource = item.MediaSources.find((m) => m.Id == mediaSourceId);
          }
          rvt.protocol = mediaSource.Protocol;
          rvt.path = mediaSource.Path;
          rvt.isRemoteStrm = "File" != rvt.protocol && item.Path.toLowerCase().endsWith(".strm");
          // remote strm file internal text need encodeURI
          if (rvt.isRemoteStrm) {
            rvt.path = encodeURI(decodeURI(rvt.path));
          }
        } else {
          // "MediaType": "Photo"... not have "MediaSources" field
          rvt.path = item.Path;
        }
      }
      return rvt;
    } else {
      rvt.message = `error: emby_api ${res.status} ${res.statusText}`;
      return rvt;
    }
  } catch (error) {
    rvt.message = `error: emby_api fetch mediaItemInfo failed, ${error}`;
    return rvt;
  }
}

async function fetchEmbyNotificationsAdmin(description) {
  let body = config.embyNotificationsAdmin;
  delete body.Enable;
  body.Description = description;
  try {
    await ngx.fetch(`${config.embyHost}/Notifications/Admin?api_key=${config.embyApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    rvt.message = `error: emby_api fetchEmbyNotificationsAdmin failed, ${error}`;
  }
}

function redirect302(r, uri) {
  r.warn(`redirect to: ${uri}`);
  // need caller: return;
  r.return(302, uri);
  if (config.embyNotificationsAdmin.Enable) {
    fetchEmbyNotificationsAdmin(`original link: ${r.uri}\nredirect to: ${uri}`);
  }
}

function internalRedirect(r) {
  r.warn(`use original link`);
  // need caller: return;
  r.internalRedirect(util.proxyUri(r.uri));
  if (config.embyNotificationsAdmin.Enable) {
    fetchEmbyNotificationsAdmin(`use original link: ${r.uri}`);
  }
}

export default { redirect2Pan, fetchEmbyFilePath, transferPlaybackInfo, redirect302, internalRedirect };

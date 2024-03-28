// author: @bpking  https://github.com/bpking1/embyExternalUrl
// 查看日志: "docker logs -f -n 10 emby-nginx 2>&1  | grep js:"
// 正常情况下此文件所有内容不需要更改
import config from "./constant.js";
import util from "./util.js";

async function redirect2Pan(r) {
  let embyPathMapping = config.embyPathMapping;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;

  let embyRes = {
    path: r.args[util.args.filePathKey],
    isStrm: r.args[util.args.isStrmKey],
    isRemote: r.args[util.args.isRemoteKey]
  };
  let start = Date.now();
  let end = Date.now();
  if (!embyRes.path) {
    // fetch mount emby/jellyfin file path
    const itemInfo = util.getItemInfo(r);
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
    start = Date.now();
    embyRes = await fetchEmbyFilePath(
      itemInfo.itemInfoUri, 
      itemInfo.itemId, 
      itemInfo.Etag, 
      itemInfo.mediaSourceId
    );
    end = Date.now();
    r.log(`embyRes: ${JSON.stringify(embyRes)}`);
    if (embyRes.message.startsWith("error")) {
      r.error(embyRes.message);
      return r.return(500, embyRes.message);
    }
  }
  // strm file internal text maybe encode
  if (embyRes.isStrm) {
      embyRes.path = decodeURIComponent(embyRes.path);
  }
  r.warn(`${end - start}ms, mount emby file path: ${embyRes.path}`);

  if (!embyRes.isStrm && util.isDisableRedirect(embyRes.path)) {
    r.warn(`embyRes hit isDisableRedirect`);
    // use original link
    return internalRedirect(r);
  }

  // file path mapping
  r.warn(`embyPathMapping: ${JSON.stringify(embyPathMapping)}`);
  config.embyMountPath.map(s => {
    embyPathMapping.unshift([s, ""]);
  });
  let embyItemPath = embyRes.path;
  embyPathMapping.map(arr => {
    embyItemPath = embyItemPath.replace(arr[0], arr[1]);
  });
  const alistFilePath = embyItemPath;
  r.warn(`mapped emby file path: ${alistFilePath}`);

  // strm file inner remote link redirect,like: http,rtsp
  if (embyRes.isRemote) {
    r.warn(`!!!warnning remote strm file`);
    return redirect(r, encodeURI(decodeURI(alistFilePath)));
  }

  // fetch alist direct link
  start = Date.now();
  const ua = r.headersIn["User-Agent"];
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  const alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken,
    ua,
  );
  end = Date.now();
  r.warn(`${end - start}ms, fetchAlistPathApi, UA: ${ua}`);
  if (!alistRes.startsWith("error")) {
    if (util.isDisableRedirect(alistRes, true)) {
      r.warn(`alistRes hit isDisableRedirect`);
      // use original link
      return internalRedirect(r);
    }
    return redirect(r, alistRes);
  }
  r.warn(`alistRes: ${alistRes}`);
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    return r.return(403, alistRes);
  }
  if (alistRes.startsWith("error500")) {
    r.warn(`will req alist /api/fs/list to rerty`);
    // const filePath = alistFilePath.substring(alistFilePath.indexOf("/", 1));
    const filePath = alistFilePath;
    const alistFsListApiPath = `${alistAddr}/api/fs/list`;
    const foldersRes = await fetchAlistPathApi(
      alistFsListApiPath,
      "/",
      alistToken,
      ua,
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
        alistToken,
        ua,
      );
      if (!driverRes.startsWith("error")) {
        driverRes = driverRes.includes("http://172.17.0.1")
          ? driverRes.replace("http://172.17.0.1", config.alistPublicAddr)
          : driverRes;
        return redirect(r, driverRes);
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
          .generateUrl(r, "", r.uri)
          .replace("/emby/Items", "/videos")
          // origin link: /emby/videos/401929/stream.xxx?xxx
          // modify link: /emby/videos/401929/stream/xxx.xxx?xxx
          .replace("PlaybackInfo", `stream/${source.Name}.${source.Container}`)
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
      // addFilePath and strmInfo cache to clients
      source.DirectStreamUrl = util.appendUrlArg(
        source.DirectStreamUrl,
        util.filePathKey,
        source.Path
      );
      source.DirectStreamUrl = util.appendUrlArg(
        source.DirectStreamUrl,
        "isStrm",
        util.checkIsStrmByLength(source.Protocol, source.MediaStreams.length)
      );
      source.DirectStreamUrl = util.appendUrlArg(
        source.DirectStreamUrl,
        "isRemote",
        source.IsRemote
      );
      // a few players not support special character
      source.DirectStreamUrl = encodeURI(source.DirectStreamUrl);
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

async function fetchAlistPathApi(alistApiPath, alistFilePath, alistToken, ua) {
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
        "User-Agent": ua,
      },
      max_response_body_size: 65535,
      body: JSON.stringify(alistRequestBody),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result) {
        return `error: alist_path_api response is null`;
      }
      if (result.message == "success") {
        // alist /api/fs/get
        if (result.data.raw_url) {
          return handleAlistRawUrl(result, alistFilePath);
        }
        // alist /api/fs/list
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

function handleAlistRawUrl(alistRes, alistFilePath) {
  let rawUrl = alistRes.data.raw_url;
  const alistSign = alistRes.data.sign;
  const cilentSelfAlistRule = config.cilentSelfAlistRule;
  if (cilentSelfAlistRule.length > 0) {
    cilentSelfAlistRule.some(rule => {
      if (util.strMatches(rule[0], rawUrl, rule[1])) {
        rawUrl = `${rule[2]}/d${encodeURI(alistFilePath)}${!alistSign ? "" : `?sign=${alistSign}`}`;
        return true;
      }
    });
  }
  return rawUrl;
}

async function fetchEmbyFilePath(itemInfoUri, itemId, Etag, mediaSourceId) {
  let rvt = {
    message: "success",
    path: "",
    isStrm: false,
    isRemote: false,
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
      if (!result) {
        rvt.message = `error: emby_api itemInfoUri response is null`;
        return rvt;
      }
      if (itemInfoUri.includes("JobItems")) {
        const jobItem = result.Items.find(o => o.Id == itemId);
        if (jobItem) {
          rvt.path = jobItem.MediaSource.Path;
          rvt.isStrm = util.checkIsStrmByPath(jobItem.OutputPath);
          rvt.isRemote = jobItem.MediaSource.IsRemote;
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
          rvt.path = mediaSource.Path;
          rvt.isStrm = util.checkIsStrmByPath(item.Path);
          rvt.isRemote = mediaSource.IsRemote;
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
  const body = {
    Name: config.embyNotificationsAdmin.name,
    Description: description
  }
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

async function itemsFilter(r) {
  r.variables.request_uri += "&Fields=Path";
  const subR = await r.subrequest(util.proxyUri(r.uri));
  let body;
  if (subR.status === 200) {
  	body = JSON.parse(subR.responseText);
  } else {
  	r.warn("itemsFilter subrequest failed");
	  return internalRedirect(r);
  }
  let totalRecordCount = body.Items.length;
  r.warn(`itemsFilter before: ${totalRecordCount}`);

  const flag = r.variables.flag;
  r.warn(`itemsFilter flag: ${flag}`);
  let mainItemPath;
  if (flag == "itemsFilter2") {
    // fetch mount emby/jellyfin file path
    const itemInfo = util.getItemInfo(r);
    r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
    const start = Date.now();
    const embyRes = await fetchEmbyFilePath(
      itemInfo.itemInfoUri, 
      itemInfo.itemId, 
      itemInfo.Etag, 
      itemInfo.mediaSourceId
    );
    mainItemPath = embyRes.path;
    const end = Date.now();
    r.warn(`${end - start}ms, mainItemPath: ${mainItemPath}`);
  }

  const itemHiddenRule = config.itemHiddenRule;
  if (!!body.Items && itemHiddenRule.length > 0) {
    body.Items = body.Items.filter(item => {
      if (!item.Path) {
        return true;
      }
      return !itemHiddenRule.some(rule => {
        if ((!rule[2] || rule[2] == 0) && !!mainItemPath 
          && util.strMatches(rule[0], mainItemPath, rule[1])) {
          return false;
        }
        if (util.strMatches(rule[0], item.Path, rule[1])) {
          r.warn(`itemPath hit itemHiddenRule: ${item.Path}`);
          return true;
        }
      });
    });
  }
  totalRecordCount = body.Items.length;
  r.warn(`itemsFilter after: ${totalRecordCount}`);
  body.TotalRecordCount = totalRecordCount;
  for (const key in subR.headersOut) {
	  if (key === "Content-Length") {
	    // auto generate content length
	    continue;
	  }
	  r.headersOut[key] = subR.headersOut[key];
	}
  return r.return(200, JSON.stringify(body));
}

function redirect(r, uri) {
  r.warn(`redirect to: ${uri}`);
  // need caller: return;
  r.return(302, uri);
  if (config.embyNotificationsAdmin.enable) {
    fetchEmbyNotificationsAdmin(
      config.embyNotificationsAdmin.includeUrl ? 
      `original link: ${r.uri}\nredirect to: ${uri}` :
      `redirect success`
    );
  }
}

function internalRedirect(r, uri) {
  if (!uri) {
    uri = "@root";
    r.warn(`use original link`);
  }
  r.log(`internalRedirect to: ${uri}`);
  // need caller: return;
  r.internalRedirect(uri);
  if (config.embyNotificationsAdmin.enable) {
    fetchEmbyNotificationsAdmin(
      config.embyNotificationsAdmin.includeUrl ? 
      `use original link: ${r.uri}` :
      `use original link success`
    );
  }
}

export default { redirect2Pan, fetchEmbyFilePath, transferPlaybackInfo, itemsFilter, redirect, internalRedirect };

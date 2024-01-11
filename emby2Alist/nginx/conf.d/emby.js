//author: @bpking  https://github.com/bpking1/embyExternalUrl
//查看日志: "docker logs -f -n 10 emby-nginx 2>&1  | grep js:"
import config from "./constant.js";
import util from "./util.js";

async function redirect2Pan(r) {
  const embyMountPath = config.embyMountPath;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const alistPublicAddr = config.alistPublicAddr;
  const alistIp = config.alistIp;
  const publicDomain = config.publicDomain;
  const changeAlistToEmby = config.changeAlistToEmby;
  const fixRclonePath = config.fixRclonePath;

  //fetch mount emby/jellyfin file path
  const itemInfo = util.getItemInfo(r);
  r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
  const embyRes = await fetchEmbyFilePath(itemInfo.itemInfoUri, itemInfo.itemId, itemInfo.Etag, itemInfo.mediaSourceId);

  if (embyRes.message.startsWith("error")) {
    r.error(embyRes.message);
    r.return(500, embyRes.message);
    return;
  }
  r.warn(`mount emby file path: ${embyRes.path}`);

  // remote strm file direct
  r.warn(`check emby file protocol: ${embyRes.protocol}`);
  // 首先检查是否允许重定向远程 strm 文件
  if (config.allowRemoteStrmRedirect) {
    // 只有当协议不是"File"并且存在路径时，执行重定向
    if ("File" != embyRes.protocol && embyRes.path) {
      r.warn(`!!!warning remote strm file redirect to: ${embyRes.path}`);
      r.return(302, embyRes.path);
      return;
    }
  } else {
    // 如果不允许重定向，则检查协议和路径
    if ("File" != embyRes.protocol && embyRes.path) {
      r.warn(`mount emby file protocol: ${embyRes.protocol}`);
      // 使用原始链接
      r.warn(`!!!warning remote strm file use original link: ${util.getEmbyOriginRequestUrl(r)}`);
      r.return(302, util.getEmbyOriginRequestUrl(r));
      return;
    }
  }
 
  // 检查文件路径是否应该被忽略
  // 或者是否包含特殊字符，该字符会被rclone转义，导致无法通过Emby路径匹配到alist中的文件
  const shouldRedirect = config.ignorePath.some(path => embyRes.path.startsWith(path)) || 
  (fixRclonePath && (embyRes.path.includes("：") || embyRes.path.includes("？") || embyRes.path.includes("！ ")));
  // 如果需要重定向，则返回原始Emby链接
  if (shouldRedirect) {
    const embyOriginRequestUrl = util.getEmbyOriginRequestUrl(r);
    const warningMessage = `!!!warning: Redirecting to original Emby link due to ignored path or invalid characters in path, redirect to: ${embyOriginRequestUrl}`;
    r.warn(warningMessage);
    r.return(302, embyOriginRequestUrl);
    return;
  }

  //fetch alist direct link
  const alistFilePath = embyRes.path.replace(embyMountPath, "");
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  r.warn(`alist path: ${alistFilePath}`);
  let alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken
  );
  // alistRes为文件直链
  if (!alistRes.startsWith("error")) {
    alistRes = alistRes.includes(alistIp)
      ? alistRes.replace(alistIp, alistPublicAddr)
      : alistRes;
    if (changeAlistToEmby && (alistRes.startsWith(alistIp) || alistRes.startsWith(publicDomain))) {
      // if "changeAlistToEmbyu" is True, change alist url to original emby stream link
      alistRes = util.getEmbyOriginRequestUrl(r);
    }
    
    r.warn(`redirect to: ${alistRes}`);
    r.return(302, alistRes);
    return;
  }

  // error403: alist auth failed
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    r.return(403, alistRes);
    return;
  }

  // error500: 遍历alist目录查找资源
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
      r.return(500, foldersRes);
      return;
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
        driverRes = driverRes.includes(alistIp)
          ? driverRes.replace(alistIp, alistPublicAddr)
          : driverRes;
        r.warn(`redirect to: ${driverRes}`);
        r.return(302, driverRes);
        return;
      }
    }
    r.warn(`fail to fetch alist resource: not found`);
    return r.return(404);
  }
  r.error(alistRes);
  r.return(500, alistRes);
  return;
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
    r.warn(`origin playbackinfo: ${response.responseText}`);
    for (let i = 0; i < body.MediaSources.length; i++) {
      const source = body.MediaSources[i];
      if (source.IsRemote) {
        // live streams are not blocked
        return r.return(200, response.responseText);
      }
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
  return r.return(302, util.getEmbyOriginRequestUrl(r));
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
    "path": ""
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
          // strm file internal text maybe have URIEncode
          if (item.Path.toLowerCase().endsWith(".strm")) {
            rvt.path = decodeURI(rvt.path);
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

export default { redirect2Pan, fetchEmbyFilePath, transferPlaybackInfo };

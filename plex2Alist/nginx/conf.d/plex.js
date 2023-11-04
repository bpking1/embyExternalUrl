//author: @bpking  https://github.com/bpking1/embyExternalUrl
//查看日志: "docker logs -f -n 10 plex-nginx 2>&1  | grep js:"
import config from "./constant.js";
import util from "./util.js";

async function redirect2Pan(r) {
  const plexMountPath = config.plexMountPath;
  const alistToken = config.alistToken;
  const alistAddr = config.alistAddr;
  const alistPublicAddr = config.alistPublicAddr;
  const alistIp = config.alistIp;
  const publicDomain = config.publicDomain;
  const changeAlistToMediaServer = config.changeAlistToMediaServer;
  //fetch mount plex file path
  let itemInfo = await util.getPlexItemInfo(r);
  r.warn(`itemInfoUri: ${itemInfo.itemInfoUri}`);
  let mediaServerRes = await fetchPlexFilePath(itemInfo.itemInfoUri, itemInfo.mediaIndex, itemInfo.partIndex);
  if (mediaServerRes.message.startsWith("error")) {
    r.error(mediaServerRes.message);
    r.return(500, mediaServerRes.message);
    return;
  }
  r.warn(`mount media_server file path: ${mediaServerRes.path}`);

  //fetch alist direct link
  const alistFilePath = mediaServerRes.path.replace(plexMountPath, "");
  const alistFsGetApiPath = `${alistAddr}/api/fs/get`;
  let alistRes = await fetchAlistPathApi(
    alistFsGetApiPath,
    alistFilePath,
    alistToken
  );
  if (!alistRes.startsWith("error")) {
    alistRes = alistRes.includes(alistIp)
      ? alistRes.replace(alistIp, alistPublicAddr)
      : alistRes;
    if (changeAlistToMediaServer && (alistRes.startsWith(alistIp) || alistRes.startsWith(publicDomain))) {
      // use original link
      alistRes = util.getPlexOriginRequestUrl(r);
    }
    r.return(302, alistRes);
    return;
  }
  if (alistRes.startsWith("error403")) {
    r.error(alistRes);
    r.return(403, alistRes);
    return;
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

// copy from emby2Alist/nginx/conf.d/emby.js
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

async function fetchPlexFilePath(itemInfoUri, mediaIndex, partIndex) {
  let rvt = {
    "message": "success",
    "path": ""
  };
  try {
    const res = await ngx.fetch(itemInfoUri, {
      method: "GET",
      headers: {
      	"Accept": "application/json", // only plex need this
        "Content-Type": "application/json;charset=utf-8",
        "Content-Length": 0,
      },
      max_response_body_size: 65535
    });
    if (res.ok) {
      const result = await res.json();
      if (result === null || result === undefined) {
        rvt.message = `error: plex_api itemInfoUri response is null`;
        return rvt;
      }
      // TODO: need fix, multi version video search keyword is too precise
      // location ~* /library/parts/(\d+)/(\d+)/file, not hava mediaIndex and partIndex
      mediaIndex = mediaIndex ? mediaIndex : 0;
      partIndex = partIndex ? partIndex : 0;
      rvt.path = result.MediaContainer.Metadata[0].Media[mediaIndex].Part[partIndex].file;
      return rvt;
    } else {
      rvt.message = `error: plex_api ${res.status} ${res.statusText}`;
      return rvt;
    }
  } catch (error) {
    rvt.message = `error: plex_api fetch mediaItemInfo failed, ${error}`;
    return rvt;
  }
}

export default { redirect2Pan, fetchPlexFilePath };

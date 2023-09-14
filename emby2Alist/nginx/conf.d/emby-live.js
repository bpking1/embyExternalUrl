// @author: Ambitious
// @date: 2023-09-04
import config from "./constant.js";
import Emby from "./emby.js";

async function directLive(r) {
  const embyHost = config.embyHost;
  const embyApiKey = config.embyApiKey;
  // 1 get the ItemId
  const regex = /[A-Za-z0-9]+/g;
  const itemId = r.uri.replace("emby", "").replace(/-/g, "").match(regex)[1];
  // 2 get Item's PlayBackInfo
  // 3 get the live-tv direct m3u8 url
  const Etag = r.args.Tag;
  let api_key = r.args["X-Emby-Token"]
    ? r.args["X-Emby-Token"]
    : r.args.api_key;
  api_key = api_key ? api_key : embyApiKey;
  const itemInfoUri = `${embyHost}/Items/${itemId}/PlaybackInfo?api_key=${api_key}&AutoOpenLiveStream=true`;
  r.warn(`itemInfoUri: ${itemInfoUri}`);
  const embyRes = await Emby.fetchEmbyFilePath(itemInfoUri, Etag);
  if (embyRes.startsWith("error")) {
    r.error(embyRes);
    redirect2Origin(r, embyHost);
    return;
  }
  if (!checkLive(embyRes)) {
    const host = r.headersIn['Host'];
    const uri = r.uri.replace("master.m3u8", "stream.mp4");
    const url = generateUrl(r, host, uri);
    r.warn(`stream url: ${url}`);
    const panUrl = await attemptPanUrl(url);
    if (panUrl) {
      r.warn(`pan url: ${panUrl}`);
      return r.return(302, panUrl);
    }
    return r.return(302, url);
  }
  r.warn(`mount emby file path: ${embyRes}`);
  // 5 execute redirect
  r.return(302, embyRes);
}

// 尝试请求 stream 流，看请求结果是否是网盘直链重定向地址
async function attemptPanUrl(streamUrl) {
  const response = await ngx.fetch(streamUrl, {
    method: "GET"
  });
  if (response && response.headers["Location"] && response.status === 302) {
    return response.headers["Location"];
  }
  return null;
}

// 检查获取的链接是否是直播源，而非本地的资源路径
function checkLive(url) {
  if (!url || url === "") {
    return false;
  }
  const regex = /^([^:/?#]+):/;
  const match = url.match(regex);
  if (!match) {
    return false;
  }
  const protocol = match[1].toLowerCase();
  const valids = ["http", "https", "hls", "rtsp", "rtmp"];
  return valids.findIndex((v) => v === protocol) !== -1;
}

function redirect2Origin(r, embyHost) {
  const url = generateUrl(r, embyHost, r.uri);
  r.return(302, url);
}

function generateUrl(r, host, uri) {
  let url = "http://" + host + uri;
  let isFirst = true;
  for (const key in r.args) {
    url += isFirst ? "?" : "&";
    url += `${key}=${r.args[key]}`;
    isFirst = false;
  }
  return url;
}

export default { directLive };

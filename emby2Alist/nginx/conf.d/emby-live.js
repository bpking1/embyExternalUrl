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
  r.warn(`mount emby file path: ${embyRes}`);
  // 4 execute redirect
  if (!checkM3U8(embyRes)) {
    redirect2Origin(r, embyHost);
    return;
  }
  r.return(302, embyRes);
}

function checkM3U8(url) {
  if (!url || url === "") {
    return false;
  }
  return url.includes("m3u");
}

function redirect2Origin(r, embyHost) {
  let url = embyHost + r.uri;
  let isFirst = true;
  for (const key in r.args) {
    url += isFirst ? "?" : "&";
    url += `${key}=${r.args[key]}`;
    isFirst = false;
  }
  r.return(302, url);
}

export default { directLive };

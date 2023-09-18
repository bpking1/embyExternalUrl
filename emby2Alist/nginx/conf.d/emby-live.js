// @author: Ambitious
// @date: 2023-09-04
import config from "./constant.js";
import util from "./util.js";
import Emby from "./emby.js";

async function directLive(r) {
  const embyHost = config.embyHost;
  const itemInfo = util.getItemInfo(r);
  // 1 get the ItemId
  const itemId = itemInfo.itemId;
  // 2 get Item's PlayBackInfo
  // 3 get the live-tv direct m3u8 url
  const itemInfoUri = `${embyHost}/Items/${itemId}/PlaybackInfo?api_key=${itemInfo.api_key}&AutoOpenLiveStream=true`;
  r.warn(`itemInfoUri: ${itemInfoUri}`);
  const embyRes = await Emby.fetchEmbyFilePath(itemInfoUri, itemInfo.Etag);
  if (embyRes.startsWith("error")) {
    r.error(embyRes);
    redirect2Origin(r);
    return;
  }
  if (!checkLive(embyRes)) {
    return Emby.redirect2Pan(r);
  }
  r.warn(`mount emby file path: ${embyRes}`);
  // 5 execute redirect
  r.return(302, embyRes);
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

function redirect2Origin(r) {
  const url = util.getEmbyOriginRequestUrl(r);
  r.return(302, url);
}

export default { directLive };

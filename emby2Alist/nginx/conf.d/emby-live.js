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
  const itemInfoUri = `${embyHost}/Items/${itemId}/PlaybackInfo?api_key=${api_key}`;
  r.warn(`itemInfoUri: ${itemInfoUri}`);
  const embyRes = await Emby.fetchEmbyFilePath(itemInfoUri, Etag);
  if (embyRes.startsWith("error")) {
    r.error(embyRes);
    r.return(500, embyRes);
    return;
  }
  r.warn(`mount emby file path: ${embyRes}`);
  // 4 execute redirect
  r.return(302, embyRes);
}

export default { directLive };

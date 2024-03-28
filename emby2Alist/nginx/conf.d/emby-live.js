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
  r.warn(`directLive itemInfoUri: ${itemInfoUri}`);
  const response = await ngx.fetch(itemInfoUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8"
    }
  });
  if (!response.ok) {
    r.error(response.statusText);
    return Emby.internalRedirect(r);
  }
  const body = await response.json();
  if (!body.MediaSources || body.MediaSources.length === 0) {
    r.error('no media source found');
    return Emby.internalRedirect(r);
  }
  if (!body.MediaSources[0].IsRemote) {
    // not a remote link
    return Emby.redirect2Pan(r);
  }
  // 5 execute redirect
  Emby.redirect(r, body.MediaSources[0].Path);
}

export default { directLive };

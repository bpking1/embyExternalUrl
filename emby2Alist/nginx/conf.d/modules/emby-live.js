// @author: Ambitious
// @date: 2023-09-04

import config from "../constant.js";
import util from "../common/util.js";
import events from "../common/events.js";
import Emby from "../emby.js";
import embyVMedia from "../modules/emby-v-media.js";

async function directLive(r) {
  events.njsOnExit(`directLive: ${r.uri}`);

  // check virtualMediaSources, versionDict cache range > routeLXDict, so ignore routeLXDict
  const vMediaUrl = await embyVMedia.getUrlByVMediaSources(r);
  // if (vMediaUrl === 1) {
  //   ngx.log(ngx.WARN, `fetchHlsWithCache success, but pre IsPlayback true not ready Streams Array`);
  //   return r.return(500, "need retry playback");
  //   // return r.return(449, "need retry playback");
  // } else 
  if (vMediaUrl) {
    return Emby.redirect(r, vMediaUrl);
  }

  if (!Emby.allowRedirect(r)) {
    return Emby.internalRedirect(r);
  }

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

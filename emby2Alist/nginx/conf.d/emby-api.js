// @author: chen3861229
// @date: 2024-03-31
import config from "./constant.js";

async function fetchNotificationsAdmin(Name, Description) {
    const body = {
      Name: Name,
      Description: Description
    }
    try {
      ngx.fetch(`${config.embyHost}/Notifications/Admin?api_key=${config.embyApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: JSON.stringify(body),
      }).then(res => {
        if (res.ok) {
          ngx.log(ngx.WARN, `success: fetchNotificationsAdmin: ${JSON.stringify(body)}`);
        } else {
          ngx.log(ngx.ERR, `error: fetchNotificationsAdmin: ${res.status} ${res.statusText}`);
        }
      });
    } catch (error) {
      ngx.log(ngx.ERR, `error: fetchNotificationsAdmin: ${error}`);
    }
}

async function fetchSessionsMessage(Id, Header, Text, TimeoutMs) {
  const body = {
    Header: Header,
    Text: Text,
    TimeoutMs: TimeoutMs,
  }
  try {
    ngx.fetch(`${config.embyHost}/Sessions/${Id}/Message?api_key=${config.embyApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(body),
    }).then(res => {
      if (res.ok) {
        ngx.log(ngx.WARN, `success: fetchSessionsMessage: ${JSON.stringify(body)}`);
      } else {
        ngx.log(ngx.ERR, `error: fetchSessionsMessage: ${res.status} ${res.statusText}`);
      }
    });
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchSessionsMessage: ${error}`);
  }
}

async function fetchSessions(DeviceId, Id, IsPlaying, ControllableByUserId) {
  const body = {
    ControllableByUserId: ControllableByUserId,
    DeviceId: DeviceId,
    Id: Id,
    IsPlaying: IsPlaying
  }
  try {
    return ngx.fetch(`${config.embyHost}/Sessions?api_key=${config.embyApiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchSessions: ${error}`);
  }
}

async function fetchPlaybackInfo(itemId) {
  return ngx.fetch(`${config.embyHost}/Items/${itemId}/PlaybackInfo?api_key=${config.embyApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8"
    }
  });
}

export default { 
    fetchNotificationsAdmin,
    fetchSessionsMessage,
    fetchSessions,
    fetchPlaybackInfo,
};
// @author: chen3861229
// @date: 2024-03-31
import config from "./constant.js";

async function fetchEmbyNotificationsAdmin(Name, Description) {
    const body = {
      Name: Name,
      Description: Description
    }
    try {
      const res = await ngx.fetch(`${config.embyHost}/Notifications/Admin?api_key=${config.embyApiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json;charset=utf-8"
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        ngx.log(ngx.WARN, `success: fetchEmbyNotificationsAdmin: ${JSON.stringify(body)}`);
      } else {
        ngx.log(ngx.ERR, `error: fetchEmbyNotificationsAdmin: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      ngx.log(ngx.ERR, `error: fetchEmbyNotificationsAdmin: ${error}`);
    }
}

async function fetchEmbySessionsMessage(Id, Header, Text, TimeoutMs) {
  const body = {
    Header: Header,
    Text: Text,
    TimeoutMs: TimeoutMs,
  }
  try {
    const res = await ngx.fetch(`${config.embyHost}/Sessions/${Id}/Message?api_key=${config.embyApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      ngx.log(ngx.WARN, `success: fetchEmbySessionsMessage: ${JSON.stringify(body)}`);
    } else {
      ngx.log(ngx.ERR, `error: fetchEmbySessionsMessage: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchEmbySessionsMessage: ${error}`);
  }
}

async function fetchEmbySessions(DeviceId, Id, IsPlaying, ControllableByUserId) {
  const body = {
    ControllableByUserId: ControllableByUserId,
    DeviceId: DeviceId,
    Id: Id,
    IsPlaying: IsPlaying
  }
  try {
    const res = await ngx.fetch(`${config.embyHost}/Sessions?api_key=${config.embyApiKey}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json;charset=utf-8"
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return await res.json();
    } else {
      ngx.log(ngx.ERR, `error: fetchEmbySessions: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    ngx.log(ngx.ERR, `error: fetchEmbySessions: ${error}`);
  }
}

export default { 
    fetchEmbyNotificationsAdmin,
    fetchEmbySessionsMessage,
    fetchEmbySessions,
};
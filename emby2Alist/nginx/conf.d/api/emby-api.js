// @author: chen3861229
// @date: 2024-03-31

import config from "../constant.js";
import util from "../common/util.js";

const PlayMethodEnum = {
  DirectPlay: "DirectPlay",
  DirectStream: "DirectStream",
  Transcode: "Transcode"
};

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

async function fetchSessions(host, apiKey, queryParams) {
  if (!host || !apiKey || !queryParams) {
    ngx.log(ngx.ERR, `error: fetchSessions: params is required`);
    return;
  }
  let url = `${host}/Sessions?api_key=${apiKey}`;
  for (const key in queryParams) {
    url = util.appendUrlArg(url, key, queryParams[key]);
  }
  return ngx.fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Accept-Encoding": "",
    },
  });
}

async function fetchPlaybackInfo(itemId) {
  return ngx.fetch(`${config.embyHost}/Items/${itemId}/PlaybackInfo?api_key=${config.embyApiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8"
    }
  });
}

async function fetchItems(host, apiKey, queryParams) {
  if (!host || !apiKey || !queryParams) {
    ngx.log(ngx.ERR, `error: fetchItems: params is required`);
    return;
  }
  let url = `${host}/Items?api_key=${apiKey}`;
  for (const key in queryParams) {
    url = util.appendUrlArg(url, key, queryParams[key]);
  }
  ngx.log(ngx.WARN, `warn: fetchItems url: ${url}`);
  return ngx.fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Accept-Encoding": "",
    }
  });
}

async function fetchVideosActiveEncodingsDelete(host, apiKey, queryParams) {
  if (!host || !apiKey || !queryParams) {
    ngx.log(ngx.ERR, `error: fetchVideosActiveEncodingsDelete: params is required`);
    return;
  }
  let url = `${host}/Videos/ActiveEncodings?api_key=${apiKey}`;
  for (const key in queryParams) {
    url = util.appendUrlArg(url, key, queryParams[key]);
  }
  ngx.log(ngx.WARN, `warn: fetchVideosActiveEncodingsDelete url: ${url}`);
  return ngx.fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Accept-Encoding": "",
    }
  });
}

export default {
  PlayMethodEnum,
  fetchNotificationsAdmin,
  fetchSessionsMessage,
  fetchSessions,
  fetchPlaybackInfo,
  fetchItems,
  fetchVideosActiveEncodingsDelete,
};
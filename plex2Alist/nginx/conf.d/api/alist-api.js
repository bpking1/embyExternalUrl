// @author: chen3861229
// @date: 2024-04-16

// import util from "../common/util.js";
import urlUtil from "../common/url-util.js";

const API_ENUM = {
  fsGet: "/api/fs/get",
  fsLink: "/api/fs/link",
  fsList: "/api/fs/list",
};

async function fetchAuth(url, username, password) {
  const body = {
    username: username,
    password: password,
  };
  try {
    const response = await ngx.fetch(url, {
      method: "POST",
      max_response_body_size: 1024,
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result) {
        return `error: alist_auth_api response is null`;
      }
      if (result.message == "success") {
        return result.data.token;
      }
      return `error500: alist_auth_api ${result.code} ${result.message}`;
    } else {
      return `error: alist_auth_api ${response.status} ${response.statusText}`;
    }
  } catch (error) {
    return `error: alist_auth_api filed ${error}`;
  }
}

async function fetchPath(url, filePath, token, ua) {
  const requestBody = {
    path: filePath,
    password: "",
  };
  try {
    const urlParts = urlUtil.parseUrl(url);
    const hostValue = `${urlParts.host}:${urlParts.port}`;
    ngx.log(ngx.WARN, `fetchAlistPath add Host: ${hostValue}`);
    const response = await ngx.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Authorization: token,
        "User-Agent": ua,
        Host: hostValue,
      },
      max_response_body_size: 65535,
      body: JSON.stringify(requestBody),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result) {
        return `error: alist_path_api response is null`;
      }
      if (result.message == "success") {
        return result;
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

export default {
  API_ENUM,
  fetchAuth,
  fetchPath,
};
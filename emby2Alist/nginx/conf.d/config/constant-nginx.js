// import embySearch from "../modules/emby-search.js"; // this is cycle import, unhandled promise rejection: ReferenceError: cannot access variable before initialization

// 选填项,用不到保持默认即可

const nginxConfig = {
  // 禁用上游服务的 docs 页面
  disableDocs: true,
};

// for js_set
function getDisableDocs(r) {
  const value = nginxConfig.disableDocs 
    && !ngx.shared["tmpDict"].get("opendocs");
  // r.log(`getDisableDocs: ${value}`);
  return value;
}

export default {
  nginxConfig,
  getDisableDocs,
}

import embySearch from "../modules/emby-search.js";

// 选填项,用不到保持默认即可

const nginxConfig = {
  // 禁用上游服务的 docs 页面
  disableDocs: true,
};

// for js_set
function getDisableDocs(r) {
  const value = nginxConfig.disableDocs 
    && !ngx.shared[embySearch.ARGS.dictName].get(embySearch.ARGS.openDocsKey);
  // r.log(`getDisableDocs: ${value}`);
  return value;
}

export default {
  nginxConfig,
  getDisableDocs,
}

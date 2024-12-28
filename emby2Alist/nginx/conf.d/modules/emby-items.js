// @author: chen3861229
// @date: 2024-07-13

import config from "../constant.js";
import util from "../common/util.js";
import urlUtil from "../common/url-util.js";
import events from "../common/events.js";
import emby from "../emby.js";
// import embyApi from "../api/emby-api.js";

async function itemsFilter(r) {
  events.njsOnExit(`itemsFilter: ${r.uri}`);

  const subRes = await subrequestForPath(r);
  const body = subRes.body;
  const subR = subRes.subR;
  const itemHiddenRule = config.itemHiddenRule.filter(rule => rule[2] != 4);
  if (itemHiddenRule && itemHiddenRule.length > 0) {
    const apiType = r.variables.apiType;
    r.warn(`itemsFilter apiType: ${apiType}`);
    let mainItemPath;
    if (apiType == "itemSimilar") {
      // fetch mount emby/jellyfin file path
      const itemInfo = util.getItemInfo(r);
      r.warn(`itemSimilarInfoUri: ${itemInfo.itemInfoUri}`);
      const embyRes = await util.cost(emby.fetchEmbyFilePath,
        itemInfo.itemInfoUri, 
        itemInfo.itemId, 
        itemInfo.Etag, 
        itemInfo.mediaSourceId
      );
      mainItemPath = embyRes.path;
      r.warn(`mainItemPath: ${mainItemPath}`);
    }

    const beforeLength = body.Items.length;
    let itemHiddenCount = 0;
    if (body.Items) {
      body.Items = body.Items.filter(item => {
        if (!item.Path) {
          return true;
        }
        const flag = !itemHiddenRule.some(rule => {
          if ((!rule[2] || rule[2] == 0 || rule[2] == 2) && !!mainItemPath 
            && util.strMatches(rule[0], mainItemPath, rule[1])) {
            return false;
          }
          if (apiType == "searchSuggest" && rule[2] == 2) {
            return false;
          }
          if (apiType == "backdropSuggest" && rule[2] == 3) {
            return false;
          }
          // 4: 只隐藏[类型风格]接口,这个暂时分页有 bug,被隐藏掉的项会有个空的海报,第一页后的 StartIndex 需要减去 itemHiddenCount
          // 且最重要是无法得知当前浏览项目,会误伤导致接口返回[],不建议实现该功能
          // if (apiType == "genreSearch" && rule[2] == 4) {
          //   return false;
          // }
          if (apiType == "itemSimilar" && rule[2] == 1) {
            return false;
          }
          if (util.strMatches(rule[0], item.Path, rule[1])) {
            r.warn(`itemPath hit itemHiddenRule: ${item.Path}`);
            itemHiddenCount++;
            return true;
          }
        });
        delete item.Path;
        return flag;
      });
    }
    const logLevel = itemHiddenCount > 0 ? ngx.WARN : ngx.INFO;
    ngx.log(logLevel, `itemsFilter before: ${beforeLength}`);
    ngx.log(logLevel, `itemsFilter after: ${body.Items.length}`);
    if (body.TotalRecordCount) {
      body.TotalRecordCount -= itemHiddenCount;
      ngx.log(logLevel, `itemsFilter TotalRecordCount: ${body.TotalRecordCount}`);
    }
  }

  util.copyHeaders(subR.headersOut, r.headersOut);
  return r.return(200, JSON.stringify(body));
}

async function usersItemsLatestFilter(r) {
  events.njsOnExit(`usersItemsLatestFilter: ${r.uri}`);

  const subRes = await subrequestForPath(r);
  let body = subRes.body;
  const subR = subRes.subR;
  const itemHiddenRule = config.itemHiddenRule.filter(rule => !rule[2] || rule[2] == 0 || rule[2] == 4);
  if (itemHiddenRule && itemHiddenRule.length > 0 && Array.isArray(body)) {
    const beforeLength = body.length;
    body = body.filter(item => {
      if (!item.Path) {
        return true;
      }
      const flag = !itemHiddenRule.some(rule => {
        if (util.strMatches(rule[0], item.Path, rule[1])) {
          r.warn(`itemPath hit itemHiddenRule: ${item.Path}`);
          return true;
        }
      });
      delete item.Path;
      return flag;
    });
    const itemHiddenCount = beforeLength - body.length;
    const logLevel = itemHiddenCount > 0 ? ngx.WARN : ngx.INFO;
    ngx.log(logLevel, `usersItemsLatestFilter before: ${beforeLength}`);
    ngx.log(logLevel, `usersItemsLatestFilter after: ${body.length}`);
    ngx.log(logLevel, `usersItemsLatestFilter itemHiddenCount: ${itemHiddenCount}`);
  }

  util.copyHeaders(subR.headersOut, r.headersOut);
  return r.return(200, JSON.stringify(body));
}

async function subrequestForPath(r) {
  r.variables.request_uri += "&Fields=Path";
  // urlUtil.appendUrlArg(r.variables.request_uri, "Fields", "Path");
  const subR = await r.subrequest(urlUtil.proxyUri(r.uri), {
    method: r.method,
  });
  if (subR.status === 200) {
  	const body = JSON.parse(subR.responseText);
    return { body, subR };
  } else {
  	r.warn(`${r.uri} subrequest failed, status: ${subR.status}`);
	  return emby.internalRedirect(r);
  }
}

export default {
  itemsFilter,
  usersItemsLatestFilter,
};
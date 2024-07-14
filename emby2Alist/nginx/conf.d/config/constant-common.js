
// 选填项,程序内部使用的公共常量,一般不需要更改

// 字符串头,用于特殊匹配判断
const strHead = {
  lanIp: ["172.", "10.", "192.", "[fd00:"], // 局域网ip头
  xEmbyClients: {
    seekBug: ["Emby for iOS", "Infuse"],
    maybeProxy: ["Emby Web", "Emby for iOS", "Infuse"],
  },
  "115": "115.com",
  ali: "aliyundrive.net",
};

export default {
  strHead,
}

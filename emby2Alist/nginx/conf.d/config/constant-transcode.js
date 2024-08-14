
// 选填项,用不到保持默认即可

// 转码配置,默认 false,将按之前逻辑禁止转码处理并移除转码选项参数,与服务端允许转码配置有相关性
const transcodeConfig = {
  enable: false, // 此大多数情况下为允许转码的总开关
  enableStrmTranscode: false, // 默认禁用 strm 的转码,体验很差,仅供调试使用
  type: "distributed-media-server", // 负载类型,可选值, ["nginx", "distributed-media-server"]
  maxNum: 3, // 单机最大转码数量,有助于加速轮询, 参数暂无作用,接口无法查询转码情况,忽略此参数
  redirectTransOptEnable: true, // 是否保留码率选择,不保留官方客户端将无法手动切换至转码
  targetItemMatchFallback: "redirect", // 目标服务媒体匹配失败后的降级后路由措施,可选值, ["redirect", "proxy"]
  // 如果只需要当前服务转码,enable 改为 true,server 改为下边的空数组
  server: [],
  // !!!实验功能,主库和所有从库给用户开启[播放-如有必要，在媒体播放期间允许视频转码]+[倒数7行-允许媒体转换]
  // type: "nginx", nginx 负载均衡,好处是使用简单且内置均衡参数选择,缺点是流量全部经过此服务器,
  // 且使用条件很苛刻,转码服务组中的媒体 id 需要和主媒体库中 id 一致,自行寻找实现主从同步,完全同步后,ApiKey 也是一致的
  // type: "distributed-media-server", 分布式媒体服务负载均衡(暂未实现均衡),优先利用 302 真正实现流量的 LB,且灵活,
  // 不区分主从,当前访问服务即为主库,可 emby/jellyfin 混搭,挂载路径可以不一致,但要求库中的标题和语种一致且原始文件名一致
  // 负载的服务组,需要分离转码时才使用,注意下列 host 必须全部为公网地址,会 302 给客户端访问,若参与负载下边手动添加
  // server: [
  //   {
  //     type: "emby",
  //     host: "http://yourdomain.com:8096",
  //     apiKey: "f839390f50a648fd92108bc11ca6730a",
  //   },
  //   {
  //     type: "jellyfin",
  //     host: "http://yourdomain.com:8097",
  //     apiKey: "f839390f50a648fd92108bc11ca6730a",
  //   },
  // ]
};

export default {
  transcodeConfig,
}

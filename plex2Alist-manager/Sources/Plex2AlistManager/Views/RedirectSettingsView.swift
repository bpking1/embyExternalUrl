import SwiftUI

struct RedirectSettingsView: View {
    @EnvironmentObject var configService: ConfigService

    private var r: RedirectSettings { configService.config.redirect }

    private var serverName: String {
        switch configService.config.mediaServerType {
        case .plex: return "Plex"
        case .emby: return "Emby"
        case .jellyfin: return "Jellyfin"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                // MARK: 302 主开关
                Group {
                    sectionHeader("302 直链控制", note: "控制 njs 是否返回 302 重定向，关闭后全部转为反代中转")

                    Toggle(isOn: $configService.config.redirect.enabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("启用 302 重定向")
                                .fontWeight(.medium)
                            Text("关闭后所有请求均转发给原始 \(serverName) 服务处理")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if configService.config.mediaServerType == .plex {
                        Group {
                            Toggle(isOn: $configService.config.redirect.enablePartStreamPlayOrDownload) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("串流播放/下载直链")
                                    Text("控制 /library/parts/.../file 类型请求的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Toggle(isOn: $configService.config.redirect.enableVideoTranscodePlay) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("转码播放直链")
                                    Text("控制 /video/:/transcode/universal/start 类型请求的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .disabled(!configService.config.redirect.enabled)
                        .padding(.leading, 20)
                    } else {
                        Group {
                            Toggle(isOn: $configService.config.redirect.enableVideoStreamPlay) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("视频播放流直链")
                                    Text("控制 /videos/(.*)/(stream|original) 类型视频播放的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Toggle(isOn: $configService.config.redirect.enableVideoLivePlay) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("视频直播流直链")
                                    Text("控制 /videos/(.*)/live 视频直播的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Toggle(isOn: $configService.config.redirect.enableAudioStreamPlay) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("音频播放流直链")
                                    Text("控制 /Audio/(.*)/(universal|stream) 音频播放的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Toggle(isOn: $configService.config.redirect.enableItemsDownload) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("常规文件下载直链")
                                    Text("控制 /Items/(.*)/Download 浏览器下载的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            Toggle(isOn: $configService.config.redirect.enableSyncDownload) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("安卓同步下载直链")
                                    Text("控制 /Sync/JobItems/(.*)/File 安卓客户端离线同步下载的 302 重定向")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .disabled(!configService.config.redirect.enabled)
                        .padding(.leading, 20)
                    }
                }

                Divider()

                // MARK: 转码
                Group {
                    sectionHeader("转码控制", note: "\(serverName) 原生转码开关")

                    Toggle(isOn: $configService.config.redirect.transcodeEnabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("允许 \(serverName) 原生转码")
                                .fontWeight(.medium)
                            Text("开启后当客户端请求转码时，\(serverName) 会自行处理转码；关闭则强制直链播放")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Divider()

                // MARK: 缓存
                Group {
                    sectionHeader("路由缓存", note: "减少重复请求 OpenList 的 API")

                    Toggle(isOn: $configService.config.redirect.routeCacheEnabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("启用路由缓存")
                                .fontWeight(.medium)
                            Text("同客户端短时间内访问相同资源时，直接返回缓存的直链地址，不再请求 OpenList API")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Divider()

                // MARK: 回源
                Group {
                    sectionHeader("回源策略", note: "上游服务异常时的降级行为")

                    Toggle(isOn: $configService.config.redirect.fallbackUseOriginal) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("失败时回源中转")
                                .fontWeight(.medium)
                            Text("当获取文件路径或 OpenList 直链失败时，将请求转发给原始 \(serverName) 服务中转处理；关闭则返回 500 错误")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Divider()

                // MARK: 签名
                Group {
                    sectionHeader("OpenList 签名", note: "直链签名参数，需要 OpenList 后端开启签名支持")

                    Toggle(isOn: $configService.config.openList.signEnabled) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("启用直链签名")
                                .fontWeight(.medium)
                            Text("为 OpenList 直链添加签名参数，防止直链被随意分享")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if configService.config.openList.signEnabled {
                        HStack {
                            Text("签名有效期（小时）")
                                .font(.subheadline)
                            TextField("12", value: $configService.config.openList.signExpireHours, format: .number)
                                .frame(maxWidth: 80)
                            Text("需与 OpenList 后台设置的直链有效期一致")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.leading, 20)
                    }
                }

                // MARK: 115 优化
                if configService.config.mediaServerType != .plex {
                    Divider()

                    Group {
                        sectionHeader("115 网盘 HLS 直链优化", note: "开启后 115 视频将由 Nginx 解析为 HLS 分片直链，提供清晰度选择")

                        FormField(label: "115 Web Cookie") {
                            VStack(alignment: .leading, spacing: 4) {
                                TextField("留空则自动从 OpenList 获取（推荐，以避免风控）", text: $configService.config.redirect.webCookie115)
                                    .font(.system(.body, design: .monospaced))
                                Text("💡 推荐保持为空。NJS 脚本将直接提取 OpenList 后台配置的凭证；在此处手动填入固定浏览器 Cookie 会增加风控几率。")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Toggle(isOn: $configService.config.redirect.directHlsEnable) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("启用 115 HLS 转码直链")
                                    .fontWeight(.medium)
                                Text("开启后，对于 115 云盘内容将自动通过 HLS 播放源直接播放")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }

                        if configService.config.redirect.directHlsEnable {
                            Toggle(isOn: $configService.config.redirect.directHlsDefaultPlayMax) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("默认播放最高清晰度")
                                        .fontWeight(.medium)
                                    Text("开启后优先使用最大分辨率清晰度播放；关闭则默认使用最低清晰度")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.leading, 20)
                        }
                    }
                }

                Spacer()

                HStack {
                    Button("保存") {
                        configService.save()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding(24)
        }
        .navigationTitle("302 控制")
    }

    private func sectionHeader(_ title: String, note: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.title3)
                .fontWeight(.semibold)
            Text(note)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

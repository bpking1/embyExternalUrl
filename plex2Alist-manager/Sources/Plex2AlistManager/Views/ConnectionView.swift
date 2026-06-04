import SwiftUI

struct ConnectionView: View {
    @EnvironmentObject var configService: ConfigService
    @State private var showSaveAlert = false
    @State private var scanMessage: String?
    @State private var scanSuccess = false

    private var config: AppConfig { configService.config }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                header("媒体服务器设置")

                Picker("媒体服务器类型", selection: $configService.config.mediaServerType) {
                    ForEach(MediaServerType.allCases, id: \.self) { type in
                        Text(type.rawValue).tag(type)
                    }
                }
                .pickerStyle(.segmented)

                switch configService.config.mediaServerType {
                case .plex:
                    plexSection
                case .emby:
                    embySection
                case .jellyfin:
                    jellyfinSection
                }

                Divider()

                header("OpenList 直链后端")
                openListSection

                Divider()

                header("路径设置")
                pathSection

                Spacer()

                HStack {
                    Button("保存配置") {
                        configService.save()
                        showSaveAlert = true
                    }
                    .buttonStyle(.borderedProminent)

                    Button("恢复默认") {
                        configService.resetToDefaults()
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(24)
        }
        .alert("已保存", isPresented: $showSaveAlert) {
            Button("确定", role: .cancel) {}
        }
        .navigationTitle("连接配置")
    }

    // MARK: - Plex Section

    private var plexSection: some View {
        VStack(spacing: 12) {
            FormField(label: "服务器地址") {
                VStack(alignment: .leading) {
                    TextField("http://127.0.0.1:32400", text: $configService.config.plex.serverURL)
                    Text("上游 plex2Alist 只需要 Plex 源服务地址；播放请求中的 X-Plex-Token 会由 Plex 客户端带入并透传。")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 24) {
                    FormField(label: "HTTP 反代端口") {
                        TextField("8098", value: $configService.config.plex.proxyPort, format: .number)
                            .frame(width: 120)
                    }
                    FormField(label: "HTTPS 反代端口") {
                        TextField("8095", value: $configService.config.plex.proxyHttpsPort, format: .number)
                            .frame(width: 120)
                    }
                }
                Text("配置 nginx 容器的监听端口。HTTP 用于常规反向代理访问，HTTPS 用于证书加载后的 SSL 安全连接。")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
            }
        }
    }

    // MARK: - Emby Section

    private var embySection: some View {
        VStack(spacing: 12) {
            FormField(label: "服务器地址") {
                VStack(alignment: .leading) {
                    TextField("http://127.0.0.1:8096", text: $configService.config.emby.serverURL)
                    Text("输入 Emby 源服务地址。")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
            }

            FormField(label: "API Key / Token") {
                SecureField("输入 Emby API Key", text: $configService.config.emby.apiKey)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 24) {
                    FormField(label: "HTTP 反代端口") {
                        TextField("8091", value: $configService.config.emby.proxyPort, format: .number)
                            .frame(width: 120)
                    }
                    FormField(label: "HTTPS 反代端口") {
                        TextField("8095", value: $configService.config.emby.proxyHttpsPort, format: .number)
                            .frame(width: 120)
                    }
                }
                Text("配置 nginx 容器的监听端口。HTTP 用于常规反向代理访问，HTTPS 用于证书加载后的 SSL 安全连接。")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
            }
        }
    }

    // MARK: - Jellyfin Section

    private var jellyfinSection: some View {
        VStack(spacing: 12) {
            FormField(label: "服务器地址") {
                VStack(alignment: .leading) {
                    TextField("http://127.0.0.1:8096", text: $configService.config.jellyfin.serverURL)
                    Text("输入 Jellyfin 源服务地址。")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .textSelection(.enabled)
                }
            }

            FormField(label: "API Key / Token") {
                SecureField("输入 Jellyfin API Key", text: $configService.config.jellyfin.apiKey)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 24) {
                    FormField(label: "HTTP 反代端口") {
                        TextField("8091", value: $configService.config.jellyfin.proxyPort, format: .number)
                            .frame(width: 120)
                    }
                    FormField(label: "HTTPS 反代端口") {
                        TextField("8095", value: $configService.config.jellyfin.proxyHttpsPort, format: .number)
                            .frame(width: 120)
                    }
                }
                Text("配置 nginx 容器的监听端口。HTTP 用于常规反向代理访问，HTTPS 用于证书加载后的 SSL 安全连接。")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.top, 2)
            }
        }
    }

    // MARK: - OpenList Section

    private var openListSection: some View {
        VStack(spacing: 12) {
            FormField(label: "服务器地址") {
                TextField("http://127.0.0.1:5244", text: $configService.config.openList.serverURL)
            }
            FormField(label: "Token") {
                SecureField("输入 OpenList Token", text: $configService.config.openList.token)
            }
            FormField(label: "公网地址") {
                VStack(alignment: .leading) {
                    TextField("留空则使用服务器地址", text: $configService.config.openList.publicURL)
                    Text("用于客户端自请求直链的场景，如 115 网盘需要公网可访问的地址")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    // MARK: - Path Section

    private var pathSection: some View {
        VStack(spacing: 12) {
            FormField(label: "部署目录") {
                VStack(alignment: .leading) {
                    HStack {
                        TextField("默认: App Support 下自动创建", text: $configService.config.deploymentDirectory)
                            .font(.system(.body, design: .monospaced))
                        Button("选择") { selectFolder { configService.config.deploymentDirectory = $0 } }
                            .buttonStyle(.bordered)
                    }
                    Text("存放 docker-compose.yml 和运行时日志的目录")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            FormField(label: "nginx 配置目录") {
                VStack(alignment: .leading) {
                    HStack {
                        TextField("默认: 部署目录下的 nginx/", text: $configService.config.nginxConfigDirectory)
                            .font(.system(.body, design: .monospaced))
                        Button("选择") { selectFolder { configService.config.nginxConfigDirectory = $0 } }
                            .buttonStyle(.bordered)
                        Button("扫描已有配置") { scanExistingConfig() }
                            .buttonStyle(.borderedProminent)
                    }
                    Text("包含 nginx.conf 和 conf.d/ 的目录，配置生成时会覆盖 constant*.js")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // 扫描结果显示
            if let msg = scanMessage {
                HStack(spacing: 6) {
                    Image(systemName: scanSuccess ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .foregroundColor(scanSuccess ? .green : .orange)
                        .font(.caption)
                    Text(msg)
                        .font(.caption)
                        .foregroundColor(scanSuccess ? .green : .orange)
                }
                .padding(.leading, 4)
            }
        }
    }

    // MARK: - Helpers

    private func header(_ text: String) -> some View {
        Text(text)
            .font(.title2)
            .fontWeight(.semibold)
    }

    private func selectFolder(_ completion: @escaping (String) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            completion(url.path)
        }
    }

    /// 从已部署的 nginx 配置目录扫描并回填所有设置
    private func scanExistingConfig() {
        let nginxDir = configService.nginxConfigDirectory()
        let scanner = ExistingConfigScanner.shared
        let scanned = scanner.scan(nginxConfDir: nginxDir, preferredType: configService.config.mediaServerType)

        var filled: [String] = []

        if let type = scanned.mediaServerType {
            configService.config.mediaServerType = type
            filled.append("服务类型")

            let serverURL = scanned.serverURL ?? scanned.plexURL
            switch type {
            case .emby:
                if let v = serverURL { configService.config.emby.serverURL = v; filled.append("Emby 地址") }
                if let v = scanned.embyApiKey { configService.config.emby.apiKey = v; filled.append("API Key") }
                if let v = scanned.proxyPort { configService.config.emby.proxyPort = v; filled.append("HTTP 端口") }
                if let v = scanned.proxyHttpsPort { configService.config.emby.proxyHttpsPort = v; filled.append("HTTPS 端口") }
            case .jellyfin:
                if let v = serverURL { configService.config.jellyfin.serverURL = v; filled.append("Jellyfin 地址") }
                if let v = scanned.embyApiKey { configService.config.jellyfin.apiKey = v; filled.append("API Key") }
                if let v = scanned.proxyPort { configService.config.jellyfin.proxyPort = v; filled.append("HTTP 端口") }
                if let v = scanned.proxyHttpsPort { configService.config.jellyfin.proxyHttpsPort = v; filled.append("HTTPS 端口") }
            case .plex:
                if let v = serverURL { configService.config.plex.serverURL = v; filled.append("Plex 地址") }
                if let v = scanned.proxyPort { configService.config.plex.proxyPort = v; filled.append("HTTP 端口") }
                if let v = scanned.proxyHttpsPort { configService.config.plex.proxyHttpsPort = v; filled.append("HTTPS 端口") }
            }
        } else {
            // fallback
            if let v = scanned.serverURL ?? scanned.plexURL {
                if configService.config.mediaServerType == .emby {
                    configService.config.emby.serverURL = v
                    filled.append("Emby 地址")
                } else if configService.config.mediaServerType == .jellyfin {
                    configService.config.jellyfin.serverURL = v
                    filled.append("Jellyfin 地址")
                } else {
                    configService.config.plex.serverURL = v
                    filled.append("Plex 地址")
                }
            }
            if let v = scanned.proxyPort {
                if configService.config.mediaServerType == .emby {
                    configService.config.emby.proxyPort = v
                } else if configService.config.mediaServerType == .jellyfin {
                    configService.config.jellyfin.proxyPort = v
                } else {
                    configService.config.plex.proxyPort = v
                }
                filled.append("HTTP 端口")
            }
            if let v = scanned.proxyHttpsPort {
                if configService.config.mediaServerType == .emby {
                    configService.config.emby.proxyHttpsPort = v
                } else if configService.config.mediaServerType == .jellyfin {
                    configService.config.jellyfin.proxyHttpsPort = v
                } else {
                    configService.config.plex.proxyHttpsPort = v
                }
                filled.append("HTTPS 端口")
            }
        }

        if let v = scanned.openListURL { configService.config.openList.serverURL = v; filled.append("OpenList 地址") }
        if let v = scanned.openListToken { configService.config.openList.token = v; filled.append("OpenList Token") }
        if let v = scanned.openListPublicURL { configService.config.openList.publicURL = v; filled.append("公网地址") }
        if let v = scanned.signEnabled { configService.config.openList.signEnabled = v; filled.append("签名开关") }
        if let v = scanned.signExpireHours { configService.config.openList.signExpireHours = v; filled.append("签名有效期") }
        if let v = scanned.redirectEnabled { configService.config.redirect.enabled = v; filled.append("302 开关") }
        if let v = scanned.transcodeEnabled { configService.config.redirect.transcodeEnabled = v; filled.append("转码开关") }
        if let v = scanned.routeCacheEnabled { configService.config.redirect.routeCacheEnabled = v; filled.append("缓存开关") }
        if let v = scanned.fallbackUseOriginal { configService.config.redirect.fallbackUseOriginal = v; filled.append("回源策略") }

        // 挂载路径
        if !scanned.mediaMountPaths.isEmpty {
            configService.config.mount.mediaMountPaths = scanned.mediaMountPaths
            filled.append("挂载路径")
        }

        // 路径映射
        if !scanned.pathMappings.isEmpty {
            configService.config.pathMappings = scanned.pathMappings.map {
                PathMapping(localPrefix: $0.local, remotePrefix: $0.remote, enabled: true)
            }
            filled.append("路径映射")
        }

        if filled.isEmpty {
            scanMessage = "在 \(nginxDir) 下未识别到有效配置"
            scanSuccess = false
        } else {
            scanMessage = "已读取 \(filled.count) 项配置：\(filled.joined(separator: "、"))"
            scanSuccess = true
            configService.save()
        }
    }
}

// MARK: - Form Field Component

struct FormField<Content: View>: View {
    let label: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            content
        }
    }
}

import SwiftUI

struct DiagnosticsView: View {
    @EnvironmentObject var configService: ConfigService
    @StateObject private var dockerService = DockerService.shared

    @State private var openListResults: [DiagnosticResult] = []
    @State private var mediaResults: [DiagnosticResult] = []
    @State private var isTesting = false

    private var mediaServerType: MediaServerType {
        configService.config.mediaServerType
    }

    private var activeServerURL: String {
        switch mediaServerType {
        case .plex: return configService.config.plex.serverURL
        case .emby: return configService.config.emby.serverURL
        case .jellyfin: return configService.config.jellyfin.serverURL
        }
    }

    private var activeHTTPPort: Int {
        switch mediaServerType {
        case .plex: return configService.config.plex.proxyPort
        case .emby: return configService.config.emby.proxyPort
        case .jellyfin: return configService.config.jellyfin.proxyPort
        }
    }

    private var activeHTTPSPort: Int {
        switch mediaServerType {
        case .plex: return configService.config.plex.proxyHttpsPort
        case .emby: return configService.config.emby.proxyHttpsPort
        case .jellyfin: return configService.config.jellyfin.proxyHttpsPort
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // MARK: OpenList Tests
                Group {
                    sectionHeader("OpenList 检测")

                    Text("测试 OpenList 后端连通性、认证和 API 响应。")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Button("运行 OpenList 检测") {
                        Task { await runOpenListTests() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isTesting)

                    if !openListResults.isEmpty {
                        resultsList(openListResults)
                    }
                }

                Divider()

                // MARK: Media Server Tests
                Group {
                    sectionHeader("\(mediaServerType.rawValue) 检测")

                    Text(mediaServerType == .plex
                         ? "测试 Plex 源服务器连通性。Plex 客户端请求中的 X-Plex-Token 会由 nginx 转发给上游脚本。"
                         : "测试 \(mediaServerType.rawValue) 源服务器连通性和 API Key。")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Button("运行 \(mediaServerType.rawValue) 检测") {
                        Task { await runMediaServerTests() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isTesting)

                    if !mediaResults.isEmpty {
                        resultsList(mediaResults)
                    }
                }

                Divider()

                // MARK: Environment Info
                Group {
                    sectionHeader("环境信息")

                    VStack(alignment: .leading, spacing: 6) {
                        InfoRow(label: "部署目录", value: configService.ensureDeploymentDirectory())
                        InfoRow(label: "nginx 配置", value: configService.nginxConfigDirectory())
                        InfoRow(label: "服务类型", value: mediaServerType.rawValue)
                        InfoRow(label: "HTTP 端口", value: "\(activeHTTPPort)")
                        InfoRow(label: "HTTPS 端口", value: "\(activeHTTPSPort)")
                        InfoRow(label: "\(mediaServerType.rawValue) 地址", value: activeServerURL)
                        InfoRow(label: "OpenList 地址", value: configService.config.openList.serverURL)
                        InfoRow(label: "路径映射数", value: "\(configService.config.pathMappings.filter(\.enabled).count) 条启用")
                    }
                    .padding(12)
                    .background(Color.secondary.opacity(0.06))
                    .cornerRadius(8)
                }

                Spacer()
            }
            .padding(24)
        }
        .navigationTitle("诊断")
        .onAppear {
            Task {
                await dockerService.detect()
                _ = await dockerService.ps(mediaServerType: configService.config.mediaServerType)
            }
        }
        .onChange(of: configService.config.mediaServerType) { _, _ in
            mediaResults = []
        }
    }

    // MARK: - Tests

    private func runOpenListTests() async {
        isTesting = true
        let service = OpenListService.shared
        let results = await service.runAllTests(config: configService.config)
        await MainActor.run {
            openListResults = results
            isTesting = false
        }
    }

    private func runMediaServerTests() async {
        isTesting = true
        let config = configService.config

        let results: [DiagnosticResult]
        switch config.mediaServerType {
        case .plex:
            // 只检测源服务器可达性；上游 plex2Alist 不需要预配置 Plex Token。
            let pingResult = await PlexService.shared.ping(serverURL: config.plex.serverURL)
            results = [pingResult]
        case .emby:
            let pingResult = await EmbyJellyfinService.shared.ping(serverURL: config.emby.serverURL, serverType: .emby)
            let keyResult = await EmbyJellyfinService.shared.testAPIKey(serverURL: config.emby.serverURL, apiKey: config.emby.apiKey, serverType: .emby)
            results = [pingResult, keyResult]
        case .jellyfin:
            let pingResult = await EmbyJellyfinService.shared.ping(serverURL: config.jellyfin.serverURL, serverType: .jellyfin)
            let keyResult = await EmbyJellyfinService.shared.testAPIKey(serverURL: config.jellyfin.serverURL, apiKey: config.jellyfin.apiKey, serverType: .jellyfin)
            results = [pingResult, keyResult]
        }

        await MainActor.run {
            mediaResults = results
            isTesting = false
        }
    }

    // MARK: - View Builders

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.title3).fontWeight(.semibold)
    }

    private func resultsList(_ results: [DiagnosticResult]) -> some View {
        VStack(spacing: 8) {
            ForEach(results) { result in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: icon(for: result.level))
                        .foregroundColor(color(for: result.level))
                        .frame(width: 18)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(result.title)
                            .fontWeight(.medium)
                        Text(result.message)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        if let suggestion = result.suggestion {
                            Text(suggestion)
                                .font(.caption)
                                .foregroundColor(.orange)
                        }
                    }
                    Spacer()
                }
                .padding(10)
                .background(Color.secondary.opacity(0.06))
                .cornerRadius(6)
            }
        }
    }

    private func icon(for level: DiagnosticResult.DiagnosticLevel) -> String {
        switch level {
        case .info: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.octagon.fill"
        }
    }

    private func color(for level: DiagnosticResult.DiagnosticLevel) -> Color {
        switch level {
        case .info: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
}

// MARK: - Info Row

struct InfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(width: 100, alignment: .trailing)
            Text(value)
                .font(.system(.caption, design: .monospaced))
                .textSelection(.enabled)
            Spacer()
        }
    }
}

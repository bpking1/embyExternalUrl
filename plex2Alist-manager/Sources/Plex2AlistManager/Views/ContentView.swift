import SwiftUI

struct ContentView: View {
    @EnvironmentObject var configService: ConfigService

    var body: some View {
        VStack(spacing: 0) {
            // 常驻托管模式状态指示条
            HStack(spacing: 12) {
                HStack(spacing: 6) {
                    let mediaType = configService.config.mediaServerType
                    let isPlex = mediaType == .plex
                    Image(systemName: isPlex ? "play.tv.fill" : "play.tv")
                        .font(.system(size: 11, weight: .bold))
                    Text(mediaType.rawValue)
                        .font(.system(size: 11, weight: .bold))
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .foregroundColor(.white)
                .background(
                    configService.config.mediaServerType == .plex ? Color.orange : Color.green
                )
                .cornerRadius(4)

                Text("模式配置托管中，本程序所有页面参数均应用至此服务")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))

            Divider()

            TabView {
                ConnectionView()
                    .tabItem {
                        Label("连接", systemImage: "cable.connector")
                    }

                RedirectSettingsView()
                    .tabItem {
                        Label("302 控制", systemImage: "arrow.triangle.swap")
                    }

                PathMappingView()
                    .tabItem {
                        Label("路径映射", systemImage: "arrow.left.arrow.right")
                    }

                CertificateView()
                    .tabItem {
                        Label("证书", systemImage: "lock.shield")
                    }

                UpstreamSyncView()
                    .tabItem {
                        Label("上游同步", systemImage: "arrow.triangle.2.circlepath")
                    }

                DockerInstallView()
                    .tabItem {
                        Label("Docker", systemImage: "shippingbox")
                    }

                GenerateView()
                    .tabItem {
                        Label("生成部署", systemImage: "gearshape.2")
                    }

                DiagnosticsView()
                    .tabItem {
                        Label("诊断", systemImage: "stethoscope")
                    }
            }
            .padding()
        }
    }
}

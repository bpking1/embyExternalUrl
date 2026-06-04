import SwiftUI

struct DockerInstallView: View {
    @State private var status: DockerInstallService.Status = .empty
    @State private var isRefreshing = false
    @State private var isLaunchingInstaller = false
    @State private var lastResult: CommandResult?

    private let service = DockerInstallService.shared

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                sectionHeader("Docker 安装")

                statusPanel

                VStack(spacing: 12) {
                    providerPanel(.orbStack, recommended: true)
                    providerPanel(.dockerDesktop, recommended: false)
                }

                if let lastResult {
                    commandResultView(title: "安装命令", result: lastResult)
                }

                Spacer()
            }
            .padding(24)
        }
        .navigationTitle("Docker")
        .onAppear {
            Task { await refresh() }
        }
    }

    private var statusPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(
                    status.engineAvailable ? "Docker Engine 可用" : "Docker Engine 未就绪",
                    systemImage: status.engineAvailable ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"
                )
                .foregroundColor(status.engineAvailable ? .green : .orange)
                .fontWeight(.medium)

                Spacer()

                Button {
                    Task { await refresh() }
                } label: {
                    Label("刷新", systemImage: "arrow.clockwise")
                }
                .buttonStyle(.bordered)
                .disabled(isRefreshing)
            }

            InfoRow(label: "Docker CLI", value: status.dockerPath.isEmpty ? "未找到" : status.dockerPath)
            InfoRow(label: "Docker 版本", value: status.dockerVersion.isEmpty ? "-" : status.dockerVersion)
            InfoRow(label: "Compose", value: status.composeVersion.isEmpty ? "-" : status.composeVersion)
            InfoRow(label: "Engine", value: status.engineVersion.isEmpty ? "-" : status.engineVersion)
            InfoRow(label: "Context", value: status.dockerContext.isEmpty ? "-" : status.dockerContext)
            InfoRow(label: "Homebrew", value: status.homebrewPath.isEmpty ? "未找到" : status.homebrewPath)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06))
        .cornerRadius(8)
    }

    private func providerPanel(_ provider: DockerInstallService.Provider, recommended: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label(provider.title, systemImage: icon(for: provider))
                    .font(.headline)
                if recommended {
                    Text("推荐")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.accentColor.opacity(0.12))
                        .cornerRadius(6)
                }
                Spacer()
                Text(installed(provider) ? "已安装" : "未安装")
                    .font(.caption)
                    .foregroundColor(installed(provider) ? .green : .secondary)
            }

            Text(description(for: provider))
                .font(.caption)
                .foregroundColor(.secondary)

            Text(service.installCommand(provider: provider))
                .font(.system(.caption, design: .monospaced))
                .textSelection(.enabled)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.secondary.opacity(0.06))
                .cornerRadius(6)

            HStack(spacing: 10) {
                if recommended {
                    Button {
                        Task { await install(provider) }
                    } label: {
                        Label("Homebrew 安装", systemImage: "terminal")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLaunchingInstaller || status.homebrewPath.isEmpty)
                } else {
                    Button {
                        Task { await install(provider) }
                    } label: {
                        Label("Homebrew 安装", systemImage: "terminal")
                    }
                    .buttonStyle(.bordered)
                    .disabled(isLaunchingInstaller || status.homebrewPath.isEmpty)
                }

                Button {
                    NSWorkspace.shared.open(provider.downloadURL)
                } label: {
                    Label("官方下载", systemImage: "arrow.down.circle")
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await openApp(provider) }
                } label: {
                    Label("启动", systemImage: "play.circle")
                }
                .buttonStyle(.bordered)
                .disabled(!installed(provider))
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06))
        .cornerRadius(8)
    }

    private func refresh() async {
        isRefreshing = true
        let next = await service.refreshStatus()
        await MainActor.run {
            status = next
            isRefreshing = false
        }
    }

    private func install(_ provider: DockerInstallService.Provider) async {
        isLaunchingInstaller = true
        let result = await service.openHomebrewInstall(provider: provider)
        await MainActor.run {
            lastResult = result
            isLaunchingInstaller = false
        }
    }

    private func openApp(_ provider: DockerInstallService.Provider) async {
        let result = await service.openInstalledApp(provider: provider)
        await MainActor.run {
            lastResult = result
        }
        await refresh()
    }

    private func installed(_ provider: DockerInstallService.Provider) -> Bool {
        switch provider {
        case .orbStack:
            return status.orbStackInstalled
        case .dockerDesktop:
            return status.dockerDesktopInstalled
        }
    }

    private func description(for provider: DockerInstallService.Provider) -> String {
        switch provider {
        case .orbStack:
            return "轻量 Docker 运行环境，安装后提供 docker、docker compose 和 Docker Engine。"
        case .dockerDesktop:
            return "Docker 官方桌面端。商业或企业环境请自行确认 Docker Desktop 许可条款。"
        }
    }

    private func icon(for provider: DockerInstallService.Provider) -> String {
        switch provider {
        case .orbStack:
            return "square.stack.3d.up"
        case .dockerDesktop:
            return "shippingbox"
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.title3).fontWeight(.semibold)
    }

    private func commandResultView(title: String, result: CommandResult) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .fontWeight(.medium)
                Spacer()
                Text(result.exitCode == 0 ? "已打开" : "失败 \(result.exitCode)")
                    .font(.caption)
                    .foregroundColor(result.exitCode == 0 ? .green : .red)
            }
            Text(result.command)
                .font(.system(.caption, design: .monospaced))
                .textSelection(.enabled)
            if !result.stdout.isEmpty {
                Text(result.stdout)
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
            }
            if !result.stderr.isEmpty {
                Text(result.stderr)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.red)
                    .textSelection(.enabled)
            }
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06))
        .cornerRadius(8)
    }
}

import SwiftUI

struct UpstreamSyncView: View {
    @EnvironmentObject var configService: ConfigService
    @StateObject private var dockerService = DockerService.shared

    @State private var onlineRepoURL = UpstreamSyncService.defaultOnlineRepoURL
    @State private var onlineCacheDirectory = UpstreamSyncService.shared.defaultOnlineCacheDirectory()
    @State private var upstreamDirectory = ""
    @State private var pullBeforeSync = false
    @State private var reloadAfterSync = false
    @State private var isWorking = false
    @State private var onlineResult: CommandResult?
    @State private var localPullResult: CommandResult?
    @State private var syncReport: UpstreamSyncService.SyncReport?
    @State private var reloadResult: CommandResult?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                sectionHeader("上游同步")

                Text("更新上游脚本，同时保留本地参数、端口、证书和生成配置。")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Text("当前激活媒体服务器: \(configService.config.mediaServerType.rawValue)")
                    .font(.caption)
                    .foregroundColor(.accentColor)

                VStack(spacing: 12) {
                    FormField(label: "线上上游") {
                        TextField(UpstreamSyncService.defaultOnlineRepoURL, text: $onlineRepoURL)
                            .font(.system(.body, design: .monospaced))
                    }

                    FormField(label: "部署目录") {
                        HStack {
                            Text(configService.ensureDeploymentDirectory())
                                .font(.system(.body, design: .monospaced))
                                .textSelection(.enabled)
                            Spacer()
                            Button {
                                NSWorkspace.shared.open(URL(fileURLWithPath: configService.ensureDeploymentDirectory()))
                            } label: {
                                Image(systemName: "folder")
                            }
                            .buttonStyle(.bordered)
                            .help("打开部署目录")
                        }
                    }

                    FormField(label: "目标 nginx") {
                        HStack {
                            Text(effectiveTargetDirectory)
                                .font(.system(.body, design: .monospaced))
                                .textSelection(.enabled)
                            Spacer()
                            Button {
                                NSWorkspace.shared.open(URL(fileURLWithPath: effectiveTargetDirectory))
                            } label: {
                                Image(systemName: "folder")
                            }
                            .buttonStyle(.bordered)
                            .help("打开目标 nginx 目录")
                        }
                    }

                    FormField(label: "本地上游") {
                        directoryRow(
                            placeholder: "~/Projects/embyExternalUrl",
                            text: $upstreamDirectory,
                            buttonTitle: "选择上游"
                        )
                    }

                    FormField(label: "在线缓存") {
                        directoryRow(
                            placeholder: UpstreamSyncService.shared.defaultOnlineCacheDirectory(),
                            text: $onlineCacheDirectory,
                            buttonTitle: "选择缓存"
                        )
                    }

                    Toggle("本地同步前执行 git pull --ff-only", isOn: $pullBeforeSync)
                        .toggleStyle(.checkbox)

                    Toggle("同步成功后重载 nginx 容器", isOn: $reloadAfterSync)
                        .toggleStyle(.checkbox)
                }

                protectedList

                HStack(spacing: 12) {
                    Button {
                        Task { await onlineSync() }
                    } label: {
                        Label("在线一键同步到部署目录", systemImage: "icloud.and.arrow.down")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking || onlineRepoURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button {
                        Task { await localSync() }
                    } label: {
                        Label("从本地上游同步", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking || upstreamDirectory.isEmpty)

                    if isWorking {
                        ProgressView()
                            .scaleEffect(0.75)
                    }
                }

                if let onlineResult {
                    commandResultView(title: "在线上游更新", result: onlineResult)
                }

                if let localPullResult {
                    commandResultView(title: "本地 Git 拉取", result: localPullResult)
                }

                if let syncReport {
                    reportView(syncReport)
                }

                if let reloadResult {
                    commandResultView(title: "nginx reload", result: reloadResult)
                }

                Spacer()
            }
            .padding(24)
        }
        .navigationTitle("上游同步")
        .onAppear {
            if upstreamDirectory.isEmpty {
                upstreamDirectory = configService.config.upstreamRepoDirectory
            }
        }
    }

    private var effectiveTargetDirectory: String {
        configService.nginxConfigDirectory()
    }

    private var protectedList: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("默认保护")
                .font(.caption)
                .foregroundColor(.secondary)
            Text("conf.d/constant.js、conf.d/config/constant*.js、conf.d/includes/*.conf、conf.d/cert/")
                .font(.system(.caption, design: .monospaced))
                .foregroundColor(.secondary)
                .textSelection(.enabled)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06))
        .cornerRadius(8)
    }

    private func onlineSync() async {
        isWorking = true
        onlineResult = nil
        localPullResult = nil
        syncReport = nil
        reloadResult = nil

        let repoURL = onlineRepoURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let cache = onlineCacheDirectory.isEmpty ? UpstreamSyncService.shared.defaultOnlineCacheDirectory() : onlineCacheDirectory
        let target = effectiveTargetDirectory

        await MainActor.run {
            configService.config.upstreamRepoDirectory = cache
            configService.save()
        }

        let online = await UpstreamSyncService.shared.syncOnlineRepository(
            repoURL: repoURL,
            cacheDirectory: cache
        )
        if online.exitCode != 0 {
            await MainActor.run {
                onlineResult = online
                isWorking = false
            }
            return
        }

        let report = await UpstreamSyncService.shared.syncPreservingParameters(
            sourceDirectory: cache,
            targetNginxDirectory: target,
            serverType: configService.config.mediaServerType
        )

        var reload: CommandResult?
        if report.succeeded, reloadAfterSync {
            reload = await dockerService.reloadNginx(mediaServerType: configService.config.mediaServerType)
        }

        await MainActor.run {
            onlineResult = online
            syncReport = report
            reloadResult = reload
            isWorking = false
        }
    }

    private func localSync() async {
        isWorking = true
        onlineResult = nil
        localPullResult = nil
        syncReport = nil
        reloadResult = nil

        let source = upstreamDirectory
        let target = effectiveTargetDirectory
        await MainActor.run {
            configService.config.upstreamRepoDirectory = source
            configService.save()
        }

        var pull: CommandResult?
        if pullBeforeSync {
            pull = await UpstreamSyncService.shared.pullRepository(repoDirectory: source)
            if pull?.exitCode != 0 {
                await MainActor.run {
                    localPullResult = pull
                    isWorking = false
                }
                return
            }
        }

        let report = await UpstreamSyncService.shared.syncPreservingParameters(
            sourceDirectory: source,
            targetNginxDirectory: target,
            serverType: configService.config.mediaServerType
        )

        var reload: CommandResult?
        if report.succeeded, reloadAfterSync {
            reload = await dockerService.reloadNginx(mediaServerType: configService.config.mediaServerType)
        }

        await MainActor.run {
            localPullResult = pull
            syncReport = report
            reloadResult = reload
            isWorking = false
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title).font(.title3).fontWeight(.semibold)
    }

    private func directoryRow(
        placeholder: String,
        text: Binding<String>,
        buttonTitle: String
    ) -> some View {
        HStack {
            TextField(placeholder, text: text)
                .font(.system(.body, design: .monospaced))
            Button(buttonTitle) {
                selectFolder { text.wrappedValue = $0 }
            }
            .buttonStyle(.bordered)
            Button {
                NSWorkspace.shared.open(URL(fileURLWithPath: text.wrappedValue.isEmpty ? placeholder : text.wrappedValue))
            } label: {
                Image(systemName: "folder")
            }
            .buttonStyle(.bordered)
            .help("打开目录")
        }
    }

    private func reportView(_ report: UpstreamSyncService.SyncReport) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(
                report.succeeded ? "同步完成" : "同步失败",
                systemImage: report.succeeded ? "checkmark.circle.fill" : "xmark.circle.fill"
            )
            .foregroundColor(report.succeeded ? .green : .red)
            .fontWeight(.medium)

            InfoRow(label: "上游 nginx", value: report.sourceNginxDirectory.isEmpty ? "-" : report.sourceNginxDirectory)
            InfoRow(label: "目标 nginx", value: report.targetNginxDirectory)

            fileSection(title: "已更新", files: report.copiedFiles, color: .green)
            fileSection(title: "无变化", files: report.skippedFiles, color: .secondary)
            fileSection(title: "已保护", files: report.protectedFiles, color: .orange)
            fileSection(title: "已备份", files: report.backupFiles, color: .secondary)
            fileSection(title: "错误", files: report.errors, color: .red)
        }
        .padding(12)
        .background(Color.secondary.opacity(0.06))
        .cornerRadius(8)
    }

    private func fileSection(title: String, files: [String], color: Color) -> some View {
        Group {
            if !files.isEmpty {
                Text("\(title) (\(files.count))")
                    .font(.caption)
                    .foregroundColor(color)
                ForEach(files.prefix(80), id: \.self) { file in
                    Text(file)
                        .font(.system(.caption, design: .monospaced))
                        .textSelection(.enabled)
                }
                if files.count > 80 {
                    Text("还有 \(files.count - 80) 项未显示")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private func commandResultView(title: String, result: CommandResult) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .fontWeight(.medium)
                Spacer()
                Text(result.exitCode == 0 ? "成功" : "失败 \(result.exitCode)")
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

    private func selectFolder(_ completion: @escaping (String) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        if panel.runModal() == .OK, let url = panel.url {
            completion(url.path)
        }
    }
}

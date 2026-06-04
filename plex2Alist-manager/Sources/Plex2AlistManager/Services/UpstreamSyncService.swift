import Foundation

// MARK: - Upstream Sync Service

final class UpstreamSyncService: @unchecked Sendable {
    static let shared = UpstreamSyncService()
    static let defaultOnlineRepoURL = "https://github.com/bpking1/embyExternalUrl.git"

    struct SyncReport: Codable, Equatable {
        let sourceNginxDirectory: String
        let targetNginxDirectory: String
        let copiedFiles: [String]
        let skippedFiles: [String]
        let protectedFiles: [String]
        let backupFiles: [String]
        let errors: [String]

        var succeeded: Bool {
            errors.isEmpty
        }
    }

    private let queue = DispatchQueue(label: "upstream.sync.service")

    func defaultOnlineCacheDirectory() -> String {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return support
            .appendingPathComponent("Plex2AlistManager", isDirectory: true)
            .appendingPathComponent("upstream/embyExternalUrl", isDirectory: true)
            .path
    }

    func syncOnlineRepository(repoURL: String, cacheDirectory: String) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                let result = RustCoreService.shared.decode(
                    CommandResult.self,
                    arguments: [
                        "git-sync",
                        "--url", repoURL,
                        "--dir", cacheDirectory
                    ]
                )
                switch result {
                case .success(let commandResult):
                    continuation.resume(returning: commandResult)
                case .failure(let commandResult):
                    continuation.resume(returning: commandResult)
                }
            }
        }
    }

    func pullRepository(repoDirectory: String) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                let result = RustCoreService.shared.decode(
                    CommandResult.self,
                    arguments: ["git-pull", "--repo", repoDirectory]
                )
                switch result {
                case .success(let commandResult):
                    continuation.resume(returning: commandResult)
                case .failure(let commandResult):
                    continuation.resume(returning: commandResult)
                }
            }
        }
    }

    func syncPreservingParameters(
        sourceDirectory: String,
        targetNginxDirectory: String,
        serverType: MediaServerType
    ) async -> SyncReport {
        let resolvedSource = resolveSourceNginxDirectory(sourceDirectory: sourceDirectory, serverType: serverType) ?? sourceDirectory
        return await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.syncPreservingParametersSync(
                    sourceDirectory: resolvedSource,
                    targetNginxDirectory: targetNginxDirectory
                ))
            }
        }
    }

    func resolveSourceNginxDirectory(sourceDirectory: String, serverType: MediaServerType) -> String? {
        let source = URL(fileURLWithPath: sourceDirectory, isDirectory: true)
        let typeSubfolder = (serverType == .plex) ? "plex2Alist/nginx" : "emby2Alist/nginx"
        let candidates = [
            source.appendingPathComponent(typeSubfolder),
            source.appendingPathComponent("nginx"),
            source
        ]
        return candidates.first { url in
            FileManager.default.fileExists(atPath: url.appendingPathComponent("nginx.conf").path)
                && FileManager.default.fileExists(atPath: url.appendingPathComponent("conf.d").path)
        }?.path
    }

    private func syncPreservingParametersSync(
        sourceDirectory: String,
        targetNginxDirectory: String
    ) -> SyncReport {
        let result = RustCoreService.shared.decode(
            SyncReport.self,
            arguments: [
                "upstream-sync",
                "--source", sourceDirectory,
                "--target", targetNginxDirectory
            ]
        )

        switch result {
        case .success(let report):
            return report
        case .failure(let commandResult):
            return SyncReport(
                sourceNginxDirectory: "",
                targetNginxDirectory: targetNginxDirectory,
                copiedFiles: [],
                skippedFiles: [],
                protectedFiles: [],
                backupFiles: [],
                errors: [commandResult.stderr.isEmpty ? commandResult.stdout : commandResult.stderr]
            )
        }
    }
}

import Foundation

// MARK: - Docker Install Service

final class DockerInstallService: @unchecked Sendable {
    static let shared = DockerInstallService()

    enum Provider: String, CaseIterable, Identifiable {
        case orbStack
        case dockerDesktop

        var id: String { rawValue }

        var title: String {
            switch self {
            case .orbStack: return "OrbStack"
            case .dockerDesktop: return "Docker Desktop"
            }
        }

        var appName: String {
            switch self {
            case .orbStack: return "OrbStack"
            case .dockerDesktop: return "Docker"
            }
        }

        var appPath: String {
            "/Applications/\(appName).app"
        }

        var caskName: String {
            switch self {
            case .orbStack: return "orbstack"
            case .dockerDesktop: return "docker"
            }
        }

        var downloadURL: URL {
            switch self {
            case .orbStack:
                return URL(string: "https://orbstack.dev/download")!
            case .dockerDesktop:
                return URL(string: "https://docs.docker.com/desktop/setup/install/mac-install/")!
            }
        }
    }

    struct Status: Equatable {
        let homebrewPath: String
        let dockerPath: String
        let dockerVersion: String
        let composeVersion: String
        let engineVersion: String
        let dockerContext: String
        let orbStackInstalled: Bool
        let dockerDesktopInstalled: Bool
        let dockerAvailable: Bool
        let engineAvailable: Bool

        static let empty = Status(
            homebrewPath: "",
            dockerPath: "",
            dockerVersion: "",
            composeVersion: "",
            engineVersion: "",
            dockerContext: "",
            orbStackInstalled: false,
            dockerDesktopInstalled: false,
            dockerAvailable: false,
            engineAvailable: false
        )
    }

    private let queue = DispatchQueue(label: "docker.install.service")

    func refreshStatus() async -> Status {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.refreshStatusSync())
            }
        }
    }

    func openHomebrewInstall(provider: Provider) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                let status = self.refreshStatusSync()
                guard !status.homebrewPath.isEmpty else {
                    continuation.resume(returning: CommandResult(
                        command: self.installCommand(provider: provider),
                        exitCode: -1,
                        stdout: "",
                        stderr: "未找到 Homebrew。请先安装 Homebrew，或使用官方下载入口。"
                    ))
                    return
                }

                let command = self.installCommand(provider: provider)
                continuation.resume(returning: self.openTerminal(command: command))
            }
        }
    }

    func openInstalledApp(provider: Provider) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.runCommand(
                    "/usr/bin/open",
                    args: ["-a", provider.appName]
                ))
            }
        }
    }

    func installCommand(provider: Provider) -> String {
        let path = dockerToolPath()
        return """
        export PATH="\(path):$PATH"; brew install --cask \(provider.caskName); open -a "\(provider.appName)"
        """
    }

    private func refreshStatusSync() -> Status {
        let homebrew = runCommand("/usr/bin/env", args: ["which", "brew"])
        let docker = runCommand("/usr/bin/env", args: ["which", "docker"])
        let dockerVersion = runCommand("/usr/bin/env", args: ["docker", "--version"])
        let composeVersion = runCommand("/usr/bin/env", args: ["docker", "compose", "version"])
        let engineVersion = runCommand("/usr/bin/env", args: ["docker", "info", "--format", "{{.ServerVersion}}"])
        let context = runCommand("/usr/bin/env", args: ["docker", "context", "show"])

        return Status(
            homebrewPath: trim(homebrew.stdout),
            dockerPath: trim(docker.stdout),
            dockerVersion: trim(dockerVersion.stdout),
            composeVersion: trim(composeVersion.stdout),
            engineVersion: trim(engineVersion.stdout),
            dockerContext: trim(context.stdout),
            orbStackInstalled: FileManager.default.fileExists(atPath: Provider.orbStack.appPath),
            dockerDesktopInstalled: FileManager.default.fileExists(atPath: Provider.dockerDesktop.appPath),
            dockerAvailable: docker.exitCode == 0 && !trim(docker.stdout).isEmpty,
            engineAvailable: engineVersion.exitCode == 0 && !trim(engineVersion.stdout).isEmpty
        )
    }

    private func openTerminal(command: String) -> CommandResult {
        let script = """
        tell application "Terminal"
            activate
            do script "\(appleScriptEscaped(command))"
        end tell
        """
        return runCommand("/usr/bin/osascript", args: ["-e", script])
    }

    private func runCommand(_ command: String, args: [String]) -> CommandResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = args
        process.environment = commandEnvironment()

        let outPipe = Pipe()
        let errPipe = Pipe()
        process.standardOutput = outPipe
        process.standardError = errPipe

        do {
            try process.run()
            process.waitUntilExit()
            let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
            let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
            return CommandResult(
                command: ([command] + args).joined(separator: " "),
                exitCode: process.terminationStatus,
                stdout: String(data: outData, encoding: .utf8) ?? "",
                stderr: String(data: errData, encoding: .utf8) ?? ""
            )
        } catch {
            return CommandResult(
                command: ([command] + args).joined(separator: " "),
                exitCode: -1,
                stdout: "",
                stderr: error.localizedDescription
            )
        }
    }

    private func commandEnvironment() -> [String: String] {
        var env = ProcessInfo.processInfo.environment
        let existingPath = env["PATH"] ?? "/usr/bin:/bin"
        env["PATH"] = "\(dockerToolPath()):\(existingPath)"
        return env
    }

    private func dockerToolPath() -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/opt/homebrew/sbin",
            "/usr/local/sbin",
            "\(home)/.orbstack/bin",
            "\(home)/.docker/bin"
        ].joined(separator: ":")
    }

    private func trim(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func appleScriptEscaped(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }
}

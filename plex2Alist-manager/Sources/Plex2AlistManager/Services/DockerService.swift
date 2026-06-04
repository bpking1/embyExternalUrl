import Foundation
import Darwin

// MARK: - Docker Service

final class DockerService: ObservableObject {
    static let shared = DockerService()

    @Published var isAvailable: Bool = false
    @Published var containerRunning: Bool = false
    @Published var containerStatus: String = ""
    @Published var lastCommandResult: CommandResult?

    private let processQueue = DispatchQueue(label: "docker.service")

    func detect() async {
        let result = await runCommand("/usr/bin/env", args: ["docker", "info", "--format", "{{.ServerVersion}}"], timeout: 8)
        await MainActor.run {
            isAvailable = result.exitCode == 0 && !result.stdout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    func ps(mediaServerType: MediaServerType = ConfigService.shared.config.mediaServerType) async -> String {
        let candidates = mediaServerType.containerCandidates
        let filters = candidates.flatMap { ["--filter", "name=\($0)"] }
        let result = await runCommand("/usr/bin/env", args: ["docker", "ps", "-a"] + filters + ["--format", "{{.Names}}\t{{.Status}}"], timeout: 8)
        let output = result.stdout.trimmingCharacters(in: .whitespacesAndNewlines)

        // 解析容器名和状态
        let lines = output.split(separator: "\n").map(String.init)
        let containers = lines.map { line -> (name: String, status: String) in
            let parts = line.split(separator: "\t", maxSplits: 1).map(String.init)
            return (parts.first ?? "", parts.count > 1 ? parts[1] : "")
        }
        if let currentContainer = containers.first(where: { candidates.contains($0.name) }) ?? containers.first {
            await MainActor.run {
                containerRunning = currentContainer.status.contains("Up")
                containerStatus = "\(currentContainer.name) — \(currentContainer.status)"
            }
            return currentContainer.status
        } else {
            await MainActor.run {
                containerRunning = false
                containerStatus = "未找到 \(mediaServerType.containerName) 容器"
            }
            return ""
        }
    }

    func up(directory: String) async -> CommandResult {
        let result = await runCommand("/usr/bin/env", args: ["docker", "compose", "-f", "\(directory)/docker-compose.yml", "up", "-d"], timeout: 90)
        await MainActor.run { self.lastCommandResult = result }
        _ = await ps()
        return result
    }

    func down(directory: String) async -> CommandResult {
        let result = await runCommand("/usr/bin/env", args: ["docker", "compose", "-f", "\(directory)/docker-compose.yml", "down"], timeout: 30)
        await MainActor.run { self.lastCommandResult = result }
        _ = await ps()
        return result
    }

    func restart(directory: String) async -> CommandResult {
        let result = await runCommand("/usr/bin/env", args: ["docker", "compose", "-f", "\(directory)/docker-compose.yml", "restart"], timeout: 30)
        await MainActor.run { self.lastCommandResult = result }
        _ = await ps()
        return result
    }

    func logs(tail: Int = 100, mediaServerType: MediaServerType = ConfigService.shared.config.mediaServerType) async -> String {
        let container = findContainerName(mediaServerType: mediaServerType)
        guard !container.isEmpty else { return "未找到容器" }
        let result = await runCommand("/usr/bin/env", args: ["docker", "logs", "--tail", "\(tail)", container], timeout: 15)
        return result.stdout
    }

    func nginxTest(mediaServerType: MediaServerType = ConfigService.shared.config.mediaServerType) async -> CommandResult {
        let container = findContainerName(mediaServerType: mediaServerType)
        if container.isEmpty {
            return CommandResult(command: "nginx -t", exitCode: -1, stdout: "", stderr: "未找到 nginx 容器")
        }
        let result = await runCommand("/usr/bin/env", args: ["docker", "exec", container, "nginx", "-t"], timeout: 15)
        await MainActor.run { self.lastCommandResult = result }
        return result
    }

    func reloadNginx(mediaServerType: MediaServerType = ConfigService.shared.config.mediaServerType) async -> CommandResult {
        let container = findContainerName(mediaServerType: mediaServerType)
        if container.isEmpty {
            return CommandResult(command: "nginx -s reload", exitCode: -1, stdout: "", stderr: "未找到正在运行的 nginx 容器")
        }
        let result = await runCommand("/usr/bin/env", args: ["docker", "exec", container, "nginx", "-s", "reload"], timeout: 15)
        await MainActor.run { self.lastCommandResult = result }
        return result
    }

    func composeConfig(directory: String) async -> CommandResult {
        let result = await runCommand("/usr/bin/env", args: ["docker", "compose", "-f", "\(directory)/docker-compose.yml", "config"], timeout: 30)
        await MainActor.run { self.lastCommandResult = result }
        return result
    }

    // MARK: - Helper

    /// 查找当前媒体类型对应的正在运行的 nginx 容器。
    private func findContainerName(mediaServerType: MediaServerType) -> String {
        for name in mediaServerType.containerCandidates {
            let result = runCommandSync("/usr/bin/env", args: ["docker", "ps", "--filter", "name=\(name)", "--filter", "status=running", "--format", "{{.Names}}"], timeout: 8)
            let out = result.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
            if let matched = out.split(separator: "\n").map(String.init).first(where: { $0 == name }) {
                return matched
            }
            if !out.isEmpty { return out }
        }
        return ""
    }

    private func runCommandSync(_ command: String, args: [String], timeout: TimeInterval = 10) -> CommandResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = args

        let existingPath = ProcessInfo.processInfo.environment["PATH"] ?? "/usr/bin:/bin"
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let dockerPaths = [
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "\(home)/.orbstack/bin",
            "\(home)/.docker/bin"
        ]
        let extendedPath = (dockerPaths + [existingPath]).joined(separator: ":")
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = extendedPath
        process.environment = env

        let outPipe = Pipe()
        let errPipe = Pipe()
        process.standardOutput = outPipe
        process.standardError = errPipe

        do {
            try process.run()
            let timedOut = Self.wait(for: process, timeout: timeout)
            if timedOut {
                Self.terminate(process)
            }
            let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
            let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
            return CommandResult(
                command: ([command] + args).joined(separator: " "),
                exitCode: timedOut ? -9 : process.terminationStatus,
                stdout: String(data: outData, encoding: .utf8) ?? "",
                stderr: timedOut ? "Command timed out after \(Int(timeout))s" : (String(data: errData, encoding: .utf8) ?? "")
            )
        } catch {
            return CommandResult(command: "", exitCode: -1, stdout: "", stderr: error.localizedDescription)
        }
    }

    // MARK: - Process Runner

    private func runCommand(_ command: String, args: [String], timeout: TimeInterval = 30) async -> CommandResult {
        return await withCheckedContinuation { continuation in
            processQueue.async {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: command)
                process.arguments = args

                let outPipe = Pipe()
                let errPipe = Pipe()
                process.standardOutput = outPipe
                process.standardError = errPipe

                // macOS GUI app 的 PATH 只有 /usr/bin:/bin，手动补全 Docker 路径
                let existingPath = ProcessInfo.processInfo.environment["PATH"] ?? "/usr/bin:/bin"
                let home = FileManager.default.homeDirectoryForCurrentUser.path
                let dockerPaths = [
                    "/usr/local/bin",
                    "/opt/homebrew/bin",
                    "/opt/homebrew/sbin",
                    "\(home)/.orbstack/bin",
                    "\(home)/.docker/bin"
                ]
                let extendedPath = (dockerPaths + [existingPath]).joined(separator: ":")
                var env = ProcessInfo.processInfo.environment
                env["PATH"] = extendedPath
                process.environment = env

                let start = Date()
                do {
                    try process.run()
                    let timedOut = Self.wait(for: process, timeout: timeout)
                    if timedOut {
                        Self.terminate(process)
                    }

                    let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
                    let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
                    _ = Int(Date().timeIntervalSince(start) * 1000)

                    let result = CommandResult(
                        command: ([command] + args).joined(separator: " "),
                        exitCode: timedOut ? -9 : process.terminationStatus,
                        stdout: String(data: outData, encoding: .utf8) ?? "",
                        stderr: timedOut ? "Command timed out after \(Int(timeout))s" : (String(data: errData, encoding: .utf8) ?? ""),
                    )
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(returning: CommandResult(
                        command: ([command] + args).joined(separator: " "),
                        exitCode: -1,
                        stdout: "",
                        stderr: error.localizedDescription
                    ))
                }
            }
        }
    }

    private static func wait(for process: Process, timeout: TimeInterval) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }
        return process.isRunning
    }

    private static func terminate(_ process: Process) {
        guard process.isRunning else { return }
        process.terminate()
        let deadline = Date().addingTimeInterval(2)
        while process.isRunning && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.05)
        }
        if process.isRunning {
            kill(process.processIdentifier, SIGKILL)
        }
    }
}

import Foundation

// MARK: - Certificate Automation Service

final class CertificateAutomationService: @unchecked Sendable {
    static let shared = CertificateAutomationService()

    enum IssueMode: String, CaseIterable, Identifiable {
        case standalone
        case webroot
        case customDNS

        var id: String { rawValue }

        var title: String {
            switch self {
            case .standalone: return "Standalone 80"
            case .webroot: return "Webroot"
            case .customDNS: return "DNS API"
            }
        }
    }

    struct Status: Equatable {
        let acmePath: String
        let acmeVersion: String

        static let empty = Status(acmePath: "", acmeVersion: "")
    }

    struct Request: Equatable {
        var domains: String
        var email: String
        var mode: IssueMode
        var webrootPath: String
        var customIssueArguments: String
        var preflightShell: String
        var certDirectory: String
        var pfxPassword: String
        var reloadAfterRenew: Bool
    }

    private let queue = DispatchQueue(label: "certificate.automation.service")

    func refreshStatus() async -> Status {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.refreshStatusSync())
            }
        }
    }

    func openInstallAcme(email: String) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
                let suffix = cleanEmail.isEmpty ? "" : " email=\(self.shellQuote(cleanEmail))"
                let command = "curl https://get.acme.sh | sh -s\(suffix)"
                continuation.resume(returning: self.openTerminal(command: command))
            }
        }
    }

    func openIssueAndInstall(_ request: Request) async -> CommandResult {
        await withCheckedContinuation { continuation in
            queue.async {
                do {
                    let hook = try self.writeRenewHook(request)
                    let command = try self.issueAndInstallCommand(request, hookPath: hook.path)
                    continuation.resume(returning: self.openTerminal(command: command))
                } catch {
                    continuation.resume(returning: CommandResult(
                        command: "acme.sh issue",
                        exitCode: -1,
                        stdout: "",
                        stderr: error.localizedDescription
                    ))
                }
            }
        }
    }

    func defaultWebrootDirectory(deploymentDirectory: String) -> String {
        URL(fileURLWithPath: deploymentDirectory, isDirectory: true)
            .appendingPathComponent("acme-webroot", isDirectory: true)
            .path
    }

    private func refreshStatusSync() -> Status {
        let acme = acmePath()
        guard !acme.isEmpty else { return .empty }
        let version = runCommand(acme, args: ["--version"])
        return Status(acmePath: acme, acmeVersion: trim(version.stdout + version.stderr))
    }

    private func issueAndInstallCommand(_ request: Request, hookPath: String) throws -> String {
        let domains = parsedDomains(request.domains)
        guard let primaryDomain = domains.first else {
            throw NSError(domain: "CertificateAutomationService", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "请至少填写一个域名"
            ])
        }

        let status = refreshStatusSync()
        let acme = status.acmePath.isEmpty ? "$HOME/.acme.sh/acme.sh" : shellQuote(status.acmePath)
        let certDir = request.certDirectory.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !certDir.isEmpty else {
            throw NSError(domain: "CertificateAutomationService", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "证书目录不能为空"
            ])
        }

        let domainArgs = domains.flatMap { ["-d", shellQuote($0)] }.joined(separator: " ")
        let issueModeArgs: String
        switch request.mode {
        case .standalone:
            issueModeArgs = "--standalone"
        case .webroot:
            let webroot = request.webrootPath.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !webroot.isEmpty else {
                throw NSError(domain: "CertificateAutomationService", code: 3, userInfo: [
                    NSLocalizedDescriptionKey: "Webroot 目录不能为空"
                ])
            }
            issueModeArgs = "-w \(shellQuote(webroot))"
        case .customDNS:
            let custom = request.customIssueArguments.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !custom.isEmpty else {
                throw NSError(domain: "CertificateAutomationService", code: 4, userInfo: [
                    NSLocalizedDescriptionKey: "DNS API 参数不能为空，例如 --dns dns_cf"
                ])
            }
            issueModeArgs = custom
        }

        let preflight = request.preflightShell.trimmingCharacters(in: .whitespacesAndNewlines)
        let cert = URL(fileURLWithPath: certDir, isDirectory: true).appendingPathComponent("cert.pem").path
        let key = URL(fileURLWithPath: certDir, isDirectory: true).appendingPathComponent("key.pem").path
        let fullchain = URL(fileURLWithPath: certDir, isDirectory: true).appendingPathComponent("fullchain.pem").path

        var lines: [String] = [
            "set -e",
            "mkdir -p \(shellQuote(certDir))"
        ]
        if !preflight.isEmpty {
            lines.append(preflight)
        }
        lines.append("\(acme) --set-default-ca --server letsencrypt")
        lines.append("\(acme) --issue --server letsencrypt \(domainArgs) \(issueModeArgs) --keylength 2048")
        lines.append(
            "\(acme) --install-cert -d \(shellQuote(primaryDomain)) --cert-file \(shellQuote(cert)) --key-file \(shellQuote(key)) --fullchain-file \(shellQuote(fullchain)) --reloadcmd \(shellQuote(hookPath))"
        )
        lines.append(shellQuote(hookPath))
        return lines.joined(separator: "; ")
    }

    private func writeRenewHook(_ request: Request) throws -> URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let hookDir = support
            .appendingPathComponent("Plex2AlistManager", isDirectory: true)
            .appendingPathComponent("acme-hooks", isDirectory: true)
        try FileManager.default.createDirectory(at: hookDir, withIntermediateDirectories: true)

        let primary = parsedDomains(request.domains).first ?? "certificate"
        let safeName = primary
            .replacingOccurrences(of: "*", with: "wildcard")
            .replacingOccurrences(of: ".", with: "_")
            .replacingOccurrences(of: "-", with: "_")
        let hook = hookDir.appendingPathComponent("renew-\(safeName).sh")
        let corePath = Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/plex2alist-core").path
        let reload = request.reloadAfterRenew ? reloadScript() : ""
        let content = """
        #!/bin/sh
        set -eu
        CORE=\(shellQuote(corePath))
        if [ ! -x "$CORE" ]; then
          CORE="plex2alist-core"
        fi
        "$CORE" cert-refresh-pfx --dir \(shellQuote(request.certDirectory)) --pfx-password \(shellQuote(request.pfxPassword))
        \(reload)
        """
        try content.write(to: hook, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: hook.path)
        return hook
    }

    private func reloadScript() -> String {
        """
        PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.orbstack/bin:$HOME/.docker/bin:$PATH"
        docker exec plex2Alist-nginx nginx -s reload 2>/dev/null || docker exec emby2Alist-nginx nginx -s reload 2>/dev/null || docker exec jellyfin2Alist-nginx nginx -s reload 2>/dev/null || docker exec nginx-plex nginx -s reload 2>/dev/null || docker exec nginx-emby nginx -s reload 2>/dev/null || docker exec nginx-jellyfin nginx -s reload 2>/dev/null || true
        """
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

    private func acmePath() -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = [
            "\(home)/.acme.sh/acme.sh",
            "/opt/homebrew/bin/acme.sh",
            "/usr/local/bin/acme.sh"
        ]
        if let existing = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) {
            return existing
        }
        let which = runCommand("/usr/bin/env", args: ["which", "acme.sh"])
        return trim(which.stdout)
    }

    private func runCommand(_ command: String, args: [String]) -> CommandResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = args

        var env = ProcessInfo.processInfo.environment
        let existingPath = env["PATH"] ?? "/usr/bin:/bin"
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        env["PATH"] = [
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "\(home)/.acme.sh",
            existingPath
        ].joined(separator: ":")
        process.environment = env

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

    private func parsedDomains(_ value: String) -> [String] {
        value
            .split { $0 == "," || $0 == "\n" || $0 == " " || $0 == "\t" }
            .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func shellQuote(_ value: String) -> String {
        "'\(value.replacingOccurrences(of: "'", with: "'\\''"))'"
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

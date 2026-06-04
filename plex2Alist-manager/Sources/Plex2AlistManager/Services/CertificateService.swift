import Foundation

// MARK: - Certificate Service

final class CertificateService: @unchecked Sendable {
    static let shared = CertificateService()

    struct CertificateUpdateReport: Codable, Equatable {
        let certDirectory: String
        let filesWritten: [String]
        let backups: [String]
        let certificateInfo: String
        let commandResult: CommandResult

        var succeeded: Bool {
            commandResult.exitCode == 0
        }
    }

    struct CertificateInspection: Equatable {
        let certificatePath: String
        let subject: String
        let issuer: String
        let notBefore: Date?
        let notAfter: Date?
        let rawOutput: String
        let commandResult: CommandResult

        var daysRemaining: Int? {
            guard let notAfter else { return nil }
            return Calendar.current.dateComponents([.day], from: Date(), to: notAfter).day
        }

        var isExpired: Bool {
            guard let notAfter else { return false }
            return notAfter < Date()
        }
    }

    private let queue = DispatchQueue(label: "certificate.service")

    func updateCertificate(
        certificatePath: String,
        privateKeyPath: String,
        certDirectory: String,
        pfxPassword: String,
        privateKeyPassword: String
    ) async -> CertificateUpdateReport {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.updateCertificateSync(
                    certificatePath: certificatePath,
                    privateKeyPath: privateKeyPath,
                    certDirectory: certDirectory,
                    pfxPassword: pfxPassword,
                    privateKeyPassword: privateKeyPassword
                ))
            }
        }
    }

    func inspectCertificate(certDirectory: String) async -> CertificateInspection {
        await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: self.inspectCertificateSync(certDirectory: certDirectory))
            }
        }
    }

    private func updateCertificateSync(
        certificatePath: String,
        privateKeyPath: String,
        certDirectory: String,
        pfxPassword: String,
        privateKeyPassword: String
    ) -> CertificateUpdateReport {
        let result = RustCoreService.shared.decode(
            CertificateUpdateReport.self,
            arguments: [
                "cert-update",
                "--cert", certificatePath,
                "--key", privateKeyPath,
                "--dir", certDirectory,
                "--pfx-password", pfxPassword,
                "--key-password", privateKeyPassword
            ]
        )

        switch result {
        case .success(let report):
            return report
        case .failure(let commandResult):
            return CertificateUpdateReport(
                certDirectory: certDirectory,
                filesWritten: [],
                backups: [],
                certificateInfo: "",
                commandResult: commandResult
            )
        }
    }

    private func inspectCertificateSync(certDirectory: String) -> CertificateInspection {
        let dir = URL(fileURLWithPath: certDirectory, isDirectory: true)
        let candidates = [
            dir.appendingPathComponent("fullchain.pem"),
            dir.appendingPathComponent("cert.pem")
        ]
        guard let certURL = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }) else {
            let result = CommandResult(
                command: "openssl x509",
                exitCode: -1,
                stdout: "",
                stderr: "未找到 fullchain.pem 或 cert.pem"
            )
            return CertificateInspection(
                certificatePath: "",
                subject: "",
                issuer: "",
                notBefore: nil,
                notAfter: nil,
                rawOutput: "",
                commandResult: result
            )
        }

        let result = runCommand("/usr/bin/openssl", args: [
            "x509",
            "-in", certURL.path,
            "-noout",
            "-subject",
            "-issuer",
            "-dates"
        ])
        let output = result.stdout.isEmpty ? result.stderr : result.stdout
        return CertificateInspection(
            certificatePath: certURL.path,
            subject: value(named: "subject", in: output),
            issuer: value(named: "issuer", in: output),
            notBefore: parseOpenSSLDate(value(named: "notBefore", in: output)),
            notAfter: parseOpenSSLDate(value(named: "notAfter", in: output)),
            rawOutput: output,
            commandResult: result
        )
    }

    private func runCommand(_ command: String, args: [String]) -> CommandResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = args

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

    private func value(named name: String, in output: String) -> String {
        output
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
            .first { $0.hasPrefix("\(name)=") }
            .map { String($0.dropFirst(name.count + 1)) }
            ?? ""
    }

    private func parseOpenSSLDate(_ value: String) -> Date? {
        let normalized = value
            .split(whereSeparator: { $0 == " " || $0 == "\t" })
            .joined(separator: " ")
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d HH:mm:ss yyyy zzz"
        return formatter.date(from: normalized)
    }

    private func failure(certDirectory: String, message: String) -> CertificateUpdateReport {
        CertificateUpdateReport(
            certDirectory: certDirectory,
            filesWritten: [],
            backups: [],
            certificateInfo: "",
            commandResult: CommandResult(
                command: "certificate update",
                exitCode: -1,
                stdout: "",
                stderr: message
            )
        )
    }
}

import Foundation

// MARK: - Template Renderer

final class TemplateRenderer {
    static let shared = TemplateRenderer()

    /// Replace `{{VARIABLE}}` placeholders in template text with values from `variables`.
    /// Returns (renderedText, unresolvedKeys).
    func render(template: String, variables: [String: String]) -> (String, [String]) {
        var result = template
        var unresolved: [String] = []

        for (key, value) in variables {
            result = result.replacingOccurrences(of: "{{\(key)}}", with: value)
        }

        // Check for any remaining placeholders
        let pattern = #"\{\{(\w+)\}\}"#
        if let regex = try? NSRegularExpression(pattern: pattern) {
            let range = NSRange(result.startIndex..., in: result)
            let matches = regex.matches(in: result, range: range)
            for match in matches {
                if let r = Range(match.range(at: 1), in: result) {
                    unresolved.append(String(result[r]))
                }
            }
        }

        return (result, unresolved)
    }

    /// Write rendered content to a file atomically, backing up existing file if present.
    @discardableResult
    func writeRendered(content: String, to url: URL, backupDir: String? = nil) throws -> String? {
        let fm = FileManager.default

        // Backup existing file
        var backupPath: String?
        if fm.fileExists(atPath: url.path), let backupDir = backupDir {
            let timestamp = ISO8601DateFormatter().string(from: Date())
                .replacingOccurrences(of: ":", with: "-")
            let backupURL = URL(fileURLWithPath: backupDir)
                .appendingPathComponent("\(url.lastPathComponent).\(timestamp).bak")
            try fm.copyItem(at: url, to: backupURL)
            backupPath = backupURL.path
        }

        // Write atomically
        try content.write(to: url, atomically: true, encoding: .utf8)
        return backupPath
    }
}

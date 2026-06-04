import Foundation

// MARK: - Existing Config Scanner

/// 从已部署的 nginx 配置目录中读取当前的 constant*.js 设置。
/// 让用户不需要手动填写，直接读取已有配置。
final class ExistingConfigScanner {

    static let shared = ExistingConfigScanner()

    struct ScannedConfig {
        var mediaServerType: MediaServerType?
        var serverURL: String?
        var plexURL: String?
        var embyApiKey: String?
        var proxyPort: Int?
        var proxyHttpsPort: Int?
        var openListURL: String?
        var openListToken: String?
        var openListPublicURL: String?
        var signEnabled: Bool?
        var signExpireHours: Int?
        var redirectEnabled: Bool?
        var transcodeEnabled: Bool?
        var routeCacheEnabled: Bool?
        var fallbackUseOriginal: Bool?
        var mediaMountPaths: [String] = []
        var pathMappings: [(local: String, remote: String)] = []
    }

    /// 扫描指定 nginx 配置目录下的所有 constant*.js，返回识别的配置。
    func scan(nginxConfDir: String, preferredType: MediaServerType? = nil) -> ScannedConfig {
        var result = ScannedConfig()

        let confdDir = URL(fileURLWithPath: nginxConfDir).appendingPathComponent("conf.d")
        let configDir = confdDir.appendingPathComponent("config")

        // 1. constant.js — 解析 plexHost / embyHost。Jellyfin 复用 emby2Alist 上游变量名。
        if let content = try? String(contentsOf: confdDir.appendingPathComponent("constant.js"), encoding: .utf8) {
            if content.contains("plexHost") {
                result.mediaServerType = .plex
                result.serverURL = extractStringConstant(from: content, variable: "plexHost")
                result.plexURL = result.serverURL
            } else if content.contains("embyHost") {
                result.mediaServerType = preferredType == .jellyfin ? .jellyfin : .emby
                result.serverURL = extractStringConstant(from: content, variable: "embyHost")
                result.embyApiKey = extractStringConstant(from: content, variable: "embyApiKey")
            }
            result.mediaMountPaths = extractArrayConstant(from: content, variable: "mediaMountPath")
        }

        // 2. constant-mount.js — OpenList / AList 连接参数
        let mountURL = configDir.appendingPathComponent("constant-mount.js")
        if let content = try? String(contentsOf: mountURL, encoding: .utf8) {
            result.openListURL = extractStringConstant(from: content, variable: "alistAddr")
            result.openListToken = extractStringConstant(from: content, variable: "alistToken")
            result.openListPublicURL = extractStringConstant(from: content, variable: "alistPublicAddr")
            result.signEnabled = extractBoolConstant(from: content, variable: "alistSignEnable")
            result.signExpireHours = extractIntConstant(from: content, variable: "alistSignExpireTime")
            result.fallbackUseOriginal = extractBoolConstant(from: content, variable: "fallbackUseOriginal")
        }

        // 3. constant-pro.js — 302 开关、缓存、路径映射
        let proURL = configDir.appendingPathComponent("constant-pro.js")
        if let content = try? String(contentsOf: proURL, encoding: .utf8) {
            result.redirectEnabled = extractObjectBool(from: content, object: "redirectConfig", property: "enable")
            result.routeCacheEnabled = extractObjectBool(from: content, object: "routeCacheConfig", property: "enable")
            result.pathMappings = extractPathMappings(from: content)
        }

        // 4. constant-transcode.js
        let transcodeURL = configDir.appendingPathComponent("constant-transcode.js")
        if let content = try? String(contentsOf: transcodeURL, encoding: .utf8) {
            result.transcodeEnabled = extractObjectBool(from: content, object: "transcodeConfig", property: "enable")
        }

        // 5. http.conf — 提取代理端口
        let includesDir = confdDir.appendingPathComponent("includes")
        let httpConfURL = includesDir.appendingPathComponent("http.conf")
        if let content = try? String(contentsOf: httpConfURL, encoding: .utf8) {
            result.proxyPort = extractPortFromHttpConf(content)
        }

        // 6. https.conf — 提取 HTTPS 代理端口
        let httpsConfURL = includesDir.appendingPathComponent("https.conf")
        if let content = try? String(contentsOf: httpsConfURL, encoding: .utf8) {
            result.proxyHttpsPort = extractPortFromHttpConf(content)
        }

        return result
    }

    // MARK: - JS 解析器

    /// 提取字符串常量: const xxx = "value";
    private func extractStringConstant(from text: String, variable: String) -> String? {
        let escVar = NSRegularExpression.escapedPattern(for: variable)
        let pattern = "(?:const|let|var)\\s+\(escVar)\\s*=\\s*\"([^\"]*?)\\s*\"\\s*;"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else { return nil }
        return String(text[valueRange]).trimmingCharacters(in: .whitespaces)
    }

    /// 提取布尔常量: const xxx = true/false;
    private func extractBoolConstant(from text: String, variable: String) -> Bool? {
        let escVar = NSRegularExpression.escapedPattern(for: variable)
        let pattern = "(?:const|let|var)\\s+\(escVar)\\s*=\\s*(true|false)\\s*;"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else { return nil }
        return text[valueRange] == "true"
    }

    /// 提取整数常量: const xxx = 123;
    private func extractIntConstant(from text: String, variable: String) -> Int? {
        let escVar = NSRegularExpression.escapedPattern(for: variable)
        let pattern = "(?:const|let|var)\\s+\(escVar)\\s*=\\s*(\\d+)\\s*;"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else { return nil }
        return Int(text[valueRange])
    }

    /// 提取对象中的布尔属性: const obj = { prop: true/false };
    private func extractObjectBool(from text: String, object: String, property: String) -> Bool? {
        let escObj = NSRegularExpression.escapedPattern(for: object)
        let escProp = NSRegularExpression.escapedPattern(for: property)
        let blockPattern = "(?:const|let|var)\\s+\(escObj)\\s*=\\s*\\{"
        guard let blockRegex = try? NSRegularExpression(pattern: blockPattern) else { return nil }

        let nsRange = NSRange(text.startIndex..., in: text)
        guard let blockMatch = blockRegex.firstMatch(in: text, range: nsRange) else { return nil }

        // 从 const xxx = { 之后开始找 prop: true/false
        let searchStart = blockMatch.range.upperBound
        let searchRange = NSRange(location: searchStart, length: nsRange.length - searchStart)
        let propPattern = "\(escProp)\\s*:\\s*(true|false)"
        guard let propRegex = try? NSRegularExpression(pattern: propPattern) else { return nil }
        guard let propMatch = propRegex.firstMatch(in: text, range: searchRange),
              propMatch.numberOfRanges > 1,
              let valueRange = Range(propMatch.range(at: 1), in: text) else { return nil }
        return text[valueRange] == "true"
    }

    /// 提取字符串数组: const xxx = ["a", "b"];
    private func extractArrayConstant(from text: String, variable: String) -> [String] {
        let escVar = NSRegularExpression.escapedPattern(for: variable)
        let pattern = "(?:const|let|var)\\s+\(escVar)\\s*=\\s*\\[([^\\]]*)\\]\\s*;"
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let arrayRange = Range(match.range(at: 1), in: text) else { return [] }

        let arrayContent = String(text[arrayRange])
        // 提取所有引号内的内容
        let itemPattern = "\"([^\"]*)\""
        guard let itemRegex = try? NSRegularExpression(pattern: itemPattern) else { return [] }
        let itemMatches = itemRegex.matches(in: arrayContent, range: NSRange(arrayContent.startIndex..., in: arrayContent))
        return itemMatches.compactMap { m in
            guard m.numberOfRanges > 1, let r = Range(m.range(at: 1), in: arrayContent) else { return nil }
            let val = String(arrayContent[r])
            return val.trimmingCharacters(in: .whitespaces).isEmpty ? nil : val.trimmingCharacters(in: .whitespaces)
        }
    }

    /// 提取 mediaPathMapping 中的路径对 [[0,0,"from","to"], ...]
    private func extractPathMappings(from text: String) -> [(String, String)] {
        var result: [(String, String)] = []
        let pattern = "\\[0,\\s*0,\\s*\"([^\"]*)\",\\s*\"([^\"]*)\"\\]"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: range)
        for match in matches {
            guard match.numberOfRanges > 2,
                  let fromRange = Range(match.range(at: 1), in: text),
                  let toRange = Range(match.range(at: 2), in: text) else { continue }
            let from = String(text[fromRange])
            let to = String(text[toRange])
            if !from.isEmpty && !to.isEmpty {
                result.append((from, to))
            }
        }
        return result
    }

    /// 从 http.conf 提取 listen 端口
    private func extractPortFromHttpConf(_ text: String) -> Int? {
        let pattern = "listen\\s+(\\d+)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..., in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else { return nil }
        return Int(text[valueRange])
    }
}

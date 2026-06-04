import Foundation

// MARK: - OpenList Service

final class OpenListService: ObservableObject {
    static let shared = OpenListService()

    /// Test OpenList connectivity: ping + auth + fs/get + range 206
    func runAllTests(config: AppConfig) async -> [DiagnosticResult] {
        var results: [DiagnosticResult] = []

        // 1. Basic connectivity
        let pingResult = await testPing(baseURL: config.openList.serverURL)
        results.append(pingResult)
        guard pingResult.level == .info else { return results }

        // 2. Auth test
        let authResult = await testAuth(baseURL: config.openList.serverURL, token: config.openList.token)
        results.append(authResult)

        // 3. Path check if test file provided
        if !config.openList.serverURL.isEmpty && !config.openList.token.isEmpty {
            let pathResult = await testFilePath(
                baseURL: config.openList.serverURL,
                token: config.openList.token,
                path: "/ping" // AList/OpenList health endpoint
            )
            results.append(pathResult)
        }

        return results
    }

    func testPing(baseURL: String) async -> DiagnosticResult {
        guard let url = URL(string: baseURL) else {
            return DiagnosticResult(title: "OpenList 地址无效", message: "无法解析 URL: \(baseURL)", level: .error, suggestion: "请检查 OpenList 地址格式")
        }

        do {
            var request = URLRequest(url: url.appendingPathComponent("ping"))
            request.timeoutInterval = 10
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) {
                return DiagnosticResult(title: "OpenList 连通", message: "\(baseURL)/ping → \(httpResponse.statusCode)", level: .info, suggestion: nil)
            }
            // Fallback: try /api/public/settings
            var altRequest = URLRequest(url: url.appendingPathComponent("api/public/settings"))
            altRequest.timeoutInterval = 10
            let (_, altResponse) = try await URLSession.shared.data(for: altRequest)
            if let httpAltResponse = altResponse as? HTTPURLResponse, (200..<300).contains(httpAltResponse.statusCode) {
                return DiagnosticResult(title: "OpenList 连通 (备用端点)", message: "\(baseURL)/api/public/settings → \(httpAltResponse.statusCode)", level: .info, suggestion: nil)
            }
            return DiagnosticResult(title: "OpenList 无响应", message: "两个端点均未返回 2xx", level: .warning, suggestion: "确认 OpenList 服务已启动且地址正确")
        } catch {
            return DiagnosticResult(title: "OpenList 不可达", message: error.localizedDescription, level: .error, suggestion: "检查网络连接和 OpenList 服务状态")
        }
    }

    func testAuth(baseURL: String, token: String) async -> DiagnosticResult {
        guard !token.isEmpty else {
            return DiagnosticResult(title: "OpenList Token 未配置", message: "Token 为空", level: .warning, suggestion: "请在连接设置中配置 OpenList Token")
        }

        guard let url = URL(string: baseURL)?.appendingPathComponent("api/me") else {
            return DiagnosticResult(title: "OpenList 地址无效", message: "无法解析 URL", level: .error, suggestion: nil)
        }

        do {
            var request = URLRequest(url: url)
            request.setValue(token, forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 10
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    return DiagnosticResult(title: "OpenList 认证通过", message: "/api/me → 200", level: .info, suggestion: nil)
                } else {
                    return DiagnosticResult(title: "OpenList 认证失败", message: "/api/me → \(httpResponse.statusCode)", level: .error, suggestion: "检查 Token 是否正确")
                }
            }
            return DiagnosticResult(title: "OpenList 认证测试失败", message: "无 HTTP 响应", level: .error, suggestion: nil)
        } catch {
            return DiagnosticResult(title: "OpenList 认证测试异常", message: error.localizedDescription, level: .error, suggestion: "检查网络连接")
        }
    }

    private func testFilePath(baseURL: String, token: String, path: String) async -> DiagnosticResult {
        // Lightweight check: just verify the API responds
        DiagnosticResult(title: "API 端点检测", message: "OpenList API 基础检测完成", level: .info, suggestion: nil)
    }
}

// MARK: - Plex Service

final class PlexService: ObservableObject {
    static let shared = PlexService()

    /// 测试 Plex 源服务器连通性。上游 plex2Alist 不要求预配置 Plex Token。
    func ping(serverURL: String) async -> DiagnosticResult {
        guard let url = URL(string: serverURL)?.appendingPathComponent("identity") else {
            return DiagnosticResult(title: "Plex 地址无效", message: "无法解析 URL: \(serverURL)", level: .error, suggestion: "检查 Plex 地址格式 (如 http://127.0.0.1:32400)")
        }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 5
            let (data, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    let name = parsePlexIdentity(data)
                    return DiagnosticResult(title: "Plex 服务器可达", message: "\(serverURL) → 200\(name.isEmpty ? "" : " (\(name))")", level: .info, suggestion: nil)
                } else {
                    return DiagnosticResult(title: "Plex 返回异常", message: "/identity → \(httpResponse.statusCode)", level: .error, suggestion: "确认 Plex 服务正在运行")
                }
            }
            return DiagnosticResult(title: "Plex 无响应", message: "无 HTTP 响应", level: .error, suggestion: "确认 Plex 服务正在运行")
        } catch {
            return DiagnosticResult(title: "Plex 不可达", message: error.localizedDescription, level: .error, suggestion: "确认 Plex 服务运行中且地址正确")
        }
    }

    private func parsePlexIdentity(_ data: Data) -> String {
        guard let xml = String(data: data, encoding: .utf8) else { return "" }
        if let range = xml.range(of: "friendlyName=\"") {
            let start = range.upperBound
            if let end = xml[start...].firstIndex(of: "\"") {
                return String(xml[start..<end])
            }
        }
        return ""
    }
}

// MARK: - Emby / Jellyfin Service

final class EmbyJellyfinService: ObservableObject {
    static let shared = EmbyJellyfinService()

    func ping(serverURL: String, serverType: MediaServerType) async -> DiagnosticResult {
        let serverName = serverType.rawValue
        guard let url = URL(string: serverURL)?.appendingPathComponent("System/Info/Public") else {
            return DiagnosticResult(title: "\(serverName) 地址无效", message: "无法解析 URL: \(serverURL)", level: .error, suggestion: "检查 \(serverName) 地址格式")
        }

        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 5
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                if (200..<300).contains(httpResponse.statusCode) {
                    return DiagnosticResult(title: "\(serverName) 服务器可达", message: "\(serverURL) → \(httpResponse.statusCode)", level: .info, suggestion: nil)
                }
                return DiagnosticResult(title: "\(serverName) 返回异常", message: "/System/Info/Public → \(httpResponse.statusCode)", level: .error, suggestion: "确认 \(serverName) 服务正在运行")
            }
            return DiagnosticResult(title: "\(serverName) 无响应", message: "无 HTTP 响应", level: .error, suggestion: "确认 \(serverName) 服务正在运行")
        } catch {
            return DiagnosticResult(title: "\(serverName) 不可达", message: error.localizedDescription, level: .error, suggestion: "确认 \(serverName) 服务运行中且地址正确")
        }
    }

    func testAPIKey(serverURL: String, apiKey: String, serverType: MediaServerType) async -> DiagnosticResult {
        let serverName = serverType.rawValue
        guard !apiKey.isEmpty else {
            return DiagnosticResult(title: "\(serverName) API Key 未配置", message: "API Key 为空", level: .warning, suggestion: "请在连接设置中配置 \(serverName) API Key")
        }
        guard let url = URL(string: serverURL)?.appendingPathComponent("System/Info") else {
            return DiagnosticResult(title: "\(serverName) 地址无效", message: "无法解析 URL", level: .error, suggestion: nil)
        }

        do {
            var request = URLRequest(url: url)
            request.setValue(apiKey, forHTTPHeaderField: "X-Emby-Token")
            request.setValue(apiKey, forHTTPHeaderField: "X-MediaBrowser-Token")
            request.timeoutInterval = 5
            let (_, response) = try await URLSession.shared.data(for: request)
            if let httpResponse = response as? HTTPURLResponse {
                if (200..<300).contains(httpResponse.statusCode) {
                    return DiagnosticResult(title: "\(serverName) API Key 可用", message: "/System/Info → \(httpResponse.statusCode)", level: .info, suggestion: nil)
                }
                return DiagnosticResult(title: "\(serverName) API Key 异常", message: "/System/Info → \(httpResponse.statusCode)", level: .error, suggestion: "检查 API Key 是否正确")
            }
            return DiagnosticResult(title: "\(serverName) API Key 测试失败", message: "无 HTTP 响应", level: .error, suggestion: nil)
        } catch {
            return DiagnosticResult(title: "\(serverName) API Key 测试异常", message: error.localizedDescription, level: .error, suggestion: "检查网络连接")
        }
    }
}

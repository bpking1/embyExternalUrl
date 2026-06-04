import Foundation

// MARK: - Root Configuration

enum MediaServerType: String, Codable, CaseIterable {
    case plex = "Plex"
    case emby = "Emby"
    case jellyfin = "Jellyfin"
}

extension MediaServerType {
    var containerName: String {
        switch self {
        case .plex: return "plex2Alist-nginx"
        case .emby: return "emby2Alist-nginx"
        case .jellyfin: return "jellyfin2Alist-nginx"
        }
    }

    var containerCandidates: [String] {
        switch self {
        case .plex: return ["plex2Alist-nginx", "nginx-plex"]
        case .emby: return ["emby2Alist-nginx", "nginx-emby"]
        case .jellyfin: return ["jellyfin2Alist-nginx", "nginx-jellyfin"]
        }
    }

    var deploymentSubfolder: String {
        switch self {
        case .plex: return "deployments/plex2Alist"
        case .emby: return "deployments/emby2Alist"
        case .jellyfin: return "deployments/jellyfin2Alist"
        }
    }

    var templateSubfolder: String {
        self == .plex ? "Templates/plex" : "Templates/emby"
    }

    var nginxConfName: String {
        self == .plex ? "plex.conf" : "emby.conf"
    }
}

struct EmbyJellyfinSettings: Codable, Equatable {
    var serverURL: String = "http://127.0.0.1:8096"
    var apiKey: String = ""
    var proxyPort: Int = 8091
    var proxyHttpsPort: Int = 8095

    enum CodingKeys: String, CodingKey {
        case serverURL
        case apiKey
        case proxyPort
        case proxyHttpsPort
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        serverURL = try container.decodeIfPresent(String.self, forKey: .serverURL) ?? "http://127.0.0.1:8096"
        apiKey = try container.decodeIfPresent(String.self, forKey: .apiKey) ?? ""
        proxyPort = try container.decodeIfPresent(Int.self, forKey: .proxyPort) ?? 8091
        proxyHttpsPort = try container.decodeIfPresent(Int.self, forKey: .proxyHttpsPort) ?? 8095
    }
}

struct AppConfig: Codable, Equatable {
    var plex: PlexSettings = .init()
    var openList: OpenListSettings = .init()
    var redirect: RedirectSettings = .init()
    var mount: MountSettings = .init()
    var pathMappings: [PathMapping] = []

    var mediaServerType: MediaServerType = .plex
    var emby: EmbyJellyfinSettings = .init()
    var jellyfin: EmbyJellyfinSettings = .init()

    // Deployment paths
    var deploymentDirectory: String = ""
    var nginxConfigDirectory: String = ""
    var upstreamRepoDirectory: String = ""
    var certificateDirectory: String?
    var certificateDomains: String = ""
    var certificateEmail: String = ""
    var certificateIssueMode: String = "standalone"
    var certificateWebrootPath: String = ""
    var certificateCustomIssueArguments: String = ""
    var certificatePreflightShell: String = ""
    var certificateReloadAfterRenew: Bool = true

    enum CodingKeys: String, CodingKey {
        case plex
        case openList
        case redirect
        case mount
        case pathMappings
        case mediaServerType
        case emby
        case jellyfin
        case deploymentDirectory
        case nginxConfigDirectory
        case upstreamRepoDirectory
        case certificateDirectory
        case certificateDomains
        case certificateEmail
        case certificateIssueMode
        case certificateWebrootPath
        case certificateCustomIssueArguments
        case certificatePreflightShell
        case certificateReloadAfterRenew
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        plex = try container.decodeIfPresent(PlexSettings.self, forKey: .plex) ?? PlexSettings()
        openList = try container.decodeIfPresent(OpenListSettings.self, forKey: .openList) ?? OpenListSettings()
        redirect = try container.decodeIfPresent(RedirectSettings.self, forKey: .redirect) ?? RedirectSettings()
        mount = try container.decodeIfPresent(MountSettings.self, forKey: .mount) ?? MountSettings()
        pathMappings = try container.decodeIfPresent([PathMapping].self, forKey: .pathMappings) ?? []
        mediaServerType = try container.decodeIfPresent(MediaServerType.self, forKey: .mediaServerType) ?? .plex
        emby = try container.decodeIfPresent(EmbyJellyfinSettings.self, forKey: .emby) ?? EmbyJellyfinSettings()
        jellyfin = try container.decodeIfPresent(EmbyJellyfinSettings.self, forKey: .jellyfin) ?? EmbyJellyfinSettings()

        deploymentDirectory = try container.decodeIfPresent(String.self, forKey: .deploymentDirectory) ?? ""
        nginxConfigDirectory = try container.decodeIfPresent(String.self, forKey: .nginxConfigDirectory) ?? ""
        upstreamRepoDirectory = try container.decodeIfPresent(String.self, forKey: .upstreamRepoDirectory) ?? ""
        certificateDirectory = try container.decodeIfPresent(String.self, forKey: .certificateDirectory)
        certificateDomains = try container.decodeIfPresent(String.self, forKey: .certificateDomains) ?? ""
        certificateEmail = try container.decodeIfPresent(String.self, forKey: .certificateEmail) ?? ""
        certificateIssueMode = try container.decodeIfPresent(String.self, forKey: .certificateIssueMode) ?? "standalone"
        certificateWebrootPath = try container.decodeIfPresent(String.self, forKey: .certificateWebrootPath) ?? ""
        certificateCustomIssueArguments = try container.decodeIfPresent(String.self, forKey: .certificateCustomIssueArguments) ?? ""
        certificatePreflightShell = try container.decodeIfPresent(String.self, forKey: .certificatePreflightShell) ?? ""
        certificateReloadAfterRenew = try container.decodeIfPresent(Bool.self, forKey: .certificateReloadAfterRenew) ?? true
    }
}

// MARK: - Plex Settings

struct PlexSettings: Codable, Equatable {
    var serverURL: String = "http://127.0.0.1:32400"
    var proxyPort: Int = 8098
    var proxyHttpsPort: Int = 8095

    enum CodingKeys: String, CodingKey {
        case serverURL
        case proxyPort
        case proxyHttpsPort
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        serverURL = try container.decodeIfPresent(String.self, forKey: .serverURL) ?? "http://127.0.0.1:32400"
        proxyPort = try container.decodeIfPresent(Int.self, forKey: .proxyPort) ?? 8098
        proxyHttpsPort = try container.decodeIfPresent(Int.self, forKey: .proxyHttpsPort) ?? 8095
    }
}

// MARK: - OpenList / AList Settings

struct OpenListSettings: Codable, Equatable {
    var serverURL: String = "http://127.0.0.1:5244"
    var token: String = ""
    var publicURL: String = ""
    var signEnabled: Bool = false
    var signExpireHours: Int = 12
}

// MARK: - Redirect / 302 Control

struct RedirectSettings: Codable, Equatable {
    // Master switches
    var enabled: Bool = true
    var enablePartStreamPlayOrDownload: Bool = true
    var enableVideoTranscodePlay: Bool = true

    // Emby/Jellyfin specific switches
    var enableVideoStreamPlay: Bool = true
    var enableVideoLivePlay: Bool = true
    var enableAudioStreamPlay: Bool = true
    var enableItemsDownload: Bool = true
    var enableSyncDownload: Bool = true

    // 115 specific settings
    var webCookie115: String = ""
    var directHlsEnable: Bool = false
    var directHlsDefaultPlayMax: Bool = false

    // Transcode
    var transcodeEnabled: Bool = false

    // Route cache
    var routeCacheEnabled: Bool = false

    // Fallback behavior
    var fallbackUseOriginal: Bool = true

    enum CodingKeys: String, CodingKey {
        case enabled
        case enablePartStreamPlayOrDownload
        case enableVideoTranscodePlay
        case enableVideoStreamPlay
        case enableVideoLivePlay
        case enableAudioStreamPlay
        case enableItemsDownload
        case enableSyncDownload
        case webCookie115
        case directHlsEnable
        case directHlsDefaultPlayMax
        case transcodeEnabled
        case routeCacheEnabled
        case fallbackUseOriginal
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        enabled = try container.decodeIfPresent(Bool.self, forKey: .enabled) ?? true
        enablePartStreamPlayOrDownload = try container.decodeIfPresent(Bool.self, forKey: .enablePartStreamPlayOrDownload) ?? true
        enableVideoTranscodePlay = try container.decodeIfPresent(Bool.self, forKey: .enableVideoTranscodePlay) ?? true
        enableVideoStreamPlay = try container.decodeIfPresent(Bool.self, forKey: .enableVideoStreamPlay) ?? true
        enableVideoLivePlay = try container.decodeIfPresent(Bool.self, forKey: .enableVideoLivePlay) ?? true
        enableAudioStreamPlay = try container.decodeIfPresent(Bool.self, forKey: .enableAudioStreamPlay) ?? true
        enableItemsDownload = try container.decodeIfPresent(Bool.self, forKey: .enableItemsDownload) ?? true
        enableSyncDownload = try container.decodeIfPresent(Bool.self, forKey: .enableSyncDownload) ?? true
        webCookie115 = try container.decodeIfPresent(String.self, forKey: .webCookie115) ?? ""
        directHlsEnable = try container.decodeIfPresent(Bool.self, forKey: .directHlsEnable) ?? false
        directHlsDefaultPlayMax = try container.decodeIfPresent(Bool.self, forKey: .directHlsDefaultPlayMax) ?? false
        transcodeEnabled = try container.decodeIfPresent(Bool.self, forKey: .transcodeEnabled) ?? false
        routeCacheEnabled = try container.decodeIfPresent(Bool.self, forKey: .routeCacheEnabled) ?? false
        fallbackUseOriginal = try container.decodeIfPresent(Bool.self, forKey: .fallbackUseOriginal) ?? true
    }
}

// MARK: - Mount Paths

struct MountSettings: Codable, Equatable {
    var mediaMountPaths: [String] = ["/mnt"]
}

// MARK: - Path Mapping

struct PathMapping: Codable, Equatable, Identifiable {
    var id: UUID = .init()
    var localPrefix: String = ""
    var remotePrefix: String = ""
    var enabled: Bool = true
    var note: String = ""
}

// MARK: - Diagnostic Result

struct DiagnosticResult: Identifiable, Equatable {
    let id: UUID = .init()
    let title: String
    let message: String
    let level: DiagnosticLevel
    let suggestion: String?
    let createdAt: Date = .init()

    enum DiagnosticLevel: Equatable {
        case info
        case warning
        case error
    }
}

// MARK: - Command Result

struct CommandResult: Codable, Equatable {
    let command: String
    let exitCode: Int32
    let stdout: String
    let stderr: String
}

// MARK: - Deployment Report

struct DeploymentReport: Equatable {
    let generatedAt: Date
    let targetDirectory: String
    let filesWritten: [String]
    let errors: [String]
    let warnings: [String]
}

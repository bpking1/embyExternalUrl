// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "Plex2AlistManager",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "Plex2AlistManager",
            path: "Sources/Plex2AlistManager",
            exclude: [
                "Resources/AppIcon.icns"
            ],
            resources: [
                .copy("Resources/Templates")
            ]
        )
    ]
)

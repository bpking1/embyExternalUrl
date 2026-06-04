import SwiftUI
import AppKit

@main
struct Plex2AlistManagerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var configService = ConfigService.shared

    init() {
        let iconURL = Bundle.main.resourceURL?.appendingPathComponent("AppIcon.icns")
        if let iconURL,
           let icon = NSImage(contentsOf: iconURL) {
            NSApplication.shared.applicationIconImage = icon
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(configService)
                .frame(minWidth: 800, minHeight: 600)
                .onAppear {
                    NSApplication.shared.setActivationPolicy(.regular)
                    NSApplication.shared.activate(ignoringOtherApps: true)
                }
        }
        .windowResizability(.contentMinSize)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem?
    private var menu: NSMenu?
    private var updateTimer: Timer?

    // Local cached statuses
    private var dockerAvailable = false
    private var containerRunning = false
    private var containerStatus = ""

    // Menu item references
    private var statusHeaderItem: NSMenuItem?
    private var serverTypeItem: NSMenuItem?
    private var dockerStatusItem: NSMenuItem?
    private var nginxStatusItem: NSMenuItem?
    private var startContainerItem: NSMenuItem?
    private var stopContainerItem: NSMenuItem?
    private var restartContainerItem: NSMenuItem?
    private var reloadNginxItem: NSMenuItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApplication.shared.setActivationPolicy(.regular)
        NSApplication.shared.activate(ignoringOtherApps: true)

        setupStatusItem()
        startTimer()

        // Initial fetch
        Task {
            await refreshStatus()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        updateTimer?.invalidate()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Keep running in the background when the main window is closed
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            sender.sendAction(Selector(("newWindow:")), to: nil, from: nil)
        }
        sender.activate(ignoringOtherApps: true)
        return true
    }

    // MARK: - Status Bar Setup & Updates

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        guard let button = statusItem?.button else { return }

        let config = NSImage.SymbolConfiguration(pointSize: 16, weight: .regular)
        if let image = NSImage(systemSymbolName: "square.stack.3d.up", accessibilityDescription: "Plex2Alist Manager")?
            .withSymbolConfiguration(config) {
            image.isTemplate = true // Adapt automatically to dark/light menu bars
            button.image = image
        }

        let menu = NSMenu()
        menu.delegate = self
        self.menu = menu

        // 1. Header & Current Statuses
        statusHeaderItem = NSMenuItem(title: "Plex2Alist 托管状态", action: nil, keyEquivalent: "")
        statusHeaderItem?.isEnabled = false
        menu.addItem(statusHeaderItem!)

        serverTypeItem = NSMenuItem(title: "服务类型: 检测中...", action: nil, keyEquivalent: "")
        serverTypeItem?.isEnabled = false
        menu.addItem(serverTypeItem!)

        dockerStatusItem = NSMenuItem(title: "Docker 状态: 检测中...", action: nil, keyEquivalent: "")
        dockerStatusItem?.isEnabled = false
        menu.addItem(dockerStatusItem!)

        nginxStatusItem = NSMenuItem(title: "Nginx 状态: 检测中...", action: nil, keyEquivalent: "")
        nginxStatusItem?.isEnabled = false
        menu.addItem(nginxStatusItem!)

        menu.addItem(NSMenuItem.separator())

        // 2. Open Main Interface
        let showWindowItem = NSMenuItem(title: "显示主窗口", action: #selector(showMainWindow), keyEquivalent: "o")
        showWindowItem.target = self
        menu.addItem(showWindowItem)

        menu.addItem(NSMenuItem.separator())

        // 3. Quick Controls
        let controlHeader = NSMenuItem(title: "快捷控制", action: nil, keyEquivalent: "")
        controlHeader.isEnabled = false
        menu.addItem(controlHeader)

        startContainerItem = NSMenuItem(title: "启动容器", action: #selector(startContainer), keyEquivalent: "")
        startContainerItem?.target = self
        menu.addItem(startContainerItem!)

        stopContainerItem = NSMenuItem(title: "停止容器", action: #selector(stopContainer), keyEquivalent: "")
        stopContainerItem?.target = self
        menu.addItem(stopContainerItem!)

        restartContainerItem = NSMenuItem(title: "重启容器", action: #selector(restartContainer), keyEquivalent: "")
        restartContainerItem?.target = self
        menu.addItem(restartContainerItem!)

        reloadNginxItem = NSMenuItem(title: "重载 Nginx 配置", action: #selector(reloadNginx), keyEquivalent: "")
        reloadNginxItem?.target = self
        menu.addItem(reloadNginxItem!)

        menu.addItem(NSMenuItem.separator())

        // 4. Quit
        let quitItem = NSMenuItem(title: "退出", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    private func startTimer() {
        updateTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task {
                await self?.refreshStatus()
            }
        }
    }

    private func refreshStatus() async {
        let mediaServerType = ConfigService.shared.config.mediaServerType
        await DockerService.shared.detect()
        _ = await DockerService.shared.ps(mediaServerType: mediaServerType)

        let available = DockerService.shared.isAvailable
        let running = DockerService.shared.containerRunning
        let status = DockerService.shared.containerStatus

        await MainActor.run {
            self.dockerAvailable = available
            self.containerRunning = running
            self.containerStatus = status
            self.updateMenuState()
        }
    }

    private func updateMenuState() {
        // Update Server Type
        let mediaType = ConfigService.shared.config.mediaServerType
        let serverTypeName = mediaType == .plex ? "Plex" : (mediaType == .emby ? "Emby" : "Jellyfin")
        serverTypeItem?.title = "服务类型: \(serverTypeName)"

        // Update Docker Status
        if dockerAvailable {
            dockerStatusItem?.title = "Docker 状态: 🟢 已启动"
        } else {
            dockerStatusItem?.title = "Docker 状态: 🔴 未运行"
        }

        // Update Nginx Status
        if dockerAvailable && containerRunning {
            nginxStatusItem?.title = "Nginx 状态: 🟢 运行中 (\(containerStatus))"

            startContainerItem?.isEnabled = false
            stopContainerItem?.isEnabled = true
            restartContainerItem?.isEnabled = true
            reloadNginxItem?.isEnabled = true
        } else {
            let statusDesc = containerStatus.isEmpty ? "已停止" : containerStatus
            nginxStatusItem?.title = "Nginx 状态: 🔴 \(statusDesc)"

            startContainerItem?.isEnabled = dockerAvailable
            stopContainerItem?.isEnabled = false
            restartContainerItem?.isEnabled = false
            reloadNginxItem?.isEnabled = false
        }

        // Update Status Item Bar Icon
        if let button = statusItem?.button {
            let symbolName = (dockerAvailable && containerRunning) ? "square.stack.3d.up.fill" : "square.stack.3d.up"
            let config = NSImage.SymbolConfiguration(pointSize: 16, weight: .regular)
            if let image = NSImage(systemSymbolName: symbolName, accessibilityDescription: "Plex2Alist Manager")?
                .withSymbolConfiguration(config) {
                image.isTemplate = true
                button.image = image
            }
        }
    }

    // MARK: - NSMenuDelegate

    func menuWillOpen(_ menu: NSMenu) {
        Task {
            await refreshStatus()
        }
    }

    // MARK: - Actions

    @objc private func showMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        let visibleWindows = NSApp.windows.filter {
            $0.className != "NSStatusBarWindow" && $0.className != "NSMenuWindow"
        }
        if let window = visibleWindows.first {
            window.makeKeyAndOrderFront(nil)
        } else {
            NSApplication.shared.sendAction(Selector(("newWindow:")), to: nil, from: nil)
        }
    }

    @objc private func startContainer() {
        let deployDir = ConfigService.shared.ensureDeploymentDirectory()
        guard FileManager.default.fileExists(atPath: "\(deployDir)/docker-compose.yml") else {
            alert(message: "请先在主界面生成部署配置。")
            return
        }
        Task {
            _ = await DockerService.shared.up(directory: deployDir)
            await refreshStatus()
        }
    }

    @objc private func stopContainer() {
        let deployDir = ConfigService.shared.ensureDeploymentDirectory()
        Task {
            _ = await DockerService.shared.down(directory: deployDir)
            await refreshStatus()
        }
    }

    @objc private func restartContainer() {
        let deployDir = ConfigService.shared.ensureDeploymentDirectory()
        Task {
            _ = await DockerService.shared.restart(directory: deployDir)
            await refreshStatus()
        }
    }

    @objc private func reloadNginx() {
        Task {
            let result = await DockerService.shared.reloadNginx(mediaServerType: ConfigService.shared.config.mediaServerType)
            if result.exitCode != 0 {
                await MainActor.run {
                    alert(message: "Nginx 重载失败:\n\(result.stderr)")
                }
            } else {
                await refreshStatus()
            }
        }
    }

    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }

    private func alert(message: String) {
        let alert = NSAlert()
        alert.messageText = "提示"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "确定")
        alert.runModal()
    }
}

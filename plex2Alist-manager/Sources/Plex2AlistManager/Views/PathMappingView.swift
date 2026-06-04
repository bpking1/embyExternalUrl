import SwiftUI

struct PathMappingView: View {
    @EnvironmentObject var configService: ConfigService

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // MARK: Mount Paths
                Group {
                    Text("挂载根路径")
                        .font(.title3)
                        .fontWeight(.semibold)

                    Text("\(configService.config.mediaServerType.rawValue) 媒体库的文件挂载根路径。上游会先移除这些前缀，再用剩余路径去 OpenList 查询同名文件。")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    ForEach(Array(configService.config.mount.mediaMountPaths.enumerated()), id: \.offset) { index, _ in
                        HStack {
                            TextField("/mnt", text: bindingForMountPath(at: index))
                                .font(.system(.body, design: .monospaced))
                            Button {
                                configService.config.mount.mediaMountPaths.remove(at: index)
                            } label: {
                                Image(systemName: "trash")
                            }
                            .buttonStyle(.borderless)
                        }
                    }

                    Button {
                        configService.config.mount.mediaMountPaths.append("")
                    } label: {
                        Label("添加挂载路径", systemImage: "plus")
                    }
                }

                Divider()

                // MARK: Path Mappings
                Group {
                    HStack {
                        Text("路径映射")
                            .font(.title3)
                            .fontWeight(.semibold)
                        Spacer()
                        Button {
                            configService.config.pathMappings.append(PathMapping())
                        } label: {
                            Label("添加映射", systemImage: "plus")
                        }
                    }

                    Text("可选项。仅当 \(configService.config.mediaServerType.rawValue) 文件路径和 OpenList 路径不一致时使用；路径一致时保持为空即可。")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if configService.config.pathMappings.isEmpty {
                        Text("尚未添加路径映射规则。当前会生成空 mediaPathMapping，适合两边目录结构一致的场景。")
                            .foregroundColor(.secondary)
                            .padding(.vertical, 8)
                    }

                    ForEach($configService.config.pathMappings) { $mapping in
                        VStack(spacing: 8) {
                            HStack(spacing: 10) {
                                Toggle("", isOn: $mapping.enabled)
                                    .labelsHidden()

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("本地路径前缀")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    TextField("/mnt/aliyun", text: $mapping.localPrefix)
                                        .font(.system(.body, design: .monospaced))
                                }

                                Image(systemName: "arrow.right")
                                    .foregroundColor(.secondary)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("OpenList 路径前缀")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    TextField("/aliyun", text: $mapping.remotePrefix)
                                        .font(.system(.body, design: .monospaced))
                                }

                                Button {
                                    configService.config.pathMappings.removeAll { $0.id == mapping.id }
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.secondary)
                                }
                                .buttonStyle(.borderless)
                            }

                            TextField("备注（可选）", text: $mapping.note)
                                .font(.caption)
                        }
                        .padding(12)
                        .background(Color.secondary.opacity(0.06))
                        .cornerRadius(8)
                    }
                }

                Spacer()

                HStack {
                    Button("保存") {
                        configService.save()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding(24)
        }
        .navigationTitle("路径映射")
    }

    private func bindingForMountPath(at index: Int) -> Binding<String> {
        Binding {
            guard index < configService.config.mount.mediaMountPaths.count else { return "" }
            return configService.config.mount.mediaMountPaths[index]
        } set: { newValue in
            guard index < configService.config.mount.mediaMountPaths.count else { return }
            configService.config.mount.mediaMountPaths[index] = newValue
        }
    }
}

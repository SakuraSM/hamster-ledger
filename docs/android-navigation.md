# Android 系统栏与底部导航

本次调整让顶部明确显示当前位置和当前账本，底部保留总览、账单、资产、报表、更多五个入口。继续使用奶油暖棕主题及现有 Phosphor 图标。

状态栏和系统导航栏保持透明，由页面表面延伸到系统栏下方。图标明暗跟随账本主题。三键导航关闭系统额外的对比度遮罩，由底部固定表面提供背景；输入法显示时使用系统自己的导航外观。

顶部安全区交给 Appbar 处理。内容区处理左右安全区，工具页和登录页另行预留底部安全区。底部导航只接收一次底部 inset，避免重复留白。顶部操作与表单返回按钮的触控区域至少 48dp。

底部导航使用 Material 3 组件，持续显示文字标签，选中项同时显示胶囊和实心图标。标签支持最高 1.3 倍字体缩放；原生无障碍树保留 tab 角色和选中状态。键盘打开时隐藏导航和记账按钮。

记账按钮的位置由 80dp 导航高度、系统底部 inset 和 16dp 间距计算。提示条出现时，再根据它实际测得的高度让位。减少动态效果的系统设置仍然生效。表单弹层也使用当前主题的系统栏图标。

## 验证记录

2026-10-11，Android API 36 ARM64 模拟器，使用 Release 构建和开发签名。

| 场景                             | 结果与证据                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 浅色、手势导航                   | 状态栏、导航标签和手势条清晰；原有两笔虚拟流水合计 27.50 元仍可读取。见 `after-light.png`。               |
| 深色、手势导航                   | 系统栏图标为浅色，底部表面与手势区域连续。见 `after-dark.png`。                                           |
| 深色、三键导航                   | 系统按钮清晰，底部无额外灰色遮罩。见 `after-dark-three-buttons.png`。                                     |
| 320dp 窄屏、1.3 倍字体、三键导航 | 五个标签可见且可点。逐个切换入口，原生选中状态与顶部页名一致。见 `narrow-large-font.png`。                |
| 搜索键盘                         | 底部菜单和记账按钮隐藏，关闭键盘后恢复。见 `keyboard.png`。                                               |
| 保存、撤销                       | 独立虚拟账本保存 1.23 元账单，提示条、记账按钮与底部菜单互不遮挡，撤销后恢复为空账本。见 `snackbar.png`。 |
| 表单弹层                         | 返回按钮至少 48dp，系统栏和页面背景保持当前主题。见 `entry-sheet.png`。                                   |
| 触控区域                         | 顶部按钮实际 126×126px，在 420dpi 下对应 48×48dp；窄屏导航入口为 64×80dp。                                |
| 原生运行                         | 未发现当前应用进程的 AndroidRuntime 或 ReactNativeJS 错误。                                               |

截图位于 [android-system-navigation](evidence/android-system-navigation/)。`before-light.png` 与 `before-three-buttons.png` 为改动前的记录，其余为改动后的验证。

`npm run check` 通过 222 项测试，并通过格式、依赖兼容、类型、lint、架构边界和 Web 构建检查。`npm run android:apk` 原生构建通过。改动保持账本数据、联网协议和备份格式不变。

验证使用独立的 AndroidUIQA 虚拟账本，原账本数据保留。结束时恢复模拟器的屏幕尺寸、字体缩放和手势导航模式。未进行真实设备或人工 TalkBack 朗读验收。

## 依据

- [Android 系统栏设计](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars)：透明系统栏、系统 inset、三键导航背景与图标对比度。
- [Android 布局和导航模式](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)：主导航入口与 Material 3 导航组件。
- [Android 无障碍触控区域](https://developer.android.com/guide/topics/ui/accessibility/apps)：至少 48dp 的触控区域。
- [Expo NavigationBar](https://docs.expo.dev/versions/latest/sdk/navigation-bar/)：运行时图标样式与 `enforceContrast` 配置。

交付 APK 为 `hamster-ledger-android-ui-0.2.0-arm64.apk`，使用开发签名，仅供安装验证。

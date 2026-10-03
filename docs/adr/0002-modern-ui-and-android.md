# 0002：现代组件与 Android 原生客户端

状态：已实施。方案日期：2026-10-02，验证更新：2026-10-03。

## 目标与方案

Web 使用 Mantine 替换基础表单、选择器、弹窗和反馈组件，保留仓鼠记账的暖色主题与页面结构。交互补齐可搜索选择、键盘操作、焦点管理、加载状态和减少动态效果偏好。

Android 使用 React Native + Expo，界面采用 React Native Paper 的 Material 3 组件。原生页面复用现有 TypeScript 账务与导入包，不复制金额、去重和预算算法。Expo 负责 Android 工程生成、原生模块和本地构建。

平台副作用继续独立：Web 保留当前存储和文件协议；Android 使用原生 SQLite、Keystore 支持的凭据存储、系统文件选择与分享。服务端为原生显式令牌认证提供独立契约，不放宽 Web Cookie 的 Origin/CSRF 保护。

## 实施范围与完成证据

| 范围         | 完成要求                                                       | 证据                                             |
| ------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| Web 组件     | 主要页面的输入、选择、按钮、弹窗、复选开关与反馈接入组件库     | 控件清单、类型检查、实际浏览器操作与可访问性检查 |
| Web 交互     | 搜索选择、键盘导航、触控尺寸、过渡效果与减少动态效果偏好       | 桌面及手机尺寸的运行截图和操作记录               |
| Android 工程 | 独立应用工程、稳定依赖、开发与构建说明、可安装 APK             | 本地构建成功与安装运行                           |
| Android 账本 | 多账本、记账编辑与恢复、核对、资产、预算、日历、周期规则和报表 | 共享业务测试与 Android 端实际操作                |
| Android 文件 | CSV/Excel 文件选择、解析、预览、导入、备份恢复与导出分享       | 原生文件流程与错误路径验证                       |
| Android 保存 | 持久化、密钥保护、升级、退出/后台恢复、失败时不覆盖数据        | 适配器测试、进程重启与升级测试                   |
| Android 同步 | 配置服务地址、登录注册、会话、同步冲突及退出                   | API 测试和 Android 端与本地服务联调              |
| 平台隔离     | 共享业务包不依赖 DOM 或原生 API                                | 包边界检查、Web 与 Android 同时构建              |

实施和运行证据见 [验证记录](../design/modern-ui-android-qa.md)，构建入口见 [Android 开发说明](../mobile-readiness.md)。已完成本地开发、共享测试、原生构建和模拟器验证；安装包使用开发签名，未做真机或应用商店发布验收。

## 同步与兼容决定

Android 首版采用主动同步。云端有新版本时先预览、恢复为新账本，保留原本机数据；没有后台轮询或记录级合并。Web 继续使用原有的自动同步。两端使用同一份账本模型和服务端版本检查。

共享 React 控制器单独放入 `ledger-react`，通过参数注入存储、时钟与 ID，不把 DOM 或 Android API 放入纯业务包。原有 Web 存储键与账本版本保持不变。

## 参考

- [Mantine：Vite 集成](https://mantine.dev/guides/vite/)
- [Expo：Monorepo](https://docs.expo.dev/guides/monorepos/)
- [Expo：SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo：SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [React Native Paper](https://github.com/callstack/react-native-paper)

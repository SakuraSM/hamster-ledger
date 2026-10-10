# Android 开发与运行

Android 客户端位于 `apps/mobile`，使用 Expo 57、React Native 0.86 和 React Native Paper。它通过共享账本控制器与业务包实现原生记账，文件、存储、通知及账号凭据由原生适配器处理。

## 开发与构建

需要 Node.js 22 或 24、npm 10+、JDK 17，以及 Android SDK 36。设置 `ANDROID_HOME`，在 Android Studio 中创建模拟器，或连接已允许 USB 调试的设备。Gradle 会按工程配置安装缺少的构建组件。

在仓库根目录运行：

```sh
npm ci
npm run android:run
```

后续开发运行 `npm run android:dev`。实际应用包含 SQLCipher 原生模块，必须使用生成的原生构建，不能在 Expo Go 中运行。`app.json`、依赖和配置插件是原生工程的来源；`apps/mobile/android` 为生成目录，不提交手工修改。

```sh
npm run android:export
npm run android:apk
```

`android:export` 检查 JavaScript 和资源打包。`android:apk` 先构建共享包，再执行 Expo prebuild 和 Gradle `assembleRelease`，生成已内置 JavaScript 的安装包，无需 Metro 即可打开。

输出位置：`apps/mobile/android/app/build/outputs/apk/release/app-release.apk`。默认仅含 `arm64-v8a`；可通过 `HAMSTER_ANDROID_ARCHITECTURES` 指定逗号分隔的目标架构。Manifest 最低 API 24，编译与目标 API 36；最低版本声明不等同于所有机型验收。

生成工程默认使用开发签名。此 APK 用于本地安装验证；应用商店发布需要配置持有者的正式签名、版本号、隐私材料及发布流程。不要把开发签名包作为商店正式版本。覆盖升级需要相同的应用 ID 和签名，勿通过卸载应用来绕过签名不匹配。

## 页面与共享逻辑

| 页面       | 行为                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 总览、账单 | 收支汇总、搜索筛选、手动新增与编辑、回收站和撤销                     |
| 资产       | 资产/负债账户、余额基准、账户别名、校准与归档；关联流水影响余额      |
| 报表       | 日期范围、年度、分类和标签统计                                       |
| 更多功能   | 多账本、重复核对、日历、预算、周期规则、分类与偏好                   |
| 导入       | 系统选择 CSV / XLSX / XLS，映射字段、预览及重复核对                  |
| 备份       | JSON 导出与预览恢复，Excel 导出及系统分享                            |
| 账号、同步 | 服务地址、登录注册、改密和设备管理；主动同步、冲突预览与恢复为新账本 |

金额使用共享的整数分规则，转账不计入收支；演示与个人账本分别存储。从示例账本进入导入时，先切换到「我的账本」，避免混入示例数据。周期账单在账本打开时补齐，不依赖后台持续运行。系统提醒按最近一次保存的提醒设置运行，只在用户开启时申请通知权限。

## 本机数据与文件

数据库使用 SQLCipher，32 字节随机密钥保存在 SecureStore / Android Keystore 支持的存储中。所有读写在同一条已设置密钥的连接上串行执行；不能直接替换成另开连接的 exclusive transaction。读取、密钥或未知版本错误会停止写入，不创建空账本覆盖原数据。

SQLite `user_version=1`，账本模型保持 `version: 1`。覆盖安装保留数据库与密钥；卸载会移除本机数据。禁用 Android 自动备份，跨设备迁移使用应用的 JSON 备份或云端恢复。

系统选择器只访问用户选中的文件，不申请整个存储目录权限。单个账单最大 10 MB、15,000 行；只支持单工作表 Excel。CSV 使用 [独立编码实现](https://github.com/kayahr/text-encoding) 严格解码 UTF-8 / GB18030，支持四字节字符；无法识别的编码会报错。导入内容只在本机解析，用户确认后写入账本。解析用的缓存副本在读取结束后清理。

JSON 备份上限 20 MB，恢复前执行共享模型校验，并创建新账本。JSON 和 Excel 导出是明文。系统分享先把文件放到应用私有缓存，由系统临时授权接收方；缓存不会在关闭分享窗口时立即删除，下次导出时清理超过 24 小时的文件。是否发送给第三方，由用户在系统分享界面选择。

## 服务连接与同步

正式构建只接受不含路径、凭据或查询参数的 HTTPS Origin，例如 `https://ledger.example.com`。服务端部署方式见 [自托管说明](self-hosting.md)。未登录时可离线使用全部本机记账功能。

开发构建可用 `adb reverse tcp:4180 tcp:4180`，然后填写 `http://127.0.0.1:4180`。本机 HTTP 例外只在开发模式开放，正式构建不能依赖这个地址。

原生客户端使用 `/api/native/` 和独立 Bearer 会话。默认登录只保存在进程内存；勾选记住登录后，凭据写入 SecureStore。密码不存储。Origin、账号、账本分别参与同步连接标识，过期会话不会删除本机账单。

首次上传创建云端副本。后续主动同步带上已知版本；远端已修改时先展示预览，恢复为新账本后再核对。本机和云端同时修改不会自动覆盖任意一边。同步单位仍是完整账本，没有后台自动同步或记录级自动合并。

## 验证与发布边界

本次实现的检查、模拟器步骤和截图记录在 [现代组件与 Android 验证](design/modern-ui-android-qa.md)。CI 执行共享规则、Web 行为、服务器和原生适配器测试，并导出 Android JavaScript 包；Gradle 构建与模拟器操作记录单独提供。

Android 模拟器结果不代替真机、各厂商后台通知策略、设备丢失恢复或应用商店验收。iOS 和 HarmonyOS 不在这次原生交付范围内。

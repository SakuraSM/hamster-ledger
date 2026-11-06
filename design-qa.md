# 凭证接力正式界面验收

final result: passed

视觉来源为[第二轮第 3 张方向稿](docs/design/receipt-relay-2026-11-06/assets/selected-direction.png)。本次检查正式 Web 与 Android 界面，所有账本均使用虚构的示例数据。原视觉稿的对照和导出记录保留在[设计校对记录](docs/design/receipt-relay-2026-11-06/design-qa.md)。

## Web

在本地运行的正式应用中逐一打开 11 个主页面，并检查页面内容、框架错误覆盖层和横向越界。桌面视口为 1440 × 1024，手机视口为 390 × 844；手机底部保留待处理、账单和资产三个入口。

- [桌面待处理](docs/design/receipt-relay-production-2026-11-07/web-desktop-inbox.png)与[桌面资产](docs/design/receipt-relay-production-2026-11-07/web-desktop-assets.png)。
- [手机待处理](docs/design/receipt-relay-production-2026-11-07/web-mobile-inbox.png)与[手机资产](docs/design/receipt-relay-production-2026-11-07/web-mobile-assets.png)。
- 在示例账本中选择真实的还款来源账户，查看预览、保存并撤销；另完成实际余额校准的预览、保存和撤销，确认余额恢复。
- 点击资产页金额显隐按钮，核查金额和账户名称均被隐藏，再恢复显示。手机暖色资产页、桌面夜间资产页以及夜间待处理页的 axe WCAG A/AA 自动检查未发现违规；自动检查不代替人工无障碍验收。

## Android

最终开发签名包安装在隔离 Android 模拟器（1080 × 1920）中，打开待处理、账单、资产和工具入口。待处理主按钮位于底部导航上方，可完整点击；资产金额显隐同时遮住账户名称。

- [待处理](docs/design/receipt-relay-production-2026-11-07/android-pending.png)、[资产](docs/design/receipt-relay-production-2026-11-07/android-assets.png)、[还款预览](docs/design/receipt-relay-production-2026-11-07/android-repayment-preview.png)。
- 在信用卡账户选择实际付款账户并输入 50 元。预览显示付款账户 59,863.70 → 59,813.70 元、负债 6,500 → 6,450 元；保存后两侧余额与预览一致，撤销后恢复。模拟器 crash buffer 无崩溃记录。
- APK 使用开发签名，仅供安装验证；没有进行应用商店发布。

## 工程检查

`npm run check` 通过，包括 779 项 Vitest、67 项 PostgreSQL 服务端测试、4 项 Sites 测试，以及依赖、格式、类型、lint、包边界和构建检查。`npm run android:apk` 构建成功。自动化测试和模拟器检查不能替代真实银行或物理设备验收。

## 边界

- 余额依赖用户维护的基准和已确认流水，没有银行实时查询。缺基准、缺汇率、历史归档和外币舍入不会被当作完整估值。
- 家庭联网账本的身份缓存及个人整本同步的并发边界见[架构说明](docs/architecture.md)。Web 完全离线冷启动无法恢复账号身份，因此不能显示联网账本缓存。
- 未进行物理设备、应用商店发布或真实银行数据验收。

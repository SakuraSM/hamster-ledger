# 双端紧凑布局与入口核对

日期：2026-11-09。Web 使用隔离来源的本地 Vite 预览与虚构示例账本，分别检查 390 × 844、320 × 700 和 1440 × 1024 窗口；Android 使用 1080 × 1920 模拟器和同一套虚构示例。图片中的账户、金额和商户均为示例数据。

1. 首次进入：Web 同步服务不可用时，本机入口排在登录表单前；Android 全新系统用户也可直接选择本机使用。两端均验证进入账本。见 `web-01-entry-before.png`、`web-01-entry-after.png`、`android-06-first-entry-after.png`。
2. 待处理：入口样式一致，预览保留未入账状态；“查看总览”与实际去向一致。见 `web-02-inbox-before.png`、`web-02-inbox-after.png`、`android-01-inbox-before.png`、`android-01-inbox-after.png`。
3. 资产：Android 首个账户进入首屏；Web 估值日期可直接打开原有日期控件。账户详情将余额校准和转账放在流水之前，Web 从滚动位置进入时焦点回到详情标题，Android 实际打开余额校准页。见 `web-03-assets-before.png`、`web-03-assets-after.png`、`web-04-account-before.png`、`web-04-account-after.png`、`android-02-assets-before.png`、`android-02-assets-after.png`、`android-03-account-before.png`、`android-03-account-after.png`。
4. 工具：Web 从功能入口进入具体设置，账本切换直达账本管理，切换设置时保留未保存的表单内容；Android 去除重复的待处理快捷项。见 `web-05-tools-before.png`、`web-05-tools-after.png`、`web-08-tools-desktop-before.png`、`web-08-tools-desktop-after.png`、`web-09-books-after.png`、`android-04-tools-before.png`、`android-04-tools-after.png`。
5. 报表与记账：Web 自定义日期按需展开，报表图表进入首屏，记账弹窗的保存按钮在窄屏保持可见；两端选择常用模板只填入草稿，没有直接写入。Android 常用模板改为横向列表，主导航三个页面均提供记账入口。见 `web-06-reports-before.png`、`web-06-reports-after.png`、`web-07-entry-before.png`、`web-07-entry-after.png`、`android-05-entry-after.png`。

`npm run check` 通过：809 项 Vitest、4 项静态托管测试和 67 项服务端测试，依赖检查另有 9 项。Android APK 构建成功并安装到模拟器，采用开发签名。仅验证本地预览和模拟器；未验证真实设备、生产同步服务或应用商店发布。新增临时 Android 测试用户已移除，原模拟器用户数据保留。

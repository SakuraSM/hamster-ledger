# 资产管理优化验收

本次将资产查看、变动追溯与余额核对连接起来。Web 与 Android 共用金额计算和交互控制器，沿用原有账户、基准及交易数据结构。

## 参考范围

参考的是公开功能说明，没有对竞品当前安装包作界面验收。[钱迹的资产趋势说明](https://docs.qianjiapp.com/assetrecord/asset_line.html)覆盖账户余额曲线与调整记录；[资产负债表说明](https://docs.qianjiapp.com/assetrecord/balance_sheet.html)区分净资产变化与收支结余。[随手记官方介绍](https://www.sui.com/download/2p0/kaniu.jsp)强调资产、负债及账户详情。本次据此补齐资产概览、期间变化、逐笔余额、校准差额和账户内转账入口。

## 流程检查

| 环节       | 改前问题                                         | 完成后的行为                                                                           | 证据                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 总览       | 只有当期收支，无法直接看到资产                   | 显示当前净资产、总资产、负债和本月变化，可直接进入资产管理；首页隐藏金额仍生效         | [改前](evidence/asset-management-2026-10-18/web-overview-before.png)、[改后](evidence/asset-management-2026-10-18/web-overview-after.png)                                                                                          |
| 资产列表   | 只有当前余额和基准后笔数                         | 展示本月变化、账户原币变化、净资产趋势及搜索；估值日可切换                             | [改前](evidence/asset-management-2026-10-18/web-assets-before.png)、[改后](evidence/asset-management-2026-10-18/web-assets-after.png)                                                                                              |
| 账户详情   | 关联账单与生效变动混在一起，列表一次渲染全部记录 | 默认显示已生效余额变动、校准及逐笔余额；关联账单单独查看，月份切换与分页共用一个控制器 | [改前](evidence/asset-management-2026-10-18/web-account-before.png)、[改后](evidence/asset-management-2026-10-18/web-account-after.png)、[Android](evidence/asset-management-2026-10-18/android-account-after.png)                 |
| 余额校准   | 进入完整账户编辑表单，没有差额预览               | 独立填写实际余额、确认时间与说明，预览账面余额、差额和结果；失败保留输入               | [改前](evidence/asset-management-2026-10-18/web-calibration-before.png)、[Web 改后](evidence/asset-management-2026-10-18/web-calibration-after.png)、[Android](evidence/asset-management-2026-10-18/android-calibration-after.png) |
| 转账与还款 | 需离开账户页再选择账户                           | 预选当前账户，并使用原有完整交易表单校验与保存                                         | 两端实际操作见下文                                                                                                                                                                                                                 |

上述流程已完成实测。Web 改前改后使用同一示例账本；Android 使用同一份示例数据验证金额与交互。所有截图均为虚拟数据。

## 金额与保存实测

示例账本初始净资产为 124,557.70 元，总资产 131,057.70 元，负债 6,500.00 元。其中银行卡余额 59,863.70 元，基准 50,000.00 元，基准后有 111 笔生效流水。

- 两端将银行卡校准为 59,963.70 元，预览差额均为增加 100 元。保存后净资产为 124,657.70 元，本月变化增加 100 元，账户明细出现校准记录。Web 的月度收入仍为 18,500.00 元、支出仍为 8,642.30 元。两端撤销后恢复初始余额。
- 两端从银行卡转入信用卡 100 元。银行卡为 59,763.70 元，信用卡负债为 6,400.00 元，总资产为 130,957.70 元，净资产仍为 124,557.70 元。两端撤销后恢复初始数据。
- 两端账户余额变动共 112 条，包含建立基准，均已切到第二页验证分页（[Android 第二页](evidence/asset-management-2026-10-18/android-page-two.png)）。Web 每页渲染 20 条。切换关联账单后回到第一页，共 123 条、7 页，每页最多 20 条。
- 校准时间不能晚于当前时间。基准以前、待确认、重复、已删除及所选日期以后的流水不会被作为新的生效变动重复累计。
- 没有历史基准或历史汇率时显示暂无可比数据。不会把首次登记余额当作净资产增长。

## 自动化与运行环境

验证环境为 Node.js 24、Ego Browser、本地 Vite 预览和 Android API 36 模拟器。Android 使用可独立运行的 release 构建，并保留原有应用数据。

`npm run check` 已完整通过：284 个 Vitest 测试、62 个 PostgreSQL 服务端测试，以及依赖、格式、设计值、类型、ESLint、模块边界、Web 构建和 Sites 包装检查。Docker 最初未启动，启动后数据库测试及完整检查均重新通过。

`npm run android:apk` 已生成 release APK。严格静态门禁同时检查了新增共享逻辑和资产组件。校准弹窗和账户页的 axe-core WCAG A 与 AA 扫描均为 0 项违规；Escape 关闭校准表单后，焦点回到“校准余额”按钮。

[390 px Web 账户页](evidence/asset-management-2026-10-18/web-account-390.png)的文档宽度为 390 px，没有整页横向溢出。[资产页](evidence/asset-management-2026-10-18/web-assets-390.png)和[校准表单](evidence/asset-management-2026-10-18/web-calibration-390.png)也完成窄屏检查。关联账单表格保留内部横向滚动。Android 的[资产页](evidence/asset-management-2026-10-18/android-assets-after.png)移除了遮挡账户余额的悬浮记账按钮。截图验证了资产总览、逐笔余额和校准表单，不代表所有品牌真机的性能或外部银行数据验收。

## 数据约束

没有数据库迁移或存储键变化。旧账户首次校准时补存原有基准；同一时点的后一次更正覆盖计算结果，但保留原始维护记录。所有金额使用整数最小货币单位，负债、信用卡预存及两端转账继续沿用既有符号规则。

净资产曲线只比较当前未归档账户。已有数据没有记录账户的历史归档时间，因此不提供“当时有哪些账户”的历史组合还原。缺失的旧余额基准无法凭流水补猜。账户余额仍依赖用户提供的基准和交易，未接入银行实时余额或投资行情。

实现入口为 `account-baselines.ts`、`account-activity.ts`、`asset-comparison.ts`，以及 `useAssetSummary`、`useAccountHistory`、`useBalanceCalibration`。使用规则见[资产账户与账单关联](assets.md)。

本页记录的是 0.4.0 发布前的功能验收。验收时使用版本号 0.3.0 的本地预览包；正式发布包使用 0.4.0 和 versionCode 4，下载与校验值以 GitHub Release 为准。原预览包的测试与校验值见 [verification.json](evidence/asset-management-2026-10-18/verification.json)。

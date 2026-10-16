# 大账本与日常操作优化

本次从 `a87a3ec` 开始检查 Android 与 Web 的流畅性和功能衔接。保留现有视觉设计、账本格式及金额规则。本文仍在补充运行验证，不能作为整体验收已完成的声明。

## 参考与取舍

- [React Native 列表优化](https://reactnative.dev/docs/optimizing-flatlist-configuration)建议复用行组件及渲染回调，并按实际屏幕权衡批量渲染。当前流水已使用 FlatList，先消除全账本重复计算；字体缩放下行高会变化，不使用固定高度推算位置。
- [FlashList 性能说明](https://shopify.github.io/flash-list/docs/fundamentals/performance/)强调在 release 构建测量，并注意复用组件的状态。当前证据指向匹配和筛选算法，暂不增加列表依赖。
- [Actual 的交易筛选](https://actualbudget.org/docs/transactions/filters/)支持组合条件和筛选合计。用于检查本项目从查找流水到整理账单的操作是否完整。
- [Actual 的重复合并](https://actualbudget.org/docs/transactions/merging/)提供人工选择匹配交易的操作。本项目继续保留原始流水，检查多个候选时能否完成核对。

这些是针对当前问题的参考，不代表某个库或产品在所有场景下都是最佳选择。

## 计算基线

在同一台主机、Node 24.19.0 下，旧代码与改后代码各执行三次。数据为合成流水，已有账本和传入文件分别为表中规模。重复导入保留相同来源、账户和订单号，改变记录 ID。回款筛选数据是尚无回款的可报销支出。

| 15,000 笔场景 |   改前中位数 | 改后中位数 |
| ------------- | -----------: | ---------: |
| 新流水匹配    |  1,963.25 ms |   36.68 ms |
| 同源重复导入  | 16,655.98 ms |   21.32 ms |
| 待报销筛选    |    310.83 ms |    0.39 ms |

原始三次结果见 [改前](evidence/ledger-optimization-2026-10-15/compute-before.json)与[改后](evidence/ledger-optimization-2026-10-15/compute-after.json)。[测量脚本](evidence/ledger-optimization-2026-10-15/benchmark.mjs)接收已构建的 `ledger-core/dist/index.js` 路径。

这是业务计算耗时，未包含文件读取、解析、渲染、数据库保存及设备差异，不能解释为手机完整操作耗时或帧率。另用固定种子生成 2,000 组输入，新旧导入结果一致。

实现将候选按账户、金额、币种、来源及日期建立索引，仍由原匹配规则判断。找到两个合格候选即保留歧义，不擅自选中第一笔。同源重复复用记录 ID 索引；列表筛选一次建立回款索引，搜索文本及日期排序随记录变化重新计算。

## 当前走查

1. Web 总览能显示示例汇总、分类和流水。[截图](evidence/ledger-optimization-2026-10-15/01-web-overview-before.png)
2. Web 全部账单能显示筛选、批量操作及分页。需要继续验证大账本和筛选切换时的选择范围。[截图](evidence/ledger-optimization-2026-10-15/02-web-transactions-before.png)
3. Android 全部账单能显示搜索、来源、待确认和回收站。需要继续检查复杂条件及核对操作。[截图](evidence/ledger-optimization-2026-10-15/03-native-transactions-before.png)

截图均为本次运行取得并检查。Web 使用隔离的 Playwright Chromium；Ego 可读取页面，但三次截图请求超时。当前会话没有 Browser 插件。Android 使用 API 36 模拟器，保留原有账本，仅使用合成验收数据。截图本身不能证明无障碍合规或低端真机性能。

## 核对与批量操作

用[三条合成流水](evidence/ledger-optimization-2026-10-15/ambiguous.json)复现：两条支付宝消费各 36 元，一条同额银行流水待确认。旧版 Web 与 Android 的核对中心均显示没有待核对记录，虽然该银行流水仍处于 pending。[Web 改前](evidence/ledger-optimization-2026-10-15/05-ambiguous-review-before.png)，[Android 改前](evidence/ledger-optimization-2026-10-15/10-native-review-before.png)。

现在核对中心及首页计数包含没有成对核对任务的待确认流水。用户可以查看原始流水，主动选择匹配对象，或确认为独立账单。没有默认候选；保存失败保留选择，重复点击只提交一次。已完成、已删除或不再满足匹配条件的核对不能再次关联。

- Web 与 Android 均实测选择第二笔消费，关联结果指向所选流水，总支出保持 72 元。[选择候选](evidence/ledger-optimization-2026-10-15/06-ambiguous-choice-after.png)，[关联结果](evidence/ledger-optimization-2026-10-15/07-ambiguous-linked-after.png)。
- 两端均实测确认为独立账单后支出为 108 元；撤销后回到 72 元，待核对入口恢复。[Android 撤销后](evidence/ledger-optimization-2026-10-15/13-native-undo-after.png)。
- 批量删除复用单笔删除的交易分组规则，待核对交易不能绕过限制删除。Web 实测删除一笔关联交易，导出的归档中主记录及银行流水同时标记删除；从回收站恢复和撤销均恢复两条原始记录。[回收站](evidence/ledger-optimization-2026-10-15/08-batch-trash-after.png)。
- Android 成对核对列表改为 FlatList；Web 核对队列每页最多 20 组，使用记录索引查找明细。该项尚未单独测量帧率。

本阶段 `npm test` 的 43 个文件、257 项测试通过，类型检查及 ESLint 通过。Android release 包已构建并覆盖安装到同一模拟器，原有账本保留。完整检查、最终安装包和大账本运行验证仍在后续清单中。

## 组合筛选与选择范围

Web 与 Android 共用查询规则：可组合日期、收支类型、来源、分类、资产账户、成员与报销条件。搜索覆盖商户、备注、账户、分类、标签和流水号，来源包含人工关联后的来源。默认列表隐藏重复原始记录，可通过状态筛选查看。

筛选合计复用原有金额规则，只统计已确认且未删除的流水；退款冲减支出，转账不计收支。开始日期晚于结束日期时显示错误，不展示零金额冒充合计。Web 同时禁止导出无效结果。清除全部筛选会清除日期、状态和查询条件。

两端实测选择三笔后搜索单笔，显示另外两笔被筛选隐藏；“仅保留当前结果中的选择”将选择减为一笔。保留原选择快照，不能借筛选刷新绕过过期写入检查。[Web 提示](evidence/ledger-optimization-2026-10-15/15-web-hidden-selection.png)。两端均验证日期错误、待确认金额为零、空结果及清除条件。

Web 在 390 px 宽度检查发现顶栏溢出，调整换行及月份控件宽度后文档宽度恢复为 390 px；表格保留内部横向滚动。[窄屏页面](evidence/ledger-optimization-2026-10-15/16-web-query-narrow.png)。Android 子页面原先在顶部露出底层菜单，给导航容器限制绘制范围后消失。[改前](evidence/ledger-optimization-2026-10-15/17-native-layer-before.png)，[改后](evidence/ledger-optimization-2026-10-15/21-native-layer-after.png)。

## 大账本与浏览器存储

15,000 笔合成账本包含 1,500 笔收入和 13,500 笔支出，收入 2,233.20 元、净支出 20,104.56 元。Android 恢复后完成单笔搜索及连续滚动。[列表](evidence/ledger-optimization-2026-10-15/23-native-scale-15000.png)，[滚动后](evidence/ledger-optimization-2026-10-15/24-native-scale-scrolled.png)。这是 release 模拟器功能检查，没有采集帧率，不能证明低端真机性能。

Web 首次恢复同一备份时，localStorage 的写入配额不足，原账本保留。修复后大值写入 IndexedDB，沿用旧账本格式、密码保护和冲突检查，详细写入次序及回退要求见[存储说明](browser-storage.md)。修复后实测 15,000 笔恢复、重开、分页、单笔搜索及整日日期筛选；每页渲染 20 条，10 月 15 日筛出 536 条。[页面](evidence/ledger-optimization-2026-10-15/20-web-scale-15000.png)。

在该 Web 账本上继续导入 5,000 笔各 2 元的支付宝合成流水。交易时间存在多个字段候选，先人工确认映射，再执行导入。同文件再次选择被拦截；仅改变换行的文件再次导入时，5,000 条全部识别为重复。最终保存 25,000 条原始记录、20,000 笔有效账单，净支出 30,104.56 元。完整归档导出后恢复到另一个新账本，记录与金额一致。[页面](evidence/ledger-optimization-2026-10-15/22-web-scale-imported.png)，[断言结果](evidence/ledger-optimization-2026-10-15/web-scale-result.json)。

对该隔离浏览器内的合成账本启用密码后，localStorage 不再有账本明文键，IndexedDB 中旧明文记录为零。锁定并重新解锁后，有效记录仍为 20,000 笔、净支出仍为 30,104.56 元。[断言结果](evidence/ledger-optimization-2026-10-15/web-vault-result.json)。不将本机密码保护解释为服务端端到端加密。

## 后续验收

- 大账本读取、筛选、滚动、导入及重复导入的 Android 运行检查。
- 新增、编辑、删除、恢复及批量整理，核对金额和关联流水。
- 单个与多个重复候选的人工核对，避免遗漏待确认记录。
- 组合筛选、空结果、条件清除、筛选合计与批量选择范围。
- 资产、报表、预算、周期记账和本地通知的主要入口。
- 备份导出及恢复到新账本，保留原账本。
- 本地 PostgreSQL 服务、登录、同步及共享权限的现有回归测试与运行检查。
- 仓库完整 `npm run check`、Android release 包及本次变更的独立审查。

真实支付通知模板、厂商后台、公网部署和跨设备生产验收仍需相应环境，不以本地检查替代。

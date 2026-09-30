# 仓鼠记账 · Hamster Ledger

[![CI](https://github.com/SakuraSM/hamster-ledger/actions/workflows/ci.yml/badge.svg)](https://github.com/SakuraSM/hamster-ledger/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

在浏览器里整理支付宝、微信与银行账单，核对重复流水，查看收入和支出。桌面 Web 优先，支持手机查看。账单在本地解析和保存。

> 项目处于早期开发阶段。当前提供可运行的 Web 应用及共享业务包，没有已发布的手机 App、银行直连或云同步服务。示例数据均为虚构。

![仓鼠记账桌面总览](docs/images/desktop.png)

## 主要功能

- 导入 CSV、XLSX、XLS，识别常见账单字段，支持表头与字段映射调整。
- 区分支付平台与实际付款账户。重复文件和有明确流水号的同源重复自动识别，跨平台疑似重复交由用户核对。
- 自动归类常见商户，支持修改分类并保存规则。
- 按月汇总收支，按来源、分类和处理状态筛选，搜索商户或流水号。
- 使用整数分计算金额，退款抵扣支出，已识别的还款、充值、提现单列。
- 保留原始字段，支持当前会话撤销、CSV 导出和 JSON 备份导出。

当前仅支持人民币和单工作表 Excel。账单兼容性依据虚拟样本验证，不代表所有银行的所有导出版本都已适配。详细边界见 [能力说明](docs/capabilities.md)。

## 本地运行

需要 Node.js 22 或 24、npm 10 以上版本。

```sh
git clone https://github.com/SakuraSM/hamster-ledger.git
cd hamster-ledger
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
```

使用终端输出的地址打开页面。首次进入示例账本，导入时写入独立的个人账本。导入页提供三个可下载的虚拟 CSV 样本。

```sh
npm run check       # 类型、边界、测试、构建与静态托管打包
npm run build       # Web 产物位于 apps/web/dist/client
```

账单保存在当前浏览器。清理网站数据或换设备后不会自动恢复；当前 JSON 备份仅支持导出，尚未提供恢复入口。

## 项目目录

| 目录                           | 职责                                         |
| ------------------------------ | -------------------------------------------- |
| `apps/web`                     | React 页面、浏览器文件读取、存储和导出       |
| `packages/ledger-core`         | 数据模型、分类、去重、收支计算与异步存储协议 |
| `packages/statement-importers` | 表头映射、日期金额解析、交易标准化           |
| `packages/design-tokens`       | 可供 Web 与未来 App 使用的 JSON 设计变量     |
| `tests`                        | 账务行为、共享包契约和 Web 异步存储测试      |
| `docs`                         | 架构、设计依据、能力边界及 App 开发准备      |

共享包在不提供 DOM 类型的配置下独立编译。后续 App 可复用业务规则，并以平台适配器接入文件选择、原生存储和导出。

- [架构与依赖边界](docs/architecture.md)
- [后续 App 开发准备](docs/mobile-readiness.md)
- [架构决策记录](docs/adr/0001-workspace-and-platform-boundaries.md)
- [设计与验证范围](docs/design/qa.md)

## 参与项目

欢迎提交可复现的问题和小范围改进。开始前阅读 [贡献说明](CONTRIBUTING.md)。请只提交虚拟样本，勿在 Issue、PR 或截图中包含真实账单、完整卡号或凭据。

安全漏洞通过 [私密报告入口](https://github.com/SakuraSM/hamster-ledger/security/advisories/new) 提交，详见 [安全策略](SECURITY.md)。

## 参考与许可

功能设计参考 [Bean-Sieve](https://github.com/Xm798/bean-sieve)、[Actual Budget](https://actualbudget.org/docs/api/reference/) 和 [double-entry-generator 社区讨论](https://github.com/deb-sig/double-entry-generator/discussions/162)。本项目自行实现当前范围内的规则，不声称拥有这些项目的全部能力。

代码采用 [MIT 许可证](LICENSE)。第三方依赖与资产说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

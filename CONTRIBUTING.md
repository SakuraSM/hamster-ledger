# 参与贡献

使用 Node.js 22 或 24 和 npm 10 以上版本。Fork 仓库后运行：

```sh
npm ci
npm run dev
```

提交前运行 `npm run check`。该命令检查类型、依赖边界、测试、Web 构建和静态站点打包。界面变更还需要在浏览器验证，静态检查不能替代页面验证。

分支使用 `feat/`、`fix/`、`docs/` 或 `refactor/` 前缀，不使用 `codex` 前缀。提交说明写清问题与行为，较大的结构调整和功能变更分开提交。

## 代码放在哪里

- Web 组件与浏览器适配放入 `apps/web`。
- 金额、账本、去重和持久化协议放入 `packages/ledger-core`。
- 表头和行记录归一化放入 `packages/statement-importers`。
- 通用颜色等设计值放入 `packages/design-tokens/src/tokens.json`，运行 `npm run tokens:generate` 更新 CSS。

共享包不得导入 React、DOM、Node 文件系统或原生 SDK。新增平台由平台适配器读取文件、计算文件哈希及保存账本。修改共享包后重新运行 `npm run build:packages`；Web 源码由 Vite 自动刷新。

## 账单样本

只提交手工构造的虚拟样本。表头可以保留实际格式，姓名、商户、时间、金额、订单号和账户必须改为虚构内容。不要把真实账单放进 Issue、PR、截图或测试日志。

修复去重问题时，至少覆盖“不该合并的相似交易”。导入器变更要明确支持的来源、格式和版本。没有样本验证的格式不得标记为已兼容。

## Pull request

说明复现方法、改动原因、验证结果和剩余边界。界面修改附截图；共享协议修改说明兼容性和迁移方式。仓库代码采用 MIT 许可证，提交内容也按该许可证提供。

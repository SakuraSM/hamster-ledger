# 项目结构与平台边界

仓鼠记账使用 npm workspaces 管理 Web 应用和共享 TypeScript 包。账务规则不依赖 Web 界面，未来 App 通过平台适配器复用这些规则。

```text
apps/
  web/                       React 与 Vite 应用
    src/components/          界面组件
    src/hooks/               页面状态与异步操作
    src/platform/browser/    文件读取、存储、下载
    src/data/                虚拟演示数据
    public/                  仓鼠标志与虚拟 CSV 样本
    worker/                  可选静态托管 Worker
packages/
  ledger-core/               账本模型、分类、去重、异步存储协议
  statement-importers/       表头映射、日期金额解析、记录归一化
  design-tokens/             JSON 设计变量与生成的 Web CSS
scripts/                     包边界检查、设计变量生成
tests/                      跨包行为与平台协议测试
docs/                       架构、设计、能力边界和 App 准备说明
.github/                    CI、问题模板、维护配置
```

目录树中 `tests`、`docs` 和 `.github` 均为仓库根目录。

## 依赖方向

`apps/web` 消费 `ledger-core`、`statement-importers` 和 `design-tokens`。`statement-importers` 只依赖 `ledger-core`，`ledger-core` 只使用 Zod 校验数据。平台层依赖共享协议，共享包不反向导入平台代码。

`check:boundaries` 检查共享包的 import 和 export。共享包使用不含 DOM 和 Node 全局类型的 TypeScript 配置，构建产物同时提供 ESM JavaScript 与声明文件。无需 React 或浏览器即可执行账务测试。

## 导入链路

1. 浏览器适配器通过 `File` 读取 CSV 或 Excel，解码并计算 SHA-256。
2. `createStatement({ name, hash, rows })` 接收普通字符串二维数组。
3. `parseStatement` 按字段映射识别账单，保留原始字段与错误行。
4. `planImport` 对账本与新记录去重，生成待确认项。
5. 用户确认后，经异步 `LedgerRepository` 写入平台存储。

App 可用原生文件选择器和解码库替换第一步，其余业务链路无需复制。二进制文件适配尚未提供原生实现。

## 持久化

`KeyValueStore` 提供异步 `getItem` 和 `setItem`。`createLedgerRepository` 负责模型校验、序列化和示例/个人账本隔离。Web 使用 localStorage 适配器，接口保留异步形式，便于后续接入原生存储。

原型的 `hamster-ledger.v1.*` 键名和账本 `version: 1` 保持兼容。读取损坏或未知版本数据会报错并停止初始化，不把空账本当作读取成功。保存失败不会更新已展示的账本，当前账本选择的保存失败与账单保存失败分别报告。

跨设备同步、多进程冲突控制、增量迁移和完整操作日志尚未实现。不要把这个 KeyValueStore 协议直接当作已经完成的同步数据库。

## 设计变量

JSON 是共享设计变量来源，Web 的基础主题从生成的 CSS 读取。未来原生客户端可把 JSON 转换为其主题对象。DOM 组件、CSS 布局和 Recharts 图表属于 Web 应用，不作为原生 UI 的共享接口。

## 工程选择

先使用 [npm 原生 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) 和单一 lockfile，暂不增加任务缓存框架。CI 使用只读权限和固定 commit 的 Actions，参考 [GitHub Actions 安全建议](https://docs.github.com/en/actions/reference/security/secure-use)。这些约束可验证且与当前规模匹配。

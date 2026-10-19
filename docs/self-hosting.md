# 自托管仓鼠记账

Node.js 提供 Web 与 HTTP API，PostgreSQL 保存账号、联网账本、附件、会话及任务状态。Web 本机账本和 Android SQLCipher 离线账本不依赖 PG；未确认支付通知只留在手机。

## 源码与 Compose 启动

使用当前源码构建 PG 版本。已有的 SQLite 版本镜像不能直接连接 PG。

1. 在未跟踪的 `.env` 中分别设置 `POSTGRES_PASSWORD`（应用账号）和 `POSTGRES_ADMIN_PASSWORD`（数据库管理员），使用两个不同的随机十六进制字符串。可用 `openssl rand -hex 32` 分别生成；不要提交或公开这些值。
2. 执行 `docker compose up -d --build`。
3. 查看 `docker compose ps`，确认 PG 健康、迁移任务成功、应用健康，再打开 `http://127.0.0.1:4180`。

Compose 默认构建 `hamster-ledger:postgres-local`，使用 `postgres:18.6-bookworm`。应用使用非超级用户 `hamster`，PG 不映射宿主端口。数据库卷挂载 `/var/lib/postgresql`；原 `ledger-data` 卷保留用于模型主密钥与旧库迁移。

已有外部 PG 可通过 `DATABASE_URL` 接入。直接运行时使用 Node.js 22 或 24、npm 10 以上版本：

```sh
npm ci
npm run build
# 通过部署环境设置 DATABASE_URL，不把凭据写入命令历史或仓库。
npm run db:migrate
npm start
```

| 环境变量                   | 默认值                    | 作用                                                     |
| -------------------------- | ------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`             | 必填                      | PostgreSQL 连接地址；手机与浏览器不持有此凭据            |
| `LEDGER_DATA_DIR`          | 仓库 `data`；容器 `/data` | 模型主密钥目录                                           |
| `LEDGER_MODEL_MASTER_KEY`  | 未设置                    | 可选，原有 32 字节 Base64 主密钥；需另行安全备份         |
| `LEDGER_MODEL_LAN_ORIGINS` | 空，禁止私网模型访问      | 逗号分隔的精确模型 origin 白名单，含协议和端口，不含路径 |
| `HOST` / `PORT`            | `127.0.0.1` / `4180`      | 监听地址与端口                                           |
| `PUBLIC_ORIGIN`            | 本机请求 Origin           | 对外部署设置实际 HTTPS Origin                            |
| `ALLOW_REGISTRATION`       | `true`                    | 设置 `false` 关闭注册                                    |
| `LEDGER_TIMEZONE`          | `Asia/Shanghai`           | 服务端周期记账时区                                       |
| `WEB_ROOT`                 | `apps/web/dist/client`    | 网页构建目录                                             |

应用启动校验 schema，不自行回退到 SQLite。迁移命令是独立步骤；Compose 会在应用启动前运行迁移任务。`/api/health` 检查数据库连通性，返回 `storage: postgresql`；健康不等同于模型服务或业务验收。

外部 PG 应使用校验服务端证书的 TLS 连接。反向代理部署时保持应用端口只监听回环地址，配置真实 HTTPS `PUBLIC_ORIGIN`；写入 Origin 不匹配会被拒绝。

## 局域网模型授权

私网模型需要同时满足部署白名单和用户的局域网选项。例如，模型接口是 `http://192.168.1.10:11434/v1` 时，在部署环境设置 `LEDGER_MODEL_LAN_ORIGINS=http://192.168.1.10:11434`。不同协议、主机或端口不会自动获得授权。不支持通配符。

升级后，旧的局域网配置也受此限制。白名单为空时，已有配置的列表、测试和识别请求都会被拒绝；公网 HTTPS 模型的默认行为保持不变。授权目标仍受禁止地址检查、DNS 固定、响应大小和超时约束。

## 旧 SQLite 迁移

1. 停止旧服务写入，保留一致性 SQLite 备份，包含尚未 checkpoint 的 WAL 内容；保留原 `.model-key` 或 `LEDGER_MODEL_MASTER_KEY`。
2. 准备空的 PG 业务库并执行 `npm run db:migrate`。
3. 设置 `LEDGER_DATA_DIR` 指向原模型主密钥目录，预检查：

```sh
npm run db:import-sqlite -- --source data/ledger.sqlite --dry-run
```

4. 核对各表数量、账本汇总与跳过的无效旧会话，再执行：

```sh
npm run db:import-sqlite -- --source data/ledger.sqlite --apply
```

5. 导入只读旧库，目标非空时拒绝覆盖；插入或内容校验失败整体回滚。核对登录、账本版本、附件、模型配置、Token 和调度状态后再恢复流量。

`DATABASE_PATH` 不再是运行配置，旧文件仅作为导入源。原主密钥缺失时停止导入含密钥的模型配置，不生成新密钥替代。迁移保留用户及账本 ID、会话摘要、版本号、请求幂等回执与原排序。缺少现代会话 ID 或 CSRF 字段的旧会话不导入，报告列出跳过数量，用户需重新登录。

PG 接受新写入后，旧 SQLite 不再包含最新数据，不能直接切回旧镜像和旧文件。先停写并保全 PG 数据，再安排兼容版本恢复及数据核对。

## 同步与备份

同步 API、版本冲突和权限行为保持原协议。个人同步以完整账本为单位；联网账本使用版本与幂等键提交业务操作。服务端无法访问手机未确认的通知收件箱。

应用内完整归档适合单账本转移，不包含账号、Token 或模型主密钥。服务端恢复必须同时保存 PG 逻辑备份和模型主密钥，步骤见 [容器备份与恢复](container-operations.md)。

服务端账本并非端到端加密；模型凭据单独加密。忘记账号密码可由管理员执行 `npm run auth:reset`，详见 [认证策略](authentication.md)。

## 测试

`npm run test:server` 使用真实 PG。设置 `TEST_DATABASE_URL` 时在指定测试数据库创建隔离 schema；未设置时自动启动并清理独立 Docker PG 测试实例。不要提供生产数据库地址作为测试连接。

`npm run check` 同时执行共享规则、Web、原生组件适配器和服务端回归。容器测试、原生 APK 与真实设备结果单独记录，不相互代替。

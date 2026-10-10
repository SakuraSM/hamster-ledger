# Docker 分发、升级与恢复

镜像名称为 `ghcr.io/sakurasm/hamster-ledger`，目标架构为 `linux/amd64`、`linux/arm64`。Compose 默认固定 `0.2.0`；也可通过 `HAMSTER_IMAGE` 指定版本或摘要。正式 `vMAJOR.MINOR.PATCH` 标签通过校验后发布版本镜像及 `latest`，分支与 PR 只构建验证。

工作流使用 [Docker 官方 GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/)，发布前核对工作区版本并执行完整检查与 Android 导出。镜像包含源码仓库和提交标签以及构建来源信息。发布状态与架构摘要见本次 [功能对照记录](homeledger-parity.md)。

## 启动与本地构建

```sh
docker compose pull
docker compose up -d
docker compose ps
```

本地源码验证可执行 `docker compose up -d --build`。默认通过 `http://127.0.0.1:4180` 访问；更换端口时同时指定访问 Origin，例如：

```sh
LEDGER_PORT=4290 PUBLIC_ORIGIN=http://127.0.0.1:4290 docker compose up -d
```

反向代理部署时设置真实 HTTPS `PUBLIC_ORIGIN`，保持主机端口只监听回环地址。容器以 UID/GID 1000 运行；绑定宿主目录时须保证该用户可写。

0.2.0 的默认端口为 4180，避免旧默认值 4190 被 Fetch 的受限端口检查拦截。原有部署如自定义端口和 Origin，应一起核对。

健康检查每 30 秒访问 `/api/health`，容器启动后有 10 秒宽限，连续 3 次失败标记 unhealthy。健康检查只验证进程和数据库服务入口，不代表模型提供商可用或业务已验收。`docker compose logs --tail=100 ledger` 可查看进程错误。

## 持久化内容

`/data` 必须保存在命名卷或绑定目录中，包含：

- `ledger.sqlite` 及运行期间的 WAL/SHM：用户、账本、附件、令牌摘要、操作记录、幂等回执、调度与汇率缓存。
- `.model-key`：自动生成的模型密钥加密主密钥，权限 0600。必须与数据库一起备份；缺少主密钥无法解密已有模型配置。

如使用 `LEDGER_MODEL_MASTER_KEY` 环境变量覆盖主密钥，应在部署环境通过自己的密钥管理方式提供并另行备份；不要把值写进仓库或 Compose 文件。`LEDGER_TIMEZONE` 默认 `Asia/Shanghai`。

## 停机备份与恢复

下面的 `BACKUP_DIR` 使用绝对路径。命令通过 Compose 服务的同一个数据卷读写，包含隐藏的 `.model-key`。先检查备份文件存在且可读取，再进行升级或恢复。

```sh
export BACKUP_DIR="$PWD/backups"
mkdir -p "$BACKUP_DIR"
docker compose stop ledger
docker compose run --rm --no-deps --user 0 \
  -v "$BACKUP_DIR:/backup" --entrypoint sh ledger \
  -c 'tar -C /data -czf /backup/ledger-before-upgrade.tar.gz .'
docker compose start ledger
tar -tzf "$BACKUP_DIR/ledger-before-upgrade.tar.gz"
```

恢复会覆盖所选卷内的数据。先停止服务并保留当前数据备份；恢复到新卷进行核对更稳妥。下列示例使用新的 Compose 项目名，因此创建独立数据卷，避免与现有服务混用：

```sh
docker compose -p hamster-restore run --rm --no-deps --user 0 \
  -v "$BACKUP_DIR:/backup:ro" --entrypoint sh ledger \
  -c 'tar -C /data -xzf /backup/ledger-before-upgrade.tar.gz && chown -R 1000:1000 /data'
LEDGER_PORT=4290 PUBLIC_ORIGIN=http://127.0.0.1:4290 \
  docker compose -p hamster-restore up -d
```

登录恢复实例，核对账单数量、附件原图、模型配置状态与令牌，再切换正式流量。不要将多个容器同时写入同一个 SQLite 卷。

## 升级与回滚

1. 记录当前镜像摘要，按上述步骤停机备份整个数据目录。
2. 将 `HAMSTER_IMAGE` 指向目标版本，执行 `docker compose pull && docker compose up -d`。
3. 检查健康状态，并登录核对账单、附件和联网写入。服务端重启后会分批处理到期订阅，使用规则与日期去重。
4. 回滚时同时恢复升级前镜像和升级前数据备份。旧版本不承诺读取 v2 字段，不能只降镜像而继续写新数据库。

应用内 `.hamster` 完整归档适合单账本转移，包含流水和引用附件；它不包含服务端账号、令牌及模型密钥，不能替代整个 `/data` 备份。旧 JSON 仍可导入为新账本。

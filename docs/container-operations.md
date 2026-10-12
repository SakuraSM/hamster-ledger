# PostgreSQL 容器备份与恢复

当前 PG 版本从源码执行 `docker compose up -d --build`。Compose 先启动数据库，再执行 schema 迁移，最后启动应用。镜像发布由正式版本工作流独立完成；源码构建通过不等同于已发布镜像。

## 持久化内容

- `postgres-data`：PostgreSQL 数据卷，挂载 `/var/lib/postgresql`。
- `ledger-data`：应用 `/data`，包含权限 0600 的 `.model-key`，迁移时也可保留旧 SQLite 文件。
- 使用 `LEDGER_MODEL_MASTER_KEY` 时需通过部署环境保存和备份原值，不能把值写入 Git。

数据库、模型主密钥和当前应用版本共同构成恢复点。仅备份 `/data` 已不能恢复 PG 账号、账本或附件。

## 一致性备份

先停止应用写入。下面命令只读备份源，输出到本机 `backups` 目录。

```sh
mkdir -p backups
docker compose stop ledger
docker compose exec -T postgres pg_dump -Fc --no-owner --no-privileges \
  -U postgres -d hamster > backups/ledger.pg.dump
export LEDGER_BACKUP_DIR="$PWD/backups"
docker compose run --rm --no-deps --user 0 \
  -v "$LEDGER_BACKUP_DIR:/backup" --entrypoint sh ledger \
  -c 'tar -C /data -czf /backup/model-key.tar.gz .model-key'
docker compose start ledger
```

如果使用环境变量主密钥，省略 `.model-key` 归档并通过自己的密钥管理系统备份。检查 `pg_restore --list` 和归档目录，确认备份存在；不要把数据库或密钥归档上传到公开位置。

## 恢复到独立实例

使用新的 Compose 项目名创建独立卷，在 `.env` 中配置该恢复实例的数据库密码。恢复项目应继续使用备份时的模型主密钥。

```sh
docker compose -p hamster-restore up -d postgres
docker compose -p hamster-restore exec -T postgres \
  pg_restore --clean --if-exists --no-owner --no-privileges --role=hamster \
  -U postgres -d hamster < backups/ledger.pg.dump
docker compose -p hamster-restore run --rm --no-deps --user 0 \
  -v "$LEDGER_BACKUP_DIR:/backup:ro" --entrypoint sh ledger \
  -c 'tar -C /data -xzf /backup/model-key.tar.gz && chown -R 1000:1000 /data'
LEDGER_PORT=4290 PUBLIC_ORIGIN=http://127.0.0.1:4290 \
  docker compose -p hamster-restore up -d ledger
```

等待数据库健康后再执行 `pg_restore`。上述恢复会清理目标库中的对应对象，只能用于确认过的独立恢复项目。登录恢复实例，核对账本数、收支、附件哈希、模型配置、会话与 Token、历史及幂等回执，再切换流量。

## 升级与故障处理

1. 记录应用镜像摘要，保留 PG 和模型主密钥恢复点。
2. 对目标版本执行迁移命令，再启动应用；schema 不匹配会拒绝启动。
3. 检查 `/api/health`、账号登录、联网写入与周期规则补记。每个周期使用持久幂等标识，不能仅依赖进程内互斥。
4. 数据库不可用时修复连接并恢复服务，不把应用指向空库或旧 SQLite 继续写入。

迁移到 PG 后已有新写入时，直接恢复旧 SQLite 会丢失新数据。应用版本回退也必须兼容当前 PG schema；不能只降镜像而继续写入不兼容的数据。

`HAMSTER_TEST_IMAGE=待验证镜像 node scripts/test-container.mjs` 会创建独立网络、PG 和数据卷，检查健康、重启及 `pg_dump` / `pg_restore` 恢复，结束后只清理本轮创建的资源。

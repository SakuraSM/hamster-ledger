# 开放 API 与机器人接入

开放 API 访问一个联网账本，使用该令牌创建者的成员权限。个人本地账本须先在“更多功能 → 家庭与联网账本”中确认转换。Web 和 Android 在同一页面提供令牌管理；明文只在创建后显示一次，服务端仅保存 SHA-256 摘要。

机器可读规范：[OpenAPI 3.1](../apps/web/public/openapi.json)。部署后可从 `/openapi.json` 下载。接口前缀为 `/api/open/v1`。浏览器 Cookie、Origin 和 Android 会话凭据不能代替专用令牌。

| 接口                    | 令牌权限            | 行为                           |
| ----------------------- | ------------------- | ------------------------------ |
| `GET /ping`             | 任意有效令牌        | 返回账本 ID、版本、角色、范围  |
| `GET /context`          | `records:read`      | 返回账户、分类和当前版本       |
| `GET /records`          | `records:read`      | 查询账单，支持日期与分页       |
| `POST /records`         | `records:write`     | 创建完整交易                   |
| `POST /ai/recognize`    | `ai:recognize`      | 文本或图片识别为多笔草稿       |
| `POST /ai/confirm`      | `ai:confirm`        | 提交人工核对后的交易并确认草稿 |
| `POST /attachments`     | `attachments:write` | 上传图片，返回附件 ID          |
| `GET /attachments/{id}` | `attachments:read`  | 读取附件及 Base64 原图         |

令牌有效期为 1–365 天，默认 30 天；每人每个账本最多 20 个有效令牌。普通成员管理自己的令牌，管理员和所有者可撤销账本中的令牌。每次请求检查创建者当前成员身份与角色；成员移除、角色调整和所有权转移会撤销相关令牌。令牌过期或撤销返回 401，权限不足返回 403，失去账本访问权限返回 404。

## 调用示例

以下数据都是虚拟账单。将 `cash-account-id` 换成 `/context` 返回的已有账户 ID；系统不会自动创建账户。`revision` 使用刚读取的版本。

```sh
export LEDGER_URL=https://ledger.example.com
read -rs LEDGER_TOKEN
export LEDGER_TOKEN
curl --fail-with-body "$LEDGER_URL/api/open/v1/ping" \
  -H "Authorization: Bearer $LEDGER_TOKEN"
curl --fail-with-body "$LEDGER_URL/api/open/v1/context" \
  -H "Authorization: Bearer $LEDGER_TOKEN"
```

```sh
curl --fail-with-body "$LEDGER_URL/api/open/v1/records" \
  -H "Authorization: Bearer $LEDGER_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: robot-order-20261003-001' \
  --data-binary @- <<'JSON'
{
  "revision": 1,
  "entry": {
    "date": "2026-10-03 12:00:00",
    "merchant": "虚拟餐馆",
    "category": "餐饮",
    "accountId": "cash-account-id",
    "detail": {
      "type": "expense",
      "original": {
        "currency": "CNY",
        "minor": 1250,
        "rate": "1",
        "date": "2026-10-03",
        "source": "manual"
      }
    }
  }
}
JSON
```

金额使用币种最小单位的安全整数，上例 `1250` 为人民币 12.50 元。外币须填写实际汇率与汇率日期；不会自动按 1 折算。跨币种转账使用 `transferToAccountId` 和 `detail.destination`；报销使用 `detail.relatedId` 关联原支出。字段约束、借贷和分摊校验与应用内一致。记录 ID 由服务端生成，客户端不能借创建接口覆盖已有记录。

## 重试与并发

所有 POST 都须携带 8–100 位 `Idempotency-Key`，仅允许字母、数字、冒号、下划线和连字符。机器人应保存平台事件 ID 到此键的映射。相同令牌、相同键和相同请求返回原响应，响应头包含 `Idempotency-Replayed: true`；同键不同内容返回 409。幂等回执保存在 SQLite，重启后保留。不要用新键重试一个结果未知的请求。

修改账本还须携带 `revision`。409 `revision_conflict` 表示账本已变化，应重新读取、保留原输入并让用户核对后，用新的请求键提交。查询可用 `from`、`to`（含首尾日期）、`limit`（默认 50，最大 200）、`offset`；后续分页携带第一页的 `revision`，版本改变时从第一页重新读取。

每个令牌每分钟最多 60 次请求，计数跨服务重启保留。429 响应的 `Retry-After` 是等待秒数。不要在错误日志中记录 Authorization、完整图片或密钥。

## AI 与附件

先以 `POST /attachments` 上传 `{name,mime,base64}`，单张最多 8 MiB，每位创建者总计最多 100 MiB。随后将返回的 ID 放进识别请求的 `attachmentIds`，或完整交易的 `detail.attachmentIds`。仅可使用本账本附件；删除及清理在应用内完成。

识别请求填写 `{revision,text,attachmentIds,targetEndpoint}`，文本与图片至少有一个，图片最多 5 张。图片会发送给令牌创建者配置的模型服务；机器人应在上传前告知用户接收服务，并用 `targetEndpoint` 核对地址。服务地址不一致时拒绝识别。没有模型配置时仅解析文本，图片返回明确错误。

默认生成待确认草稿。只有账本主动开启 AI 自动入账且令牌包含 `records:write`，才可能自动入账；金额、账户、分类、重复疑点等规则仍须全部通过。`ai:recognize` 单独授权只能生成草稿。确认请求必须同时提供 `draftId`、最新 `revision` 和核对后的完整 `entry`。`ai:confirm` 本身授权入账，可不授予任意创建交易的 `records:write`。

机器人应展示草稿的来源、金额、账户和待核对项，保留用户确认步骤。模型输出不能直接拼成账本补丁。失败上传的孤立附件可在应用内清理，服务端临时识别附件超过 24 小时自动清理。重复来源识别与重复草稿确认不会重复入账，自动入账可在应用内撤销。

本次提供接入协议和示例，没有连接任何用户聊天平台。

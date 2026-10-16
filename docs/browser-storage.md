# Web 大账本保存与兼容

Web 继续使用原有 `hamster-ledger.v1.*` 账本键和 JSON schema。超过 64 Ki 字符的值写入 IndexedDB，localStorage 只保存版本引用；小值继续内联，遇到 localStorage 容量限制也转入 IndexedDB。已有明文和加密账本在读取时兼容，后续保存时按大小选择存储。

这解决了 15,000 笔合成备份在 localStorage 写入时超过配额的问题。[MDN 的存储配额说明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)列出 localStorage 的 5 MiB 上限；IndexedDB 使用浏览器管理的配额，也可能因空间不足而失败。

## 写入与失败处理

- IndexedDB 数据库为 `hamster-ledger-values.v1`，对象仓库为 `values`。每次写入生成独立版本，保存逻辑键与字符串内容。
- 等待使用 strict durability 的事务完成，再发布 `hamster-idb:v1:` 引用。发布前失败保留旧引用；发布后清理旧版本不改变保存结果。事务完成的依据见 [IndexedDB 使用说明](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)。
- 明文写入检查读取时和发布前的版本。Web Locks 可用时沿用现有串行锁，不可用时仍通过引用比较拒绝过期写入。
- 引用缺失、内容丢失或逻辑键不匹配会停止读取和覆盖，不把损坏数据解释为空账本。
- 加密仍使用现有 AES-GCM envelope。启用密码后先保存完整密文，再清理旧明文及中断写入留下的明文版本；附件密钥仍受同一密码保护。

`tests/large-storage.test.ts` 覆盖超过 localStorage 配额的值、旧值兼容、发布失败、过期写入、缺失内容、加密解锁及加密保存失败。实际大账本与备份验证见[本轮优化记录](ledger-optimization-2026-10-15.md)。

## 回退与备份

旧版本应用不能解析 IndexedDB 引用。回退应用代码前，应在当前版本导出完整 `.hamster` 备份，使用独立浏览器存储环境恢复；不要直接用旧代码覆盖当前存储。账本导出格式没有引入新的 schema。

清除站点数据仍会移除本机账本和凭证。IndexedDB 不等于云端备份；本轮验证不承诺浏览器配额、系统空间和设备故障之外的数据持久性。

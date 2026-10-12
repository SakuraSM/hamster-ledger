# 合成导入文件

这些文件仅包含本轮自制数据。先在独立测试账本创建 `OPPO-CASH` 账户，再依次导入银行 CSV、Excel、重复 CSV 和微信 CSV。

- `bank-OPPO-QA.csv`：支出 3.21 元，收入 7.89 元。
- `bank-OPPO-QA.xlsx`：支出 1.11 元，收入 2.22 元。
- `bank-OPPO-QA-duplicate.csv`：与银行 CSV 使用相同交易单号，故意多保留一个末尾空行，测试不同文件内容下的交易级去重。
- `wechat-OPPO-QA.csv`：两笔支出分别与银行交易 3.21 元、Excel 交易 1.11 元形成跨平台待核对。

CSV 保留原生验证时的 BOM、CRLF 和末尾空行，目录内的 Git 属性仅用于保留这些输入字节。文件 SHA256 见上级 `verification.json`。

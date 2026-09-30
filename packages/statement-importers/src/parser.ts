import { parseAmount, parseDate } from "./parseValues.js";
export { parseAmount, parseDate } from "./parseValues.js";
import {
  type BillRecord,
  type Category,
  type Source,
  RECORD_STATUS,
} from "@hamster-ledger/core";
import {
  classifyCategory,
  classifyKind,
  identifySource,
  normalizeAccount,
} from "@hamster-ledger/core";

export const FIELD_LABELS = {
  date: "交易时间",
  merchant: "交易对方",
  amount: "金额",
  direction: "收支方向",
  account: "付款账户",
  orderId: "交易单号",
  description: "商品说明",
  category: "分类",
  status: "交易状态",
  income: "收入金额",
  expense: "支出金额",
  currency: "币种",
} as const;
export type Field = keyof typeof FIELD_LABELS;
export type FieldMap = Partial<Record<Field, number>>;
const ALIASES: Record<Field, string[]> = {
  date: [
    "交易时间",
    "交易创建时间",
    "交易日期",
    "记账日期",
    "日期",
    "入账时间",
    "date",
  ],
  merchant: [
    "交易对方",
    "对方户名",
    "对方名称",
    "商户名称",
    "收款方",
    "交易地点",
    "merchant",
    "payee",
  ],
  amount: ["金额", "交易金额", "金额(元)", "交易金额(元)", "amount"],
  direction: [
    "收/支",
    "收支",
    "收支类型",
    "借贷标志",
    "收支方向",
    "direction",
    "type",
  ],
  account: [
    "收/付款方式",
    "支付方式",
    "付款方式",
    "收付款方式",
    "交易账户",
    "账户",
    "account",
  ],
  orderId: ["交易单号", "交易订单号", "交易号", "流水号", "订单号", "orderid"],
  description: [
    "商品",
    "商品说明",
    "备注",
    "说明",
    "摘要",
    "交易类型",
    "description",
  ],
  category: ["交易分类", "分类", "category"],
  status: ["当前状态", "交易状态", "状态", "status"],
  income: ["收入", "收入金额", "收入金额(元)", "存入"],
  expense: ["支出", "支出金额", "支出金额(元)", "支取"],
  currency: ["币种", "交易币种", "currency"],
};
export const MAX_FILE_ROWS = 15000;
const HEADER_SEARCH_ROWS = 100;
export interface StatementFile {
  name: string;
  hash: string;
  rows: string[][];
  headerIndex: number;
  mapping: FieldMap;
  source: Source;
  account: string;
}
export interface ParseResult {
  records: BillRecord[];
  errors: string[];
}
function cleanHeader(value: string): string {
  return value
    .replace(/[\s\uFEFF]/g, "")
    .replaceAll("（", "(")
    .replaceAll("）", ")")
    .toLowerCase();
}
export function mapHeaders(headers: string[]): FieldMap {
  const mapping: FieldMap = {};
  for (const field of Object.keys(ALIASES) as Field[]) {
    const index = headers.findIndex((header) =>
      ALIASES[field].some(
        (alias) => cleanHeader(alias) === cleanHeader(header),
      ),
    );
    if (index >= 0) mapping[field] = index;
  }
  return mapping;
}
function findHeader(rows: string[][]): number {
  return rows.slice(0, HEADER_SEARCH_ROWS).findIndex((row) => {
    const mapping = mapHeaders(row);
    return (
      mapping.date !== undefined &&
      (mapping.amount !== undefined ||
        mapping.income !== undefined ||
        mapping.expense !== undefined)
    );
  });
}
export function createStatement(input: {
  name: string;
  hash: string;
  rows: string[][];
}): StatementFile {
  const { name, hash, rows } = input;
  if (rows.length > MAX_FILE_ROWS)
    throw new Error("单次最多读取 15,000 行，请拆分账单。");
  if (!rows.length) throw new Error("文件没有可读取的内容。");
  const detected = findHeader(rows);
  const headerIndex = Math.max(0, detected);
  const source = identifySource(
    name +
      " " +
      rows
        .slice(0, headerIndex + 1)
        .flat()
        .join(" "),
  );
  return {
    name: name,
    hash,
    rows,
    headerIndex,
    mapping: mapHeaders(rows[headerIndex]),
    source,
    account: "",
  };
}
function parseRow(input: {
  file: StatementFile;
  row: string[];
  index: number;
  rules: Record<string, Category>;
}): BillRecord {
  const { file, row, index, rules } = input;
  const field = (key: Field): string => {
    const column = file.mapping[key];
    return column === undefined ? "" : (row[column] ?? "").trim();
  };
  const date = parseDate(field("date"));
  if (!date) throw new Error("交易日期缺失或格式错误");
  const expense = parseAmount(field("expense"));
  const income = parseAmount(field("income"));
  const amount =
    parseAmount(field("amount")) ??
    (expense !== null && expense > 0 ? expense : (income ?? expense));
  if (amount === null) throw new Error("金额缺失或不是有效人民币金额");
  const currency = field("currency");
  if (currency && !/^(CNY|RMB|人民币|人民币元|元|156)$/i.test(currency))
    throw new Error("当前仅支持人民币账单，请单独处理外币交易");
  const description = field("description");
  const merchant = field("merchant") || description || "未知商户";
  const sourceStatus = field("status") || "已导入";
  const direction =
    field("direction") ||
    (expense !== null && expense > 0
      ? "支出"
      : income !== null && income > 0
        ? "收入"
        : "");
  const identifiedKind = classifyKind({
    direction,
    description: merchant + " " + description,
    sourceStatus,
  });
  const category = classifyCategory({
    text: merchant + " " + description,
    hint: field("category"),
    rules,
  });
  const raw = Object.fromEntries(
    file.rows[file.headerIndex].map((header, column) => [
      header || `列${column + 1}`,
      row[column] ?? "",
    ]),
  );
  const isPending = identifiedKind === null;
  return {
    id: `${file.hash}-${index}`,
    date,
    merchant,
    description,
    amount,
    currency: "CNY",
    kind: identifiedKind ?? "不计收支",
    category,
    source: file.source,
    account: normalizeAccount(field("account") || file.account, file.source),
    orderId: field("orderId"),
    status: isPending ? RECORD_STATUS.PENDING : RECORD_STATUS.CONFIRMED,
    sourceStatus,
    fileName: file.name,
    raw,
    linkedSources: [],
    reason: isPending ? "收支方向未识别，请确认交易类型" : undefined,
  };
}
export function parseStatement(
  file: StatementFile,
  rules: Record<string, Category>,
): ParseResult {
  const records: BillRecord[] = [];
  const errors: string[] = [];
  if (
    file.mapping.date === undefined ||
    (file.mapping.amount === undefined &&
      file.mapping.income === undefined &&
      file.mapping.expense === undefined)
  )
    return { records, errors: ["请设置交易时间和金额字段。"] };
  file.rows.slice(file.headerIndex + 1).forEach((row, offset) => {
    if (
      row.every((value) => !value.trim()) ||
      /^-{3,}|共\d+笔|导出时间|统计时间|收入.*笔.*支出/.test(row.join(" "))
    )
      return;
    const index = file.headerIndex + offset + 1;
    try {
      records.push(parseRow({ file, row, index, rules }));
    } catch (error) {
      errors.push(
        `第 ${index + 1} 行：${error instanceof Error ? error.message : "读取失败"}`,
      );
    }
  });
  return { records, errors };
}

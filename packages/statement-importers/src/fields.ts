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
  tags: "标签",
} as const;
export type Field = keyof typeof FIELD_LABELS;
export type FieldMap = Partial<Record<Field, number>>;
const ALIASES: Record<Field, string[]> = {
  date: [
    "交易时间",
    "记录时间",
    "记账时间",
    "发生时间",
    "发生日期",
    "入账日期",
    "付款时间",
    "交易创建时间",
    "交易日期",
    "记账日期",
    "日期",
    "入账时间",
    "date",
  ],
  merchant: [
    "交易对方",
    "商户",
    "商家",
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
    "商品名称",
    "备注信息",
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
  tags: ["标签", "标记", "tags"],
};

export const FIELDS = Object.keys(FIELD_LABELS) as Field[];
export function cleanHeader(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\s\uFEFF]/g, "")
    .replace(/^[*]+|[*]+$/g, "")
    .toLowerCase();
}
const HEADER_FIELDS = new Map<string, Field[]>();
for (const field of FIELDS)
  for (const alias of ALIASES[field]) {
    const key = cleanHeader(alias);
    HEADER_FIELDS.set(key, [...(HEADER_FIELDS.get(key) ?? []), field]);
  }
export function matchHeaderFields(
  headers: string[],
): Partial<Record<Field, number[]>> {
  const matches: Partial<Record<Field, number[]>> = {};
  headers.forEach((header, index) => {
    for (const field of new Set(HEADER_FIELDS.get(cleanHeader(header)) ?? []))
      (matches[field] ??= []).push(index);
  });
  return matches;
}
export function mapHeaders(headers: string[]): FieldMap {
  const mapping: FieldMap = {};
  const matches = matchHeaderFields(headers);
  for (const field of FIELDS) {
    const column = matches[field]?.[0];
    if (column !== undefined) mapping[field] = column;
  }
  return mapping;
}

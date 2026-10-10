import {
  CURRENCY_DIGITS,
  convertToCny,
  defaultCategory,
  parseMinor,
  splitAmount,
  type AdvancedEntryInput,
  type BillRecord,
  type Currency,
  type ExchangeRate,
  type Ledger,
  type TransactionDetail,
} from "@hamster-ledger/core";
export interface EntryDraft {
  id: string;
  type: TransactionDetail["type"];
  date: string;
  merchant: string;
  category: string;
  description: string;
  tags: string;
  accountId: string;
  destinationId: string;
  amount: string;
  rate: string;
  rateDate: string;
  rateSource: ExchangeRate["source"];
  destinationAmount: string;
  destinationRate: string;
  relatedId: string;
  isReimbursable: boolean;
  adjustmentSign: 1 | -1;
  splitMode: "none" | "equal" | "weighted" | "fixed";
  splits: Array<{ memberId: string; value: string }>;
}
export const TWO_ACCOUNT_TYPES = [
  "transfer",
  "lend",
  "borrow",
  "repay_receive",
  "repay_pay",
  "invest_buy",
  "invest_sell",
  "aa_settlement",
];
export function initialEntryDraft(
  ledger: Ledger,
  record: BillRecord | undefined,
  now: string,
  id: string,
): EntryDraft {
  const detail = record?.detail;
  const currency =
    detail?.original.currency ??
    ledger.accounts.find(
      (account) =>
        account.id === record?.accountId || (!record && !account.isArchived),
    )?.currency ??
    "CNY";
  const destinationCurrency = detail?.destination?.currency ?? currency;
  return {
    id: record?.id ?? id,
    type:
      detail?.type ??
      (record?.kind === "收入"
        ? "income"
        : record?.kind === "退款"
          ? "refund"
          : record?.kind === "转账"
            ? "transfer"
            : "expense"),
    date: record?.date ?? now,
    merchant: record?.merchant ?? "",
    category: record?.category ?? defaultCategory(ledger, { kind: "支出" }),
    description: record?.description ?? "",
    tags: record?.tags?.join("，") ?? "",
    accountId:
      record?.accountId ??
      ledger.accounts.find((account) => !account.isArchived)?.id ??
      "",
    destinationId: record?.transferToAccountId ?? "",
    amount: record
      ? String(
          (detail?.original.minor ?? record.amount) /
            10 ** CURRENCY_DIGITS[currency],
        )
      : "",
    rate: detail?.original.rate ?? (currency === "CNY" ? "1" : ""),
    rateDate: detail?.original.date ?? now.slice(0, 10),
    rateSource: detail?.original.source ?? "manual",
    destinationAmount: detail?.destination
      ? String(
          detail.destination.minor / 10 ** CURRENCY_DIGITS[destinationCurrency],
        )
      : "",
    destinationRate: detail?.destination?.rate ?? "",
    relatedId: detail?.relatedId ?? "",
    isReimbursable: detail?.isReimbursable ?? false,
    adjustmentSign:
      detail?.type === "adjust" &&
      (detail.movements[0]?.amount ?? 0) *
        (ledger.accounts.find((account) => account.id === record?.accountId)
          ?.kind === "liability"
          ? -1
          : 1) <
        0
        ? -1
        : 1,
    splitMode: detail?.splits.length ? "fixed" : "none",
    splits:
      detail?.splits.map((item) => ({
        memberId: item.memberId,
        value: String(item.amount / 100),
      })) ?? [],
  };
}
export function buildAdvancedEntry(
  ledger: Ledger,
  draft: EntryDraft,
  baseline?: BillRecord,
): AdvancedEntryInput {
  const account = ledger.accounts.find((item) => item.id === draft.accountId);
  if (!account) throw new Error("请先添加并选择收付款账户。");
  const currency: Currency = account.currency ?? "CNY";
  const original = {
    currency,
    minor: parseMinor({ value: draft.amount, currency }),
    rate: currency === "CNY" ? "1" : draft.rate,
    date: currency === "CNY" ? draft.date.slice(0, 10) : draft.rateDate,
    source: currency === "CNY" ? ("manual" as const) : draft.rateSource,
  };
  let destination;
  if (TWO_ACCOUNT_TYPES.includes(draft.type)) {
    const target = ledger.accounts.find(
      (item) => item.id === draft.destinationId,
    );
    if (!target) throw new Error("请选择转入账户。");
    const destinationCurrency = target.currency ?? "CNY";
    destination = {
      ...original,
      currency: destinationCurrency,
      source:
        destinationCurrency === currency
          ? original.source
          : ("manual" as const),
      date:
        destinationCurrency === currency
          ? original.date
          : draft.date.slice(0, 10),
      minor: draft.destinationAmount
        ? parseMinor({
            value: draft.destinationAmount,
            currency: destinationCurrency,
          })
        : destinationCurrency === currency
          ? original.minor
          : 0,
      rate:
        destinationCurrency === "CNY"
          ? "1"
          : destinationCurrency === currency
            ? original.rate
            : draft.destinationRate,
    };
  }
  const amount = convertToCny(original);
  const splits =
    draft.type !== "expense" || draft.splitMode === "none"
      ? []
      : draft.splitMode === "fixed"
        ? draft.splits.map((item) => ({
            memberId: item.memberId.trim(),
            amount: parseMinor({ value: item.value, currency: "CNY" }),
          }))
        : splitAmount({
            amount,
            members: draft.splits.map((item) => ({
              id: item.memberId.trim(),
              weight: draft.splitMode === "equal" ? 1 : Number(item.value),
            })),
          });
  return {
    id: draft.id,
    expectedRecord: baseline,
    date: draft.date,
    merchant: draft.merchant,
    category: draft.category,
    description: draft.description,
    tags: draft.tags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
    accountId: draft.accountId,
    transferToAccountId: draft.destinationId || null,
    adjustmentSign: draft.adjustmentSign,
    detail: {
      ...baseline?.detail,
      type: draft.type,
      original,
      destination,
      relatedId: draft.relatedId || undefined,
      isReimbursable: draft.type === "expense" && draft.isReimbursable,
      splits,
      origin:
        baseline?.detail?.origin && baseline.detail.origin !== "legacy"
          ? baseline.detail.origin
          : "manual",
      attachmentIds: baseline?.detail?.attachmentIds ?? [],
      movements: [],
    },
  };
}

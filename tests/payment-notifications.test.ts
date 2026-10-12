import { describe, expect, it } from "vitest";
import {
  parsePaymentNotification,
  paymentAmountString,
  paymentEditedEntry,
  saveAdvancedEntry,
  confirmPaymentNotification,
  linkPaymentNotification,
  paymentReceiptRecord,
  paymentNotificationMatches,
  summarize,
  PAYMENT_RECORD_PREFIX,
  type PaymentReceipt,
  type Ledger,
  type AdvancedEntryInput,
} from "@hamster-ledger/core";
const receipt: PaymentReceipt = {
  id: "a".repeat(64),
  source: "微信支付",
  bookId: "personal",
  title: "微信支付",
  text: "支付成功，商户：QA小店，实付：12.34元，优惠：2.00元，余额987.66元",
  postedAt: 1791763200000,
  capturedAt: 1791763200001,
  isTruncated: false,
};
const localTimestamp = "2026-10-12 12:00:00";
const ledger: Ledger = {
  version: 2,
  baseCurrency: "CNY",
  records: [],
  reviews: [],
  rules: {},
  files: [],
  accounts: [
    {
      id: "cash",
      name: "QA现金",
      kind: "asset",
      type: "现金",
      aliases: [],
      isArchived: false,
      checkpoints: [],
      openingBalance: 100000,
      balanceAt: "2026-10-01 00:00:00",
      currency: "CNY",
    },
  ],
};
const entry: AdvancedEntryInput = {
  id: "edited",
  date: localTimestamp,
  merchant: "QA小店",
  category: "餐饮",
  accountId: "cash",
  description: "",
  detail: {
    type: "expense",
    origin: "manual",
    original: {
      minor: 1234,
      currency: "CNY",
      rate: "1",
      date: "2026-10-12",
      source: "manual",
    },
  },
};
const parse = (text: string) =>
  parsePaymentNotification({ receipt: { ...receipt, text }, localTimestamp });
describe("payment notification parsing", () => {
  it("extracts actual payment instead of discounts, balances and card suffixes", () => {
    expect(parsePaymentNotification({ receipt, localTimestamp })).toMatchObject(
      {
        amount: "12.34",
        merchant: "QA小店",
        type: "expense",
        date: localTimestamp,
      },
    );
    expect(
      parse("支付成功，银行卡尾号1234，消费12.34元，余额987.66元").amount,
    ).toBe("12.34");
  });
  it("preserves thousands separators and refuses partial malformed decimals", () => {
    expect(parse("支付成功 实付1,234.56元，优惠2.00元").amount).toBe("1234.56");
    expect(parse("支付成功 实付12.345元").amount).toBe("");
    expect(parse("支付成功 实付12,34.56元").amount).toBe("");
  });
  it("uses explicit receipt time and preserves the order number", () => {
    expect(
      parse(
        "支付成功 实付12.34元\n商户：QA小店\n交易时间：2026-10-11 20:30:15\n交易单号：QA-123",
      ),
    ).toMatchObject({ date: "2026-10-11 20:30:15", orderId: "QA-123" });
  });
  it("leaves ambiguous and zero amounts empty", () => {
    expect(parse("支付成功：12.34元、23.45元").amount).toBe("");
    expect(parse("支付成功 实付0元").amount).toBe("");
  });
  it("does not turn card numbers or balances into a payment", () => {
    expect(parse("支付成功，尾号1234，余额987.66元").amount).toBe("");
  });
  it("distinguishes refunds, transfers and income and does not assume loan direction", () => {
    expect(parse("退款到账2.34元").type).toBe("refund");
    expect(parse("收款到账12.34元").type).toBe("income");
    expect(parse("转账成功12.34元").type).toBe("transfer");
    expect(parse("信用卡还款成功12.34元").type).toBeNull();
  });
  it("blocks foreign currency and avoids inferring fields from truncated messages", () => {
    expect(parse("支付成功 USD12.34").isSupported).toBe(false);
    expect(
      parsePaymentNotification({
        receipt: { ...receipt, isTruncated: true },
        localTimestamp,
      }).amount,
    ).toBe("");
  });
  it("leaves the funding account to the reviewer and does not guess a merchant", () => {
    const result = parse("支付成功12.34元");
    expect(result.merchant).toBe("");
    expect(result.issues.join()).toContain("实际收付款账户");
    expect("accountId" in result).toBe(false);
  });
});
describe("payment entry fidelity", () => {
  it("preserves cents at the maximum safe integer", () => {
    expect(paymentAmountString(Number.MAX_SAFE_INTEGER)).toBe(
      "90071992547409.91",
    );
  });
  it("preserves a negative adjustment when reapplying an edited draft", () => {
    const edited = saveAdvancedEntry(ledger, {
      ...entry,
      id: PAYMENT_RECORD_PREFIX + receipt.id,
      adjustmentSign: -1,
      detail: { ...entry.detail, type: "adjust" },
    });
    const restored = confirmPaymentNotification({
      ledger,
      receipt,
      entry: paymentEditedEntry({ ledger: edited, receiptId: receipt.id }),
    });
    expect(restored.records[0].detail?.movements[0].amount).toBe(-1234);
  });
  it("does not classify merchant names as refunds or transfers", () => {
    expect(parse("支付成功，商户：退回商贸转账书店，实付12.34元").type).toBe(
      "expense",
    );
  });
});
describe("payment notification confirmation", () => {
  it("requires explicit confirmation and writes only minimal provenance", () => {
    parsePaymentNotification({ receipt, localTimestamp });
    expect(ledger.records).toHaveLength(0);
    const next = confirmPaymentNotification({ ledger, receipt, entry });
    expect(next.records[0]).toMatchObject({
      id: PAYMENT_RECORD_PREFIX + receipt.id,
      source: "微信支付",
      accountId: "cash",
      kind: "支出",
      amount: 1234,
    });
    expect(JSON.stringify(next)).not.toContain(receipt.text);
    expect(summarize(next.records)).toEqual({
      expense: 1234,
      income: 0,
      net: -1234,
    });
  });
  it("replays safely after an acknowledgement failure and never resurrects deleted records", () => {
    const next = confirmPaymentNotification({ ledger, receipt, entry });
    expect(confirmPaymentNotification({ ledger: next, receipt, entry })).toBe(
      next,
    );
    const deleted = {
      ...next,
      records: next.records.map((record) => ({ ...record, isDeleted: true })),
    };
    expect(
      confirmPaymentNotification({ ledger: deleted, receipt, entry }),
    ).toBe(deleted);
    expect(
      paymentReceiptRecord({ ledger: deleted, receiptId: receipt.id })
        ?.isDeleted,
    ).toBe(true);
  });
  it("links an existing record without changing money and makes link replay durable", () => {
    const existing = confirmPaymentNotification({
      ledger,
      receipt: { ...receipt, id: "b".repeat(64) },
      entry,
    });
    const linked = linkPaymentNotification({
      ledger: existing,
      receipt,
      recordId: existing.records[0].id,
    });
    expect(linked.records).toHaveLength(1);
    expect(summarize(linked.records)).toEqual(summarize(existing.records));
    expect(
      paymentReceiptRecord({ ledger: linked, receiptId: receipt.id })?.id,
    ).toBe(existing.records[0].id);
    expect(
      linkPaymentNotification({
        ledger: linked,
        receipt,
        recordId: existing.records[0].id,
      }),
    ).toBe(linked);
  });
  it("keeps equal amount transactions separate when the user explicitly creates both", () => {
    const first = confirmPaymentNotification({ ledger, receipt, entry });
    const second = confirmPaymentNotification({
      ledger: first,
      receipt: { ...receipt, id: "b".repeat(64) },
      entry,
    });
    expect(second.records).toHaveLength(2);
    expect(summarize(second.records).expense).toBe(2468);
  });
  it("blocks a known ordinary transaction number even after deletion", () => {
    const first = confirmPaymentNotification({
      ledger,
      receipt,
      entry,
      orderId: "QA-ORDER",
    });
    const deleted = {
      ...first,
      records: first.records.map((record) => ({ ...record, isDeleted: true })),
    };
    expect(() =>
      confirmPaymentNotification({
        ledger: deleted,
        receipt: { ...receipt, id: "b".repeat(64) },
        entry,
        orderId: "QA-ORDER",
      }),
    ).toThrow("交易号已存在");
  });
  it("finds possible duplicates in imported and manual records without merging them", () => {
    const existing = confirmPaymentNotification({
      ledger,
      receipt: { ...receipt, id: "b".repeat(64) },
      entry,
    });
    const candidate = parsePaymentNotification({ receipt, localTimestamp });
    expect(
      paymentNotificationMatches({ ledger: existing, candidate, receipt }),
    ).toHaveLength(1);
    expect(existing.records).toHaveLength(1);
  });
  it("refuses archived accounts and foreign currency confirmation", () => {
    expect(() =>
      confirmPaymentNotification({
        ledger: {
          ...ledger,
          accounts: ledger.accounts.map((account) => ({
            ...account,
            isArchived: true,
          })),
        },
        receipt,
        entry,
      }),
    ).toThrow();
    expect(() =>
      confirmPaymentNotification({
        ledger,
        receipt,
        entry: {
          ...entry,
          detail: {
            ...entry.detail,
            original: { ...entry.detail.original, currency: "USD" },
          },
        },
      }),
    ).toThrow("人民币");
  });
});

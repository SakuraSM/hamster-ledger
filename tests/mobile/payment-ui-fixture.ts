import type {
  AdvancedEntryInput,
  Ledger,
  PaymentReceipt,
} from "@hamster-ledger/core";
export function paymentUiFixture(): {
  receipt: PaymentReceipt;
  ledger: Ledger;
  entry: AdvancedEntryInput;
} {
  return {
    receipt: {
      id: "a".repeat(64),
      source: "微信支付",
      bookId: "personal",
      title: "微信支付",
      text: "支付成功12.34元",
      postedAt: 1791763200000,
      capturedAt: 1791763200001,
      isTruncated: false,
    },
    ledger: {
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
          openingBalance: 100000,
          balanceAt: "2026-10-01 00:00:00",
          currency: "CNY",
          aliases: [],
          checkpoints: [],
          isArchived: false,
        },
      ],
    },
    entry: {
      id: "edited",
      date: "2026-10-12 12:00:00",
      merchant: "QA小店",
      category: "餐饮",
      accountId: "cash",
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
    },
  };
}

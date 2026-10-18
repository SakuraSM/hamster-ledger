// @vitest-environment jsdom
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_LEDGER,
  type AssetAccount,
  type BillRecord,
  type Currency,
} from "@hamster-ledger/core";
import {
  useAccountHistory,
  useBalanceCalibration,
  useExchangeRates,
} from "@hamster-ledger/ledger-react";

const account: AssetAccount = {
  id: "bank",
  name: "资产测试",
  type: "银行卡",
  kind: "asset",
  openingBalance: 10000,
  balanceAt: "2026-09-01 00:00:00",
  checkpoints: [],
  aliases: [],
  isArchived: false,
};
const record: BillRecord = {
  id: "expense",
  merchant: "咖啡",
  description: "",
  kind: "支出",
  date: "2026-09-10 12:00:00",
  amount: 1000,
  currency: "CNY",
  account: "资产测试",
  accountId: "bank",
  category: "餐饮",
  source: "手动记账",
  sourceStatus: "",
  status: "confirmed",
  fileName: "",
  orderId: "",
  raw: {},
  linkedSources: [],
};
const ledger = { ...EMPTY_LEDGER, accounts: [account], records: [record] };
afterEach(cleanup);

describe("shared asset interaction controllers", () => {
  it("recalculates calibration differences at the selected effective time and preserves metadata", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined),
      onClose = vi.fn();
    const { result } = renderHook(() =>
      useBalanceCalibration({
        ledger,
        account,
        initialAt: "2026-10-18 12:00:00",
        now: () => "2026-10-18 12:00:00",
        onSave,
        onClose,
      }),
    );
    expect(result.current.preview).toEqual({
      expected: 9000,
      actual: 9000,
      difference: 0,
    });
    act(() => {
      result.current.setAt("2026-09-05 12:00:00");
      result.current.setAmount("105");
      result.current.setNote("核对余额");
    });
    expect(result.current.preview).toEqual({
      expected: 10000,
      actual: 10500,
      difference: 500,
    });
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledWith({
      account: {
        ...account,
        openingBalance: 10500,
        balanceAt: "2026-09-05 12:00:00",
      },
      note: "核对余额",
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("preserves account metadata changed while a calibration draft is open", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ book }) =>
        useBalanceCalibration({
          ledger: book,
          account,
          initialAt: "2026-10-18 12:00:00",
          now: () => "2026-10-18 12:00:00",
          onSave,
          onClose: vi.fn(),
        }),
      { initialProps: { book: ledger } },
    );
    act(() => result.current.setAmount("120"));
    rerender({
      book: {
        ...ledger,
        accounts: [{ ...account, name: "新账户名称", aliases: ["保留别名"] }],
      },
    });
    await act(() => result.current.save());
    expect(onSave.mock.calls[0][0].account).toMatchObject({
      name: "新账户名称",
      aliases: ["保留别名"],
      openingBalance: 12000,
    });
  });
  it("keeps failed calibration drafts and rejects future or invalid amounts before save", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("存储失败")),
      onClose = vi.fn();
    const { result } = renderHook(() =>
      useBalanceCalibration({
        ledger,
        account,
        initialAt: "2026-10-18 12:00:00",
        now: () => "2026-10-18 12:00:00",
        onSave,
        onClose,
      }),
    );
    act(() => result.current.setAmount("93.20"));
    await act(() => result.current.save());
    expect(result.current.error).toBe("存储失败");
    expect(result.current.amount).toBe("93.20");
    expect(onClose).not.toHaveBeenCalled();
    act(() => result.current.setAt("2026-10-19 12:00:00"));
    await act(() => result.current.save());
    expect(result.current.error).toContain("不能晚于");
    expect(onSave).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.setAt("2026-10-18 12:00:00");
      result.current.setAmount("invalid");
    });
    expect(result.current.preview).toBeNull();
    await act(() => result.current.save());
    expect(onSave).toHaveBeenCalledTimes(1);
  });
  it("paginates history, excludes future/deleted/duplicates and resets page on a month change", () => {
    const records = Array.from({ length: 65 }, (_, index) => ({
      ...record,
      id: `record-${index}`,
      merchant: `流水 ${index}`,
    }));
    const book = {
      ...ledger,
      records: [
        ...records,
        { ...record, id: "future", date: "2026-11-01 00:00:00" },
        { ...record, id: "deleted", isDeleted: true },
        { ...record, id: "duplicate", status: "duplicate" as const },
      ],
    };
    const { result } = renderHook(() =>
      useAccountHistory({
        ledger: book,
        account,
        through: "2026-10-18 23:59:59",
      }),
    );
    expect(result.current.count).toBe(66);
    expect(result.current.activities).toHaveLength(20);
    act(() => result.current.setPage(4));
    expect(result.current.activities).toHaveLength(6);
    act(() => result.current.setMode("records"));
    expect(result.current.page).toBe(1);
    expect(result.current.count).toBe(65);
    act(() => {
      result.current.setPage(4);
      result.current.setMonth("2026-10");
    });
    expect(result.current.page).toBe(1);
    expect(result.current.records).toHaveLength(0);
  });
  it("does not reuse a valuation quote for a different date and keeps a manual quote during a pending request", async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    const client = {
      request: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    };
    const { result, rerender } = renderHook(
      ({ date }) =>
        useExchangeRates({ client, currencies: ["USD" as Currency], date }),
      { initialProps: { date: "2026-10-18" } },
    );
    act(() => result.current.setManual("USD", "7.25"));
    await act(async () =>
      resolveRequest({
        currency: "USD",
        date: "2026-10-18",
        rate: "7.10",
        source: "manual",
      }),
    );
    expect(result.current.rates[0].rate).toBe("7.25");
    rerender({ date: "2026-09-30" });
    expect(result.current.rates).toEqual([]);
    await act(async () =>
      resolveRequest({
        currency: "USD",
        date: "2026-09-30",
        rate: "7.00",
        source: "manual",
      }),
    );
    await waitFor(() => expect(result.current.rates[0]?.rate).toBe("7.00"));
  });
});

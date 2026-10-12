import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  paymentInbox,
  isPaymentBookId,
} from "../../apps/mobile/src/platform/payment-inbox";
const native = vi.hoisted(() => ({
  getStatus: vi.fn(),
  listPending: vi.fn(),
  configure: vi.fn(),
  handle: vi.fn(),
  clear: vi.fn(),
  openSettings: vi.fn(),
  addListener: vi.fn(),
}));
vi.mock("../../apps/mobile/modules/payment-inbox", () => ({ default: native }));
beforeEach(() => vi.resetAllMocks());
const receipt = {
  id: "a".repeat(64),
  source: "微信支付",
  bookId: "personal",
  title: "微信支付",
  text: "支付成功12.34元",
  postedAt: 1791763200000,
  capturedAt: 1791763200001,
  isTruncated: false,
};
describe("payment inbox native protocol", () => {
  it("accepts only native local book identifiers", () => {
    expect(isPaymentBookId("personal")).toBe(true);
    expect(isPaymentBookId("book:qa")).toBe(true);
    expect(isPaymentBookId("demo")).toBe(false);
    expect(isPaymentBookId("book:")).toBe(false);
    expect(isPaymentBookId("server-book")).toBe(false);
  });
  it("rejects unknown payment sources instead of treating them as supported", async () => {
    native.listPending.mockResolvedValue([{ ...receipt, source: "某银行" }]);
    await expect(paymentInbox.pending()).rejects.toThrow();
  });
  it("validates native ciphertext-decoded receipt fields and timestamps", async () => {
    native.listPending.mockResolvedValue([receipt]);
    expect(await paymentInbox.pending()).toEqual([receipt]);
    native.listPending.mockResolvedValue([{ ...receipt, postedAt: NaN }]);
    await expect(paymentInbox.pending()).rejects.toThrow();
    native.listPending.mockResolvedValue([{ ...receipt, bookId: "demo" }]);
    await expect(paymentInbox.pending()).rejects.toThrow();
  });
  it("serializes explicit consent/configuration and minimal completion receipts", async () => {
    native.configure.mockResolvedValue(undefined);
    native.handle.mockResolvedValue(undefined);
    await paymentInbox.configure({
      enabled: true,
      sources: ["微信支付"],
      bookId: "personal",
    });
    expect(JSON.parse(native.configure.mock.calls[0][0])).toEqual({
      enabled: true,
      sources: ["微信支付"],
      bookId: "personal",
    });
    await paymentInbox.handled({
      id: receipt.id,
      state: "linked",
      recordId: "existing",
    });
    expect(JSON.parse(native.handle.mock.calls[0][0])).toEqual({
      id: receipt.id,
      state: "linked",
      recordId: "existing",
    });
    await expect(
      paymentInbox.configure({ enabled: true, sources: [], bookId: "" }),
    ).rejects.toThrow();
  });
  it("releases native event listeners", () => {
    const remove = vi.fn();
    native.addListener.mockReturnValue({ remove });
    const unsubscribe = paymentInbox.subscribe(() => {});
    unsubscribe();
    expect(remove).toHaveBeenCalledOnce();
  });
});

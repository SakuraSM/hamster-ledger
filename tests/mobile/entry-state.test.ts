import { expect, it } from "vitest";
import { entryState } from "../../apps/mobile/src/ui/entry-state";

const ready = {
  isLedgerLoading: false,
  isAccountLoading: false,
  needsEntry: false,
  mustChangePassword: false,
};
it("waits for both the encrypted ledger and account initialization", () => {
  expect(entryState({ ...ready, isLedgerLoading: true })).toBe("loading");
  expect(entryState({ ...ready, isAccountLoading: true })).toBe("loading");
});
it("keeps temporary-password sessions on the password change screen", () => {
  expect(entryState({ ...ready, needsEntry: true })).toBe("account");
  expect(entryState({ ...ready, mustChangePassword: true })).toBe("account");
  expect(entryState(ready)).toBe("ledger");
});
it("does not show previous-book content during an identity transition", () => {
  expect(entryState({ ...ready, isIdentityCurrent: false })).toBe("loading");
});

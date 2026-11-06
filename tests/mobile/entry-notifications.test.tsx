// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createDemoLedger } from "@hamster-ledger/fixtures";
import { DEFAULT_PREFERENCES } from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { usePlanningNotifications } from "../../apps/mobile/src/hooks/usePlanningNotifications";

const deliver = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/mobile/src/platform/planning-notifications", () => ({
  deliverPlanningNotifications: deliver,
}));
afterEach(() => {
  cleanup();
  deliver.mockClear();
});
it("does not deliver private reminders before account initialization completes", async () => {
  const ledger = createDemoLedger();
  ledger.preferences = { ...DEFAULT_PREFERENCES, reminderEnabled: true };
  const controller = { mode: "demo", ledger } as LedgerController;
  const hook = renderHook(
    ({ enabled }) => usePlanningNotifications(controller, enabled),
    { initialProps: { enabled: false } },
  );
  expect(deliver).not.toHaveBeenCalled();
  await act(async () => hook.rerender({ enabled: true }));
  expect(deliver).toHaveBeenCalledOnce();
});

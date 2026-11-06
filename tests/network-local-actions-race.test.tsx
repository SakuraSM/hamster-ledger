// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  DEFAULT_BOOKS,
  EMPTY_LEDGER,
  createLedgerRepository,
  type BillRecord,
  type Ledger,
  type Review,
} from "@hamster-ledger/core";
import type { NetworkClient } from "@hamster-ledger/ledger-react";
import { useLedger } from "../packages/ledger-react/src/useLedger";
import { useNetworkLedger } from "../packages/ledger-react/src/useNetworkLedger";
import { queueLedgerWrite } from "../packages/ledger-react/src/ledger-write-queue";

afterEach(cleanup);
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const record: BillRecord = {
  id: "left",
  date: "2026-10-01 12:00:00",
  merchant: "商户",
  description: "",
  amount: 100,
  currency: "CNY",
  kind: "支出",
  category: "餐饮",
  source: "手动记账",
  account: "现金",
  orderId: "",
  status: "confirmed",
  sourceStatus: "已确认",
  fileName: "synthetic",
  raw: {},
  linkedSources: [],
};
const review: Review = {
  id: "review",
  leftId: "left",
  rightId: "right",
  state: "pending",
  reasons: [],
};
const initial: Ledger = {
  ...EMPTY_LEDGER,
  records: [record, { ...record, id: "right" }],
  reviews: [review],
};
function fixture() {
  const values = new Map<string, string>();
  let held: {
    started: ReturnType<typeof deferred>;
    release: ReturnType<typeof deferred>;
  } | null = null;
  const repository = createLedgerRepository({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (key === "hamster-ledger.v1.personal" && held) {
        const active = held;
        held = null;
        active.started.resolve();
        await active.release.promise;
      }
      values.set(key, value);
    },
  });
  const client: NetworkClient = {
    request: async () => {
      throw new Error("offline");
    },
  };
  return {
    repository,
    client,
    hold: () => {
      held = { started: deferred(), release: deferred() };
      return held;
    },
  };
}
async function setup() {
  const env = fixture();
  await env.repository.saveBooks(DEFAULT_BOOKS);
  await env.repository.save("personal", initial);
  await env.repository.saveActiveMode("personal");
  const hook = renderHook(
    ({ userId }: { userId: string }) => {
      const local = useLedger({
        repository: env.repository,
        createDemoLedger: () => EMPTY_LEDGER,
        localNow: () => "2026-11-07 12:00:00",
        newEntityId: () => "new",
      });
      const controller = useNetworkLedger({
        local,
        client: env.client,
        userId,
        server: "https://test",
        repository: env.repository,
        newId: () => "operation",
      });
      return { local, controller };
    },
    { initialProps: { userId: "a" } },
  );
  await waitFor(() =>
    expect(hook.result.current.controller.isLoading).toBe(false),
  );
  return { env, hook };
}
const edit = {
  id: "left",
  kind: "支出" as const,
  category: "购物",
  account: "现金",
  remember: false,
};
type Action = "edit" | "decide" | "undo";
async function prepare(
  action: Action,
  hook: Awaited<ReturnType<typeof setup>>["hook"],
): Promise<void> {
  if (action === "undo")
    await act(async () =>
      hook.result.current.controller.commit({
        ...initial,
        rules: { saved: "餐饮" },
      }),
    );
}
function invoke(
  action: Action,
  hook: Awaited<ReturnType<typeof setup>>["hook"],
): Promise<void> | undefined {
  if (action === "edit") return hook.result.current.controller.editRecord(edit);
  if (action === "decide")
    hook.result.current.controller.decide(review, "separate");
  else hook.result.current.controller.undo();
  return undefined;
}
function expectUnchanged(action: Action, value: Ledger): void {
  if (action === "edit") expect(value.records[0].category).toBe("餐饮");
  if (action === "decide") expect(value.reviews[0].state).toBe("pending");
  if (action === "undo") expect(value.rules).toEqual({ saved: "餐饮" });
}
function expectChanged(action: Action, value: Ledger): void {
  if (action === "edit") expect(value.records[0].category).toBe("购物");
  if (action === "decide") expect(value.reviews[0].state).toBe("separate");
  if (action === "undo") expect(value.rules).toEqual({});
}
it.each(["edit", "decide", "undo"] as const)(
  "blocks queued %s after identity changes",
  async (action) => {
    const { env, hook } = await setup();
    await prepare(action, hook);
    const started = deferred(),
      release = deferred();
    const first = queueLedgerWrite({
      repository: env.repository,
      mode: "personal",
      write: async () => {
        started.resolve();
        await release.promise;
      },
    });
    await started.promise;
    let pending: Promise<void> | undefined;
    act(() => {
      pending = invoke(action, hook);
    });
    hook.rerender({ userId: "b" });
    await act(async () => {
      release.resolve();
      await first;
      if (pending) await expect(pending).rejects.toThrow(/身份|变化/);
    });
    await waitFor(() => expect(hook.result.current.local.isSaving).toBe(false));
    expectUnchanged(action, (await env.repository.load("personal"))!);
    expectUnchanged(action, hook.result.current.controller.ledger);
  },
);
it.each(["edit", "decide", "undo"] as const)(
  "does not publish an already-started %s write after identity changes",
  async (action) => {
    const { env, hook } = await setup();
    await prepare(action, hook);
    const held = env.hold();
    let pending: Promise<void> | undefined;
    act(() => {
      pending = invoke(action, hook);
    });
    await held.started.promise;
    hook.rerender({ userId: "b" });
    await act(async () => {
      held.release.resolve();
      if (pending) await expect(pending).rejects.toThrow(/身份|变化/);
    });
    await waitFor(() => expect(hook.result.current.local.isSaving).toBe(false));
    expectUnchanged(action, hook.result.current.controller.ledger);
    expect(hook.result.current.controller.error).toMatch(/可能已写入/);
    expectChanged(action, (await env.repository.load("personal"))!);
  },
);
it.each(["edit", "decide", "undo"] as const)(
  "keeps ordinary same-identity %s working",
  async (action) => {
    const { env, hook } = await setup();
    await prepare(action, hook);
    await act(async () => {
      await invoke(action, hook);
    });
    await waitFor(() => expect(hook.result.current.local.isSaving).toBe(false));
    expectChanged(action, (await env.repository.load("personal"))!);
    expectChanged(action, hook.result.current.controller.ledger);
  },
);

it("does not let an old local undo callback undo a later operation", async () => {
  const { env, hook } = await setup();
  await act(async () =>
    hook.result.current.controller.commit({
      ...initial,
      rules: { first: "餐饮" },
    }),
  );
  const oldUndo = hook.result.current.controller.undo;
  await act(async () =>
    hook.result.current.controller.commit({
      ...initial,
      rules: { later: "购物" },
    }),
  );
  await act(async () => {
    oldUndo();
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.local.isSaving).toBe(false));
  expect((await env.repository.load("personal"))?.rules).toEqual({
    later: "购物",
  });
  act(() => hook.result.current.controller.undo());
  await waitFor(() =>
    expect(hook.result.current.controller.ledger.rules).toEqual({
      first: "餐饮",
    }),
  );
});

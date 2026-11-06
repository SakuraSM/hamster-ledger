import { expect, it } from "vitest";
import {
  EMPTY_LEDGER,
  createLedgerRepository,
  type Ledger,
  type NetworkCacheIdentity,
} from "@hamster-ledger/core";

function book(name: string): Ledger {
  return {
    ...EMPTY_LEDGER,
    accounts: [
      {
        id: "cash",
        name,
        kind: "asset",
        type: "现金",
        openingBalance: 100,
        balanceAt: "2026-01-01 00:00:00",
        aliases: [],
        isArchived: false,
        checkpoints: [],
      },
    ],
  };
}
const first: NetworkCacheIdentity = {
  mode: "personal",
  id: "same",
  userId: "one",
  server: "https://first",
};
const second: NetworkCacheIdentity = {
  mode: "personal",
  id: "same",
  userId: "two",
  server: "https://second",
};

it("persists identity-bound cache envelopes independently without changing the ledger key", async () => {
  const values = new Map<string, string>();
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const repository = createLedgerRepository(store);
  await repository.save("personal", book("原账本"));
  await repository.saveNetworkCache!(first, {
    status: "verified",
    revision: 1,
    ledger: book("身份一"),
  });
  await repository.saveNetworkCache!(second, {
    status: "verified",
    revision: 1,
    ledger: book("身份二"),
  });
  await repository.saveNetworkCache!(first, {
    status: "revoked",
    revision: 1,
    ledger: book("身份一"),
  });
  const reopened = createLedgerRepository(store);
  expect((await reopened.load("personal"))?.accounts[0].name).toBe("原账本");
  expect((await reopened.loadNetworkCache!(first))?.status).toBe("revoked");
  expect(
    (await reopened.loadNetworkCache!(first))?.ledger?.accounts[0].name,
  ).toBe("身份一");
  expect(
    (await reopened.loadNetworkCache!(second))?.ledger?.accounts[0].name,
  ).toBe("身份二");
});

it("propagates cache metadata storage failures without altering existing ledger data", async () => {
  const repository = createLedgerRepository({
    getItem: async () => null,
    setItem: async () => {
      throw new Error("不可写");
    },
  });
  await expect(
    repository.saveNetworkCache!(first, { status: "revoked" }),
  ).rejects.toThrow("不可写");
});

it("publishes identity, status and ledger together through one atomic store write", async () => {
  const values = new Map<string, string>();
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => (release = resolve));
  const pending = new Promise<void>((resolve) => (started = resolve));
  let hold = false;
  const store = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (hold) {
        started();
        await blocked;
      }
      values.set(key, value);
    },
  };
  const repository = createLedgerRepository(store);
  await repository.saveNetworkCache!(first, {
    status: "verified",
    revision: 1,
    ledger: book("原已验证快照"),
  });
  const originalKeys = [...values.keys()];
  hold = true;
  const write = repository.saveNetworkCache!(first, {
    status: "revoked",
    revision: 1,
    ledger: book("原已验证快照"),
  });
  await pending;
  const before = await repository.loadNetworkCache!(first);
  expect(before?.status).toBe("verified");
  expect(before?.ledger?.accounts[0].name).toBe("原已验证快照");
  expect([...values.keys()]).toEqual(originalKeys);
  release();
  await write;
  const after = await repository.loadNetworkCache!(first);
  expect(after?.status).toBe("revoked");
  expect(after?.ledger?.accounts[0].name).toBe("原已验证快照");
  expect([...values.keys()]).toEqual(originalKeys);
});

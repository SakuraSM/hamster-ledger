import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/database.mjs";
import { runScheduledBook, schedulerDate } from "../src/scheduler.mjs";
import { setup, register, EMPTY } from "./helpers.mjs";
const account = {
  id: "cash",
  name: "虚拟钱包",
  kind: "asset",
  type: "银行卡",
  openingBalance: 10000,
  balanceAt: "2024-01-01 00:00:00",
  aliases: [],
  isArchived: false,
  checkpoints: [],
  currency: "CNY",
};
const subscription = {
  id: "due",
  name: "虚拟订阅",
  amount: 100,
  currency: "CNY",
  accountId: "cash",
  category: "娱乐",
  cycle: "monthly",
  interval: 1,
  anchorDay: 31,
  nextDate: "2024-01-31",
  status: "active",
  autoPost: true,
  reminderDays: 3,
  skippedDates: [],
  isArchived: false,
};
test("scheduler batches catchup, persists replay identities and resumes without duplicate charges", async (context) => {
  const client = await setup(context),
    cookie = await register(client);
  const response = await client.request("/api/network/books", {
    method: "POST",
    cookie,
    body: {
      confirm: true,
      name: "调度测试",
      ledger: {
        ...EMPTY,
        accounts: [account],
        subscriptions: [{ ...subscription, nextDate: "2000-01-31" }],
      },
    },
  });
  const book = await response.json();
  assert.equal(response.status, 201);
  const now = () => Date.UTC(2004, 1, 29, 16); // Shanghai has crossed into March; February's month-end charge is due.
  let database = openDatabase(client.databasePath);
  try {
    const first = await runScheduledBook({ database, bookId: book.id, now });
    assert.equal(first.changed, true);
    const stored = JSON.parse(
      database.prepare("SELECT ledger FROM books WHERE id=?").get(book.id)
        .ledger,
    );
    assert.equal(stored.records.length, 50);
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM scheduler_runs").get()
        .count,
      50,
    );
  } finally {
    database.close();
  }
  database = openDatabase(client.databasePath);
  try {
    const repeated = await runScheduledBook({ database, bookId: book.id, now });
    assert.equal(repeated.changed, false);
    assert.equal(
      JSON.parse(
        database.prepare("SELECT ledger FROM books WHERE id=?").get(book.id)
          .ledger,
      ).records.length,
      50,
    );
    assert.equal(
      database
        .prepare(
          "SELECT count(*) AS count FROM book_operations WHERE source='scheduler'",
        )
        .get().count,
      1,
    );
  } finally {
    database.close();
  }
  assert.equal(schedulerDate(Date.UTC(2024, 1, 29, 16)), "2024-03-01");
  assert.equal(schedulerDate(Date.UTC(2024, 1, 29, 15, 59)), "2024-02-29");
});
test("missing foreign rates produce an actionable notice and never an assumed exchange rate", async (context) => {
  const client = await setup(context),
    cookie = await register(client);
  const response = await client.request("/api/network/books", {
    method: "POST",
    cookie,
    body: {
      confirm: true,
      name: "外币调度",
      ledger: {
        ...EMPTY,
        accounts: [{ ...account, currency: "USD" }],
        subscriptions: [{ ...subscription, currency: "USD" }],
      },
    },
  });
  const book = await response.json(),
    database = openDatabase(client.databasePath);
  try {
    await runScheduledBook({
      database,
      bookId: book.id,
      now: () => Date.UTC(2024, 0, 31, 10),
      fetcher: async () => {
        throw new Error("offline");
      },
    });
    const ledger = JSON.parse(
      database.prepare("SELECT ledger FROM books WHERE id=?").get(book.id)
        .ledger,
    );
    assert.equal(ledger.records.length, 0);
    assert.ok(
      ledger.notifications.some((notice) => notice.title === "自动记账待处理"),
    );
  } finally {
    database.close();
  }
});

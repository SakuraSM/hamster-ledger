import assert from "node:assert/strict";
import { EMPTY } from "./helpers.mjs";
export const account = {
  id: "cash",
  name: "虚拟现金",
  kind: "asset",
  type: "现金",
  openingBalance: 10000,
  balanceAt: "2026-01-01 00:00:00",
};
export const entry = (overrides = {}) => ({
  type: "expense",
  amount: "12.50",
  currency: "CNY",
  date: "2026-10-03 12:00:00",
  merchant: "虚拟餐馆",
  category: "餐饮",
  accountId: "cash",
  description: "虚拟账单",
  confidence: 0.99,
  issues: [],
  ...overrides,
});
export const image = {
  name: "虚拟凭证.png",
  mime: "image/png",
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1X8AAAAASUVORK5CYII=",
};
export const path = (book, suffix) => `/api/network/books/${book.id}${suffix}`;
export async function book(client, cookie) {
  const response = await client.request("/api/network/books", {
    cookie,
    method: "POST",
    body: {
      confirm: true,
      name: "虚拟 AI 账本",
      ledger: { ...EMPTY, accounts: [account] },
    },
  });
  assert.equal(response.status, 201);
  return response.json();
}
export async function profile(client, cookie, extra = {}) {
  const response = await client.request("/api/models/profile", {
    cookie,
    method: "PUT",
    body: {
      endpoint: "https://model.example/v1",
      model: "synthetic-model",
      key: "synthetic-secret-not-real",
      ...extra,
    },
  });
  assert.equal(response.status, 200);
  return response.json();
}
export const recognition = (book, extra = {}) => ({
  key: "synthetic-recognize-1",
  revision: book.revision,
  text: "虚拟测试账单",
  ...extra,
});

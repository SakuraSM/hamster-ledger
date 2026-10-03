import { serializeSnapshot } from "../apps/mobile/src/platform/snapshot";
import { EMPTY_LEDGER } from "@hamster-ledger/core";
import { describe, expect, it, vi } from "vitest";
import {
  createCloudClient,
  normalizeServer,
  type Credentials,
} from "../apps/mobile/src/platform/cloud-client";
import {
  createKeyedStore,
  type KeyedDatabase,
} from "../apps/mobile/src/platform/keyed-store";
const auth: Credentials = {
  accessToken: "a".repeat(43),
  csrfToken: "csrf-fixture",
  user: { id: "fixture-user", username: "qa", mustChangePassword: false },
  session: { id: "session", expiresAt: Date.now() + 10000, remember: true },
};
describe("native cloud transport", () => {
  it("restricts production servers to HTTPS origins, allowing only explicit local debug HTTP", () => {
    expect(normalizeServer("https://example.com/")).toBe("https://example.com");
    for (const url of [
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/api",
      "https://example.com/?token=1",
      "https://example.com/#fragment",
      "http://127.0.0.1:4196",
    ])
      expect(() => normalizeServer(url)).toThrow();
    expect(normalizeServer("http://127.0.0.1:4196", true)).toBe(
      "http://127.0.0.1:4196",
    );
    expect(() => normalizeServer("http://example.com", true)).toThrow();
  });
  it("uses native bearer endpoints without cookies and clears only the expired session", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: "expired", code: "session_expired" }),
          { status: 401 },
        ),
      );
    const invalidate = vi.fn(async () => undefined);
    const client = createCloudClient({
      origin: "https://example.com",
      getCredentials: () => auth,
      invalidate,
      fetcher: request,
    });
    await expect(client.books()).rejects.toMatchObject({ status: 401 });
    expect(request).toHaveBeenCalledWith(
      "https://example.com/api/native/books",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        headers: expect.objectContaining({
          Authorization: "Bearer " + auth.accessToken,
          "X-Hamster-User": auth.user.id,
        }),
      }),
    );
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
  it("an old response cannot log out an account that signed in while the request was pending", async () => {
    let current = auth;
    const request = vi.fn<typeof fetch>().mockImplementation(async () => {
      current = { ...auth, accessToken: "b".repeat(43) };
      return new Response(JSON.stringify({ code: "session_expired" }), {
        status: 401,
      });
    });
    const invalidate = vi.fn(async () => undefined);
    await expect(
      createCloudClient({
        origin: "https://example.com",
        getCredentials: () => current,
        invalidate,
        fetcher: request,
      }).books(),
    ).rejects.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("sends auth and ledger writes as JSON with the intended method and revision", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({ ok: true })),
      );
    const client = createCloudClient({
      origin: "https://example.com",
      getCredentials: () => auth,
      invalidate: async () => undefined,
      fetcher: request,
    });
    const input = {
      username: "qa",
      password: "synthetic-password-123",
      remember: false,
      isRegister: true,
    };
    await client.authenticate(input);
    expect(request).toHaveBeenLastCalledWith(
      "https://example.com/api/native/auth/register",
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
    const update = {
      id: "book-id",
      revision: 3,
      name: "book",
      ledger: EMPTY_LEDGER,
    };
    await client.save(update);
    expect(request).toHaveBeenLastCalledWith(
      "https://example.com/api/native/books/book-id",
      expect.objectContaining({ method: "PUT", body: JSON.stringify(update) }),
    );
  });
  it("invalid current-password responses do not clear the active login", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: "invalid_credentials" }), {
        status: 401,
      }),
    );
    const invalidate = vi.fn(async () => undefined);
    await expect(
      createCloudClient({
        origin: "https://example.com",
        getCredentials: () => auth,
        invalidate,
        fetcher: request,
      }).changePassword("wrong", "new"),
    ).rejects.toThrow();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
describe("SQLCipher keyed-connection queue", () => {
  it("serializes a read behind a write transaction and preserves existing data after a failed write", async () => {
    const rows = new Map<string, string>([["book", "original"]]);
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    const database: KeyedDatabase = {
      async getFirstAsync<T>(_sql: string, key: string): Promise<T | null> {
        events.push("read");
        return (rows.has(key) ? { value: rows.get(key) } : null) as T | null;
      },
      async runAsync(_sql: string, key: string, value: string) {
        writes++;
        events.push("write");
        if (writes === 1) {
          await gate;
          throw new Error("disk full");
        }
        rows.set(key, value);
      },
      async withTransactionAsync(action) {
        events.push("begin");
        try {
          await action();
          events.push("commit");
        } catch (cause) {
          events.push("rollback");
          throw cause;
        }
      },
    };
    const store = createKeyedStore(async () => database);
    const failed = store.setItem("book", "partial");
    const rejection = expect(failed).rejects.toThrow("disk full");
    const reading = store.getItem("book");
    await vi.waitFor(() => expect(events).toEqual(["begin", "write"]));
    release();
    await rejection;
    expect(await reading).toBe("original");
    expect(events).toEqual(["begin", "write", "rollback", "read"]);
    await store.setItem("book", "saved");
    expect(await store.getItem("book")).toBe("saved");
  });
  it("an unavailable keyed database rejects reads and writes without falling back to plaintext", async () => {
    const store = createKeyedStore(async () => {
      throw new Error("key unavailable");
    });
    await expect(store.getItem("book")).rejects.toThrow("key unavailable");
    await expect(store.setItem("book", "value")).rejects.toThrow(
      "key unavailable",
    );
  });
});

it("snapshot identity survives schema key ordering while retaining record order", () => {
  const first = {
    name: "book",
    ledger: { records: [{ merchant: "合成午餐", amount: 1234 }], version: 1 },
  };
  const reordered = {
    ledger: { version: 1, records: [{ amount: 1234, merchant: "合成午餐" }] },
    name: "book",
  };
  expect(serializeSnapshot(first)).toBe(serializeSnapshot(reordered));
  expect(serializeSnapshot({ records: [1, 2] })).not.toBe(
    serializeSnapshot({ records: [2, 1] }),
  );
});

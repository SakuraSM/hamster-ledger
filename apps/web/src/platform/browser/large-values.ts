const DATABASE = "hamster-ledger-values.v1";
const STORE = "values";
const REFERENCE = "hamster-idb:v1:";
const INLINE_LIMIT = 64 * 1024;
interface StoredValue {
  id: string;
  key: string;
  value: string;
}
let database: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("本地数据库正被其他页面占用，请关闭旧页面后重试。"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        database = undefined;
      };
      resolve(db);
    };
  }).catch((error: unknown) => {
    database = undefined;
    throw error;
  });
  return database;
}
async function request<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode, { durability: "strict" });
    const operation = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(operation.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("账本存储中断，原数据已保留。"));
  });
}
export async function readStoredValue(key: string): Promise<string | null> {
  // A concurrent writer can retire the previous version while this read awaits IDB.
  for (let attempt = 0; attempt < 3; attempt++) {
    const raw = localStorage.getItem(key);
    if (!raw?.startsWith(REFERENCE)) return raw;
    const row = await request<StoredValue | undefined>("readonly", (store) =>
      store.get(raw.slice(REFERENCE.length)),
    );
    if (localStorage.getItem(key) !== raw) continue;
    if (!row || row.key !== key)
      throw new Error("本地账本数据缺失，请从备份恢复；已停止写入。");
    return row.value;
  }
  throw new Error("另一个页面已修改账本，请刷新后重试。");
}
export async function writeStoredValue(
  key: string,
  value: string,
  expected: string | null = localStorage.getItem(key),
): Promise<void> {
  const previous = localStorage.getItem(key);
  if (previous !== expected)
    throw new Error("另一个页面已修改账本，请刷新后重试。");
  if (value.length <= INLINE_LIMIT && !previous?.startsWith(REFERENCE)) {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (error) {
      if (
        !(error instanceof DOMException) ||
        error.name !== "QuotaExceededError"
      )
        throw error;
    }
  }
  const id = crypto.randomUUID();
  // Publish the pointer only after the complete transaction commits. A failure
  // before publication leaves the previous ledger readable.
  await request("readwrite", (store) =>
    store.put({ id, key, value } satisfies StoredValue),
  );
  try {
    if (localStorage.getItem(key) !== expected)
      throw new Error("另一个页面已修改账本，请刷新后重试。");
    localStorage.setItem(key, REFERENCE + id);
  } catch (error) {
    await request("readwrite", (store) => store.delete(id)).catch(
      () => undefined,
    );
    throw error;
  }
  if (previous?.startsWith(REFERENCE)) {
    // Publication already succeeded; cleanup must not report a failed save.
    await request("readwrite", (store) =>
      store.delete(previous.slice(REFERENCE.length)),
    ).catch(() => undefined);
  }
}
/** Remove retired plaintext too, including a write interrupted before publication. */
export async function removeStoredPrefix(prefix: string): Promise<void> {
  if (typeof indexedDB !== "undefined") {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite", {
        durability: "strict",
      });
      const cursor = transaction.objectStore(STORE).openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        if ((current.value as StoredValue).key.startsWith(prefix))
          current.delete();
        current.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("历史明文清理失败。"));
    });
  }
  const keys = Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index),
  );
  for (const key of keys)
    if (key?.startsWith(prefix)) localStorage.removeItem(key);
}

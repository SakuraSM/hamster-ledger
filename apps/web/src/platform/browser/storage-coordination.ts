const WRITE_LOCK = "hamster-ledger.storage-write.v1";
export function requireStorageLock(): void {
  if (typeof navigator.locks?.request !== "function")
    throw new Error(
      "当前浏览器不支持跨页面安全加密，请升级浏览器后重试；原数据已保留。",
    );
}
export async function withStorageLock(
  write: () => Promise<void>,
): Promise<void> {
  if (typeof navigator.locks?.request === "function") {
    await navigator.locks.request(WRITE_LOCK, { mode: "exclusive" }, write);
    return;
  }
  await write();
}

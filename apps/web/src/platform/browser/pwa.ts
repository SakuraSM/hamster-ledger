export function registerOfflineShell(): void {
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      console.warn("离线缓存未启用，联网状态下仍可使用账本。");
    });
  }
}

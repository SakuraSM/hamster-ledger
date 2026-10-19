export function createAccountOperations(): {
  version: () => number;
  isCurrent: (version: number) => boolean;
  assertCurrent: (version: number) => void;
  cancel: () => number;
  run: (action: (version: number) => Promise<void>) => Promise<void>;
  persist: (version: number, action: () => Promise<void>) => Promise<void>;
} {
  let generation = 0;
  let busyVersion: number | null = null;
  let queue = Promise.resolve();
  function assertCurrent(version: number): void {
    if (version !== generation) throw new Error("登录状态已变化，请重新操作。");
  }
  return {
    version: () => generation,
    isCurrent: (version) => version === generation,
    assertCurrent,
    cancel: () => ++generation,
    async run(action) {
      if (busyVersion === generation)
        throw new Error("正在处理账号操作，请稍后重试。");
      const version = ++generation;
      busyVersion = version;
      try {
        await action(version);
      } finally {
        if (busyVersion === version) busyVersion = null;
      }
    },
    persist(version, action) {
      const result = queue.then(async () => {
        assertCurrent(version);
        await action();
        assertCurrent(version);
      });
      // A failed write must not prevent a later invalidation from clearing it.
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

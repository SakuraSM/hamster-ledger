import type { LedgerMode, LedgerRepository } from "@hamster-ledger/core";

const queues = new WeakMap<LedgerRepository, Map<LedgerMode, Promise<void>>>();
const directoryQueues = new WeakMap<LedgerRepository, Promise<void>>();

export function queueDirectoryWrite(input: {
  repository: LedgerRepository;
  write: () => Promise<void>;
}): Promise<void> {
  const previous = directoryQueues.get(input.repository) ?? Promise.resolve();
  const result = previous.then(input.write);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  directoryQueues.set(input.repository, settled);
  void settled.then(() => {
    if (directoryQueues.get(input.repository) === settled)
      directoryQueues.delete(input.repository);
  });
  return result;
}

export function queueLedgerWrite(input: {
  repository: LedgerRepository;
  mode: LedgerMode;
  write: () => Promise<void>;
}): Promise<void> {
  let modes = queues.get(input.repository);
  if (!modes) {
    modes = new Map();
    queues.set(input.repository, modes);
  }
  const previous = modes.get(input.mode) ?? Promise.resolve();
  const result = previous.then(input.write);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  modes.set(input.mode, settled);
  void settled.then(() => {
    if (modes.get(input.mode) !== settled) return;
    modes.delete(input.mode);
    if (!modes.size) queues.delete(input.repository);
  });
  return result;
}

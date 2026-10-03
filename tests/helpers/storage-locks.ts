/** Serializes test clients using the same lock name, like the native Web Locks API. */
export function installStorageLocks(): () => void {
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  const tails = new Map<string, Promise<unknown>>();
  const request = <Result>(
    name: string,
    _options: unknown,
    callback: () => Promise<Result>,
  ): Promise<Result> => {
    const operation = (tails.get(name) ?? Promise.resolve()).then(callback);
    tails.set(
      name,
      operation.catch(() => undefined),
    );
    return operation;
  };
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: { request },
  });
  return () => {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else Reflect.deleteProperty(navigator, "locks");
  };
}

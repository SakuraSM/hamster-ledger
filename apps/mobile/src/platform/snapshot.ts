// Object insertion order can change after schema parsing or a process restart.
// Keep snapshot comparisons about content; array order still carries meaning.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  return value;
}
export function serializeSnapshot(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

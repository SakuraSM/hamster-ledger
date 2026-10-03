import type { BillRecord } from "./model.js";
export function primaryRecord(records: BillRecord[], id: string): BillRecord {
  const byId = new Map(records.map((record) => [record.id, record]));
  let current = byId.get(id);
  if (!current) throw new Error("记录不存在。");
  const seen = new Set<string>();
  while (current.duplicateOf) {
    if (seen.has(current.id))
      throw new Error("关联流水存在循环，暂时无法处理。");
    seen.add(current.id);
    const parent = byId.get(current.duplicateOf);
    if (!parent) throw new Error("关联流水不完整，暂时无法处理。");
    current = parent;
  }
  return current;
}
export function recordGroupIds(records: BillRecord[], id: string): Set<string> {
  const root = primaryRecord(records, id);
  const children = new Map<string, string[]>();
  for (const record of records) {
    if (record.duplicateOf)
      children.set(record.duplicateOf, [
        ...(children.get(record.duplicateOf) ?? []),
        record.id,
      ]);
  }
  const members = new Set<string>();
  const pending = [root.id];
  while (pending.length) {
    const current = pending.pop();
    if (!current || members.has(current)) continue;
    members.add(current);
    pending.push(...(children.get(current) ?? []));
  }
  return members;
}

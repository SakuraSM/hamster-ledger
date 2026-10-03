import { CATEGORIES, type Ledger, type Kind } from "./model.js";
import {
  categoryDefinitionSchema,
  type CategoryDefinition,
} from "./planning-model.js";
export function categoryDefinitions(ledger: Ledger): CategoryDefinition[] {
  const defaults = CATEGORIES.map((name, order): CategoryDefinition => ({
    id: `builtin:${name}`,
    name,
    kind: name === "工资" ? "收入" : "支出",
    order,
  }));
  const custom = ledger.categories ?? [];
  return [
    ...defaults.filter((item) => !custom.some((other) => other.id === item.id)),
    ...custom,
  ].sort((left, right) => left.order - right.order);
}
export function categoryNames(ledger: Ledger, kind?: Kind): string[] {
  return categoryDefinitions(ledger)
    .filter(
      (category) =>
        !category.isArchived &&
        (!kind ||
          kind === "转账" ||
          kind === "不计收支" ||
          category.kind === (kind === "收入" ? "收入" : "支出")),
    )
    .map((category) => category.name);
}
export function saveCategory(
  ledger: Ledger,
  input: CategoryDefinition,
): Ledger {
  const category = categoryDefinitionSchema.parse(input);
  const existing = categoryDefinitions(ledger);
  if (category.parentId) {
    const parent = existing.find((item) => item.id === category.parentId);
    if (
      !parent ||
      parent.id === category.id ||
      parent.parentId ||
      parent.kind !== category.kind ||
      parent.isArchived ||
      existing.some((item) => item.parentId === category.id)
    )
      throw new Error("父分类必须是同收支类型的有效一级分类，最多两级。");
  }
  if (
    existing.some(
      (item) => item.id !== category.id && item.name === category.name,
    )
  )
    throw new Error("分类名称已存在。");
  const old = existing.find((item) => item.id === category.id);
  const shouldRename = old && old.name !== category.name;
  return {
    ...ledger,
    categories: [
      ...(ledger.categories ?? []).filter((item) => item.id !== category.id),
      category,
    ],
    records: shouldRename
      ? ledger.records.map((record) =>
          record.category === old.name
            ? { ...record, category: category.name }
            : record,
        )
      : ledger.records,
    rules: shouldRename
      ? Object.fromEntries(
          Object.entries(ledger.rules).map(([merchant, name]) => [
            merchant,
            name === old.name ? category.name : name,
          ]),
        )
      : ledger.rules,
    budgets: shouldRename
      ? ledger.budgets?.map((budget) =>
          budget.category === old.name
            ? { ...budget, category: category.name }
            : budget,
        )
      : ledger.budgets,
    recurringRules: shouldRename
      ? ledger.recurringRules?.map((rule) =>
          rule.category === old.name
            ? { ...rule, category: category.name }
            : rule,
        )
      : ledger.recurringRules,
    subscriptions: shouldRename
      ? ledger.subscriptions?.map((subscription) =>
          subscription.category === old.name
            ? { ...subscription, category: category.name }
            : subscription,
        )
      : ledger.subscriptions,
  };
}
export function moveCategory(
  ledger: Ledger,
  { id, direction }: { id: string; direction: -1 | 1 },
): Ledger {
  const categories = categoryDefinitions(ledger);
  const index = categories.findIndex((category) => category.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= categories.length) return ledger;
  [categories[index], categories[target]] = [
    categories[target],
    categories[index],
  ];
  return {
    ...ledger,
    categories: categories.map((category, order) => ({ ...category, order })),
  };
}

export function defaultCategory(
  ledger: Ledger,
  input: { kind: Kind; preferredId?: string },
): string {
  const preferredId =
    input.preferredId ??
    (input.kind === "收入"
      ? "builtin:工资"
      : input.kind === "转账"
        ? "builtin:其他"
        : "builtin:餐饮");
  const available = categoryNames(ledger, input.kind);
  const preferred = categoryDefinitions(ledger).find(
    (category) =>
      category.id === preferredId && available.includes(category.name),
  );
  return preferred?.name ?? available[0] ?? "";
}

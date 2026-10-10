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
        !categoryDefinitions(ledger).some(
          (parent) => parent.id === category.parentId && parent.isArchived,
        ) &&
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
export const CATEGORY_TEMPLATES = {
  daily: "日常生活",
  family: "家庭开支",
  investment: "投资收支",
} as const;
const TEMPLATE_GROUPS: Record<
  keyof typeof CATEGORY_TEMPLATES,
  Array<{ name: string; kind: "收入" | "支出"; children: string[] }>
> = {
  daily: [
    { name: "餐饮", kind: "支出", children: ["早餐", "午晚餐", "咖啡茶饮"] },
    { name: "交通", kind: "支出", children: ["公交地铁", "打车", "养车"] },
    { name: "居住", kind: "支出", children: ["水电网费", "物业费用"] },
  ],
  family: [
    {
      name: "家庭",
      kind: "支出",
      children: ["育儿", "教育", "宠物", "家庭用品"],
    },
    { name: "家庭收入", kind: "收入", children: ["奖金", "补贴"] },
  ],
  investment: [
    { name: "投资费用", kind: "支出", children: ["交易手续费", "借款利息"] },
    { name: "投资收入", kind: "收入", children: ["存款利息", "分红"] },
  ],
};
export function applyCategoryTemplate(
  ledger: Ledger,
  template: keyof typeof CATEGORY_TEMPLATES,
): Ledger {
  let next = ledger;
  for (const group of TEMPLATE_GROUPS[template]) {
    let parent = categoryDefinitions(next).find(
      (item) => item.name === group.name,
    );
    if (
      parent &&
      (parent.kind !== group.kind || parent.parentId || parent.isArchived)
    )
      continue;
    if (!parent) {
      parent = {
        id: `template:${template}:${group.name}`,
        name: group.name,
        kind: group.kind,
        order: categoryDefinitions(next).length,
      };
      next = saveCategory(next, parent);
    }
    for (const name of group.children) {
      if (categoryDefinitions(next).some((item) => item.name === name))
        continue;
      next = saveCategory(next, {
        id: `template:${template}:${group.name}:${name}`,
        name,
        kind: group.kind,
        parentId: parent.id,
        order: categoryDefinitions(next).length,
      });
    }
  }
  return next;
}

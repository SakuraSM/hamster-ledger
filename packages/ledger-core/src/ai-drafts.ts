import { type Ledger } from "./model.js";
import {
  type AiCandidate,
  type AiDraft,
  aiCandidateSchema,
} from "./ai-model.js";
import {
  saveAdvancedEntry,
  type AdvancedEntryInput,
} from "./advanced-entries.js";
import { parseMinor } from "./currency.js";
import { dateTimeSchema } from "./date-schemas.js";
import { categoryNames } from "./categories.js";
import { validateFinancialIntegrity } from "./financial-integrity.js";

export function candidateIssues(
  ledger: Ledger,
  candidate: AiCandidate,
): string[] {
  const issues = [...candidate.issues];
  let amount = 0;
  try {
    amount = parseMinor({
      value: candidate.amount,
      currency: candidate.currency,
    });
    if (amount <= 0) throw new Error();
  } catch {
    issues.push("金额无效，请核对原始凭证");
  }
  if (!dateTimeSchema.safeParse(candidate.date).success)
    issues.push("交易日期待确认");
  if (!candidate.merchant.trim()) issues.push("交易对象待确认");
  const account = ledger.accounts.find(
    (item) => item.id === candidate.accountId && !item.isArchived,
  );
  if (!account) issues.push("请选择已有账户");
  else if ((account.currency ?? "CNY") !== candidate.currency)
    issues.push("账户与币种不一致");
  if (candidate.currency !== "CNY") issues.push("外币金额须核对汇率");
  const kind = candidate.type === "income" ? "收入" : "支出";
  if (
    !categoryNames(ledger, kind).includes(candidate.category) ||
    candidate.category === "待分类"
  )
    issues.push("分类待确认");
  if (!["expense", "income"].includes(candidate.type))
    issues.push("此交易类型须补充关联账户或交易");
  if (candidate.confidence < 0.95) issues.push("识别结果需人工核对");
  if (
    ledger.records.some(
      (record) =>
        record.status === "confirmed" &&
        record.date.slice(0, 10) === candidate.date.slice(0, 10) &&
        record.merchant === candidate.merchant &&
        record.detail?.original.minor === amount &&
        record.detail.original.currency === candidate.currency,
    )
  )
    issues.push("存在同日同金额交易（含回收站），可能重复");
  return [...new Set(issues)];
}
export function candidateEntry(draft: AiDraft): AdvancedEntryInput {
  const item = draft.candidate;
  if (item.currency !== "CNY")
    throw new Error("请在完整交易编辑器中填写外币汇率。");
  return {
    id: `ai:${draft.id}`,
    date: item.date,
    merchant: item.merchant,
    description: item.description,
    category: item.category,
    accountId: item.accountId ?? "",
    detail: {
      type: item.type,
      original: {
        minor: parseMinor({ value: item.amount, currency: item.currency }),
        currency: item.currency,
        rate: "1",
        date: item.date.slice(0, 10),
        source: "manual",
      },
      attachmentIds: draft.attachmentIds,
      splits: [],
      movements: [],
      origin: "ai",
      memberId: draft.memberId,
    },
  };
}
export function confirmAiDraft(
  ledger: Ledger,
  id: string,
  entry: AdvancedEntryInput,
): Ledger {
  const draft = ledger.aiDrafts?.find((item) => item.id === id);
  if (!draft) throw new Error("草稿不存在。");
  if (draft.state === "confirmed") return ledger;
  if (draft.state !== "pending") throw new Error("草稿已丢弃。");
  const recordId = `ai:${draft.id}`;
  if (ledger.records.some((record) => record.id === recordId))
    throw new Error("此草稿曾经入账，请在流水或回收站中处理。");
  const next = saveAdvancedEntry(ledger, {
    ...entry,
    id: recordId,
    detail: {
      ...entry.detail,
      origin: "ai",
      attachmentIds: [
        ...new Set([
          ...draft.attachmentIds,
          ...(entry.detail.attachmentIds ?? []),
        ]),
      ],
      memberId: draft.memberId,
    },
  });
  validateFinancialIntegrity(next);
  return {
    ...next,
    aiDrafts: ledger.aiDrafts?.map((item) =>
      item.id === id ? { ...item, state: "confirmed", recordId } : item,
    ),
  };
}
export function addAiDrafts(
  ledger: Ledger,
  drafts: AiDraft[],
  autoPost: boolean,
): Ledger {
  if (!drafts.length || drafts.length > 50)
    throw new Error("每次识别须包含 1–50 笔草稿。");
  if (ledger.aiDrafts?.some((item) => item.sourceHash === drafts[0].sourceHash))
    return ledger;
  let next: Ledger = {
    ...ledger,
    aiDrafts: [...(ledger.aiDrafts ?? []), ...drafts],
  };
  if (autoPost)
    for (const draft of drafts)
      if (candidateIssues(next, draft.candidate).length === 0)
        next = confirmAiDraft(next, draft.id, candidateEntry(draft));
  return next;
}
export function parseRuleText(
  text: string,
  ledger: Ledger,
  today: string,
): AiCandidate[] {
  const chunks = text
    .split(
      /[;；\n。]+|[，,](?!\s*(?:优惠|折扣|原价|实付|合计|总计|\d{3}(?:\D|$)))/,
    )
    .map((item) => item.trim())
    .filter(Boolean);
  if (!chunks.length || chunks.length > 50)
    throw new Error("请输入 1–50 笔交易，用分号或换行分隔。");
  return chunks.map((chunk) => {
    const date = chunk.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? today;
    const withoutDate = chunk.replace(/\d{4}-\d{2}-\d{2}/g, "");
    const amounts = [
      ...withoutDate.matchAll(/(?:¥|￥)?(-?\d+(?:\.\d+)?)(?:\s*元)?/g),
    ];
    const accounts = ledger.accounts.filter(
      (account) => !account.isArchived && chunk.includes(account.name),
    );
    const type = /工资|收入|收款/.test(chunk)
      ? "income"
      : /转账/.test(chunk)
        ? "transfer"
        : /借出/.test(chunk)
          ? "lend"
          : /借入/.test(chunk)
            ? "borrow"
            : /报销/.test(chunk)
              ? "reimburse"
              : "expense";
    const category =
      categoryNames(ledger, type === "income" ? "收入" : "支出").find((name) =>
        chunk.includes(name),
      ) ?? "待分类";
    return aiCandidateSchema.parse({
      type,
      amount: amounts.length === 1 ? amounts[0][1] : "",
      date: `${date} 12:00:00`,
      merchant: chunk.slice(0, 200),
      description: chunk,
      category,
      accountId: accounts.length === 1 ? accounts[0].id : null,
      confidence: 0.5,
      issues: [
        "本地规则解析，请核对日期、金额和账户",
        ...(amounts.length !== 1 ? ["金额不唯一或未找到"] : []),
      ],
    });
  });
}

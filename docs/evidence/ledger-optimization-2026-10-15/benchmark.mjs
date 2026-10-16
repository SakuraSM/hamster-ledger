import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
const core = await import(pathToFileURL(process.argv[2]).href);
function record(index) {
  return {
    id: `test-${index}`,
    date: "2026-10-03 12:00:00",
    merchant: `虚拟商户${index}`,
    description: "合成性能数据",
    amount: 1000 + index,
    currency: "CNY",
    kind: "支出",
    category: "餐饮",
    source: "支付宝",
    account: "虚拟银行卡",
    orderId: `ORDER-${index}`,
    status: "confirmed",
    sourceStatus: "成功",
    fileName: "synthetic.csv",
    raw: {},
    linkedSources: [],
    detail: {
      type: "expense",
      original: {
        currency: "CNY",
        minor: 1000 + index,
        rate: "1",
        date: "2026-10-03",
        source: "manual",
      },
      splits: [],
      attachmentIds: [],
      movements: [],
      origin: "manual",
      isReimbursable: true,
    },
  };
}
const results = [];
for (const size of [1000, 5000, 15000]) {
  const records = Array.from({ length: size }, (_, i) => record(i));
  const ledger = { ...core.EMPTY_LEDGER, records };
  const incoming = records.map((item) => ({
    ...item,
    id: `new-${item.id}`,
    orderId: `new-${item.orderId}`,
  }));
  for (const operation of [
    "import-new",
    "import-duplicate",
    "reimbursement-filter",
  ]) {
    const timings = [];
    let count;
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      if (operation === "import-new")
        count = core.planImport(ledger, incoming).added;
      if (operation === "import-duplicate")
        count = core.planImport(
          ledger,
          incoming.map((item, i) => ({ ...item, orderId: records[i].orderId })),
        ).duplicate;
      if (operation === "reimbursement-filter") {
        const matcher = core.createFinanceFilter
          ? core.createFinanceFilter(ledger, { reimbursement: "pending" })
          : (item) =>
              core.matchesFinanceFilters(ledger, item, {
                reimbursement: "pending",
              });
        count = records.filter(matcher).length;
      }
      timings.push(Number((performance.now() - start).toFixed(2)));
    }
    results.push({ size, operation, count, ms: timings });
  }
}
console.log(JSON.stringify({ node: process.version, results }, null, 2));

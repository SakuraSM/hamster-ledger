import { readFileSync, writeFileSync } from "node:fs";
const input = new URL(
  "../packages/design-tokens/src/tokens.json",
  import.meta.url,
);
const target = new URL(
  "../packages/design-tokens/src/theme.css",
  import.meta.url,
);
const tokens = JSON.parse(readFileSync(input, "utf8"));
const names = {
  canvas: "bg",
  sidebar: "sidebar",
  text: "ink",
  muted: "muted",
  primary: "primary",
  primaryHover: "primary-hover",
  action: "action",
  actionText: "action-ink",
  divider: "line",
  selected: "apricot",
  positive: "positive",
};
const css =
  "/* Generated from tokens.json. Run npm run tokens:generate. */\n:root {\n" +
  Object.entries(names)
    .map(([key, name]) => `  --${name}: ${tokens.color[key]};`)
    .join("\n") +
  `\n  --chart-income: ${tokens.chart.income};\n  --chart-income-muted: ${tokens.chart.incomeMuted};` +
  `\n  --chart-expense: ${tokens.chart.expense};\n  --chart-expense-muted: ${tokens.chart.expenseMuted};` +
  tokens.chart.categories
    .map((color, index) => `\n  --chart-category-${index + 1}: ${color};`)
    .join("") +
  '\n}\n:root[data-theme="night"] {' +
  `\n  --chart-income: ${tokens.chart.incomeDark};\n  --chart-income-muted: ${tokens.chart.incomeMutedDark};` +
  `\n  --chart-expense: ${tokens.chart.expenseDark};\n  --chart-expense-muted: ${tokens.chart.expenseMutedDark};` +
  tokens.chart.categoriesDark
    .map((color, index) => `\n  --chart-category-${index + 1}: ${color};`)
    .join("") +
  "\n}\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== css)
    throw new Error("Design token CSS is stale. Run npm run tokens:generate.");
} else writeFileSync(target, css);

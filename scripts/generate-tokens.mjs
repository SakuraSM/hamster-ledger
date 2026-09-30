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
  divider: "line",
  selected: "apricot",
  positive: "positive",
};
const css =
  "/* Generated from tokens.json. Run npm run tokens:generate. */\n:root {\n" +
  Object.entries(names)
    .map(([key, name]) => `  --${name}: ${tokens.color[key]};`)
    .join("\n") +
  "\n}\n";
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== css)
    throw new Error("Design token CSS is stale. Run npm run tokens:generate.");
} else writeFileSync(target, css);

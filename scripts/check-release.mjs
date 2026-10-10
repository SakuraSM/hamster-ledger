import { readFileSync, readdirSync } from "node:fs";
const tag = process.env.RELEASE_TAG;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
  throw new Error("Only formal vMAJOR.MINOR.PATCH tags publish latest.");
const expected = tag.slice(1);
for (const path of [
  "package.json",
  ...["apps", "packages"].flatMap((dir) =>
    readdirSync(dir).map((name) => `${dir}/${name}/package.json`),
  ),
]) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  if (pkg.version !== expected)
    throw new Error(`${path} version differs from ${tag}.`);
}
console.log(`Release ${tag}: workspace versions match.`);

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "..");
const rules = new Map([
  ["packages/ledger-core", new Set(["zod"])],
  ["packages/statement-importers", new Set(["@hamster-ledger/core"])],
]);
const files = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
const errors = [];
for (const [workspace, allowed] of rules) {
  const sourceRoot = path.join(root, workspace, "src");
  for (const file of files(sourceRoot).filter((file) => file.endsWith(".ts"))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const check = (specifier) => {
      if (specifier.startsWith(".")) {
        const resolved = path.resolve(path.dirname(file), specifier);
        if (!resolved.startsWith(sourceRoot + path.sep))
          errors.push(
            `${file}: relative import leaves the shared package: ${specifier}`,
          );
      } else if (!allowed.has(specifier))
        errors.push(`${file}: unsupported dependency: ${specifier}`);
    };
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        check(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const [argument] = node.arguments;
        if (argument && ts.isStringLiteral(argument)) check(argument.text);
        else
          errors.push(`${file}: dynamic imports require a literal module name`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Shared package boundaries verified: no Web, React, Node or native runtime imports.",
);

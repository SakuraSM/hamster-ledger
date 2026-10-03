module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      function directPhosphorImports({ types }) {
        return {
          visitor: {
            ImportDeclaration(path) {
              const { node } = path;
              if (
                node.source.value !== "phosphor-react-native" ||
                node.importKind === "type"
              )
                return;
              const icons = node.specifiers.filter(
                (specifier) =>
                  types.isImportSpecifier(specifier) &&
                  specifier.importKind !== "type" &&
                  specifier.imported.name.endsWith("Icon"),
              );
              if (!icons.length) return;
              const remaining = node.specifiers.filter(
                (specifier) => !icons.includes(specifier),
              );
              const declarations = icons.map((specifier) =>
                types.importDeclaration(
                  [specifier],
                  types.stringLiteral(
                    `phosphor-react-native/src/icons/${specifier.imported.name.slice(0, -4)}`,
                  ),
                ),
              );
              if (remaining.length)
                declarations.push(
                  types.importDeclaration(remaining, node.source),
                );
              path.replaceWithMultiple(declarations);
            },
          },
        };
      },
    ],
  };
};

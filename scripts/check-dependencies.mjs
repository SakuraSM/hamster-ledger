import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";

const WORKSPACES = {
  web: "apps/web",
  mobile: "apps/mobile",
  shared: "packages/ledger-react",
};

/** Read installed versions using each workspace's own module resolution. */
export function readDependencySnapshot(root) {
  const rootRequire = createRequire(resolve(root, "package.json"));
  const readJson = (filename) => JSON.parse(readFileSync(filename, "utf8"));
  const installedPackage = (name) =>
    readJson(rootRequire.resolve(`${name}/package.json`));
  const workspaceRequires = Object.fromEntries(
    Object.entries(WORKSPACES).map(([name, directory]) => [
      name,
      createRequire(resolve(root, directory, "package.json")),
    ]),
  );
  const react = Object.fromEntries(
    Object.entries(workspaceRequires).map(([name, workspaceRequire]) => [
      name,
      {
        version: readJson(workspaceRequire.resolve("react/package.json"))
          .version,
        entry: realpathSync(workspaceRequire.resolve("react")),
      },
    ]),
  );
  const expoDirectory = dirname(
    workspaceRequires.mobile.resolve("expo/package.json"),
  );
  return {
    react,
    reactDomVersion: readJson(
      workspaceRequires.web.resolve("react-dom/package.json"),
    ).version,
    reactNativeVersion: readJson(
      workspaceRequires.mobile.resolve("react-native/package.json"),
    ).version,
    expoModules: readJson(resolve(expoDirectory, "bundledNativeModules.json")),
    nodeVersion: process.versions.node,
    nodeEngine: readJson(resolve(root, "package.json")).engines.node,
    nodeTypesVersion: installedPackage("@types/node").version,
    typescriptVersion: installedPackage("typescript").version,
    eslintVersion: installedPackage("eslint").version,
    lintPeers: installedPackage("typescript-eslint").peerDependencies,
  };
}

/** Return actionable compatibility errors without changing dependencies. */
export function validateDependencies(snapshot) {
  const errors = [];
  const { react, reactDomVersion, expoModules, lintPeers } = snapshot;
  if (react.web.version !== reactDomVersion) {
    errors.push(
      `Web React ${react.web.version} and React DOM ${reactDomVersion} must have the exact same version. Upgrade them together.`,
    );
  }
  if (new Set(Object.values(react).map(({ entry }) => entry)).size !== 1) {
    errors.push(
      "Web, Android and ledger-react resolve different React instances. Keep the shared controller on the renderer's React instance.",
    );
  }
  const requirements = [
    ["Android React", react.mobile.version, expoModules.react],
    ["React Native", snapshot.reactNativeVersion, expoModules["react-native"]],
    ["TypeScript", snapshot.typescriptVersion, lintPeers.typescript],
    ["ESLint", snapshot.eslintVersion, lintPeers.eslint],
    ["Node.js", snapshot.nodeVersion, snapshot.nodeEngine],
  ];
  for (const [name, version, range] of requirements) {
    if (!range || !semver.validRange(range)) {
      errors.push(`${name}: missing or invalid compatibility range.`);
    } else if (!semver.satisfies(version, range)) {
      errors.push(`${name} ${version} does not satisfy ${range}.`);
    }
  }
  const minimumNode = semver.minVersion(snapshot.nodeEngine);
  if (
    minimumNode &&
    semver.major(snapshot.nodeTypesVersion) !== minimumNode.major
  ) {
    errors.push(
      `@types/node ${snapshot.nodeTypesVersion} must match the minimum supported Node.js major ${minimumNode.major}.`,
    );
  }
  return errors;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const root = resolve(import.meta.dirname, "..");
  const errors = validateDependencies(readDependencySnapshot(root));
  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      "Dependency compatibility verified: React instances, Expo runtime, lint peers and Node.js types.",
    );
  }
}

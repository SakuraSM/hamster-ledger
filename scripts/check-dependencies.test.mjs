import assert from "node:assert/strict";
import test from "node:test";
import { validateDependencies } from "./check-dependencies.mjs";

function compatibleSnapshot() {
  const runtime = { version: "19.2.3", entry: "/fixture/react/index.js" };
  return {
    react: {
      web: { ...runtime },
      mobile: { ...runtime },
      shared: { ...runtime },
    },
    reactDomVersion: "19.2.3",
    reactNativeVersion: "0.86.3",
    expoModules: { react: "19.2.3", "react-native": "0.86.3" },
    nodeVersion: "22.23.1",
    nodeEngine: ">=22.14.0",
    nodeTypesVersion: "22.20.4",
    typescriptVersion: "5.9.3",
    eslintVersion: "9.39.4",
    lintPeers: {
      typescript: ">=4.8.4 <6.1.0",
      eslint: "^8.57.0 || ^9.0.0 || ^10.0.0",
    },
  };
}

test("accepts the baseline and the supported ESLint upgrade on Node 24", () => {
  const snapshot = compatibleSnapshot();
  assert.deepEqual(validateDependencies(snapshot), []);
  snapshot.eslintVersion = "10.12.0";
  snapshot.nodeVersion = "24.21.0";
  assert.deepEqual(validateDependencies(snapshot), []);
});

test("rejects a standalone React upgrade like PR 4", () => {
  const snapshot = compatibleSnapshot();
  snapshot.react.web.version = "19.3.0";
  assert.match(validateDependencies(snapshot).join("\n"), /exact same version/);
});

test("rejects a standalone React DOM upgrade like PR 5", () => {
  const snapshot = compatibleSnapshot();
  snapshot.reactDomVersion = "19.3.0";
  assert.match(validateDependencies(snapshot).join("\n"), /exact same version/);
});

test("rejects paired React upgrades outside the installed Expo contract", () => {
  const snapshot = compatibleSnapshot();
  for (const runtime of Object.values(snapshot.react))
    runtime.version = "19.3.0";
  snapshot.reactDomVersion = "19.3.0";
  assert.match(validateDependencies(snapshot).join("\n"), /Android React/);
});

test("rejects duplicate React instances even when versions match", () => {
  const snapshot = compatibleSnapshot();
  snapshot.react.shared.entry = "/fixture/nested/react/index.js";
  assert.match(
    validateDependencies(snapshot).join("\n"),
    /different React instances/,
  );
});

test("rejects React Native outside the installed Expo contract", () => {
  const snapshot = compatibleSnapshot();
  snapshot.reactNativeVersion = "0.87.0";
  assert.match(
    validateDependencies(snapshot).join("\n"),
    /React Native 0.87.0/,
  );
});

test("rejects TypeScript 7 from PR 6 but accepts a supported peer range", () => {
  const snapshot = compatibleSnapshot();
  snapshot.typescriptVersion = "7.0.2";
  assert.match(validateDependencies(snapshot).join("\n"), /TypeScript 7.0.2/);
  snapshot.lintPeers.typescript = ">=5.0.0 <8.0.0";
  assert.deepEqual(validateDependencies(snapshot), []);
});

test("rejects lint peers and Node types beyond the supported baseline", () => {
  const snapshot = compatibleSnapshot();
  snapshot.eslintVersion = "11.0.0";
  snapshot.nodeTypesVersion = "26.6.3";
  const errors = validateDependencies(snapshot).join("\n");
  assert.match(errors, /ESLint 11.0.0/);
  assert.match(errors, /minimum supported Node.js major 22/);
});

test("rejects an unsupported Node runtime and a missing SDK contract", () => {
  const snapshot = compatibleSnapshot();
  snapshot.nodeVersion = "20.20.2";
  delete snapshot.expoModules.react;
  const errors = validateDependencies(snapshot).join("\n");
  assert.match(errors, /Node.js 20.20.2/);
  assert.match(errors, /Android React: missing or invalid/);
});

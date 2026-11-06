/// <reference types="vite/client" />
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SceneActions } from "../apps/web/src/design-preview/SceneShell";
import { getScene } from "../apps/web/src/design-preview/catalog";
import {
  planPreviewNavigation,
  type PreviewNavigation,
} from "../apps/web/src/design-preview/navigation";

afterEach(cleanup);

it.each([
  ["delete-confirm", "继续保留"],
  ["deleted", "撤销删除"],
  ["record-source", "返回账单详情"],
  ["restore-record-done", "查看恢复的账单"],
])("returns to the same record from %s", (sceneId, label) => {
  let selected: PreviewNavigation | undefined;
  render(
    <SceneActions
      scene={getScene(sceneId)}
      mode="mobile"
      onNavigate={(target, subject) => {
        selected = planPreviewNavigation({ sceneId, target, subject });
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(selected).toMatchObject({ kind: "navigate", target: "record" });
});

it("keeps the recovered coffee separate from the lunch detail", () => {
  const sceneId = "payment-recovery";
  let selected: PreviewNavigation | undefined;
  render(
    <SceneActions
      scene={getScene(sceneId)}
      mode="mobile"
      onNavigate={(target, subject) => {
        selected = planPreviewNavigation({ sceneId, target, subject });
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "打开关联账单" }));
  expect(selected).toMatchObject({ kind: "static", target: "record" });
});

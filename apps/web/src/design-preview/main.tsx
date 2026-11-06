import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SCENES, getScene, scenesForMode } from "./catalog";
import {
  ComparisonView,
  ContactSheet,
  DesignAtlas,
  RawScene,
} from "./DesignAtlas";
import type { DesignMode, SceneSpec } from "./model";
import { planPreviewNavigation } from "./navigation";
import "./styles/index.css";
declare global {
  interface Window {
    designCatalog: SceneSpec[];
    designReady: boolean;
  }
}
function DesignApplication(): React.JSX.Element {
  const initial = new URLSearchParams(location.search);
  const [sceneId, setSceneId] = useState(initial.get("scene") ?? "assets");
  const [mode, setMode] = useState<DesignMode>(
    initial.get("mode") === "desktop" ? "desktop" : "mobile",
  );
  const setView = (nextId: string, nextMode: DesignMode): void => {
    const scene = getScene(nextId);
    const supportedMode = scene.mobileOnly
      ? "mobile"
      : scene.webOnly
        ? "desktop"
        : nextMode;
    setSceneId(nextId);
    setMode(supportedMode);
    const url = new URL(location.href);
    url.searchParams.set("scene", nextId);
    url.searchParams.set("mode", supportedMode);
    history.replaceState(null, "", url);
  };
  const onNavigate = (id: string, subject?: string): void => {
    const plan = planPreviewNavigation({ sceneId, target: id, subject });
    if (plan.kind === "static") {
      window.alert(plan.message);
      return;
    }
    if (plan.kind === "confirm" && !window.confirm(plan.message)) return;
    setView(plan.target, mode);
  };
  const onMode = (next: DesignMode): void =>
    setView(
      scenesForMode(next).some((scene) => scene.id === sceneId)
        ? sceneId
        : "inbox",
      next,
    );
  const props = {
    sceneId,
    mode,
    onNavigate,
    onMode,
    onSelectScene: (id: string): void => setView(id, mode),
  };
  if (initial.get("compare") === "1")
    return <ComparisonView onNavigate={onNavigate} />;
  if (initial.has("sheet"))
    return (
      <ContactSheet
        ids={(initial.get("sheet") ?? "inbox,overview,transactions").split(",")}
        onNavigate={onNavigate}
      />
    );
  if (initial.get("raw") === "1") return <RawScene {...props} />;
  return <DesignAtlas {...props} />;
}
const root = document.getElementById("root");
if (!root) throw new Error("设计预览缺少挂载节点");
window.designCatalog = SCENES;
window.designReady = false;
if (new URLSearchParams(location.search).get("raw") === "1")
  document.body.classList.add("raw-page");
createRoot(root).render(<DesignApplication />);
requestAnimationFrame(() => {
  window.designReady = true;
});

import { assetScenes1 } from "./scenes/assets-1";
import { assetScenes2 } from "./scenes/assets-2";
import { assetDepthScenes1 } from "./scenes/assets-depth-1";
import { assetDepthScenes2 } from "./scenes/assets-depth-2";
import { assetDepthScenes3 } from "./scenes/assets-depth-3";
import { authScenes1 } from "./scenes/auth-1";
import { authScenes2 } from "./scenes/auth-2";
import { captureScenes1 } from "./scenes/capture-1";
import { captureScenes2 } from "./scenes/capture-2";
import { completenessScenes1 } from "./scenes/completeness-1";
import { completenessScenes2 } from "./scenes/completeness-2";
import { entryVariantScenes } from "./scenes/entry-variants";
import { feedbackScenes1 } from "./scenes/feedback-1";
import { feedbackScenes2 } from "./scenes/feedback-2";
import { importScenes } from "./scenes/imports";
import { ledgerScenes1 } from "./scenes/ledger-1";
import { ledgerScenes2 } from "./scenes/ledger-2";
import { networkExitScenes } from "./scenes/network-exit";
import { paymentScenes } from "./scenes/payment";
import { planningScenes1 } from "./scenes/planning-1";
import { planningScenes2 } from "./scenes/planning-2";
import { settingsScenes1 } from "./scenes/settings-1";
import { settingsScenes2 } from "./scenes/settings-2";
import { stateScenes1 } from "./scenes/states-1";
import { stateScenes2 } from "./scenes/states-2";
import { walletAccountScenes } from "./scenes/wallet-accounts";
import { workspaceScenes1 } from "./scenes/workspaces-1";
import { workspaceScenes2 } from "./scenes/workspaces-2";
import { workspaceScenes3 } from "./scenes/workspaces-3";
import type { SceneSpec, DesignMode } from "./model";
export const SCENES: SceneSpec[] = [
  ...assetScenes1,
  ...assetScenes2,
  ...assetDepthScenes1,
  ...assetDepthScenes2,
  ...assetDepthScenes3,
  ...authScenes1,
  ...authScenes2,
  ...captureScenes1,
  ...captureScenes2,
  ...completenessScenes1,
  ...completenessScenes2,
  ...entryVariantScenes,
  ...feedbackScenes1,
  ...feedbackScenes2,
  ...importScenes,
  ...ledgerScenes1,
  ...ledgerScenes2,
  ...networkExitScenes,
  ...paymentScenes,
  ...planningScenes1,
  ...planningScenes2,
  ...settingsScenes1,
  ...settingsScenes2,
  ...stateScenes1,
  ...stateScenes2,
  ...walletAccountScenes,
  ...workspaceScenes1,
  ...workspaceScenes2,
  ...workspaceScenes3,
];
export function scenesForMode(mode: DesignMode): SceneSpec[] {
  return SCENES.filter(
    (scene) =>
      !(mode === "desktop" && scene.mobileOnly) &&
      !(mode === "mobile" && scene.webOnly),
  );
}
export function getScene(id: string): SceneSpec {
  const result = SCENES.find((scene) => scene.id === id);
  if (!result) throw new Error(`未知视觉稿：${id}`);
  return result;
}

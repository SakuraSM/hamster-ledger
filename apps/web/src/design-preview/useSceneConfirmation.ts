import { useState, type FormEvent } from "react";
import type { SceneSpec } from "./model";
interface SceneConfirmation {
  canProceed: boolean;
  onFormChange: (event: FormEvent<HTMLElement>) => void;
}
export function useSceneConfirmation(scene: SceneSpec): SceneConfirmation {
  const needsConfirmation = scene.blocks.some((block) =>
    block.items?.some(
      (item) => item.type === "toggle" && item.value?.includes("未勾选"),
    ),
  );
  const [confirmation, setConfirmation] = useState({
    sceneId: scene.id,
    isChecked: false,
  });
  return {
    canProceed:
      !needsConfirmation ||
      (confirmation.sceneId === scene.id && confirmation.isChecked),
    onFormChange: (event) => {
      if (
        needsConfirmation &&
        event.target instanceof HTMLInputElement &&
        event.target.type === "checkbox"
      )
        setConfirmation({ sceneId: scene.id, isChecked: event.target.checked });
    },
  };
}

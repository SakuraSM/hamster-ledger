import { getScene } from "./catalog";
import type { DesignMode, VisualBlock } from "./model";
export function supportsTarget(target: string, mode: DesignMode): boolean {
  const scene = getScene(target);
  return (
    !(mode === "desktop" && scene.mobileOnly) &&
    !(mode === "mobile" && scene.webOnly)
  );
}
export function blockForMode(
  block: VisualBlock,
  mode: DesignMode,
): VisualBlock {
  return {
    ...block,
    items: block.items?.filter(
      (item) => !item.target || supportsTarget(item.target, mode),
    ),
  };
}
export function blockKey(block: VisualBlock): string {
  return `${block.kind}:${block.heading ?? block.text ?? block.items?.map((item) => item.label).join("|") ?? block.caption ?? block.value ?? "main"}`;
}

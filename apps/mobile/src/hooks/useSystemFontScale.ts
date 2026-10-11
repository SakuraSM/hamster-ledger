import { useSyncExternalStore } from "react";
import { DeviceEventEmitter, useWindowDimensions } from "react-native";
import fontScaleEvent from "../ui/font-scale-event.json";

let nativeScale: number | null = null;
const subscribers = new Set<() => void>();
let subscription: ReturnType<typeof DeviceEventEmitter.addListener> | undefined;
function subscribe(notify: () => void): () => void {
  subscribers.add(notify);
  subscription ??= DeviceEventEmitter.addListener(
    fontScaleEvent.name,
    (value: unknown) => {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value === nativeScale
      )
        return;
      nativeScale = value;
      subscribers.forEach((subscriber) => subscriber());
    },
  );
  return () => {
    subscribers.delete(notify);
    if (!subscribers.size) {
      subscription?.remove();
      subscription = undefined;
    }
  };
}
const getSnapshot = (): number | null => nativeScale;

export function useSystemFontScale(): number {
  const { fontScale } = useWindowDimensions();
  // Keep the latest Android configuration for screens opened after the event;
  // React Native Dimensions can still contain the previous font scale.
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return current ?? fontScale;
}

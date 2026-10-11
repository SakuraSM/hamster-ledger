import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
export function useReducedMotion(): boolean {
  const [hasReducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    let isActive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isActive) setReducedMotion(value);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      isActive = false;
      listener.remove();
    };
  }, []);
  return hasReducedMotion;
}

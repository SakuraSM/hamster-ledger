import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
export function useKeyboardVisibility(): boolean {
  const [isVisible, setVisible] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return isVisible;
}

import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

interface NavigationLayerProps {
  children: ReactNode;
  tool: ReactNode;
}
export function NavigationLayer({
  children,
  tool,
}: NavigationLayerProps): React.JSX.Element {
  const isToolOpen = Boolean(tool);
  return (
    <View style={styles.fill}>
      <View
        style={[styles.fill, isToolOpen && styles.hidden]}
        pointerEvents={isToolOpen ? "none" : "auto"}
        accessibilityElementsHidden={isToolOpen}
        importantForAccessibility={isToolOpen ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {isToolOpen ? <View style={StyleSheet.absoluteFill}>{tool}</View> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { opacity: 0 },
});

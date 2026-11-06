import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { AppTool } from "./AuxiliaryPages";
import type { ToolHistoryEntry } from "./tool-history";

export function RetainedToolPages({
  entries,
  identity,
  renderPage,
}: {
  entries: ToolHistoryEntry[];
  identity: string;
  renderPage: (page: AppTool) => ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.fill}>
      {entries.map((entry, index) => {
        const isActive = index === entries.length - 1;
        return (
          <View
            key={`${identity}:${entry.id}`}
            style={isActive ? styles.fill : styles.hidden}
            pointerEvents={isActive ? "auto" : "none"}
            accessibilityElementsHidden={!isActive}
            importantForAccessibility={
              isActive ? "auto" : "no-hide-descendants"
            }
          >
            {renderPage(entry.page)}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});

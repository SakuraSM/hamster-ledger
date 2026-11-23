import { createContext, useContext, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
import { BlurTargetView, BlurView } from "expo-blur";
export const AtlasEffects = createContext(true);
/** The chrome samples a dedicated colour layer, never an account or credential screen. */
export function AtlasGlass({ children }: { children: ReactNode }) {
  const enabled = useContext(AtlasEffects),
    theme = useTheme(),
    target = useRef<View>(null);
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        overflow: "hidden",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.outlineVariant,
      }}
    >
      {enabled && (
        <>
          <BlurTargetView
            ref={target}
            pointerEvents="none"
            accessible={false}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={{
                position: "absolute",
                top: -20,
                bottom: 0,
                width: "48%",
                right: -28,
                borderRadius: 60,
                backgroundColor: theme.colors.primaryContainer,
                opacity: 0.65,
              }}
            />
          </BlurTargetView>
          <BlurView
            pointerEvents="none"
            accessible={false}
            blurTarget={target}
            blurMethod="dimezisBlurViewSdk31Plus"
            intensity={36}
            tint={theme.dark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
      {children}
    </View>
  );
}

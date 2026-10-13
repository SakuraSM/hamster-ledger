import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Keyboard, StyleSheet, View } from "react-native";
import { useTheme } from "react-native-paper";
const ENTER_DURATION_MS = 220;
const RETURN_DURATION_MS = 160;
const ENTER_OFFSET = 16;
const RETURN_OFFSET = 4;
import { NATIVE_SCENE_EASING } from "./motion";
interface NavigationLayerProps {
  children: ReactNode;
  tool: ReactNode;
  transitionKey?: string;
  hasReducedMotion?: boolean;
}
export function NavigationLayer({
  children,
  tool,
  transitionKey,
  hasReducedMotion = false,
}: NavigationLayerProps): React.JSX.Element {
  const theme = useTheme();
  const isToolOpen = Boolean(tool);
  const [progress] = useState(() => new Animated.Value(0));
  const wasToolOpen = useRef(false);
  const motion = useMemo(
    () => ({
      base: {
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -RETURN_OFFSET],
            }),
          },
        ],
      },
      tool: {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [ENTER_OFFSET, 0],
            }),
          },
        ],
      },
    }),
    [progress],
  );
  useLayoutEffect(() => {
    if (!isToolOpen && !wasToolOpen.current) {
      progress.setValue(0);
      return;
    }
    wasToolOpen.current = isToolOpen;
    if (isToolOpen) Keyboard.dismiss();
    if (hasReducedMotion) {
      progress.setValue(isToolOpen ? 1 : 0);
      return;
    }
    if (isToolOpen) progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: isToolOpen ? 1 : 0,
      duration: isToolOpen ? ENTER_DURATION_MS : RETURN_DURATION_MS,
      easing: NATIVE_SCENE_EASING,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [isToolOpen, transitionKey, hasReducedMotion, progress]);
  return (
    <View style={styles.fill}>
      <Animated.View
        style={[styles.fill, motion.base]}
        pointerEvents={isToolOpen ? "none" : "auto"}
        accessibilityElementsHidden={isToolOpen}
        importantForAccessibility={isToolOpen ? "no-hide-descendants" : "auto"}
      >
        {children}
      </Animated.View>
      {isToolOpen ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.colors.background },
            motion.tool,
          ]}
        >
          {tool}
        </Animated.View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({ fill: { flex: 1 } });

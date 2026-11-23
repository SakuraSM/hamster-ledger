import { useContext, useEffect, useRef, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTheme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import { AtlasEffects } from "./AtlasGlass";
export function AtlasBand({
  groups,
}: {
  groups: { label: string; value: number }[];
}) {
  const theme = useTheme(),
    allowed = useContext(AtlasEffects) && theme.animation.scale !== 0;
  const [width, setWidth] = useState(0),
    phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!allowed || !width) return;
    phase.setValue(0);
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(3300),
        Animated.timing(phase, {
          toValue: 1,
          duration: 2450,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [allowed, phase, width]);
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible={false}
      style={{
        height: 12,
        flexDirection: "row",
        gap: 2,
        borderRadius: 5,
        overflow: "hidden",
      }}
    >
      {groups.map((g, i) => (
        <View
          key={g.label}
          style={{
            flex: g.value,
            backgroundColor:
              tokens.chart.categories[i % tokens.chart.categories.length],
          }}
        />
      ))}
      {allowed && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              width: 72,
              transform: [
                {
                  translateX: phase.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-72, width],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="reflection" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="white" stopOpacity={0} />
                <Stop offset=".5" stopColor="white" stopOpacity={0.55} />
                <Stop offset="1" stopColor="white" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#reflection)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { BottomNavigation, useTheme } from "react-native-paper";
import { AppIcon } from "./Icons";
export const NAVIGATION_BAR_HEIGHT = 80;
const NAVIGATION_ICON_SIZE = 24;
const MAX_LABEL_FONT_SCALE = 1.3;
import { NATIVE_SCENE_EASING } from "./motion";
export const APP_ROUTES = [
  {
    key: "overview",
    title: "总览",
    header: "总览",
    focusedIcon: "home-outline",
  },
  {
    key: "records",
    title: "账单",
    header: "全部账单",
    focusedIcon: "format-list-bulleted",
  },
  {
    key: "assets",
    title: "资产",
    header: "资产管理",
    focusedIcon: "wallet-outline",
  },
  {
    key: "reports",
    title: "报表",
    header: "收支报表",
    focusedIcon: "chart-pie",
  },
  {
    key: "tools",
    title: "更多",
    header: "更多功能",
    focusedIcon: "dots-horizontal",
  },
];
export type AppRoute = (typeof APP_ROUTES)[number];
interface AppNavigationProps {
  index: number;
  onIndexChange: (index: number) => void;
  renderScene: (input: { route: AppRoute }) => ReactNode;
  hasReducedMotion: boolean;
  bottomInset: number;
}
function renderNavigationIcon({
  route,
  focused,
  color,
}: {
  route: AppRoute;
  focused: boolean;
  color: string;
}): React.JSX.Element {
  return (
    <AppIcon
      name={route.focusedIcon}
      size={NAVIGATION_ICON_SIZE}
      color={color}
      weight={focused ? "fill" : "regular"}
    />
  );
}
export function AppNavigation({
  index,
  onIndexChange,
  renderScene,
  hasReducedMotion,
  bottomInset,
}: AppNavigationProps): React.JSX.Element {
  const theme = useTheme();
  return (
    <BottomNavigation
      navigationState={{ index, routes: APP_ROUTES }}
      onIndexChange={onIndexChange}
      renderScene={renderScene}
      renderIcon={renderNavigationIcon}
      getAccessibilityLabel={({ route }) => route.title}
      sceneAnimationEnabled={!hasReducedMotion}
      sceneAnimationEasing={NATIVE_SCENE_EASING}
      activeColor={theme.colors.onSecondaryContainer}
      inactiveColor={theme.colors.onSurfaceVariant}
      activeIndicatorStyle={{
        backgroundColor: theme.colors.secondaryContainer,
      }}
      barStyle={{
        backgroundColor: theme.colors.elevation.level2,
        borderTopColor: theme.colors.outlineVariant,
        borderTopWidth: StyleSheet.hairlineWidth,
      }}
      safeAreaInsets={{ left: 0, right: 0, bottom: bottomInset }}
      labelMaxFontSizeMultiplier={MAX_LABEL_FONT_SCALE}
      labeled
      shifting={false}
      keyboardHidesNavigationBar
    />
  );
}
